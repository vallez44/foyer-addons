'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { HAConnection } = require('../lib/ha');
const { HASource } = require('../lib/sources');
const { Home } = require('../lib/home');
const { defaultSettings } = require('../lib/store');
const { suggestLayouts } = require('../lib/suggest');
const { silent, realisticHome, makeFakeWs, fakeFetch, until, st } = require('./helpers');

function connect(home, token = 'good', fetchImpl) {
  const FakeWS = makeFakeWs(home);
  const conn = new HAConnection({
    wsUrl: 'ws://supervisor/core/websocket', restUrl: 'http://supervisor/core/api', token, log: silent, WebSocketImpl: FakeWS,
    fetchImpl: fetchImpl || fakeFetch([
      [/\/calendars\/calendar\.personnel\?start=/, [{ summary: 'Dentiste', start: { dateTime: new Date().toISOString() }, end: { dateTime: new Date(Date.now() + 3600e3).toISOString() } }]],
      [/\/api\/media_player_proxy\//, 'PNGDATA', 'image/png'],
    ]),
  });
  const settings = defaultSettings();
  const model = new Home({ source: new HASource(conn), log: silent, settings: () => settings });
  return { FakeWS, conn, model, settings };
}

test('loads a Home Assistant home over the WebSocket API and keeps only what a wall display may show', async (t) => {
  const { model, conn, FakeWS } = connect(realisticHome());
  t.after(() => model ? model.stop() : conn.stop());
  model.start();
  await until(() => model.ready && model.blocks.calendar && model.blocks.todo && model.blocks.weather && model.blocks.weather.daily.length);

  const ids = model.eligibleIds();
  assert.ok(ids.includes('light.lampe_1'));
  assert.ok(ids.includes('binary_sensor.capteur_porte_entree_contact'));
  assert.ok(!ids.includes('switch.zigbee2mqtt_bridge_permit_join'), 'config entities are hidden');
  assert.ok(!ids.includes('binary_sensor.capteur_porte_entree_battery_low'), 'diagnostic entities are hidden');
  assert.ok(!ids.includes('button.nas_shut_down'), 'config buttons are hidden');
  assert.ok(!ids.includes('update.home_assistant_core_update'), 'updates never reach an iPad');

  // Area comes from the device; the area name is taken out of the display name.
  assert.strictEqual(model.areaOf('light.lampe_chambre_1'), 'chambre');
  assert.strictEqual(model.compact('light.lampe_chambre_1').n, 'Lampe 1');
  assert.strictEqual(model.compact('light.lampe_entree').n, 'Lampe');

  // No tokens and no GPS reach the iPad.
  const mp = model.compact('media_player.enceinte_chambre');
  assert.ok(!JSON.stringify(mp).includes('SECRET'));
  assert.match(mp.at.pic, /^api\/art\/media_player\.enceinte_chambre\?c=/);
  assert.ok(!JSON.stringify(model.compact('person.maison')).includes('48.85'));
  assert.strictEqual(model.compact('binary_sensor.capteur_porte_entree_contact').n, 'Porte', '"Capteur Porte Entrée" in the Entrée');

  // Artwork: Home Assistant's own proxy paths (HomePods put a URL in the query), nothing else.
  const art = await model.source.picture('/api/media_player_proxy/media_player.enceinte_chambre?token=SECRET&cache=https://is1-ssl.mzstatic.com/x.jpg');
  assert.strictEqual(art.type, 'image/png');
  await assert.rejects(model.source.picture('/api/config'), /refused/);
  await assert.rejects(model.source.picture('/api/media_player_proxy/../../config'), /refused/);
  await assert.rejects(model.source.picture('https://evil.example.com/x.png'), /refused/);

  assert.strictEqual(model.blocks.calendar.events[0].title, 'Dentiste');
  assert.deepStrictEqual(model.blocks.todo.lists['todo.rappels'], { open: [{ t: 'Pain', due: null }], done: 1 });
  assert.strictEqual(model.blocks.weather.entity, 'weather.forecast_maison');

  // A state change reaches long-polling clients as a delta.
  const v = model.v;
  FakeWS.instances[0].fireState('light.lampe_1', st('light.lampe_1', 'on', { friendly_name: 'Lampe 1', brightness: 255 }));
  await until(() => model.v > v);
  const d = model.delta(v, model.epoch);
  assert.strictEqual(d.e['light.lampe_1'].s, 'on');
  assert.strictEqual(model.delta(v, 'other-epoch'), null, 'an old epoch must reload');

  // Changes of hidden entities are not sent.
  const v2 = model.v;
  FakeWS.instances[0].fireState('switch.zigbee2mqtt_bridge_permit_join', st('switch.zigbee2mqtt_bridge_permit_join', 'on'));
  await new Promise((r) => setTimeout(r, 30));
  assert.strictEqual(model.v, v2);
});

test('suggests the same kind of layout as the reference for this home', async (t) => {
  const { model, conn, settings } = connect(realisticHome());
  t.after(() => model ? model.stop() : conn.stop());
  model.start();
  await until(() => model.ready);
  const { home_plus: plus, home } = suggestLayouts(model, settings);
  // No thermostat: clock and weather on top, then the photo.
  assert.deepStrictEqual(plus.slice(0, 3).map((x) => `${x.type}:${x.size}`), ['clock:M', 'weather:M', 'photo:L']);
  assert.deepStrictEqual(plus[3], { type: 'agenda', size: 'W' });
  assert.deepStrictEqual(plus.slice(4, 6).map((x) => x.type), ['room', 'room']);
  assert.deepStrictEqual(plus[6], { type: 'action', action: 'all_off', size: 'W' });
  const small = plus.filter((x) => x.size === 'S').map((x) => x.entity);
  assert.ok(small.includes('binary_sensor.capteur_porte_entree_contact'));
  assert.ok(small.indexOf('light.lampe_sdb') === -1 || small.indexOf('light.lampe_sdb') === small.length - 1, 'an offline lamp goes last');
  assert.strictEqual(home[0].type, 'weather');
  assert.ok(home.every((x) => x.entity !== 'button.nas_shut_down'));
});

test('refused sign-in is reported and retried slowly', async (t) => {
  const { conn } = connect(realisticHome(), 'wrong');
  t.after(() => conn.stop());
  conn.start();
  await until(() => conn.authFailed);
  assert.strictEqual(conn.connected, false);
});

test('reconnects after Home Assistant restarts and reloads everything', async (t) => {
  const { model, conn, FakeWS } = connect(realisticHome());
  t.after(() => model ? model.stop() : conn.stop());
  model.start();
  await until(() => model.ready);
  const epoch = model.epoch;
  conn.backoff = 5;
  FakeWS.instances[0].close();
  await until(() => !model.ready);
  await until(() => model.ready && FakeWS.instances.length === 2, 3000);
  assert.notStrictEqual(model.epoch, epoch, 'clients are told to reload');
});
