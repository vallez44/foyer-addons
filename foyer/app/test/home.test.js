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
  assert.ok(!ids.includes('switch.foyer_releve_homepod'), 'the "Masquer dans Foyer" label hides an entity');
  assert.ok(ids.includes('switch.guirlande'), 'other switches stay');
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
  assert.deepStrictEqual(model.blocks.todo.lists['todo.rappels'], { open: [{ t: 'Pain', due: null, uid: '1' }], done: 1 });
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

test('a HomePod and its Music Assistant twin are one speaker: Apple Music goes to the twin, the buttons to what plays', async (t) => {
  const home = realisticHome();
  home.devices.push({ id: 'hp', area_id: 'salon', name: 'Compote', model: 'HomePod' }, { id: 'hpma', area_id: null, name: 'Compote', model: 'HomePod' });
  home.entities.push(
    { entity_id: 'media_player.compote_compote', device_id: 'hp', area_id: null, entity_category: null, hidden_by: null, disabled_by: null, labels: [], platform: 'apple_tv', unique_id: 'AA:BB:CC:00:11:22' },
    { entity_id: 'media_player.compote', device_id: 'hpma', area_id: null, entity_category: null, hidden_by: null, disabled_by: null, labels: [], platform: 'music_assistant', unique_id: 'apaabbcc001122' },
    { entity_id: 'media_player.mac_mini', device_id: null, area_id: null, entity_category: null, hidden_by: null, disabled_by: null, labels: [], platform: 'music_assistant', unique_id: 'ap0011aabbccdd' },
  );
  home.states.push(
    st('media_player.compote_compote', 'idle', { friendly_name: 'Compote', volume_level: 0.3, supported_features: 21437 }),
    st('media_player.compote', 'idle', { friendly_name: 'Compote', volume_level: 0.2, supported_features: 8320575, mass_player_type: 'player' }),
    st('media_player.mac_mini', 'unavailable', { friendly_name: 'Mac mini', supported_features: 8320575 }),
  );
  const { model, conn, FakeWS } = connect(home);
  t.after(() => model.stop());
  model.start();
  await until(() => model.ready);

  const ids = model.eligibleIds();
  assert.ok(ids.includes('media_player.compote_compote'), 'the HomePod stays, in its room');
  assert.ok(!ids.includes('media_player.compote'), 'its Music Assistant twin hides behind it');
  assert.ok(ids.includes('media_player.mac_mini'), 'a Music Assistant player without twin stays itself');
  let c = model.compact('media_player.compote_compote');
  assert.strictEqual(c.a, 'salon');
  assert.strictEqual(c.at.ma, true, 'it can play Apple Music now');
  assert.ok(c.at.supported_features & 4194304, 'and search');
  assert.strictEqual(model.homeInfo().caps.musicAssistant, true);
  assert.strictEqual(model.mediaTarget('media_player.compote_compote', 'play_media'), 'media_player.compote');
  assert.strictEqual(model.mediaTarget('media_player.compote_compote', 'media_play_pause'), 'media_player.compote_compote', 'nothing plays: the HomePod itself');

  // Music Assistant plays: the speaker shows it and its buttons go there.
  const v = model.v;
  FakeWS.instances[0].fireState('media_player.compote', st('media_player.compote', 'playing', { friendly_name: 'Compote', media_title: 'Clair de lune', media_artist: 'Debussy', entity_picture: '/api/media_player_proxy/media_player.compote?token=X', supported_features: 8320575 }));
  await until(() => model.v > v && model.compact('media_player.compote_compote').s === 'playing');
  c = model.compact('media_player.compote_compote');
  assert.strictEqual(c.at.media_title, 'Clair de lune');
  assert.strictEqual(c.n, 'Compote');
  assert.ok(/^api\/art\/media_player\.compote_compote\?c=/.test(c.at.pic), 'its artwork goes through the speaker');
  assert.strictEqual(model.mediaTarget('media_player.compote_compote', 'media_pause'), 'media_player.compote');
  assert.strictEqual(model.speakerFor('media_player.compote_compote'), 'media_player.compote');

  // Siri plays on the HomePod: the HomePod again.
  FakeWS.instances[0].fireState('media_player.compote', st('media_player.compote', 'idle', { friendly_name: 'Compote', supported_features: 8320575 }));
  FakeWS.instances[0].fireState('media_player.compote_compote', st('media_player.compote_compote', 'playing', { friendly_name: 'Compote', media_title: 'Radio', supported_features: 21437 }));
  await until(() => model.compact('media_player.compote_compote').at.media_title === 'Radio');
  assert.strictEqual(model.mediaTarget('media_player.compote_compote', 'media_pause'), 'media_player.compote_compote');

  // Music Assistant stopped: the HomePod is on its own again.
  FakeWS.instances[0].fireState('media_player.compote', st('media_player.compote', 'unavailable', { friendly_name: 'Compote' }));
  await until(() => model.libraryFor('media_player.compote_compote') === 'media_player.compote_compote');
  assert.ok(!model.compact('media_player.compote_compote').at.ma);

  // Searching Apple Music through Home Assistant.
  const found = await model.source.searchMedia('media_player.compote', 'clair');
  assert.strictEqual(found[0].title, 'Clair de lune');
  const call = FakeWS.calls.find((m) => m.service === 'search_media');
  assert.deepStrictEqual(call.service_data, { search_query: 'clair' });
  assert.strictEqual(call.return_response, true);
});
