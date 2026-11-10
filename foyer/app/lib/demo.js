'use strict';
const { EventEmitter } = require('events');

/** A made-up home, so Foyer can be tried (and developed) without touching a real one. */

const AREAS = [
  ['salon', 'Salon', 'mdi:sofa'], ['cuisine', 'Cuisine', 'mdi:silverware-fork-knife'], ['chambre', 'Chambre', 'mdi:bed'],
  ['entree', 'Entrée', 'mdi:door'], ['garage', 'Garage', 'mdi:garage'], ['bureau', 'Bureau', 'mdi:desk'], ['jardin', 'Jardin', 'mdi:tree'],
];

function iso(d) { return new Date(d).toISOString(); }

function atToday(h, m, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

function nextAt(h, m) {
  const d = atToday(h, m);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function buildStates() {
  const now = iso(Date.now() - 3600000);
  const S = (entity_id, state, attributes, area) => ({ entity_id, state, attributes, area, last_changed: now, last_updated: now });
  return [
    S('climate.salon', 'heat', {
      friendly_name: 'Thermostat', current_temperature: 20.5, temperature: 21, hvac_modes: ['off', 'heat', 'auto'],
      hvac_action: 'heating', min_temp: 7, max_temp: 30, target_temp_step: 0.5, supported_features: 385,
    }, 'salon'),
    S('light.lampadaire_salon', 'on', { friendly_name: 'Lampadaire', brightness: 178, color_mode: 'brightness', supported_color_modes: ['brightness'] }, 'salon'),
    S('light.spots_salon', 'off', { friendly_name: 'Spots Salon', color_mode: null, supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }, 'salon'),
    S('light.suspension_cuisine', 'off', { friendly_name: 'Suspension', supported_color_modes: ['brightness'] }, 'cuisine'),
    S('light.chevet', 'off', { friendly_name: 'Lampe de chevet', supported_color_modes: ['brightness'] }, 'chambre'),
    S('light.applique_entree', 'on', { friendly_name: 'Applique', brightness: 120, color_mode: 'brightness', supported_color_modes: ['brightness'] }, 'entree'),
    S('light.lampe_bureau', 'off', { friendly_name: 'Lampe de bureau', supported_color_modes: ['onoff'] }, 'bureau'),
    S('switch.guirlande', 'off', { friendly_name: 'Guirlande', icon: 'mdi:string-lights' }, 'jardin'),
    S('fan.chambre', 'on', { friendly_name: 'Ventilateur', percentage: 40, percentage_step: 20, supported_features: 49 }, 'chambre'),
    S('cover.volets_chambre', 'closed', { friendly_name: 'Volets', current_position: 0, device_class: 'shutter', supported_features: 15 }, 'chambre'),
    S('cover.porte_garage', 'closed', { friendly_name: 'Porte de garage', device_class: 'garage', supported_features: 3 }, 'garage'),
    S('lock.porte_entree', 'locked', { friendly_name: "Porte d'entrée" }, 'entree'),
    S('lock.porte_cuisine', 'unlocked', { friendly_name: 'Porte arrière' }, 'cuisine'),
    S('binary_sensor.baie_vitree', 'off', { friendly_name: 'Baie vitrée', device_class: 'door' }, 'salon'),
    S('scene.arrivee', 'unknown', { friendly_name: 'Arrivée' }, null),
    S('scene.bonjour', 'unknown', { friendly_name: 'Bonjour', icon: 'mdi:white-balance-sunny' }, null),
    S('scene.bonne_nuit', 'unknown', { friendly_name: 'Bonne nuit', icon: 'mdi:weather-night' }, null),
    S('scene.cinema', 'unknown', { friendly_name: 'Cinéma', icon: 'mdi:movie-open' }, null),
    S('media_player.enceinte_salon', 'playing', {
      friendly_name: 'Enceinte Salon', media_title: "Lumière d'octobre", media_artist: 'Les Pins Bleus', media_album_name: 'Marée basse',
      volume_level: 0.32, is_volume_muted: false, supported_features: 4346767, media_duration: 214, media_position: 63,
      media_position_updated_at: iso(Date.now()), entity_picture: '/api/media_player_proxy/media_player.enceinte_salon?token=demo',
    }, 'salon'),
    S('media_player.enceinte_chambre', 'idle', { friendly_name: 'Enceinte Chambre', volume_level: 0.2, supported_features: 4346767 }, 'chambre'),
    S('camera.sonnette', 'idle', { friendly_name: 'Sonnette', entity_picture: '/api/camera_proxy/camera.sonnette?token=demo' }, 'entree'),
    S('camera.jardin', 'idle', { friendly_name: 'Jardin' }, 'jardin'),
    S('camera.allee', 'idle', { friendly_name: 'Allée' }, 'garage'),
    S('weather.maison', 'cloudy', {
      friendly_name: 'Maison', temperature: 12.4, apparent_temperature: 10.8, humidity: 78, wind_speed: 14, wind_bearing: 240,
      pressure: 1012, temperature_unit: '°C', wind_speed_unit: 'km/h', pressure_unit: 'hPa', supported_features: 3,
    }, null),
    S('sensor.temperature_chambre', '19.2', { friendly_name: 'Température Chambre', device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement' }, 'chambre'),
    S('calendar.famille', 'off', { friendly_name: 'Famille' }, null),
    S('calendar.travail', 'off', { friendly_name: 'Travail' }, null),
    S('todo.courses', '4', { friendly_name: 'Courses', supported_features: 15 }, null),
    S('alarm_control_panel.maison', 'disarmed', { friendly_name: 'Alarme', code_format: 'number', code_arm_required: false, supported_features: 15 }, null),
    S('sun.sun', 'below_horizon', { friendly_name: 'Soleil', next_rising: iso(nextAt(7, 52)), next_setting: iso(nextAt(17, 21)), elevation: -8 }, null),
    S('person.camille', 'home', { friendly_name: 'Camille' }, null),
  ];
}

const SCENES = {
  'scene.arrivee': [['light.lampadaire_salon', 'on', { brightness: 200 }], ['light.applique_entree', 'on', { brightness: 160 }]],
  'scene.bonjour': [['cover.volets_chambre', 'open', { current_position: 100 }], ['light.suspension_cuisine', 'on', { brightness: 230 }]],
  'scene.bonne_nuit': [
    ['light.lampadaire_salon', 'off', { brightness: null }], ['light.spots_salon', 'off', {}], ['light.suspension_cuisine', 'off', { brightness: null }],
    ['light.applique_entree', 'off', { brightness: null }], ['light.lampe_bureau', 'off', {}], ['lock.porte_entree', 'locked', {}],
    ['lock.porte_cuisine', 'locked', {}], ['cover.volets_chambre', 'closed', { current_position: 0 }],
  ],
  'scene.cinema': [['light.lampadaire_salon', 'on', { brightness: 40 }], ['light.spots_salon', 'off', {}]],
};

const DEMO_RADIOS = ['Radio des Tilleuls', 'Jazz du soir', 'Classique douce', 'Infos locales'];
const DEMO_PLAYLISTS = ['Dimanche matin', 'En cuisine', 'Soirée calme', 'Concentration'];
const TRACKS = [["Lumière d'octobre", 'Les Pins Bleus'], ['Sel et cendre', 'Odile Marchal'], ['Petit matin', 'Trio Calanque'], ['Vent du large', 'Les Pins Bleus']];

/**
 * A fixture replays a copy of a real home (for previews):
 * { config, areas: [[id, name]], states: [[entity_id, state, area, attributes, "hidden"|"config"|"diagnostic", { platform, unique_id }]] }
 */
function fixtureStates(fixture) {
  const now = iso(Date.now() - 3600000);
  return fixture.states.map(([entity_id, state, area, attributes, flag, reg]) => ({
    entity_id, state, attributes, area, flag: flag || null, reg: reg || null, last_changed: now, last_updated: now,
  }));
}

class DemoSource extends EventEmitter {
  constructor({ log, fixture = null }) {
    super();
    this.kind = 'demo';
    this.log = log;
    this.fixture = fixture;
    this.connected = false;
    this.authFailed = false;
    this.states = new Map();
    this.areaOf = new Map();
    this.flags = new Map();
    this.regExtra = new Map();
    this.stateCb = null;
    this.forecastCbs = [];
    this.track = 0;
    this.extraEvents = [];
    this.lists = {
      'todo.courses': [['Pain de campagne', 'needs_action'], ['Lait', 'needs_action'], ['Pommes', 'needs_action'], ['Café', 'needs_action'], ['Piles', 'completed']]
        .map(([summary, status], i) => ({ summary, status, uid: `c${i}` })),
    };
  }

  start() {
    for (const st of this.fixture ? fixtureStates(this.fixture) : buildStates()) {
      const { area, flag, reg, ...rest } = st;
      this.states.set(st.entity_id, rest);
      this.areaOf.set(st.entity_id, area);
      if (flag) this.flags.set(st.entity_id, flag);
      if (reg) this.regExtra.set(st.entity_id, reg);
    }
    setTimeout(() => {
      this.connected = true;
      this.log.info('Demo mode: showing a sample home.');
      this.emit('ready');
    }, 50);
    // A little life: the speaker moves on, the outdoor temperature drifts.
    this.tick = setInterval(() => {
      const w = this.states.get('weather.maison');
      if (!w) return;
      const t = Math.round((12 + Math.sin(Date.now() / 3.6e6) * 2) * 10) / 10;
      if (w.attributes.temperature !== t) this._set('weather.maison', w.state, { temperature: t });
    }, 60000);
    if (this.tick.unref) this.tick.unref();
  }

  stop() { clearInterval(this.tick); }

  getConfig() {
    if (this.fixture && this.fixture.config) return Promise.resolve(this.fixture.config);
    return Promise.resolve({ location_name: 'Maison des Tilleuls', language: 'fr', time_zone: 'Europe/Paris', unit_system: { temperature: '°C' } });
  }

  getStates() { return Promise.resolve([...this.states.values()]); }
  getAreas() {
    const list = this.fixture ? this.fixture.areas : AREAS;
    return Promise.resolve(list.map(([area_id, name, icon]) => ({ area_id, name, icon: icon || null })));
  }
  getDevices() { return Promise.resolve([]); }

  getEntityRegistry() {
    return Promise.resolve([...this.states.keys()].map((entity_id) => {
      const flag = this.flags.get(entity_id);
      return {
        entity_id,
        area_id: this.areaOf.get(entity_id) || null,
        device_id: null,
        entity_category: flag === 'config' || flag === 'diagnostic' ? flag : null,
        hidden_by: flag === 'hidden' ? 'user' : null,
        disabled_by: null,
        ...(this.regExtra.get(entity_id) || {}),
      };
    }));
  }

  subscribeStateChanges(cb) {
    this.stateCb = cb;
    return Promise.resolve(1);
  }

  subscribeRegistryUpdates() { return Promise.resolve(); }

  async subscribeForecast(entityId, type, cb) {
    cb(this._forecast(type));
    return () => {};
  }

  getForecastOnce(entityId, type) { return Promise.resolve(this._forecast(type)); }

  _forecast(type) {
    const out = [];
    const conds = ['cloudy', 'partlycloudy', 'partlycloudy', 'rainy', 'cloudy', 'sunny', 'sunny', 'partlycloudy'];
    if (type === 'hourly') {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      for (let i = 1; i <= 24; i += 1) {
        const t = new Date(start.getTime() + i * 3600000);
        const h = t.getHours();
        const night = h < 8 || h >= 18;
        out.push({
          datetime: iso(t), condition: night ? (i % 5 === 0 ? 'cloudy' : 'clear-night') : conds[i % conds.length],
          temperature: Math.round(11 + 3 * Math.sin(((h - 9) / 24) * 2 * Math.PI)), precipitation_probability: (i * 7) % 40, wind_speed: 12 + (i % 6),
        });
      }
    } else {
      for (let i = 0; i < 8; i += 1) {
        const t = atToday(12, 0, i);
        out.push({ datetime: iso(t), condition: conds[(i + 2) % conds.length], temperature: 13 + (i % 3), templow: 6 + (i % 4), precipitation_probability: (i * 13) % 60 });
      }
    }
    return out;
  }

  getCalendarEvents(entityId) {
    const extra = this.extraEvents.filter((x) => x.cal === entityId).map((x) => x.ev);
    return this._calendar(entityId).then((list) => list.concat(extra));
  }

  _calendar(entityId) {
    const ev = (title, d, h1, m1, h2, m2, location) => ({
      summary: title, start: { dateTime: iso(atToday(h1, m1, d)) }, end: { dateTime: iso(atToday(h2, m2, d)) }, location,
    });
    if (entityId === 'calendar.famille') {
      return Promise.resolve([
        ev('Marché couvert', 0, 9, 0, 10, 0),
        ev('Atelier poterie', 0, 14, 0, 16, 0, 'Atelier des Remparts'),
        ev('Dîner chez Léa', 0, 19, 30, 22, 0),
        ev('Cours de natation', 1, 18, 0, 19, 0),
        ev('Anniversaire de Mamie', 3, 12, 0, 15, 0),
        { summary: 'Vacances de Noël', start: { date: atToday(0, 0, 40).toISOString().slice(0, 10) }, end: { date: atToday(0, 0, 41).toISOString().slice(0, 10) } },
      ]);
    }
    return Promise.resolve([
      ev("Point d'équipe", 1, 9, 30, 10, 0),
      ev('Revue de projet', 2, 14, 0, 15, 30),
      ev('Formation sécurité', -1, 10, 0, 12, 0),
    ]);
  }

  getTodoItems(entityId) {
    return Promise.resolve((this.lists[entityId] || []).map((i) => ({ ...i })));
  }

  browseMedia(entityId, id) {
    const dir = (title, mid, children) => ({ title, media_class: 'directory', media_content_id: mid, media_content_type: 'directory', can_expand: true, can_play: false, children });
    const item = (title, mid, type) => ({ title, media_class: 'music', media_content_id: mid, media_content_type: type, can_play: true, can_expand: false });
    if (id === 'radios') return Promise.resolve(dir('Radios', 'radios', DEMO_RADIOS.map((t, i) => item(t, `radio:${i}`, 'audio/mpeg'))));
    if (id === 'playlists') return Promise.resolve(dir('Playlists', 'playlists', DEMO_PLAYLISTS.map((t, i) => item(t, `playlist:${i}`, 'playlist'))));
    // Like Home Assistant, the root also lists media sources that have nothing to play on a speaker.
    const cams = { title: 'Camera', media_class: 'app', media_content_id: 'media-source://camera', media_content_type: 'app', can_expand: true, can_play: false };
    return Promise.resolve(dir('Musique', 'root', [dir('Radios', 'radios'), dir('Playlists', 'playlists'), cams]));
  }

  getEnergyPrefs() {
    return Promise.resolve({ energy_sources: [{ type: 'grid', stat_energy_from: 'demo:linky', stat_cost: 'demo:linky_cost' }] });
  }

  statistics(ids, startIso, period) {
    // A plausible home: 2.5 to 4.5 kWh a day at 0.1952 €/kWh.
    const day = 86400e3;
    const start = Date.parse(startIso);
    const out = {};
    for (const id of ids) {
      const cost = id.endsWith('_cost');
      const rows = [];
      if (period === 'month') {
        const kwh = 3.1 * new Date().getDate();
        rows.push({ start: start, end: Date.now(), change: cost ? kwh * 0.1952 : kwh });
      } else {
        for (let t = Math.floor(start / day) * day; t + day <= Date.now(); t += day) {
          const kwh = 2.5 + ((Math.sin(t / day) + 1) * 1.0);
          rows.push({ start: t, end: t + day, change: Math.round((cost ? kwh * 0.1952 : kwh) * 100) / 100 });
        }
      }
      out[id] = rows;
    }
    return Promise.resolve(out);
  }

  searchMedia(entityId, query) {
    const q = String(query).toLowerCase();
    const item = (title, mid, type, cls) => ({ title, media_class: cls, media_content_id: mid, media_content_type: type, can_play: true, can_expand: false });
    const out = [];
    TRACKS.forEach(([title, artist], i) => {
      if (`${title} ${artist}`.toLowerCase().includes(q)) out.push(item(`${title} · ${artist}`, `track:${i}`, 'track', 'track'));
    });
    DEMO_PLAYLISTS.forEach((t, i) => { if (t.toLowerCase().includes(q)) out.push(item(t, `playlist:${i}`, 'playlist', 'playlist')); });
    DEMO_RADIOS.forEach((t, i) => { if (t.toLowerCase().includes(q)) out.push(item(t, `radio:${i}`, 'audio/mpeg', 'music')); });
    return Promise.resolve(out);
  }

  _set(id, state, attrs) {
    const st = this.states.get(id);
    if (!st) return;
    const now = iso(Date.now());
    const ns = {
      ...st,
      state,
      attributes: { ...st.attributes, ...attrs },
      last_changed: state !== st.state ? now : st.last_changed,
      last_updated: now,
    };
    for (const k of Object.keys(attrs)) if (attrs[k] === null) delete ns.attributes[k];
    this.states.set(id, ns);
    setTimeout(() => this.stateCb && this.stateCb({ entity_id: id, old_state: st, new_state: ns }), 120);
  }

  callService(domain, service, data = {}, target = {}) {
    const ids = [].concat(target.entity_id || []);
    for (const id of ids) this._apply(id, domain, service, data);
    return Promise.resolve({ context: { id: 'demo' } });
  }

  _apply(id, domain, service, data) {
    const st = this.states.get(id);
    if (!st) return;
    const on = st.state === 'on';
    switch (domain) {
      case 'light': {
        const turnOn = service === 'turn_on' || (service === 'toggle' && !on);
        if (!turnOn) return this._set(id, 'off', { brightness: null });
        const attrs = {};
        if (data.brightness_pct !== undefined) attrs.brightness = Math.round((data.brightness_pct / 100) * 255);
        else if (!st.attributes.brightness && (st.attributes.supported_color_modes || []).some((m) => m !== 'onoff')) attrs.brightness = 204;
        if (data.color_temp_kelvin) attrs.color_temp_kelvin = data.color_temp_kelvin;
        return this._set(id, data.brightness_pct === 0 ? 'off' : 'on', attrs);
      }
      case 'switch': case 'input_boolean': case 'humidifier':
        return this._set(id, service === 'turn_on' || (service === 'toggle' && !on) ? 'on' : 'off', {});
      case 'fan':
        if (service === 'set_percentage') return this._set(id, data.percentage > 0 ? 'on' : 'off', { percentage: data.percentage });
        return this._set(id, service === 'turn_on' || (service === 'toggle' && !on) ? 'on' : 'off', {});
      case 'cover': {
        let pos = st.attributes.current_position;
        if (service === 'open_cover' || (service === 'toggle' && st.state === 'closed')) pos = 100;
        else if (service === 'close_cover' || service === 'toggle') pos = 0;
        else if (service === 'set_cover_position') pos = data.position;
        else return undefined;
        return this._set(id, pos > 0 ? 'open' : 'closed', pos === undefined ? {} : { current_position: pos });
      }
      case 'lock':
        return this._set(id, service === 'lock' ? 'locked' : 'unlocked', {});
      case 'climate':
        if (service === 'set_temperature') return this._set(id, st.state, { temperature: data.temperature });
        if (service === 'set_hvac_mode') return this._set(id, data.hvac_mode, { hvac_action: data.hvac_mode === 'off' ? 'off' : 'heating' });
        return this._set(id, service === 'turn_off' ? 'off' : 'heat', {});
      case 'media_player': {
        if (service === 'media_play_pause') return this._set(id, st.state === 'playing' ? 'paused' : 'playing', {});
        if (service === 'media_play') return this._set(id, 'playing', {});
        if (service === 'media_pause') return this._set(id, 'paused', {});
        if (service === 'media_next_track' || service === 'media_previous_track') {
          this.track = (this.track + (service === 'media_next_track' ? 1 : TRACKS.length - 1)) % TRACKS.length;
          const [title, artist] = TRACKS[this.track];
          return this._set(id, 'playing', { media_title: title, media_artist: artist, media_position: 0, media_position_updated_at: iso(Date.now()) });
        }
        if (service === 'volume_set') return this._set(id, st.state, { volume_level: data.volume_level });
        if (service === 'play_media') {
          const m = /^(radio|playlist|track):(\d+)$/.exec(data.media_content_id || '');
          if (m && m[1] === 'track' && TRACKS[Number(m[2])]) {
            this.track = Number(m[2]);
            const [title, artist] = TRACKS[this.track];
            return this._set(id, 'playing', { media_title: title, media_artist: artist, media_position: 0 });
          }
          const title = m ? (m[1] === 'radio' ? DEMO_RADIOS : DEMO_PLAYLISTS)[Number(m[2])] : data.media_content_id;
          return this._set(id, 'playing', { media_title: title, media_artist: m && m[1] === 'radio' ? 'Radio' : 'Playlist', media_position: 0 });
        }
        if (service === 'volume_mute') return this._set(id, st.state, { is_volume_muted: data.is_volume_muted });
        return undefined;
      }
      case 'scene':
        for (const [eid, state, attrs] of SCENES[id] || []) this._set(eid, state, attrs);
        return undefined;
      case 'calendar':
        if (service === 'create_event') {
          const start = data.start_date_time ? { dateTime: data.start_date_time } : { date: data.start_date };
          const end = data.end_date_time ? { dateTime: data.end_date_time } : { date: data.end_date };
          this.extraEvents.push({ cal: id, ev: { summary: data.summary, start, end, location: data.location } });
        }
        return undefined;
      case 'todo': {
        const list = this.lists[id] || (this.lists[id] = []);
        if (service === 'add_item') list.push({ summary: data.item, status: 'needs_action', uid: `n${Date.now()}` });
        const found = list.find((x) => x.uid === data.item || x.summary === data.item);
        if (service === 'update_item' && found && data.status) found.status = data.status;
        if (service === 'remove_item' && found) list.splice(list.indexOf(found), 1);
        return this._set(id, String(list.filter((x) => x.status !== 'completed').length), {});
      }
      case 'alarm_control_panel': {
        const map = { alarm_arm_home: 'armed_home', alarm_arm_away: 'armed_away', alarm_arm_night: 'armed_night', alarm_disarm: 'disarmed' };
        return this._set(id, map[service] || st.state, {});
      }
      default:
        return undefined;
    }
  }

  cameraImage(entityId) {
    return Promise.resolve({ type: 'image/svg+xml', body: Buffer.from(cameraSvg(entityId)) });
  }

  picture() {
    return Promise.resolve({ type: 'image/svg+xml', body: Buffer.from(artSvg(this.track)) });
  }
}

// ------------------------------------------------------------------ illustrations (all made up)
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function cameraSvg(id) {
  const scenes = {
    'camera.sonnette': `<rect width="1280" height="720" fill="url(#sky)"/><path d="M0 470 L1280 430 L1280 720 L0 720Z" fill="#e8edf2"/>
      <path d="M560 720 L610 470 L670 470 L720 720Z" fill="#9aa4ad"/><rect x="80" y="250" width="300" height="230" fill="#b9805a"/><path d="M60 260 L230 150 L400 260Z" fill="#5b3b2e"/>
      <rect x="900" y="230" width="320" height="240" fill="#c99a72"/><path d="M880 240 L1060 130 L1240 240Z" fill="#6d4636"/><circle cx="1000" cy="560" r="46" fill="#f4f6f8"/><circle cx="1000" cy="500" r="30" fill="#f4f6f8"/>`,
    'camera.jardin': `<rect width="1280" height="720" fill="url(#sky)"/><path d="M0 330 L1280 300 L1280 720 L0 720Z" fill="#5d8a3a"/>
      <rect x="120" y="200" width="18" height="190" fill="#6b4b2a"/><rect x="330" y="200" width="18" height="190" fill="#6b4b2a"/><rect x="120" y="200" width="228" height="14" fill="#6b4b2a"/>
      <circle cx="760" cy="520" r="40" fill="#e0a94a"/><rect x="980" y="160" width="40" height="260" fill="#4a3624"/><circle cx="1000" cy="150" r="120" fill="#3d6b2c"/>`,
    'camera.allee': `<rect width="1280" height="720" fill="url(#sky)"/><path d="M0 380 L1280 360 L1280 720 L0 720Z" fill="#6f7a52"/>
      <path d="M380 720 L640 380 L900 380 L1180 720Z" fill="#a9aaa6"/><rect x="700" y="420" width="280" height="120" rx="30" fill="#3b4148"/><rect x="740" y="380" width="190" height="70" rx="22" fill="#2b3036"/>
      <rect x="40" y="170" width="420" height="230" fill="#8b98a6"/><path d="M20 180 L250 80 L480 180Z" fill="#474f58"/>`,
  };
  const label = { 'camera.sonnette': 'SONNETTE', 'camera.jardin': 'JARDIN', 'camera.allee': 'ALLÉE' }[id] || 'CAMÉRA';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb8cf"/><stop offset="1" stop-color="#dfe7ee"/></linearGradient></defs>
    ${scenes[id] || '<rect width="1280" height="720" fill="#444"/>'}
    <rect width="1280" height="720" fill="#20262c" opacity="0.12"/>
    <text x="40" y="680" font-family="Menlo, monospace" font-size="30" fill="#fff" opacity="0.85">${label}  ${stamp()}</text></svg>`;
}

function artSvg(n) {
  const palettes = [['#f97316', '#7c3aed'], ['#0ea5e9', '#14532d'], ['#e11d48', '#f59e0b'], ['#22c55e', '#1e3a8a']];
  const [a, b] = palettes[n % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="600" height="600" fill="url(#g)"/><circle cx="420" cy="190" r="90" fill="#fff" opacity="0.85"/>
    <path d="M0 430 Q150 330 300 420 T600 400 L600 600 L0 600Z" fill="#000" opacity="0.28"/></svg>`;
}

function photoSvg(n) {
  const scenes = {
    1: `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d1b69"/><stop offset="0.55" stop-color="#f25f5c"/><stop offset="1" stop-color="#ffd166"/></linearGradient></defs>
      <rect width="1600" height="1200" fill="url(#s)"/><circle cx="1050" cy="690" r="150" fill="#ffe8a3"/>
      <path d="M0 820 Q300 640 640 800 T1600 760 L1600 1200 L0 1200Z" fill="#3b2a4d"/><path d="M0 950 Q400 820 900 940 T1600 900 L1600 1200 L0 1200Z" fill="#22172e"/>`,
    2: `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4f0"/><stop offset="1" stop-color="#e6f4fb"/></linearGradient></defs>
      <rect width="1600" height="1200" fill="url(#s)"/><path d="M0 760 L380 330 L640 620 L920 260 L1300 700 L1600 520 L1600 820 L0 820Z" fill="#5b7186"/>
      <path d="M380 330 L470 430 L410 420 L360 460Z M920 260 L1010 360 L950 350 L880 400Z" fill="#fff"/><rect y="820" width="1600" height="380" fill="#3e7fa6"/>
      <path d="M0 820 L380 1100 L640 900 L920 1160 L1300 920 L1600 1000 L1600 820Z" fill="#5b7186" opacity="0.35"/>`,
    3: `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f3b3a"/><stop offset="1" stop-color="#7fb685"/></linearGradient></defs>
      <rect width="1600" height="1200" fill="url(#s)"/>${[120, 330, 520, 760, 980, 1180, 1420].map((x, i) => `<path d="M${x} ${1200 - (i % 2) * 40} L${x + 120} ${520 + (i % 3) * 60} L${x + 240} ${1200 - (i % 2) * 40}Z" fill="#0b2a26" opacity="${0.75 + (i % 2) * 0.2}"/>`).join('')}
      <circle cx="1180" cy="260" r="80" fill="#fdf6d8" opacity="0.9"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200" preserveAspectRatio="xMidYMid slice">${scenes[n] || scenes[1]}</svg>`;
}

module.exports = { DemoSource, photoSvg, cameraSvg };
