'use strict';
const { randomDigits, randomToken, randomId, sha256, safeEqualHex, formatCode } = require('./util');

const DAY = 86400000;
const CODE_TTL = 7 * DAY;
const DEVICE_IDLE_LIMIT = 90 * DAY;
const MAX_FAILS = 8;
const FAIL_WINDOW = 5 * 60 * 1000;

const codeHash = (code) => sha256(`foyer-code:${String(code).replace(/\D/g, '')}`);
const tokenHash = (token) => sha256(`foyer-device:${token}`);

class PairingError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/**
 * iPads that open Foyer on its own port pair once with a code, then keep a device cookie.
 * Codes: one-time 8-digit codes valid 7 days (setup sheets, the log), or a fixed code from the add-on options.
 */
class Pairing {
  constructor({ store, config, log, now = () => Date.now() }) {
    this.store = store;
    this.config = config;
    this.log = log;
    this.now = now;
    this.fails = new Map();
    this._applyFixedCode();
    this._prune();
  }

  get devices() { return this.store.data.devices; }
  get codes() { return this.store.data.codes; }

  /** A new fixed code forgets every paired iPad (that is how you remove them all at once). */
  _applyFixedCode() {
    const fixed = this.config.fixedPairingCode;
    const h = fixed ? codeHash(fixed) : null;
    if (h && this.store.data.fixedCodeHash && this.store.data.fixedCodeHash !== h && this.devices.length) {
      this.log.info('The pairing code changed: every paired iPad must pair again.');
      this.store.data.devices = [];
    }
    this.store.data.fixedCodeHash = h;
    this.store.save();
  }

  _prune() {
    const t = this.now();
    const before = this.codes.length + this.devices.length;
    this.store.data.codes = this.codes.filter((c) => c.expires > t);
    this.store.data.devices = this.devices.filter((d) => t - (d.lastSeen || d.created) < DEVICE_IDLE_LIMIT);
    if (this.codes.length + this.devices.length !== before) this.store.save();
  }

  createCode(purpose = 'setup') {
    this._prune();
    if (purpose === 'log') this.store.data.codes = this.codes.filter((c) => c.purpose !== 'log');
    const code = randomDigits(8);
    this.codes.push({ hash: codeHash(code), purpose, created: this.now(), expires: this.now() + CODE_TTL });
    this.store.save();
    return { code, display: formatCode(code), expires: this.now() + CODE_TTL };
  }

  hasAdmin() {
    return this.devices.some((d) => d.admin);
  }

  _limited(ip) {
    const t = this.now();
    const list = (this.fails.get(ip) || []).filter((x) => t - x < FAIL_WINDOW);
    this.fails.set(ip, list);
    if (list.length >= MAX_FAILS) return Math.ceil((list[0] + FAIL_WINDOW - t) / 1000);
    return 0;
  }

  _fail(ip) {
    const list = this.fails.get(ip) || [];
    list.push(this.now());
    this.fails.set(ip, list);
  }

  /** Returns { device, token } or throws PairingError. */
  pair({ code, name, ua, ip, standalone }) {
    const wait = this._limited(ip);
    if (wait) throw new PairingError('too many tries', 429, wait);
    const digits = String(code || '').replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 12) {
      this._fail(ip);
      throw new PairingError('wrong code', 401);
    }
    this._prune();
    const h = codeHash(digits);
    let purpose = null;
    if (this.store.data.fixedCodeHash && safeEqualHex(h, this.store.data.fixedCodeHash)) {
      purpose = 'fixed';
    } else {
      const idx = this.codes.findIndex((c) => safeEqualHex(c.hash, h));
      if (idx >= 0) {
        purpose = this.codes[idx].purpose;
        this.codes.splice(idx, 1); // one time
      }
    }
    if (!purpose) {
      this._fail(ip);
      throw new PairingError('wrong code', 401);
    }
    this.fails.delete(ip);
    const token = randomToken(32);
    const device = {
      id: randomId(6),
      name: (typeof name === 'string' && name.trim().slice(0, 40)) || guessName(ua),
      tokenHash: tokenHash(token),
      created: this.now(),
      lastSeen: this.now(),
      ua: String(ua || '').slice(0, 160),
      // Standalone has no Home Assistant sidebar: the iPad that set Foyer up becomes its admin.
      admin: Boolean(standalone && (purpose === 'log' || !this.hasAdmin())),
    };
    this.devices.push(device);
    this.store.save();
    this.log.info(`Paired a new device: ${device.name}${device.admin ? ' (admin)' : ''}.`);
    return { device, token };
  }

  deviceByToken(token) {
    if (!token || typeof token !== 'string' || token.length < 20) return null;
    const h = tokenHash(token);
    const d = this.devices.find((x) => safeEqualHex(x.tokenHash, h));
    if (!d) return null;
    const t = this.now();
    if (t - (d.lastSeen || d.created) >= DEVICE_IDLE_LIMIT) {
      this.remove(d.id);
      return null;
    }
    if (t - d.lastSeen > 60000) {
      d.lastSeen = t;
      this.store.saveSoon();
    }
    return d;
  }

  list() {
    return this.devices.map((d) => ({ id: d.id, name: d.name, created: d.created, lastSeen: d.lastSeen, admin: Boolean(d.admin), ua: d.ua }));
  }

  rename(id, name) {
    const d = this.devices.find((x) => x.id === id);
    if (!d || typeof name !== 'string' || !name.trim()) return false;
    d.name = name.trim().slice(0, 40);
    this.store.save();
    return true;
  }

  makeAdmin(id) {
    const d = this.devices.find((x) => x.id === id);
    if (!d) return false;
    for (const x of this.devices) x.admin = x.id === id;
    this.store.save();
    return true;
  }

  remove(id) {
    const n = this.devices.length;
    this.store.data.devices = this.devices.filter((d) => d.id !== id);
    if (this.devices.length !== n) {
      this.store.save();
      return true;
    }
    return false;
  }
}

function guessName(ua) {
  const s = String(ua || '');
  if (/iPad/.test(s)) return 'iPad';
  if (/iPhone/.test(s)) return 'iPhone';
  if (/Macintosh/.test(s)) return /Mobile/.test(s) ? 'iPad' : 'Mac';
  if (/Android/.test(s)) return 'Android';
  return 'Écran';
}

module.exports = { Pairing, PairingError, codeHash, tokenHash };
