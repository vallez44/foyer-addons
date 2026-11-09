'use strict';
const fs = require('fs');
const path = require('path');
const { readJson, log } = require('./util');

const VERSION = require('../package.json').version;

/**
 * Three ways to run:
 *  - addon:      inside Home Assistant OS / Supervised (SUPERVISOR_TOKEN is injected by the Supervisor)
 *  - standalone: a container next to Home Assistant Container/Core (HA_URL + HA_TOKEN)
 *  - demo:       no Home Assistant at all, a sample home (FOYER_DEMO=1, or nothing configured)
 */
function loadConfig(env = process.env) {
  const isAddon = Boolean(env.SUPERVISOR_TOKEN);
  const options = isAddon ? readJson('/data/options.json', {}) : {};

  let mode = 'demo';
  if (env.FOYER_DEMO === '1') mode = 'demo';
  else if (isAddon) mode = 'addon';
  else if (env.HA_URL && env.HA_TOKEN) mode = 'standalone';

  const haUrl = (env.HA_URL || '').replace(/\/+$/, '');
  const wsFromHttp = (u) => u.replace(/^http/i, 'ws');

  const dataDir = env.FOYER_DATA_DIR || (isAddon ? '/data' : path.join(__dirname, '..', 'data'));
  const mediaRoot = env.FOYER_MEDIA_DIR || (isAddon || fs.existsSync('/media') ? '/media' : path.join(dataDir, 'media'));

  const pairingCode = String(options.pairing_code || env.FOYER_PAIRING_CODE || '').replace(/\s+/g, '');
  const fixedCodeValid = /^[0-9]{8,12}$/.test(pairingCode);
  if (pairingCode && !fixedCodeValid) log.warn('pairing_code ignored: it must be 8 to 12 digits.');

  const allowedHosts = String(options.allowed_hosts || env.FOYER_ALLOWED_HOSTS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  return {
    version: VERSION,
    mode,
    isAddon,
    haWsUrl: isAddon ? 'ws://supervisor/core/websocket' : (haUrl ? `${wsFromHttp(haUrl)}/api/websocket` : ''),
    haRestUrl: isAddon ? 'http://supervisor/core/api' : (haUrl ? `${haUrl}/api` : ''),
    haToken: isAddon ? env.SUPERVISOR_TOKEN : (env.HA_TOKEN || ''),
    supervisorUrl: isAddon ? 'http://supervisor' : '',
    port: parseInt(env.FOYER_PORT || '8110', 10),
    directAccess: options.direct_access !== false && env.FOYER_DIRECT !== '0',
    fixedPairingCode: fixedCodeValid ? pairingCode : '',
    allowedHosts,
    allowPublic: env.FOYER_ALLOW_PUBLIC === '1',
    sensitiveFromHaOnly: Boolean(options.sensitive_from_ha_only),
    ingressProxyIp: '172.30.32.2',
    fixture: env.FOYER_FIXTURE || null,
    dataDir,
    mediaDir: path.join(mediaRoot, 'foyer'),
    publicDir: path.join(__dirname, '..', 'public'),
  };
}

module.exports = { loadConfig, VERSION };
