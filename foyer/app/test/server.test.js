'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const { createApp } = require('../server');
const { loadConfig } = require('../lib/config');
const { DemoSource } = require('../lib/demo');
const { silent, tmpDir, until } = require('./helpers');

function request(port, method, urlPath, { body, headers = {}, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const h = { Host: `localhost:${port}`, ...headers };
    if (cookie) h.Cookie = cookie;
    let payload;
    if (body !== undefined) {
      payload = Buffer.from(JSON.stringify(body));
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = payload.length;
    }
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function startApp(overrides) {
  const dir = tmpDir();
  const cfg = {
    ...loadConfig({ FOYER_DATA_DIR: dir, FOYER_MEDIA_DIR: dir }),
    port: 0, publicDir: path.join(__dirname, '..', 'public'), ...overrides,
  };
  const source = new DemoSource({ log: silent });
  const app = createApp(cfg, { source });
  // Quiet logs for the test run.
  await new Promise((r) => {
    app.home.start();
    app.server.listen(0, '127.0.0.1', r);
  });
  await until(() => app.home.ready);
  await until(() => app.home.extraBlocks.layout || (app.home.emit('loaded'), false), 2000).catch(() => {});
  return { app, port: app.server.address().port };
}

test('standalone: screens pair with a code, everything else needs the device cookie', async (t) => {
  const { app, port } = await startApp({ mode: 'standalone', isAddon: false });
  t.after(() => app.stop());

  assert.strictEqual((await request(port, 'GET', '/')).status, 200, 'the page itself loads before pairing');
  assert.strictEqual((await request(port, 'GET', '/api/snapshot')).status, 401);
  assert.strictEqual((await request(port, 'GET', '/api/session', { headers: { Host: 'evil.example.com' } })).status, 421, 'DNS rebinding');
  assert.strictEqual((await request(port, 'POST', '/api/pair', { body: { code: '1' } })).status, 403, 'requests without the Foyer header are refused');

  const H = { 'X-Foyer': '1' };
  const bad = await request(port, 'POST', '/api/pair', { body: { code: '12345678' }, headers: H });
  assert.strictEqual(bad.status, 401);

  const admin = app.pairing.createCode('log');
  const ok = await request(port, 'POST', '/api/pair', { body: { code: admin.display }, headers: { ...H, 'User-Agent': 'iPad' } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.json.admin, true, 'the first screen in standalone is the admin');
  const cookie = ok.headers['set-cookie'][0].split(';')[0];
  assert.match(ok.headers['set-cookie'][0], /HttpOnly/);

  const snap = await request(port, 'GET', '/api/snapshot', { cookie });
  assert.strictEqual(snap.status, 200);
  assert.ok(snap.json.entities['light.lampadaire_salon']);
  assert.ok(snap.json.blocks.layout.tiles.home_plus.length > 5);
  assert.strictEqual((await request(port, 'GET', '/api/admin/settings', { cookie })).status, 200);

  // A second screen is not an admin.
  const c2 = app.pairing.createCode('setup');
  const ok2 = await request(port, 'POST', '/api/pair', { body: { code: c2.code }, headers: H });
  const cookie2 = ok2.headers['set-cookie'][0].split(';')[0];
  const refused = await request(port, 'GET', '/api/admin/settings', { cookie: cookie2 });
  assert.strictEqual(refused.status, 403);
  assert.match(refused.json.error, /Ask the person/);

  // Long-poll wakes up when a light changes.
  const s = snap.json;
  const pollP = request(port, 'GET', `/api/poll?v=${s.v}&e=${s.epoch}`, { cookie: cookie2 });
  const act = await request(port, 'POST', '/api/action', { body: { entity_id: 'light.chevet', service: 'toggle' }, headers: H, cookie: cookie2 });
  assert.strictEqual(act.status, 200);
  const poll = await pollP;
  assert.strictEqual(poll.json.e['light.chevet'].s, 'on');

  // Refused actions say why.
  const no = await request(port, 'POST', '/api/action', { body: { entity_id: 'light.chevet', service: 'set_config' }, headers: H, cookie: cookie2 });
  assert.strictEqual(no.status, 403);

  // Removing a screen stops it at once.
  const dev2 = app.pairing.list().find((d) => !d.admin);
  assert.strictEqual((await request(port, 'DELETE', `/api/admin/devices/${dev2.id}`, { headers: H, cookie })).status, 200);
  assert.strictEqual((await request(port, 'GET', '/api/snapshot', { cookie: cookie2 })).status, 401);
});

test('add-on: requests from the ingress proxy are Home Assistant users; pictures stay inside their folder', async (t) => {
  const { app, port } = await startApp({ mode: 'addon', isAddon: true, ingressProxyIp: '127.0.0.1' });
  t.after(() => app.stop());
  const s = await request(port, 'GET', '/api/session', { headers: { 'X-Ingress-Path': '/api/hassio_ingress/abc' } });
  assert.strictEqual(s.json.kind, 'ingress');
  assert.strictEqual(s.json.admin, true);
  const settings = await request(port, 'GET', '/api/admin/settings');
  assert.strictEqual(settings.status, 200);
  assert.ok(settings.json.suggested.home_plus.length > 5);

  const put = await request(port, 'PUT', '/api/admin/settings', { body: { wallpaper: 'ocean', faces: [{ id: 'clock', on: true }] }, headers: { 'X-Foyer': '1' } });
  assert.strictEqual(put.json.settings.wallpaper, 'ocean');
  assert.strictEqual(app.home.extraBlocks.settings.wallpaper, 'ocean', 'iPads get the new settings');

  assert.strictEqual((await request(port, 'GET', '/photos/..%2F..%2Fetc%2Fpasswd')).status, 404);
  assert.strictEqual((await request(port, 'GET', '/js/../../server.js')).status, 404);
  assert.strictEqual((await request(port, 'GET', '/api/camera/camera.sonnette')).headers['content-type'], 'image/svg+xml');
  assert.strictEqual((await request(port, 'GET', '/api/camera/light.chevet')).status, 404);
  const page = await request(port, 'GET', '/');
  assert.match(page.headers['content-security-policy'], /script-src 'self'/);
  assert.strictEqual(page.headers['content-encoding'], undefined, 'no compression through ingress');
});
