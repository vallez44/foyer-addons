'use strict';
const { EventEmitter } = require('events');

const MAX_PICTURE = 12 * 1024 * 1024;

async function readPicture(res) {
  if (!res.ok) throw new Error(`picture ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) throw new Error('not a picture');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PICTURE) throw new Error('picture too large');
  return { type, body: buf };
}

/** Adapts the raw Home Assistant connection to the small interface the Home model uses. */
class HASource extends EventEmitter {
  constructor(conn) {
    super();
    this.conn = conn;
    this.kind = 'ha';
    conn.on('ready', () => this.emit('ready'));
    conn.on('disconnected', () => this.emit('disconnected'));
  }

  get connected() { return this.conn.connected; }
  get authFailed() { return this.conn.authFailed; }
  start() { this.conn.start(); }
  stop() { this.conn.stop(); }

  getConfig() { return this.conn.command({ type: 'get_config' }); }
  getStates() { return this.conn.command({ type: 'get_states' }, 60000); }
  getAreas() { return this.conn.command({ type: 'config/area_registry/list' }); }
  getDevices() { return this.conn.command({ type: 'config/device_registry/list' }, 60000); }
  getEntityRegistry() { return this.conn.command({ type: 'config/entity_registry/list' }, 60000); }

  subscribeStateChanges(cb) {
    return this.conn.subscribe({ type: 'subscribe_events', event_type: 'state_changed' }, (ev) => cb(ev.data));
  }

  async subscribeRegistryUpdates(cb) {
    for (const t of ['area_registry_updated', 'device_registry_updated', 'entity_registry_updated']) {
      await this.conn.subscribe({ type: 'subscribe_events', event_type: t }, () => cb(t));
    }
  }

  async subscribeForecast(entityId, forecastType, cb) {
    const id = await this.conn.subscribe(
      { type: 'weather/subscribe_forecast', entity_id: entityId, forecast_type: forecastType },
      (ev) => cb((ev && ev.forecast) || []),
    );
    return () => this.conn.unsubscribe(id);
  }

  async getForecastOnce(entityId, forecastType) {
    const r = await this.conn.callService('weather', 'get_forecasts', { type: forecastType }, { entity_id: entityId }, true);
    const resp = r && r.response && r.response[entityId];
    return (resp && resp.forecast) || [];
  }

  async getCalendarEvents(entityId, startIso, endIso) {
    const q = `?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
    const res = await this.conn.rest(`/calendars/${encodeURIComponent(entityId)}${q}`);
    if (!res.ok) throw new Error(`calendar ${entityId}: ${res.status}`);
    return res.json();
  }

  async getTodoItems(entityId) {
    const r = await this.conn.command({ type: 'todo/item/list', entity_id: entityId });
    return (r && r.items) || [];
  }

  callService(domain, service, data, target) {
    return this.conn.callService(domain, service, data, target);
  }

  browseMedia(entityId, contentId, contentType) {
    const msg = { type: 'media_player/browse_media', entity_id: entityId };
    if (contentId) msg.media_content_id = contentId;
    if (contentType) msg.media_content_type = contentType;
    return this.conn.command(msg, 30000);
  }

  async cameraImage(entityId) {
    return readPicture(await this.conn.rest(`/camera_proxy/${encodeURIComponent(entityId)}`));
  }

  async picture(apiPath) {
    return readPicture(await this.conn.fetchPicture(apiPath));
  }
}

module.exports = { HASource, readPicture };
