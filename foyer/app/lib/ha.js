'use strict';
const { EventEmitter } = require('events');

/**
 * Minimal Home Assistant WebSocket + REST client.
 * Emits: 'ready' (after auth_ok, subscriptions must be (re)made by the listener), 'disconnected'.
 * The token never leaves this module.
 */
class HAConnection extends EventEmitter {
  constructor({ wsUrl, restUrl, token, log, WebSocketImpl, fetchImpl }) {
    super();
    this.wsUrl = wsUrl;
    this.restUrl = restUrl;
    this.token = token;
    this.log = log;
    this.WebSocketImpl = WebSocketImpl || globalThis.WebSocket;
    this.fetchImpl = fetchImpl || globalThis.fetch;
    this.nextId = 1;
    this.pending = new Map();
    this.subs = new Map();
    this.connected = false;
    this.backoff = 1000;
    this.stopped = false;
    this.authFailed = false;
    this.haVersion = null;
    this.ws = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
  }

  start() {
    this.stopped = false;
    this._connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
    }
  }

  _connect() {
    if (this.stopped) return;
    let ws;
    try {
      ws = new this.WebSocketImpl(this.wsUrl);
    } catch (e) {
      this.log.warn(`Home Assistant connection failed: ${e.message}`);
      this._scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onmessage = (ev) => this._onMessage(ev.data);
    ws.onclose = () => this._onClose(ws);
    ws.onerror = () => { /* onclose follows */ };
  }

  _scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.reconnectTimer);
    const delay = this.authFailed ? 60000 : this.backoff;
    this.backoff = Math.min(this.backoff * 2, 30000);
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  _onClose(ws) {
    if (ws !== this.ws) return;
    const wasConnected = this.connected;
    this.connected = false;
    clearInterval(this.pingTimer);
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('connection closed'));
    }
    this.pending.clear();
    this.subs.clear();
    if (wasConnected) {
      this.log.warn('Lost the connection to Home Assistant, reconnecting.');
      this.emit('disconnected');
    } else if (!this.warnedUnreachable && !this.authFailed) {
      this.warnedUnreachable = true;
      this.log.warn(`Cannot reach Home Assistant at ${this.wsUrl}, retrying.`);
    }
    this._scheduleReconnect();
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8'));
    } catch (e) {
      return;
    }
    const list = Array.isArray(msg) ? msg : [msg];
    for (const m of list) this._handle(m);
  }

  _handle(m) {
    switch (m.type) {
      case 'auth_required':
        this._raw({ type: 'auth', access_token: this.token });
        break;
      case 'auth_ok':
        this.connected = true;
        this.authFailed = false;
        this.warnedUnreachable = false;
        this.backoff = 1000;
        this.haVersion = m.ha_version || null;
        this._startPing();
        this.log.info(`Connected to Home Assistant ${this.haVersion || ''}`.trim());
        this.emit('ready');
        break;
      case 'auth_invalid':
        this.authFailed = true;
        this.log.error(`Home Assistant refused the sign-in: ${m.message || 'invalid token'}`);
        try { this.ws.close(); } catch (e) { /* ignore */ }
        break;
      case 'result': {
        const p = this.pending.get(m.id);
        if (!p) break;
        this.pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.success) p.resolve(m.result);
        else {
          const err = new Error((m.error && m.error.message) || 'Home Assistant error');
          err.code = m.error && m.error.code;
          p.reject(err);
        }
        break;
      }
      case 'event': {
        const cb = this.subs.get(m.id);
        if (cb) {
          try { cb(m.event); } catch (e) { this.log.error('subscription handler failed', e); }
        }
        break;
      }
      case 'pong': {
        const p = this.pending.get(m.id);
        if (p) {
          this.pending.delete(m.id);
          clearTimeout(p.timer);
          p.resolve(true);
        }
        break;
      }
      default:
        break;
    }
  }

  _raw(obj) {
    if (!this.ws) return;
    this.ws.send(JSON.stringify(obj));
  }

  _startPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' }, 10000).catch(() => {
        this.log.warn('Home Assistant did not answer a ping, reconnecting.');
        try { this.ws.close(); } catch (e) { /* ignore */ }
      });
    }, 30000);
  }

  /** Sends a command and resolves with its result. onEvent makes it a subscription. */
  send(msg, timeoutMs = 30000, onEvent = null) {
    if (!this.connected) return Promise.reject(new Error('not connected to Home Assistant'));
    const id = this.nextId++;
    if (onEvent) this.subs.set(id, onEvent);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Home Assistant did not answer ${msg.type}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this._raw(Object.assign({ id }, msg));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        this.subs.delete(id);
        reject(e);
      }
    }).then((result) => ({ id, result }), (err) => {
      this.subs.delete(id);
      throw err;
    });
  }

  async command(msg, timeoutMs) {
    const { result } = await this.send(msg, timeoutMs);
    return result;
  }

  async subscribe(msg, onEvent) {
    const { id } = await this.send(msg, 30000, onEvent);
    return id;
  }

  async unsubscribe(subId) {
    this.subs.delete(subId);
    if (!this.connected) return;
    try {
      await this.command({ type: 'unsubscribe_events', subscription: subId });
    } catch (e) { /* already gone */ }
  }

  callService(domain, service, data, target, returnResponse = false) {
    const msg = { type: 'call_service', domain, service };
    if (data && Object.keys(data).length) msg.service_data = data;
    if (target) msg.target = target;
    if (returnResponse) msg.return_response = true;
    return this.command(msg, 20000);
  }

  /** REST call to Home Assistant's API (relative path like /calendars/calendar.x). */
  async rest(pathAndQuery, { method = 'GET', body, timeoutMs = 15000 } = {}) {
    const headers = { Authorization: `Bearer ${this.token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return this.fetchImpl(this.restUrl + pathAndQuery, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
  }

  /** Fetches a picture path Home Assistant gave us (must stay inside /api/...). */
  async fetchPicture(apiPath, timeoutMs = 15000) {
    // Only Home Assistant's own picture proxies; the query (token, cache URL) is passed as is.
    const path = typeof apiPath === 'string' ? apiPath.split('?')[0] : '';
    if (!/^\/api\/(media_player_proxy|camera_proxy|image_proxy|brands)\/[\w.@-]+(\/[\w.@-]+)*$/.test(path) || path.includes('..')) {
      throw new Error('refused picture path');
    }
    return this.rest(apiPath.slice(4), { timeoutMs });
  }
}

module.exports = { HAConnection };
