'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../public/js/layout');
const { sanitizeSettings, defaultSettings } = require('../lib/store');
const { isAllowedHost, isPrivateIp } = require('../lib/util');

test('tiles are placed in order in the first free spot; what does not fit is left out', () => {
  const tiles = [
    { size: 'M', id: 'clock' }, { size: 'M', id: 'weather' }, { size: 'L', id: 'photo' }, { size: 'W', id: 'agenda' },
    { size: 'W', id: 'room1' }, { size: 'W', id: 'room2' }, { size: 'W', id: 'off' },
    ...Array.from({ length: 9 }, (_, i) => ({ size: 'S', id: `s${i}` })),
  ];
  const placed = L.place(tiles, 7, 4);
  const at = Object.fromEntries(placed.map((p) => [p.tile.id, [p.x, p.y, p.w, p.h]]));
  assert.deepStrictEqual(at.clock, [0, 0, 2, 2]);
  assert.deepStrictEqual(at.weather, [2, 0, 2, 2]);
  assert.deepStrictEqual(at.photo, [4, 0, 3, 2]);
  assert.deepStrictEqual(at.off, [0, 3, 2, 1]);
  assert.strictEqual(placed.length, 7 + 6, 'six small tiles fit, three are left out');
  const cells = placed.reduce((n, p) => n + p.w * p.h, 0);
  assert.strictEqual(cells, 28, 'the 7×4 grid is full');
});

test('portrait grids are the landscape ones turned', () => {
  assert.deepStrictEqual(L.gridFor('home_plus', true), [7, 4]);
  assert.deepStrictEqual(L.gridFor('home_plus', false), [4, 7]);
  assert.deepStrictEqual(L.gridFor('home', true), [4, 3]);
  assert.strictEqual(L.place([{ size: 'XL' }], 3, 4)[0].w, 3, 'a tile wider than the grid shrinks');
});

test('settings from the settings page are checked', () => {
  const cur = defaultSettings();
  const next = sanitizeSettings({
    faces: [{ id: 'clock', on: true }, { id: 'evil', on: true }],
    startFace: 'nope',
    layouts: { home: [{ type: 'entity', entity: 'light.x', size: 'S' }, { type: 'iframe', url: 'http://x' }, { type: 'room', area: '../etc' }], hacked: [] },
    night: { from: '25:00', to: '06:30', dim: 3 },
    photoInterval: 5,
    calendars: ['calendar.a', 'not an id'],
    wallpaper: 'neon',
  }, cur);
  assert.strictEqual(next.faces[0].id, 'clock');
  assert.strictEqual(next.faces.length, 10);
  assert.ok(!next.faces.some((f) => f.id === 'evil'));
  assert.strictEqual(next.startFace, 'home_plus');
  assert.deepStrictEqual(next.layouts.home, [{ type: 'entity', entity: 'light.x', size: 'S' }, { type: 'room', size: 'S' }]);
  assert.ok(!('hacked' in next.layouts));
  assert.strictEqual(next.night.from, '22:30');
  assert.strictEqual(next.night.to, '06:30');
  assert.strictEqual(next.night.dim, 0.4);
  assert.strictEqual(next.photoInterval, 300);
  assert.deepStrictEqual(next.calendars, ['calendar.a']);
  assert.strictEqual(next.wallpaper, 'amber');
});

test('only home-network addresses and names are answered on the direct port', () => {
  for (const ip of ['192.168.1.20', '10.1.2.3', '172.20.0.1', '100.101.102.103', '::ffff:192.168.0.4', 'fd7a:115c:a1e0::1', '127.0.0.1']) {
    assert.ok(isPrivateIp(ip), ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '2001:4860::1', '100.128.0.1']) assert.ok(!isPrivateIp(ip), ip);
  for (const host of ['192.168.1.20:8110', 'homeassistant.local:8110', 'ipad-salon', 'maison.ts.net', 'ha.home.arpa', '[fd00::1]:8110']) {
    assert.ok(isAllowedHost(host), host);
  }
  for (const host of ['evil.example.com', 'attacker.com:8110', '', 'a b']) assert.ok(!isAllowedHost(host), host);
  assert.ok(isAllowedHost('foyer.maison.fr', ['foyer.maison.fr']));
});
