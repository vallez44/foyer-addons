'use strict';

/**
 * What an iPad may ask Home Assistant to do. Anything not listed here is refused before it reaches
 * Home Assistant: no add-ons, users, backups, updates, settings, shell commands or new automations.
 * Each field is checked and coerced; unknown fields are dropped.
 */
const F = {
  pct: (v) => (Number.isFinite(+v) && +v >= 0 && +v <= 100 ? Math.round(+v) : undefined),
  kelvin: (v) => (Number.isFinite(+v) && +v >= 1000 && +v <= 12000 ? Math.round(+v) : undefined),
  temp: (v) => (Number.isFinite(+v) && +v >= -50 && +v <= 120 ? Math.round(+v * 10) / 10 : undefined),
  unit: (v) => (Number.isFinite(+v) && +v >= 0 && +v <= 1 ? Math.round(+v * 1000) / 1000 : undefined),
  bool: (v) => (typeof v === 'boolean' ? v : undefined),
  code: (v) => (typeof v === 'string' && /^[0-9A-Za-z]{1,16}$/.test(v) ? v : undefined),
  rgb: (v) => (Array.isArray(v) && v.length === 3 && v.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) ? v : undefined),
  hvac: (v, st) => {
    const modes = (st && st.attributes && st.attributes.hvac_modes) || [];
    return typeof v === 'string' && modes.includes(v) ? v : undefined;
  },
};

const SERVICES = {
  light: { toggle: {}, turn_off: {}, turn_on: { brightness_pct: F.pct, color_temp_kelvin: F.kelvin, rgb_color: F.rgb } },
  switch: { toggle: {}, turn_on: {}, turn_off: {} },
  input_boolean: { toggle: {}, turn_on: {}, turn_off: {} },
  fan: { toggle: {}, turn_on: {}, turn_off: {}, set_percentage: { percentage: F.pct } },
  cover: { open_cover: {}, close_cover: {}, stop_cover: {}, toggle: {}, set_cover_position: { position: F.pct } },
  lock: { lock: {}, unlock: { code: F.code }, open: { code: F.code } },
  climate: {
    set_temperature: { temperature: F.temp, target_temp_low: F.temp, target_temp_high: F.temp },
    set_hvac_mode: { hvac_mode: F.hvac },
    turn_on: {},
    turn_off: {},
  },
  media_player: {
    media_play_pause: {}, media_play: {}, media_pause: {}, media_stop: {}, media_next_track: {}, media_previous_track: {},
    volume_set: { volume_level: F.unit }, volume_mute: { is_volume_muted: F.bool }, turn_on: {}, turn_off: {},
  },
  scene: { turn_on: {} },
  script: { turn_on: {} },
  alarm_control_panel: {
    alarm_arm_home: { code: F.code }, alarm_arm_away: { code: F.code }, alarm_arm_night: { code: F.code }, alarm_disarm: { code: F.code },
  },
  button: { press: {} },
  input_button: { press: {} },
  vacuum: { start: {}, pause: {}, stop: {}, return_to_base: {} },
  valve: { open_valve: {}, close_valve: {}, toggle: {} },
  humidifier: { toggle: {}, turn_on: {}, turn_off: {} },
};

/** Things that can run anything (scripts) or press anything (buttons) must be put on a face by the owner first. */
const LAYOUT_ONLY = new Set(['script', 'button', 'input_button']);

function isSensitive(domain, service, st) {
  const dc = st && st.attributes && st.attributes.device_class;
  if (domain === 'lock') return service === 'unlock' || service === 'open';
  if (domain === 'alarm_control_panel') return service === 'alarm_disarm';
  if (domain === 'cover' && ['garage', 'gate', 'door'].includes(dc)) {
    return service === 'open_cover' || service === 'toggle' || service === 'set_cover_position';
  }
  return false;
}

class PolicyError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * Checks one action from an iPad and returns the Home Assistant call(s) to make.
 * ctx: { fromHa: boolean (opened through Home Assistant), admin: boolean }
 * home: Home model; layoutEntities: Set of entity ids placed on faces; settings: current settings.
 */
function resolveAction(req, { ctx, home, layoutEntities, settings, sensitiveFromHaOnly }) {
  if (!req || typeof req !== 'object') throw new PolicyError('bad request', 400);

  if (req.action === 'all_off' || req.action === 'room_toggle' || req.action === 'room_off') {
    return resolveVirtual(req, home);
  }

  const id = req.entity_id;
  const service = req.service;
  if (typeof id !== 'string' || typeof service !== 'string' || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(id)) {
    throw new PolicyError('bad request', 400);
  }
  const domain = id.split('.')[0];
  const allowed = SERVICES[domain];
  if (!allowed || !Object.prototype.hasOwnProperty.call(allowed, service)) {
    throw new PolicyError(`${domain}.${service} is not something a wall display may do`);
  }
  if (!home.isEligible(id)) throw new PolicyError('unknown device', 404);
  if (LAYOUT_ONLY.has(domain) && !layoutEntities.has(id)) {
    throw new PolicyError('only scripts and buttons placed on a face can be run');
  }
  const st = home.states.get(id);
  const fromHa = Boolean(ctx && ctx.fromHa);
  const sensitiveLocked = sensitiveFromHaOnly || (settings && settings.sensitiveFromHaOnly);
  if (sensitiveLocked && !fromHa && isSensitive(domain, service, st)) {
    throw new PolicyError('locks, alarms and garage doors open only from Home Assistant on this home');
  }

  const data = {};
  const schema = allowed[service];
  const input = (req.data && typeof req.data === 'object') ? req.data : {};
  for (const key of Object.keys(schema)) {
    if (input[key] === undefined) continue;
    const v = schema[key](input[key], st);
    if (v === undefined) throw new PolicyError(`invalid ${key}`, 400);
    data[key] = v;
  }
  return [{ domain, service, data, target: { entity_id: id } }];
}

function resolveVirtual(req, home) {
  const lights = home.eligibleIds().filter((id) => id.startsWith('light.') && home.states.get(id).state !== 'unavailable');
  if (req.action === 'all_off') {
    const on = lights.filter((id) => home.states.get(id).state === 'on');
    if (!on.length) return [];
    return [{ domain: 'light', service: 'turn_off', data: {}, target: { entity_id: on } }];
  }
  const area = req.area;
  if (typeof area !== 'string' || !home.areas.some((a) => a.id === area)) throw new PolicyError('unknown room', 404);
  const inRoom = lights.filter((id) => home.areaOf(id) === area);
  if (!inRoom.length) return [];
  const anyOn = inRoom.some((id) => home.states.get(id).state === 'on');
  if (req.action === 'room_off' || anyOn) {
    const on = inRoom.filter((id) => home.states.get(id).state === 'on');
    return on.length ? [{ domain: 'light', service: 'turn_off', data: {}, target: { entity_id: on } }] : [];
  }
  return [{ domain: 'light', service: 'turn_on', data: {}, target: { entity_id: inRoom } }];
}

module.exports = { resolveAction, isSensitive, PolicyError, SERVICES, LAYOUT_ONLY };
