'use strict';

/**
 * Suggested layouts, made from the home's own things:
 * top row = the thermostat or the clock, the clock or the weather, and the photo;
 * below = weather / up next, the camera or the two biggest rooms, two scenes, then lights and devices
 * (locks and doors first, then one per room). The rest stays in the room pages.
 */
function inventory(home, settings) {
  const ids = home.eligibleIds();
  const st = (id) => home.states.get(id);
  const by = (prefix) => ids.filter((id) => id.startsWith(prefix));
  const available = (id) => !['unavailable', 'unknown'].includes(st(id).state);
  const dc = (id) => (st(id).attributes || {}).device_class;

  let climates = by('climate.');
  if (settings.thermostatEntity && climates.includes(settings.thermostatEntity)) {
    climates = [settings.thermostatEntity, ...climates.filter((c) => c !== settings.thermostatEntity)];
  }
  const lights = by('light.');
  const controllable = ids.filter((id) => /^(light|switch|fan|cover|media_player|climate|lock)\./.test(id));
  const roomCounts = new Map();
  for (const id of controllable) {
    const a = home.areaOf(id);
    if (a) roomCounts.set(a, (roomCounts.get(a) || 0) + 1);
  }
  const rooms = home.areas
    .filter((a) => lights.some((l) => home.areaOf(l) === a.id))
    .sort((a, b) => (roomCounts.get(b.id) || 0) - (roomCounts.get(a.id) || 0));

  return {
    ids, st, available, dc, climates, lights, rooms,
    weather: home.pickWeatherEntity(),
    calendars: home.pickCalendars(),
    cameras: by('camera.').sort((a, b) => Number(/sonnette|doorbell|porte|entree|front/.test(b)) - Number(/sonnette|doorbell|porte|entree|front/.test(a))),
    scenes: by('scene.').sort((a, b) => home.displayName(a, st(a)).localeCompare(home.displayName(b, st(b)), 'fr')),
    locks: by('lock.'),
    garages: by('cover.').filter((id) => ['garage', 'gate'].includes(dc(id))),
    covers: by('cover.').filter((id) => !['garage', 'gate'].includes(dc(id))),
    doors: by('binary_sensor.').filter((id) => ['door', 'garage_door', 'window', 'opening'].includes(dc(id))),
    alarms: by('alarm_control_panel.'),
    fans: by('fan.'),
    switches: by('switch.').filter((id) => dc(id) !== 'outlet'),
    outlets: by('switch.').filter((id) => dc(id) === 'outlet'),
    booleans: by('input_boolean.'),
    media: by('media_player.'),
    home,
  };
}

function onePerRoom(inv, list) {
  const out = [];
  const seen = new Set();
  for (const room of inv.rooms) {
    const pick = list.find((id) => inv.home.areaOf(id) === room.id && inv.available(id));
    if (pick && !seen.has(room.id)) {
      seen.add(room.id);
      out.push(pick);
    }
  }
  return out;
}

function uniqueEntityTiles(list, limit) {
  const seen = new Set();
  const out = [];
  for (const id of list) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ type: 'entity', entity: id, size: 'S' });
  }
  return out.slice(0, limit);
}

/** Stable: keeps the priority order, but devices that are offline go last. */
function sortAvailableFirst(inv, list) {
  return list.filter((id) => inv.available(id)).concat(list.filter((id) => !inv.available(id)));
}

/**
 * Takes devices from several lists in turn, following `pattern`, so a few slots get a mix
 * (a lock, a light, the garage, another light…) instead of only the first kind.
 */
function weave(inv, pattern, lists) {
  const sorted = {};
  for (const k of Object.keys(lists)) sorted[k] = sortAvailableFirst(inv, lists[k]);
  const idx = {};
  const out = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const k of pattern) {
      const list = sorted[k] || [];
      const i = idx[k] || 0;
      if (i < list.length) {
        out.push(list[i]);
        idx[k] = i + 1;
        progressed = true;
      }
    }
  }
  return sortAvailableFirst(inv, out);
}

function deviceLists(inv) {
  const perRoom = onePerRoom(inv, inv.lights);
  return {
    K: inv.locks.slice().sort((a, b) => Number(inv.st(b).state === 'unlocked') - Number(inv.st(a).state === 'unlocked')),
    L: perRoom.concat(inv.lights.filter((id) => !perRoom.includes(id))),
    G: inv.garages,
    D: inv.doors,
    A: inv.alarms.slice(0, 1),
    O: inv.fans.concat(inv.covers, inv.switches, inv.booleans),
  };
}

function suggestHomePlus(inv) {
  const tiles = [];
  const hasClimate = inv.climates.length > 0;
  if (hasClimate) tiles.push({ type: 'thermostat', entity: inv.climates[0], size: 'M' });
  tiles.push({ type: 'clock', size: 'M' });
  if (!hasClimate) tiles.push(inv.weather ? { type: 'weather', entity: inv.weather, size: 'M' } : { type: 'date', size: 'M' });
  tiles.push({ type: 'photo', size: 'L' });
  if (hasClimate && inv.weather) tiles.push({ type: 'weather', entity: inv.weather, size: 'W' });
  tiles.push(inv.calendars.length ? { type: 'agenda', size: 'W' } : { type: 'house', size: 'W' });
  if (inv.cameras.length) tiles.push({ type: 'camera', entity: inv.cameras[0], size: 'W' });
  else for (const r of inv.rooms.slice(0, 2)) tiles.push({ type: 'room', area: r.id, size: 'W' });
  if (inv.scenes.length) for (const s of inv.scenes.slice(0, 2)) tiles.push({ type: 'entity', entity: s, size: 'W' });
  else tiles.push({ type: 'action', action: 'all_off', size: 'W' });
  const rest = weave(inv, ['K', 'L', 'G', 'L', 'D', 'L', 'O', 'A', 'K', 'L', 'D', 'O'], deviceLists(inv));
  return tiles.concat(uniqueEntityTiles(rest, 12));
}

function suggestHome(inv) {
  const tiles = [];
  if (inv.climates.length) tiles.push({ type: 'thermostat', entity: inv.climates[0], size: 'M' });
  else if (inv.weather) tiles.push({ type: 'weather', entity: inv.weather, size: 'M' });
  else tiles.push({ type: 'clock', size: 'M' });
  if (inv.climates.length || inv.weather) tiles.push({ type: 'clock', size: 'S' });
  if (inv.scenes.length) tiles.push({ type: 'entity', entity: inv.scenes[0], size: 'S' });
  else tiles.push({ type: 'action', action: 'all_off', size: 'S' });
  const rest = weave(inv, ['K', 'L', 'L', 'O', 'G', 'L', 'D', 'L', 'O', 'K'], deviceLists(inv));
  return tiles.concat(uniqueEntityTiles(rest, 10));
}

function suggestLayouts(home, settings) {
  const inv = inventory(home, settings);
  return {
    home_plus: suggestHomePlus(inv),
    home: suggestHome(inv),
  };
}

module.exports = { suggestLayouts, inventory };
