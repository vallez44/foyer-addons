'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const log = {
  debugOn: process.env.FOYER_DEBUG === '1',
  info: (...a) => console.log(`[${ts()}] INFO:`, ...a),
  warn: (...a) => console.warn(`[${ts()}] WARNING:`, ...a),
  error: (...a) => console.error(`[${ts()}] ERROR:`, ...a),
  debug: (...a) => { if (log.debugOn) console.log(`[${ts()}] DEBUG:`, ...a); },
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

/** Atomic write: temp file then rename, readable only by this process. */
function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const randomId = (bytes = 6) => crypto.randomBytes(bytes).toString('hex');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function randomDigits(n) {
  let out = '';
  while (out.length < n) out += crypto.randomInt(0, 10).toString();
  return out;
}

/** Constant-time compare of two hex digests of equal length. */
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function normalizeIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7))) return ip.slice(7);
  return ip;
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function inCidr4(ip, base, bits) {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

/** Home networks only: RFC1918, loopback, link-local, CGNAT (Tailscale), IPv6 ULA / link-local / Tailscale. */
function isPrivateIp(raw) {
  const ip = normalizeIp(raw);
  if (net.isIPv4(ip)) {
    return inCidr4(ip, '10.0.0.0', 8) || inCidr4(ip, '172.16.0.0', 12) || inCidr4(ip, '192.168.0.0', 16) ||
      inCidr4(ip, '127.0.0.0', 8) || inCidr4(ip, '169.254.0.0', 16) || inCidr4(ip, '100.64.0.0', 10);
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') ||
      l.startsWith('fea') || l.startsWith('feb');
  }
  return false;
}

/**
 * Protects the direct port against DNS rebinding: only names a home network uses are answered.
 * IP literals, *.local, *.lan, *.home, *.home.arpa, *.internal, one-word names, Tailscale (*.ts.net) and extra names.
 */
function isAllowedHost(hostHeader, extra = []) {
  if (!hostHeader) return false;
  let host = String(hostHeader).trim().toLowerCase();
  if (host.startsWith('[')) host = host.slice(1, host.indexOf(']'));
  else host = host.replace(/:\d+$/, '');
  if (!host) return false;
  if (net.isIP(host)) return true;
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  if (!host.includes('.')) return true;
  const suffixes = ['.local', '.lan', '.home', '.home.arpa', '.internal', '.ts.net', '.localhost'];
  if (suffixes.some((s) => host.endsWith(s))) return true;
  return extra.includes(host);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch (e) {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

function debounce(fn, ms) {
  let t = null;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

function formatCode(code) {
  const c = String(code);
  return c.length === 8 ? `${c.slice(0, 4)} ${c.slice(4)}` : c;
}

module.exports = {
  log, readJson, writeJsonAtomic, randomToken, randomId, randomDigits, sha256, safeEqualHex,
  normalizeIp, isPrivateIp, isAllowedHost, parseCookies, debounce, formatCode,
};
