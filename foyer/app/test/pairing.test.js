'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Store } = require('../lib/store');
const { Pairing } = require('../lib/pairing');
const { silent, tmpDir } = require('./helpers');

function make(config = {}, now = () => Date.now()) {
  const store = new Store(tmpDir());
  return { store, p: new Pairing({ store, config: { fixedPairingCode: '', ...config }, log: silent, now }) };
}

test('a setup code works once', () => {
  const { p } = make();
  const { code } = p.createCode('setup');
  const { device, token } = p.pair({ code, ip: '192.168.1.20', ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)' });
  assert.strictEqual(device.name, 'iPad');
  assert.strictEqual(p.deviceByToken(token).id, device.id);
  assert.throws(() => p.pair({ code, ip: '192.168.1.21' }), /wrong code/);
});

test('eight wrong codes make that device wait, not the others', () => {
  const { p } = make();
  const { code } = p.createCode('setup');
  for (let i = 0; i < 8; i += 1) assert.throws(() => p.pair({ code: '00000000', ip: '10.0.0.9' }), /wrong code/);
  assert.throws(() => p.pair({ code, ip: '10.0.0.9' }), (e) => e.status === 429 && e.retryAfter > 0);
  assert.ok(p.pair({ code, ip: '10.0.0.10' }).token, 'another device still pairs');
});

test('codes expire after 7 days and idle devices after 90 days', () => {
  let t = Date.now();
  const { p } = make({}, () => t);
  const { code } = p.createCode('setup');
  t += 8 * 86400000;
  assert.throws(() => p.pair({ code, ip: '10.0.0.1' }), /wrong code/);
  const fresh = p.createCode('setup');
  const { token } = p.pair({ code: fresh.code, ip: '10.0.0.1' });
  t += 89 * 86400000;
  assert.ok(p.deviceByToken(token), 'still paired after 89 days');
  t += 89 * 86400000;
  assert.ok(p.deviceByToken(token), 'each use starts the 90 days again');
  t += 91 * 86400000;
  assert.strictEqual(p.deviceByToken(token), null);
});

test('a fixed code can pair several screens; changing it forgets them all', () => {
  const dir = tmpDir();
  const store = new Store(dir);
  const p1 = new Pairing({ store, config: { fixedPairingCode: '12345678' }, log: silent });
  p1.pair({ code: '1234 5678', ip: '10.0.0.1' });
  p1.pair({ code: '12345678', ip: '10.0.0.2' });
  assert.strictEqual(p1.list().length, 2);
  const store2 = new Store(dir);
  const p2 = new Pairing({ store: store2, config: { fixedPairingCode: '87654321' }, log: silent });
  assert.strictEqual(p2.list().length, 0);
});

test('in standalone mode the first screen becomes the admin, removal is immediate', () => {
  const { p } = make();
  const a = p.pair({ code: p.createCode('log').code, ip: '10.0.0.1', standalone: true });
  const b = p.pair({ code: p.createCode('setup').code, ip: '10.0.0.2', standalone: true });
  assert.strictEqual(a.device.admin, true);
  assert.strictEqual(b.device.admin, false);
  p.makeAdmin(b.device.id);
  assert.deepStrictEqual(p.list().map((d) => d.admin), [false, true]);
  p.remove(a.device.id);
  assert.strictEqual(p.deviceByToken(a.token), null);
});

test('only hashes are stored', () => {
  const { p, store } = make();
  const { code } = p.createCode('setup');
  const { token } = p.pair({ code, ip: '10.0.0.1' });
  const raw = JSON.stringify(store.data);
  assert.ok(!raw.includes(token));
  assert.ok(!raw.includes(code));
});
