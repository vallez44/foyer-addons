'use strict';
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { debounce, randomId } = require('./util');

/** Domains a wall display may show. Everything else (updates, users, backups…) never reaches an iPad. */
const DOMAINS = new Set([
  'light', 'switch', 'fan', 'cover', 'lock', 'climate', 'media_player', 'scene', 'script', 'input_boolean',
  'alarm_control_panel', 'binary_sensor', 'sensor', 'camera', 'weather', 'calendar', 'todo', 'sun', 'vacuum',
  'button', 'input_button', 'valve', 'humidifier', 'water_heater', 'person',
]);

const SENSOR_CLASSES = new Set(['temperature', 'humidity', 'illuminance', 'co2', 'pm25', 'pm10', 'aqi', 'power', 'energy', 'pressure']);
const BINARY_CLASSES = new Set([
  'door', 'window', 'garage_door', 'opening', 'motion', 'occupancy', 'presence', 'smoke', 'moisture', 'gas',
  'lock', 'carbon_monoxide', 'vibration', 'sound',
]);

const HIDE_LABELS = new Set(['masquer_dans_foyer', 'hide_in_foyer']);
const COMMON_ATTRS = ['device_class', 'unit_of_measurement', 'supported_features'];
const ATTRS = {
  light: ['brightness', 'color_mode', 'supported_color_modes', 'color_temp_kelvin', 'min_color_temp_kelvin', 'max_color_temp_kelvin', 'rgb_color', 'hs_color'],
  fan: ['percentage', 'percentage_step', 'preset_mode', 'preset_modes', 'oscillating'],
  cover: ['current_position', 'current_tilt_position'],
  climate: ['current_temperature', 'temperature', 'target_temp_high', 'target_temp_low', 'target_temp_step', 'hvac_modes', 'hvac_action', 'min_temp', 'max_temp', 'preset_mode', 'current_humidity'],
  media_player: ['media_title', 'media_artist', 'media_album_name', 'media_content_type', 'media_duration', 'media_position', 'media_position_updated_at', 'volume_level', 'is_volume_muted', 'app_name', 'source'],
  alarm_control_panel: ['code_format', 'code_arm_required', 'changed_by'],
  lock: ['code_format'],
  weather: ['temperature', 'apparent_temperature', 'humidity', 'wind_speed', 'wind_bearing', 'wind_gust_speed', 'pressure', 'uv_index', 'cloud_coverage', 'visibility', 'temperature_unit', 'wind_speed_unit', 'pressure_unit', 'precipitation_unit'],
  sun: ['next_rising', 'next_setting', 'next_dawn', 'next_dusk', 'elevation', 'rising'],
  sensor: ['state_class'],
  calendar: ['message', 'start_time', 'end_time', 'all_day', 'location'],
  vacuum: ['battery_level', 'status'],
  humidifier: ['humidity', 'current_humidity', 'mode'],
  water_heater: ['temperature', 'current_temperature', 'operation_mode', 'min_temp', 'max_temp'],
  valve: ['current_position'],
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shortHash = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 10);

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * The home as the iPads see it: filtered entities, areas, weather, calendars and lists,
 * with a version number per change so long-polling clients get only what changed.
 */
class Home extends EventEmitter {
  constructor({ source, log, settings }) {
    super();
    this.source = source;
    this.log = log;
    this.getSettings = settings; // () => settings object
    this.states = new Map();
    this.entityReg = new Map();
    this.deviceReg = new Map();
    this.twinOf = new Map();
    this.nativeOf = new Map();
    this.areas = [];
    this.config = {};
    this.blocks = { weather: null, calendar: null, todo: null };
    this.extraBlocks = {};
    this.epoch = randomId(4);
    this.v = 1;
    this.entityVer = new Map();
    this.blockVer = {};
    this.areasVer = 1;
    this.ready = false;
    this.lastError = null;
    this.forecastUnsubs = [];
    this.weatherEntity = null;
    this.calendarTimer = null;
    this.calendarIds = [];
    this.todoIds = [];
    this._emitChange = debounce(() => this.emit('change'), 30);
    this._refreshRegistries = debounce(() => this._loadRegistries(true).catch((e) => this.log.warn(`registries: ${e.message}`)), 2000);
    this._refreshCalendar = debounce(() => this.loadCalendar().catch((e) => this.log.warn(`calendar: ${e.message}`)), 3000);
    this._todoRefreshers = new Map();

    source.on('ready', () => this._onReady().catch((e) => {
      this.lastError = e.message;
      this.log.error(`Could not load the home: ${e.message}`);
    }));
    source.on('disconnected', () => {
      this.ready = false;
      this.markBlock('status');
    });
  }

  start() {
    this.source.start();
    this.calendarTimer = setInterval(() => this._refreshCalendar(), 10 * 60 * 1000);
    if (this.calendarTimer.unref) this.calendarTimer.unref();
  }

  stop() {
    clearInterval(this.calendarTimer);
    this._emitChange.cancel();
    this._refreshRegistries.cancel();
    this._refreshCalendar.cancel();
    for (const fn of this._todoRefreshers.values()) fn.cancel();
    if (this.source.stop) this.source.stop();
  }

  // ---------------------------------------------------------------- versions
  bump() {
    this.v += 1;
    return this.v;
  }

  markEntity(id) {
    this.entityVer.set(id, this.bump());
    this._emitChange();
  }

  markBlock(name) {
    this.blockVer[name] = this.bump();
    this._emitChange();
  }

  setBlock(name, value) {
    this.extraBlocks[name] = value;
    this.markBlock(name);
  }

  /** Forces every client to reload everything (registry change, new settings shape…). */
  resync() {
    this.epoch = randomId(4);
    this.bump();
    this._emitChange();
  }

  // ---------------------------------------------------------------- loading
  async _onReady() {
    this.config = (await this.source.getConfig()) || {};
    await this._loadRegistries(false);
    const states = await this.source.getStates();
    this.states.clear();
    for (const st of states) this.states.set(st.entity_id, st);
    await this.source.subscribeStateChanges((data) => this._onStateChanged(data));
    await this.source.subscribeRegistryUpdates(() => this._refreshRegistries());
    this.ready = true;
    this.lastError = null;
    this.log.info(`Home loaded: ${this.states.size} entities, ${this.areas.length} areas.`);
    this.resync();
    this.markBlock('status');
    this.emit('loaded');
    await Promise.all([
      this.setupWeather().catch((e) => this.log.warn(`weather: ${e.message}`)),
      this.loadCalendar().catch((e) => this.log.warn(`calendar: ${e.message}`)),
      this.loadTodos().catch((e) => this.log.warn(`lists: ${e.message}`)),
    ]);
  }

  async _loadRegistries(notify) {
    const [areas, devices, entities] = await Promise.all([
      this.source.getAreas(), this.source.getDevices(), this.source.getEntityRegistry(),
    ]);
    this.areas = (areas || []).map((a) => ({ id: a.area_id, name: a.name, icon: a.icon || null, floor: a.floor_id || null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    this.deviceReg.clear();
    for (const d of devices || []) {
      this.deviceReg.set(d.id, { area: d.area_id || null, name: d.name_by_user || d.name || '', model: d.model || '' });
    }
    this.entityReg.clear();
    for (const e of entities || []) {
      this.entityReg.set(e.entity_id, {
        area: e.area_id || null,
        device: e.device_id || null,
        hidden: Boolean(e.hidden_by),
        disabled: Boolean(e.disabled_by),
        category: e.entity_category || null,
        icon: e.icon || null,
        // The "Masquer dans Foyer" / "Hide in Foyer" label keeps an entity off the iPads.
        skip: Array.isArray(e.labels) && e.labels.some((l) => HIDE_LABELS.has(l)),
        platform: e.platform || null,
        uid: typeof e.unique_id === 'string' ? e.unique_id : null,
      });
    }
    this._linkTwins();
    if (notify) {
      this.log.info('Home Assistant registries changed, reloading the iPads.');
      this.resync();
      this.emit('loaded');
    }
  }

  /**
   * Music Assistant adds a second player for each AirPlay speaker Home Assistant already knows (a HomePod…).
   * The iPads see one speaker: the original one, which has the room and sees what Siri or the iPhone plays.
   * What only Music Assistant can do (Apple Music, search) goes to its twin, found by the speaker's MAC address.
   */
  _linkTwins() {
    this.twinOf = new Map();
    this.nativeOf = new Map();
    const byMac = new Map();
    for (const [id, r] of this.entityReg) {
      if (!id.startsWith('media_player.') || r.platform === 'music_assistant' || !r.uid || r.disabled) continue;
      const hex = r.uid.toLowerCase().replace(/[^0-9a-f]/g, '');
      if (hex.length === 12) byMac.set(hex, id);
    }
    for (const [id, r] of this.entityReg) {
      if (!id.startsWith('media_player.') || r.platform !== 'music_assistant' || !r.uid || r.disabled) continue;
      const m = /^ap([0-9a-f]{12})$/i.exec(r.uid);
      const native = m && byMac.get(m[1].toLowerCase());
      if (!native || this.twinOf.has(native)) continue;
      this.twinOf.set(native, id);
      this.nativeOf.set(id, native);
    }
  }

  /** True for a player of Music Assistant (its library can be browsed and searched). */
  isMusicAssistant(id) {
    const r = this.entityReg.get(id);
    return Boolean(r && r.platform === 'music_assistant');
  }

  /** The player that plays Apple Music and the library for this speaker (its Music Assistant twin when it works). */
  libraryFor(id) {
    const ma = this.twinOf && this.twinOf.get(id);
    const st = ma && this.states.get(ma);
    return st && st.state !== 'unavailable' ? ma : id;
  }

  /** The player to show and to control for this speaker: the one that plays (or holds a paused song). */
  speakerFor(id) {
    const ma = this.libraryFor(id);
    if (ma === id) return id;
    const a = (this.states.get(ma) || {}).state;
    const n = (this.states.get(id) || {}).state;
    if (a === 'playing' || a === 'buffering') return ma;
    if (n === 'playing') return id;
    if (a === 'paused' && n !== 'playing') return ma;
    return id;
  }

  /** Where a speaker's action goes: its library for play_media, the player that plays for the rest. */
  mediaTarget(id, service) {
    return service === 'play_media' ? this.libraryFor(id) : this.speakerFor(id);
  }

  _onStateChanged(data) {
    if (!data || !data.entity_id) return;
    const id = data.entity_id;
    const prev = this.states.get(id);
    const wasEligible = prev ? this.isEligible(id) : false;
    if (data.new_state) this.states.set(id, data.new_state);
    else this.states.delete(id);
    // A Music Assistant twin changes what its speaker shows.
    const native = this.nativeOf && this.nativeOf.get(id);
    if (native && this.isEligible(native)) this.markEntity(native);
    if (!wasEligible && !this.isEligible(id)) return;
    this.markEntity(id);
    const domain = id.split('.')[0];
    if (domain === 'calendar') this._refreshCalendar();
    if (domain === 'todo') this._refreshTodo(id);
    if (domain === 'weather' && id === this.weatherEntity && !this.forecastUnsubs.length) this.setupWeather().catch(() => {});
    if (!prev && data.new_state) this.emit('entities-changed');
  }

  // ---------------------------------------------------------------- filtering
  isEligibleDomain(id) {
    return DOMAINS.has(id.split('.')[0]);
  }

  isEligible(id) {
    // A Music Assistant twin hides behind its speaker (unless that speaker is hidden).
    const native = this.nativeOf && this.nativeOf.get(id);
    if (native && this._eligible(native)) return false;
    return this._eligible(id);
  }

  _eligible(id) {
    const domain = id.split('.')[0];
    if (!DOMAINS.has(domain)) return false;
    const reg = this.entityReg.get(id);
    if (reg && (reg.hidden || reg.disabled || reg.category || reg.skip)) return false;
    const st = this.states.get(id);
    if (!st) return false;
    const dc = st.attributes && st.attributes.device_class;
    if (domain === 'sensor') {
      return SENSOR_CLASSES.has(dc) || (st.attributes && /°[CF]$/.test(st.attributes.unit_of_measurement || ''));
    }
    if (domain === 'binary_sensor') return BINARY_CLASSES.has(dc);
    return true;
  }

  areaOf(id) {
    const reg = this.entityReg.get(id);
    if (!reg) return null;
    if (reg.area) return reg.area;
    const dev = reg.device && this.deviceReg.get(reg.device);
    return (dev && dev.area) || null;
  }

  areaName(areaId) {
    const a = this.areas.find((x) => x.id === areaId);
    return a ? a.name : null;
  }

  displayName(id, st) {
    let name = (st && st.attributes && st.attributes.friendly_name) || id.split('.')[1].replace(/_/g, ' ');
    const areaName = this.areaName(this.areaOf(id));
    if (areaName && name.toLowerCase() !== areaName.toLowerCase()) {
      const re = new RegExp(`(^|\\s)${escapeRe(areaName)}(?=\\s|$)`, 'i');
      const stripped = name.replace(re, ' ').replace(/\s{2,}/g, ' ').trim();
      // "Porte de garage" in the Garage stays whole: never leave a dangling "de", "du", "of"…
      const dangling = /(^|\s)(de|du|des|d'|la|le|les|l'|à|au|aux|en|of|the|in)$/i.test(stripped);
      if (stripped.length >= 2 && !dangling) name = stripped;
    }
    // "Capteur Porte" reads better as "Porte" on a tile.
    if (id.startsWith('binary_sensor.')) {
      const bare = name.replace(/^(capteur|détecteur|detecteur|sensor|contact)\s+(de\s+|d')?/i, '').trim();
      if (bare.length >= 3) name = bare;
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /** The small, safe form of a state an iPad receives (no tokens, no GPS, no internals). */
  compact(id) {
    const own = this.states.get(id);
    if (!own) return null;
    const domain = id.split('.')[0];
    // A speaker with a Music Assistant twin shows whichever of the two plays.
    const shown = domain === 'media_player' ? this.speakerFor(id) : id;
    const st = this.states.get(shown) || own;
    const ownAttrs = own.attributes || {};
    const src = st.attributes || {};
    const at = {};
    for (const k of COMMON_ATTRS.concat(ATTRS[domain] || [])) {
      if (src[k] !== undefined && src[k] !== null) at[k] = src[k];
    }
    if (domain === 'media_player') {
      if (src.entity_picture) at.pic = `api/art/${id}?c=${shortHash(src.entity_picture)}`;
      const lib = this.libraryFor(id);
      if (lib !== id || this.isMusicAssistant(id)) {
        at.ma = true;
        const libAttrs = (this.states.get(lib) || {}).attributes || {};
        at.supported_features = (ownAttrs.supported_features || 0) | (libAttrs.supported_features || 0);
      }
    }
    if (domain === 'camera') at.pic = `api/camera/${id}`;
    const reg = this.entityReg.get(id);
    const dev = reg && reg.device ? this.deviceReg.get(reg.device) : null;
    if (domain === 'media_player' && dev && dev.model) at.model = dev.model;
    return {
      s: st.state,
      n: this.displayName(id, own),
      fn: ownAttrs.friendly_name || null,
      a: this.areaOf(id),
      i: (reg && reg.icon) || ownAttrs.icon || null,
      at,
      lc: Date.parse(st.last_changed) || 0,
    };
  }

  eligibleIds() {
    const out = [];
    for (const id of this.states.keys()) if (this.isEligible(id)) out.push(id);
    return out.sort();
  }

  homeInfo() {
    const c = this.config || {};
    return {
      name: c.location_name || 'Maison',
      lang: (c.language || 'fr').slice(0, 2),
      tz: c.time_zone || null,
      units: (c.unit_system && c.unit_system.temperature) || '°C',
      // Where Home Assistant's own page lives (Settings → Home Assistant → Open).
      url: typeof c.internal_url === 'string' && /^https?:\/\//.test(c.internal_url) ? c.internal_url : null,
      caps: {
        musicAssistant: (Array.isArray(c.components) && c.components.includes('music_assistant'))
          || [...this.entityReg.values()].some((r) => r.platform === 'music_assistant'),
        radio: Array.isArray(c.components) && c.components.includes('radio_browser'),
      },
      connected: this.ready,
      error: this.lastError,
    };
  }

  // ---------------------------------------------------------------- weather
  pickWeatherEntity() {
    const s = this.getSettings();
    if (s.weatherEntity && this.states.has(s.weatherEntity)) return s.weatherEntity;
    const all = [...this.states.keys()].filter((id) => id.startsWith('weather.')).sort();
    return all[0] || null;
  }

  async setupWeather() {
    for (const u of this.forecastUnsubs) { try { await u(); } catch (e) { /* ignore */ } }
    this.forecastUnsubs = [];
    const id = this.pickWeatherEntity();
    this.weatherEntity = id;
    if (!id) {
      this.blocks.weather = null;
      this.markBlock('weather');
      return;
    }
    const features = (this.states.get(id).attributes || {}).supported_features || 0;
    const block = { entity: id, hourly: [], daily: [] };
    this.blocks.weather = block;
    const trim = (list, n) => (list || []).slice(0, n).map((f) => ({
      t: f.datetime, c: f.condition, hi: f.temperature, lo: f.templow, p: f.precipitation_probability,
      pr: f.precipitation, w: f.wind_speed, day: f.is_daytime,
    }));
    const wants = [];
    if (features & 2) wants.push(['hourly', 24]);
    if (features & 1) wants.push(['daily', 8]);
    else if (features & 4) wants.push(['twice_daily', 8]);
    for (const [type, n] of wants) {
      const key = type === 'hourly' ? 'hourly' : 'daily';
      try {
        const unsub = await this.source.subscribeForecast(id, type, (list) => {
          if (this.weatherEntity !== id) return;
          block[key] = trim(list, n);
          this.markBlock('weather');
        });
        this.forecastUnsubs.push(unsub);
      } catch (e) {
        try {
          block[key] = trim(await this.source.getForecastOnce(id, type), n);
        } catch (e2) {
          this.log.warn(`forecast ${type}: ${e2.message}`);
        }
      }
    }
    this.markBlock('weather');
  }

  // ---------------------------------------------------------------- calendars
  pickCalendars() {
    const s = this.getSettings();
    const all = [...this.states.keys()].filter((id) => id.startsWith('calendar.') && this.isEligible(id)).sort();
    if (Array.isArray(s.calendars) && s.calendars.length) return all.filter((id) => s.calendars.includes(id));
    return all;
  }

  async loadCalendar() {
    if (!this.ready) return;
    const ids = this.pickCalendars();
    this.calendarIds = ids;
    const now = new Date();
    const start = startOfDay(new Date(now.getTime() - 8 * 86400000)).toISOString();
    const end = new Date(now.getTime() + 22 * 86400000).toISOString();
    const events = [];
    await Promise.all(ids.map(async (id) => {
      try {
        const list = await this.source.getCalendarEvents(id, start, end);
        for (const ev of list || []) {
          const s = ev.start || {};
          const e = ev.end || {};
          events.push({
            cal: id,
            title: ev.summary || '',
            start: s.dateTime || s.date || ev.start,
            end: e.dateTime || e.date || ev.end,
            allDay: Boolean(s.date && !s.dateTime),
            loc: ev.location || null,
          });
        }
      } catch (err) {
        this.log.warn(`calendar ${id}: ${err.message}`);
      }
    }));
    events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    this.blocks.calendar = {
      calendars: ids.map((id) => ({ id, name: this.displayName(id, this.states.get(id)) })),
      events: events.slice(0, 300),
      at: Date.now(),
    };
    this.markBlock('calendar');
  }

  // ---------------------------------------------------------------- lists
  async loadTodos() {
    if (!this.ready) return;
    const ids = [...this.states.keys()].filter((id) => id.startsWith('todo.') && this.isEligible(id)).sort();
    this.todoIds = ids;
    const lists = {};
    await Promise.all(ids.map(async (id) => {
      try {
        lists[id] = this._trimTodo(await this.source.getTodoItems(id));
      } catch (e) {
        this.log.warn(`list ${id}: ${e.message}`);
      }
    }));
    this.blocks.todo = { lists };
    this.markBlock('todo');
  }

  _trimTodo(items) {
    const open = items.filter((i) => i.status !== 'completed').slice(0, 30)
      .map((i) => ({ t: i.summary, due: i.due || null, uid: i.uid || null }));
    return { open, done: items.filter((i) => i.status === 'completed').length };
  }

  _refreshTodo(id) {
    if (!this._todoRefreshers.has(id)) {
      this._todoRefreshers.set(id, debounce(async () => {
        try {
          const items = await this.source.getTodoItems(id);
          if (!this.blocks.todo) this.blocks.todo = { lists: {} };
          this.blocks.todo.lists[id] = this._trimTodo(items);
          this.markBlock('todo');
        } catch (e) {
          this.log.warn(`list ${id}: ${e.message}`);
        }
      }, 1000));
    }
    this._todoRefreshers.get(id)();
  }

  // ---------------------------------------------------------------- client payloads
  blockValue(name) {
    if (name === 'status') return this.homeInfo();
    if (name in this.blocks) return this.blocks[name];
    return this.extraBlocks[name];
  }

  blockNames() {
    return ['status', ...Object.keys(this.blocks), ...Object.keys(this.extraBlocks)];
  }

  snapshot() {
    const entities = {};
    for (const id of this.eligibleIds()) entities[id] = this.compact(id);
    const blocks = {};
    for (const name of this.blockNames()) blocks[name] = this.blockValue(name);
    return { epoch: this.epoch, v: this.v, areas: this.areas, entities, blocks };
  }

  /** Everything that changed after version `since`, or null when the client must reload. */
  delta(since, epoch) {
    if (epoch !== this.epoch || since > this.v) return null;
    const e = {};
    let n = 0;
    for (const [id, ver] of this.entityVer) {
      if (ver > since) {
        e[id] = this.isEligible(id) ? this.compact(id) : null;
        n += 1;
      }
    }
    const b = {};
    for (const name of this.blockNames()) {
      if ((this.blockVer[name] || 0) > since) {
        b[name] = this.blockValue(name);
        n += 1;
      }
    }
    return { epoch: this.epoch, v: this.v, e, b, n };
  }
}

module.exports = { Home, DOMAINS };
