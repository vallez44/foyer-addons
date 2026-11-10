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
    if (Buffer.isBuffer(body)) {
      payload = body;
      h['Content-Length'] = payload.length;
    } else if (body !== undefined) {
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

  // Any screen can arrange the tiles on the screen itself; only the admin can put a script or a button on a face.
  const tiles = [{ type: 'clock', size: 'M' }, { type: 'entity', entity: 'light.chevet', size: 'W' }, { type: 'entity', entity: 'script.reboot', size: 'S' }];
  const arranged = await request(port, 'PUT', '/api/arrange', { body: { face: 'home', tiles }, headers: H, cookie: cookie2 });
  assert.strictEqual(arranged.status, 200);
  assert.deepStrictEqual(arranged.json.tiles.map((x) => `${x.type}:${x.entity || ''}:${x.size}`), ['clock::M', 'entity:light.chevet:W']);
  assert.strictEqual(app.home.extraBlocks.layout.auto.home, false, 'every screen gets the new layout');
  const byAdmin = await request(port, 'PUT', '/api/arrange', { body: { face: 'home', tiles }, headers: H, cookie });
  assert.strictEqual(byAdmin.json.tiles.length, 3);
  assert.strictEqual((await request(port, 'PUT', '/api/arrange', { body: { face: 'photos', tiles }, headers: H, cookie: cookie2 })).status, 400);
  const back = await request(port, 'PUT', '/api/arrange', { body: { face: 'home', tiles: null, wallpaper: 'sage' }, headers: H, cookie: cookie2 });
  assert.strictEqual(back.json.auto, true, 'back to the suggested layout');
  assert.strictEqual(back.json.wallpaper, 'sage');

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

test('screens: their own preferences, music on the speakers, calendar and reminders, an installable page', async (t) => {
  const { app, port } = await startApp({ mode: 'standalone', isAddon: false });
  t.after(() => app.stop());
  const H = { 'X-Foyer': '1' };
  const first = await request(port, 'POST', '/api/pair', { body: { code: app.pairing.createCode('log').display }, headers: H });
  const admin = first.headers['set-cookie'][0].split(';')[0];
  const second = await request(port, 'POST', '/api/pair', { body: { code: app.pairing.createCode('setup').code }, headers: H });
  const cookie = second.headers['set-cookie'][0].split(';')[0];

  // Settings inside the dashboard: any screen changes the screen preferences, only the admin changes security.
  const prefs = {
    wallpaper: 'lavender', defaultCalendar: 'calendar.travail', sensitiveFromHaOnly: true,
    apps: { apple: { music: true, calendar: true, bogus: true }, hidden: { podcasts: true } },
  };
  const put = await request(port, 'PUT', '/api/prefs', { body: prefs, headers: H, cookie });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.json.settings.wallpaper, 'lavender');
  assert.strictEqual(put.json.settings.defaultCalendar, 'calendar.travail');
  assert.deepStrictEqual(put.json.settings.apps, { apple: { music: true, calendar: true }, hidden: { podcasts: true } });
  assert.strictEqual(put.json.settings.sensitiveFromHaOnly, false, 'security stays with Home Assistant and the first screen');
  assert.strictEqual(app.home.extraBlocks.settings.wallpaper, 'lavender', 'every screen gets it');
  const byAdmin = await request(port, 'PUT', '/api/prefs', { body: { sensitiveFromHaOnly: true }, headers: H, cookie: admin });
  assert.strictEqual(byAdmin.json.settings.sensitiveFromHaOnly, true);
  assert.strictEqual((await request(port, 'PUT', '/api/prefs', { body: { wallpaper: 'ocean' }, cookie })).status, 403, 'the Foyer header is required');

  // Music: what a speaker can play, then playing it there.
  const root = await request(port, 'GET', '/api/browse?entity_id=media_player.enceinte_salon', { cookie });
  assert.strictEqual(root.status, 200);
  const folder = root.json.children.find((c) => c.open);
  const inside = await request(port, 'GET', `/api/browse?entity_id=media_player.enceinte_salon&id=${encodeURIComponent(folder.id)}&type=${encodeURIComponent(folder.type)}`, { cookie });
  const item = inside.json.children.find((c) => c.play);
  assert.ok(item, 'something to play');
  const play = { entity_id: 'media_player.enceinte_salon', service: 'play_media', data: { media_content_id: item.id, media_content_type: item.type } };
  assert.strictEqual((await request(port, 'POST', '/api/action', { body: play, headers: H, cookie })).status, 200);
  await until(() => app.home.states.get('media_player.enceinte_salon').attributes.media_title === item.title, 2000);
  assert.strictEqual((await request(port, 'GET', '/api/browse?entity_id=light.chevet', { cookie })).status, 404, 'only speakers');
  assert.ok(!root.json.children.some((c) => /^media-source:\/\/camera/.test(c.id)), 'no cameras among the music');

  // Search (Apple Music through Music Assistant at home; the demo searches its own music).
  const found = await request(port, 'GET', '/api/search?entity_id=media_player.enceinte_salon&q=jazz', { cookie });
  assert.strictEqual(found.status, 200);
  assert.ok(found.json.children.some((c) => c.title === 'Jazz du soir' && c.play));
  assert.strictEqual((await request(port, 'GET', '/api/search?entity_id=media_player.enceinte_salon&q=%20', { cookie })).status, 400);
  assert.strictEqual((await request(port, 'GET', '/api/search?entity_id=light.chevet&q=jazz', { cookie })).status, 404, 'only speakers search');
  const odd = { ...play, data: { media_content_id: { url: 'x' }, media_content_type: 'music' } };
  assert.strictEqual((await request(port, 'POST', '/api/action', { body: odd, headers: H, cookie })).status, 400, 'fields are checked');

  // A new calendar event and a reminder.
  const ev = { summary: 'Dîner chez Léa', start_date_time: '2026-11-12T19:30:00', end_date_time: '2026-11-12T21:30:00', location: 'Nantes' };
  assert.strictEqual((await request(port, 'POST', '/api/action', { body: { entity_id: 'calendar.famille', service: 'create_event', data: ev }, headers: H, cookie })).status, 200);
  const badEv = { entity_id: 'calendar.famille', service: 'create_event', data: { summary: 'x', start_date_time: 'tomorrow' } };
  assert.strictEqual((await request(port, 'POST', '/api/action', { body: badEv, headers: H, cookie })).status, 400);
  const add = { entity_id: 'todo.courses', service: 'add_item', data: { item: 'Farine' } };
  assert.strictEqual((await request(port, 'POST', '/api/action', { body: add, headers: H, cookie })).status, 200);
  const removeAll = { entity_id: 'todo.courses', service: 'remove_completed_items', data: {} };
  assert.strictEqual((await request(port, 'POST', '/api/action', { body: removeAll, headers: H, cookie })).status, 403);

  // Settings live in the dashboard now; Android's Chrome can install the page like an app.
  const old = await request(port, 'GET', '/settings', { cookie });
  assert.strictEqual(old.status, 302);
  assert.strictEqual(old.headers.location, './?settings=1');
  const man = await request(port, 'GET', '/manifest.webmanifest?start=%2F');
  assert.strictEqual(man.status, 200);
  assert.strictEqual(man.json.start_url, '/');
  assert.strictEqual(man.json.display, 'standalone');
  const evil = await request(port, 'GET', `/manifest.webmanifest?start=${encodeURIComponent('//evil.example.com/')}`);
  assert.strictEqual(evil.json.start_url, './', 'start stays on this server');
  for (const icon of man.json.icons) assert.strictEqual((await request(port, 'GET', `/${icon.src}`)).status, 200);
});

test('screens: your own wallpaper, kept at home and shown on every screen', async (t) => {
  const { app, port } = await startApp({ mode: 'standalone', isAddon: false });
  t.after(() => app.stop());
  const H = { 'X-Foyer': '1' };
  const first = await request(port, 'POST', '/api/pair', { body: { code: app.pairing.createCode('log').display }, headers: H });
  const cookie = first.headers['set-cookie'][0].split(';')[0];
  assert.strictEqual(app.home.extraBlocks.settings.alarmSiren, true, 'the screens know whether to sound the siren');

  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
  const up = await request(port, 'POST', '/api/wallpaper', { body: jpeg, headers: { ...H, 'Content-Type': 'image/jpeg' }, cookie });
  assert.strictEqual(up.status, 200);
  assert.strictEqual(app.home.extraBlocks.settings.wallpaper, 'custom');
  assert.strictEqual(app.home.extraBlocks.settings.wallpaperV, up.json.wallpaperV);
  const pic = await request(port, 'GET', `/wallpaper?v=${up.json.wallpaperV}`, { cookie });
  assert.strictEqual(pic.status, 200);
  assert.strictEqual(pic.headers['content-type'], 'image/jpeg');
  assert.strictEqual((await request(port, 'GET', '/wallpaper')).status, 401, 'only for the screens of the home');
  assert.strictEqual((await request(port, 'POST', '/api/wallpaper', { body: Buffer.from('not a picture'), headers: H, cookie })).status, 415);

  // Back to a colour, then to your picture again.
  await request(port, 'PUT', '/api/arrange', { body: { wallpaper: 'ocean' }, headers: H, cookie });
  assert.strictEqual(app.home.extraBlocks.settings.wallpaper, 'ocean');
  await request(port, 'PUT', '/api/arrange', { body: { wallpaper: 'custom' }, headers: H, cookie });
  assert.strictEqual(app.home.extraBlocks.settings.wallpaper, 'custom');
});
