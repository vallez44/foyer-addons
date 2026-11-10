'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const silent = { info() {}, warn() {}, error() {}, debug() {} };

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'foyer-test-'));
}

const iso = (ms = Date.now()) => new Date(ms).toISOString();
const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes, last_changed: iso(), last_updated: iso() });

/** A home shaped like a real one without thermostat, cameras or scenes (lights, doors, alarm, speakers, calendars). */
function realisticHome() {
  return {
    config: { location_name: 'Maison', language: 'fr', time_zone: 'Europe/Paris', unit_system: { temperature: '°C' } },
    areas: [['salon', 'Salon'], ['cuisine', 'Cuisine'], ['chambre', 'Chambre'], ['entree', 'Entrée'], ['salle_de_bain', 'Salle de bain']]
      .map(([area_id, name]) => ({ area_id, name, icon: null })),
    devices: [
      { id: 'd1', area_id: 'chambre', name: 'Lampe Chambre 1' }, { id: 'd2', area_id: 'salle_de_bain', name: 'Lampe SDB' },
      { id: 'd3', area_id: 'salon', name: 'Lampe 1' }, { id: 'd4', area_id: 'entree', name: 'Lampe Entrée' },
      { id: 'd5', area_id: 'salon', name: 'Lampe 2' }, { id: 'd6', area_id: 'chambre', name: 'Guirlande' },
      { id: 'd7', area_id: 'entree', name: 'Capteur Porte Entrée' }, { id: 'd8', area_id: 'salon', name: 'Baie' },
      { id: 'd9', area_id: 'salon', name: 'Z2M bridge' }, { id: 'd10', area_id: 'chambre', name: 'Enceinte Chambre' },
    ],
    entities: [
      ['light.lampe_chambre_1', 'd1'], ['light.lampe_sdb', 'd2'], ['light.lampe_1', 'd3'], ['light.lampe_entree', 'd4'], ['light.lampe_2', 'd5'],
      ['switch.guirlande', 'd6'], ['binary_sensor.capteur_porte_entree_contact', 'd7'], ['binary_sensor.detecteur_vitre_salon_contact', 'd8'],
      ['binary_sensor.capteur_porte_entree_battery_low', 'd7', 'diagnostic'], ['switch.zigbee2mqtt_bridge_permit_join', 'd9', 'config'],
      ['button.nas_shut_down', null, 'config'], ['media_player.enceinte_chambre', 'd10'],
      ['switch.foyer_releve_homepod', null, null, ['masquer_dans_foyer']],
    ].map(([entity_id, device_id, entity_category, labels]) => ({
      entity_id, device_id, area_id: null, entity_category: entity_category || null, hidden_by: null, disabled_by: null, labels: labels || [],
    })),
    states: [
      st('light.lampe_chambre_1', 'off', { friendly_name: 'Lampe Chambre 1', supported_color_modes: ['brightness'] }),
      st('light.lampe_sdb', 'unavailable', { friendly_name: 'Lampe SDB', supported_color_modes: ['brightness'] }),
      st('light.lampe_1', 'off', { friendly_name: 'Lampe 1', supported_color_modes: ['brightness'] }),
      st('light.lampe_entree', 'off', { friendly_name: 'Lampe Entrée', supported_color_modes: ['brightness'] }),
      st('light.lampe_2', 'on', { friendly_name: 'Lampe 2', brightness: 128, supported_color_modes: ['color_temp', 'xy'] }),
      st('switch.guirlande', 'off', { friendly_name: 'Guirlande' }),
      st('switch.foyer_releve_homepod', 'off', { friendly_name: 'Foyer relevé HomePod' }),
      st('switch.zigbee2mqtt_bridge_permit_join', 'off', { friendly_name: 'Zigbee2MQTT Bridge Permit join' }),
      st('button.nas_shut_down', 'unknown', { friendly_name: 'NAS Arrêter' }),
      st('binary_sensor.capteur_porte_entree_contact', 'off', { friendly_name: 'Capteur Porte Entrée', device_class: 'door' }),
      st('binary_sensor.detecteur_vitre_salon_contact', 'off', { friendly_name: 'Capteur Baie Salon', device_class: 'door' }),
      st('binary_sensor.capteur_porte_entree_battery_low', 'off', { friendly_name: 'Batterie', device_class: 'battery' }),
      st('alarm_control_panel.alarme', 'disarmed', { friendly_name: 'Alarme', supported_features: 11 }),
      st('media_player.enceinte_chambre', 'idle', { friendly_name: 'Enceinte Chambre', volume_level: 0.46, entity_picture: '/api/media_player_proxy/media_player.enceinte_chambre?token=SECRET&cache=1' }),
      st('weather.forecast_maison', 'cloudy', { friendly_name: 'Forecast Maison', temperature: 15.8, humidity: 79, supported_features: 3 }),
      st('calendar.personnel', 'off', { friendly_name: 'Personnel' }),
      st('todo.rappels', '2', { friendly_name: 'Rappels' }),
      st('sun.sun', 'below_horizon', { next_rising: iso(Date.now() + 3600e3), next_setting: iso(Date.now() + 10 * 3600e3) }),
      st('update.home_assistant_core_update', 'on', { friendly_name: 'Core update' }),
      st('person.maison', 'not_home', { friendly_name: 'Maison', latitude: 48.8566, longitude: 2.3522 }),
    ],
  };
}

/**
 * A fake Home Assistant WebSocket server: answers auth, get_config, registries, get_states,
 * subscriptions, forecasts, lists and service calls the way Home Assistant does.
 */
function makeFakeWs(home, opts = {}) {
  const calls = [];
  class FakeWS {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.subs = {};
      FakeWS.instances.push(this);
      setTimeout(() => this._emit({ type: 'auth_required', ha_version: '2026.10.4' }), 1);
    }
    _emit(o) { setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(o) }), 1); }
    result(id, result, success = true) { this._emit(success ? { id, type: 'result', success: true, result } : { id, type: 'result', success: false, error: { code: 'x', message: result } }); }
    send(raw) {
      const m = JSON.parse(raw);
      this.sent.push(m);
      switch (m.type) {
        case 'auth':
          this._emit(m.access_token === (opts.token || 'good') ? { type: 'auth_ok', ha_version: '2026.10.4' } : { type: 'auth_invalid', message: 'Invalid access token' });
          break;
        case 'get_config': this.result(m.id, home.config); break;
        case 'config/area_registry/list': this.result(m.id, home.areas); break;
        case 'config/device_registry/list': this.result(m.id, home.devices); break;
        case 'config/entity_registry/list': this.result(m.id, home.entities); break;
        case 'get_states': this.result(m.id, home.states); break;
        case 'subscribe_events': this.subs[m.event_type] = m.id; this.result(m.id, null); break;
        case 'weather/subscribe_forecast':
          this.result(m.id, null);
          this._emit({ id: m.id, type: 'event', event: { type: m.forecast_type, forecast: [{ datetime: iso(), condition: 'rainy', temperature: 12, templow: 7 }] } });
          break;
        case 'todo/item/list': this.result(m.id, { items: [{ summary: 'Pain', uid: '1', status: 'needs_action' }, { summary: 'Lait', uid: '2', status: 'completed' }] }); break;
        case 'call_service':
          calls.push(m);
          if (m.service === 'search_media' && m.return_response) {
            const result = [
              { title: 'Clair de lune', media_class: 'track', media_content_id: 'apple_music://track/1', media_content_type: 'track', can_play: true, can_expand: false },
              { title: 'Caméra', media_class: 'app', media_content_id: 'media-source://camera/camera.x', media_content_type: 'app', can_play: false, can_expand: true },
            ];
            this.result(m.id, { context: { id: 'c' }, response: { [m.target.entity_id]: { result } } });
          } else {
            this.result(m.id, { context: { id: 'c' } });
          }
          break;
        case 'ping': this._emit({ id: m.id, type: 'pong' }); break;
        case 'unsubscribe_events': this.result(m.id, null); break;
        default: this.result(m.id, `unknown command ${m.type}`, false);
      }
    }
    fireState(entity_id, new_state) {
      const id = this.subs.state_changed;
      this._emit({ id, type: 'event', event: { event_type: 'state_changed', data: { entity_id, new_state } } });
    }
    close() { setTimeout(() => this.onclose && this.onclose({}), 1); }
  }
  FakeWS.instances = [];
  FakeWS.calls = calls;
  return FakeWS;
}

function fakeFetch(routes) {
  return async (url) => {
    for (const [re, body, type] of routes) {
      if (re.test(url)) {
        const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
        return {
          ok: true, status: 200,
          headers: { get: (k) => (k.toLowerCase() === 'content-type' ? (type || 'application/json') : null) },
          json: async () => JSON.parse(buf.toString()),
          arrayBuffer: async () => buf,
        };
      }
    }
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}), arrayBuffer: async () => Buffer.alloc(0) };
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await wait(10);
  }
  throw new Error('timed out');
}

module.exports = { silent, tmpDir, realisticHome, makeFakeWs, fakeFetch, wait, until, st, iso };
