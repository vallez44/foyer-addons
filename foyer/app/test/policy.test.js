'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveAction, PolicyError } = require('../lib/policy');
const { st } = require('./helpers');

function fakeHome(states, areas = { 'light.salon': 'salon', 'light.cuisine': 'cuisine', 'light.salon2': 'salon' }) {
  const map = new Map(states.map((s) => [s.entity_id, s]));
  return {
    states: map,
    areas: [{ id: 'salon' }, { id: 'cuisine' }],
    isEligible: (id) => map.has(id) && !id.startsWith('update.'),
    eligibleIds: () => [...map.keys()],
    areaOf: (id) => areas[id] || null,
  };
}

const home = fakeHome([
  st('light.salon', 'on', { brightness: 200 }), st('light.salon2', 'off'), st('light.cuisine', 'on'),
  st('lock.porte', 'locked'), st('cover.garage', 'closed', { device_class: 'garage' }), st('cover.volets', 'closed', { device_class: 'shutter' }),
  st('climate.salon', 'heat', { hvac_modes: ['off', 'heat'] }), st('script.reboot_nas', 'off'), st('alarm_control_panel.maison', 'armed_away'),
  st('update.core', 'on'), st('media_player.salon', 'playing'),
]);
const ctx = { fromHa: false, admin: false };
const base = { ctx, home, layoutEntities: new Set(), settings: { sensitiveFromHaOnly: false } };
const run = (req, extra = {}) => resolveAction(req, { ...base, ...extra });

test('ordinary actions are passed on with checked fields only', () => {
  assert.deepStrictEqual(run({ entity_id: 'light.salon', service: 'turn_on', data: { brightness_pct: 42.4, transition: 99, flash: 'long' } }), [
    { domain: 'light', service: 'turn_on', data: { brightness_pct: 42 }, target: { entity_id: 'light.salon' } },
  ]);
  assert.deepStrictEqual(run({ entity_id: 'climate.salon', service: 'set_hvac_mode', data: { hvac_mode: 'heat' } })[0].data, { hvac_mode: 'heat' });
  assert.deepStrictEqual(run({ entity_id: 'media_player.salon', service: 'volume_set', data: { volume_level: 0.33333 } })[0].data, { volume_level: 0.333 });
  // Playing something on a speaker: only the media itself is passed on (no announce, no extra options).
  const play = { media_content_id: 'radio:1', media_content_type: 'audio/mpeg', extra: { announce: true }, announce: true };
  assert.deepStrictEqual(run({ entity_id: 'media_player.salon', service: 'play_media', data: play })[0].data,
    { media_content_id: 'radio:1', media_content_type: 'audio/mpeg' });
});

test('anything that changes Home Assistant itself is refused', () => {
  const refused = [
    { entity_id: 'update.core', service: 'install' },
    { entity_id: 'light.salon', service: 'delete' },
    { entity_id: 'homeassistant.restart', service: 'restart' },
    { entity_id: 'light.salon', service: '__proto__' },
    { entity_id: 'light.salon; rm -rf', service: 'toggle' },
    { entity_id: 'light.unknown', service: 'toggle' },
  ];
  for (const req of refused) assert.throws(() => run(req), PolicyError, JSON.stringify(req));
});

test('invalid values are refused, not clamped', () => {
  assert.throws(() => run({ entity_id: 'light.salon', service: 'turn_on', data: { brightness_pct: 400 } }), /invalid brightness_pct/);
  assert.throws(() => run({ entity_id: 'climate.salon', service: 'set_hvac_mode', data: { hvac_mode: 'cool' } }), /invalid hvac_mode/);
  assert.throws(() => run({ entity_id: 'lock.porte', service: 'unlock', data: { code: '12 34' } }), /invalid code/);
});

test('scripts and buttons run only once the owner put them on a face', () => {
  assert.throws(() => run({ entity_id: 'script.reboot_nas', service: 'turn_on' }), /placed on a face/);
  assert.strictEqual(run({ entity_id: 'script.reboot_nas', service: 'turn_on' }, { layoutEntities: new Set(['script.reboot_nas']) }).length, 1);
});

test('locks, alarms and garage doors can be limited to Home Assistant itself', () => {
  const locked = { settings: { sensitiveFromHaOnly: true } };
  assert.throws(() => run({ entity_id: 'lock.porte', service: 'unlock' }, locked), /only from Home Assistant/);
  assert.throws(() => run({ entity_id: 'cover.garage', service: 'open_cover' }, locked), /only from Home Assistant/);
  assert.throws(() => run({ entity_id: 'alarm_control_panel.maison', service: 'alarm_disarm' }, locked), /only from Home Assistant/);
  // Closing, locking and arming stay possible; shutters are not garage doors.
  assert.strictEqual(run({ entity_id: 'lock.porte', service: 'lock' }, locked).length, 1);
  assert.strictEqual(run({ entity_id: 'cover.garage', service: 'close_cover' }, locked).length, 1);
  assert.strictEqual(run({ entity_id: 'cover.volets', service: 'open_cover' }, locked).length, 1);
  // From Home Assistant's sidebar, everything works.
  assert.strictEqual(run({ entity_id: 'lock.porte', service: 'unlock' }, { ...locked, ctx: { fromHa: true } }).length, 1);
});

test('room and whole-home actions only touch lights', () => {
  assert.deepStrictEqual(run({ action: 'all_off' }), [{ domain: 'light', service: 'turn_off', data: {}, target: { entity_id: ['light.salon', 'light.cuisine'] } }]);
  assert.deepStrictEqual(run({ action: 'room_toggle', area: 'salon' }), [{ domain: 'light', service: 'turn_off', data: {}, target: { entity_id: ['light.salon'] } }]);
  assert.throws(() => run({ action: 'room_toggle', area: 'garage' }), /unknown room/);
});
