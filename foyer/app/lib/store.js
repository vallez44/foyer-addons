'use strict';
const path = require('path');
const { readJson, writeJsonAtomic, randomId } = require('./util');

const FACE_IDS = ['photos', 'home_plus', 'analog', 'home', 'flow', 'modular', 'weather', 'calendar', 'clock', 'cameras'];
const DEFAULT_ON = new Set(['photos', 'home_plus', 'analog', 'home', 'flow']);
const WALLPAPERS = ['amber', 'ocean', 'lavender', 'sage', 'graphite'];
const NIGHT_FACES = ['flow', 'clock', 'analog', 'photos'];
const APP_IDS = ['home', 'music', 'calendar', 'reminders', 'weather', 'photos', 'timers', 'worldclock', 'alarms', 'podcasts', 'news',
  'books', 'tv', 'safari', 'findmy', 'shortcuts', 'maps', 'homeassistant', 'settings'];

function defaultSettings() {
  return {
    faces: FACE_IDS.map((id) => ({ id, on: DEFAULT_ON.has(id) })),
    startFace: 'home_plus',
    layouts: { home_plus: null, home: null },
    wallpaper: 'amber',
    style: 'glass',
    night: { enabled: true, from: '22:30', to: '07:00', face: 'flow', dim: 0.4 },
    photoInterval: 300,
    returnAfter: 0,
    weatherEntity: null,
    calendars: null,
    thermostatEntity: null,
    speaker: null,
    sensitiveFromHaOnly: false,
    lang: null,
    apps: { apple: { music: true }, hidden: {} },
    defaultCalendar: null,
    alarmSiren: true,
  };
}

const TILE_TYPES = new Set(['entity', 'thermostat', 'clock', 'weather', 'photo', 'agenda', 'camera', 'room', 'house', 'action', 'media', 'date', 'sun', 'todo', 'sensor', 'energy']);
const SIZES = new Set(['S', 'W', 'T', 'M', 'L', 'XL']);
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isEntityId = (s) => typeof s === 'string' && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(s);
const str = (s, max = 80) => (typeof s === 'string' ? s.slice(0, max) : undefined);

function cleanTile(t) {
  if (!t || typeof t !== 'object' || !TILE_TYPES.has(t.type)) return null;
  const out = { type: t.type, size: SIZES.has(t.size) ? t.size : 'S' };
  if (isEntityId(t.entity)) out.entity = t.entity;
  if (typeof t.area === 'string' && /^[a-z0-9_]+$/.test(t.area)) out.area = t.area;
  if (t.action === 'all_off') out.action = t.action;
  const name = str(t.name, 40);
  if (name) out.name = name;
  // Cell chosen by dragging on the screen, per orientation (l = landscape, p = portrait).
  if (t.pos && typeof t.pos === 'object') {
    const pos = {};
    for (const k of ['l', 'p']) {
      const p = t.pos[k];
      if (Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n < 16)) pos[k] = [p[0], p[1]];
    }
    if (Object.keys(pos).length) out.pos = pos;
  }
  return out;
}

/** Validates settings coming from the settings page; anything unexpected falls back to the current value. */
function sanitizeSettings(input, current) {
  const s = JSON.parse(JSON.stringify(current));
  if (!input || typeof input !== 'object') return s;
  if (Array.isArray(input.faces)) {
    const seen = new Set();
    const faces = [];
    for (const f of input.faces) {
      if (f && FACE_IDS.includes(f.id) && !seen.has(f.id)) {
        seen.add(f.id);
        faces.push({ id: f.id, on: Boolean(f.on) });
      }
    }
    for (const id of FACE_IDS) if (!seen.has(id)) faces.push({ id, on: false });
    if (faces.some((f) => f.on)) s.faces = faces;
  }
  if (FACE_IDS.includes(input.startFace)) s.startFace = input.startFace;
  if (input.layouts && typeof input.layouts === 'object') {
    for (const face of ['home_plus', 'home']) {
      if (!(face in input.layouts)) continue;
      const l = input.layouts[face];
      s.layouts[face] = Array.isArray(l) ? l.map(cleanTile).filter(Boolean).slice(0, 40) : null;
    }
  }
  if (WALLPAPERS.includes(input.wallpaper)) s.wallpaper = input.wallpaper;
  if (['glass', 'frosted', 'flat'].includes(input.style)) s.style = input.style;
  if (input.night && typeof input.night === 'object') {
    const n = input.night;
    if (typeof n.enabled === 'boolean') s.night.enabled = n.enabled;
    if (isTime(n.from)) s.night.from = n.from;
    if (isTime(n.to)) s.night.to = n.to;
    if (NIGHT_FACES.includes(n.face)) s.night.face = n.face;
    if (Number.isFinite(+n.dim) && +n.dim >= 0 && +n.dim <= 0.85) s.night.dim = Math.round(+n.dim * 100) / 100;
  }
  if (Number.isInteger(input.photoInterval) && input.photoInterval >= 10 && input.photoInterval <= 86400) s.photoInterval = input.photoInterval;
  if (Number.isInteger(input.returnAfter) && input.returnAfter >= 0 && input.returnAfter <= 86400) s.returnAfter = input.returnAfter;
  for (const k of ['weatherEntity', 'thermostatEntity', 'speaker']) {
    if (input[k] === null || isEntityId(input[k])) s[k] = input[k];
  }
  if (input.calendars === null) s.calendars = null;
  else if (Array.isArray(input.calendars)) s.calendars = input.calendars.filter(isEntityId).slice(0, 30);
  if (typeof input.sensitiveFromHaOnly === 'boolean') s.sensitiveFromHaOnly = input.sensitiveFromHaOnly;
  if (typeof input.alarmSiren === 'boolean') s.alarmSiren = input.alarmSiren;
  if (input.lang === null || input.lang === 'fr' || input.lang === 'en') s.lang = input.lang;
  if (input.defaultCalendar === null || isEntityId(input.defaultCalendar)) s.defaultCalendar = input.defaultCalendar;
  if (input.apps && typeof input.apps === 'object') {
    s.apps = s.apps || { apple: {}, hidden: {} };
    for (const part of ['apple', 'hidden']) {
      const src = input.apps[part];
      if (!src || typeof src !== 'object') continue;
      const out = {};
      for (const id of APP_IDS) if (src[id] === true) out[id] = true;
      s.apps[part] = out;
    }
  }
  return s;
}

/** Everything Foyer remembers, in one JSON file under /data (readable only by Foyer). */
class Store {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'foyer.json');
    const raw = readJson(this.file, {});
    this.data = {
      installId: raw.installId || randomId(8),
      settings: sanitizeSettings(raw.settings || {}, defaultSettings()),
      devices: Array.isArray(raw.devices) ? raw.devices : [],
      codes: Array.isArray(raw.codes) ? raw.codes : [],
      photos: Array.isArray(raw.photos) ? raw.photos : [],
    };
    if (raw.fixedCodeHash) this.data.fixedCodeHash = raw.fixedCodeHash;
    this.saveTimer = null;
    this.save();
  }

  get settings() { return this.data.settings; }

  setSettings(next) {
    this.data.settings = next;
    this.save();
  }

  save() {
    writeJsonAtomic(this.file, this.data);
  }

  /** For frequent, unimportant writes (last-seen times). */
  saveSoon() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 10 * 60 * 1000);
    if (this.saveTimer.unref) this.saveTimer.unref();
  }
}

module.exports = { Store, defaultSettings, sanitizeSettings, FACE_IDS, WALLPAPERS, APP_IDS };
