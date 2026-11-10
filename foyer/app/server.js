'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { loadConfig } = require('./lib/config');
const {
  log, parseCookies, normalizeIp, isPrivateIp, isAllowedHost, debounce,
} = require('./lib/util');
const { Store, sanitizeSettings, FACE_IDS } = require('./lib/store');
const { Pairing, PairingError } = require('./lib/pairing');
const { HAConnection } = require('./lib/ha');
const { HASource } = require('./lib/sources');
const { DemoSource, photoSvg } = require('./lib/demo');
const { Home } = require('./lib/home');
const { Photos } = require('./lib/photos');
const { suggestLayouts } = require('./lib/suggest');
const { resolveAction, PolicyError, LAYOUT_ONLY } = require('./lib/policy');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;
const POLL_TIMEOUT = 25000;
const COOKIE = 'foyer_device';

function createApp(cfg, deps = {}) {
  const store = deps.store || new Store(cfg.dataDir);
  const pairing = new Pairing({ store, config: cfg, log });
  const source = deps.source || (cfg.mode === 'demo'
    ? new DemoSource({ log, fixture: cfg.fixture ? JSON.parse(fs.readFileSync(cfg.fixture, 'utf8')) : null })
    : new HASource(new HAConnection({ wsUrl: cfg.haWsUrl, restUrl: cfg.haRestUrl, token: cfg.haToken, log })));
  const home = new Home({ source, log, settings: () => store.settings });
  const photos = new Photos({ store, mediaDir: cfg.mediaDir, log, demo: cfg.mode === 'demo' });
  const assetStamp = `${cfg.version}-${Date.now().toString(36)}`;
  let layoutEntities = new Set();
  const waiters = new Set();

  // ---------------------------------------------------------------- blocks the iPads receive
  function clientSettings() {
    const s = store.settings;
    return {
      faces: s.faces, startFace: s.startFace, wallpaper: s.wallpaper, style: s.style, night: s.night,
      photoInterval: s.photoInterval, returnAfter: s.returnAfter, speaker: s.speaker, lang: s.lang,
      thermostatEntity: s.thermostatEntity, weatherEntity: s.weatherEntity, calendars: s.calendars,
      defaultCalendar: s.defaultCalendar, apps: s.apps, sensitiveFromHaOnly: s.sensitiveFromHaOnly || cfg.sensitiveFromHaOnly,
    };
  }

  /** Settings any screen of the home may change from the screen itself (Settings in Foyer). */
  const SCREEN_PREFS = ['faces', 'startFace', 'wallpaper', 'style', 'night', 'returnAfter', 'photoInterval', 'speaker', 'apps', 'lang',
    'calendars', 'defaultCalendar', 'weatherEntity', 'thermostatEntity', 'alarmSiren'];

  function computeLayouts() {
    const s = store.settings;
    const suggested = home.ready ? suggestLayouts(home, s, photos.items.length) : { home_plus: [], home: [] };
    const tiles = {};
    const auto = {};
    for (const face of ['home_plus', 'home']) {
      auto[face] = !Array.isArray(s.layouts[face]);
      tiles[face] = auto[face] ? suggested[face] : s.layouts[face];
    }
    layoutEntities = new Set();
    for (const face of Object.keys(tiles)) for (const t of tiles[face]) if (t.entity) layoutEntities.add(t.entity);
    return { tiles, auto, suggested };
  }

  function publishLayout() {
    const { tiles, auto } = computeLayouts();
    home.setBlock('layout', { tiles, auto });
  }
  const publishLayoutSoon = debounce(publishLayout, 500);

  function publishAll() {
    home.setBlock('settings', clientSettings());
    home.setBlock('photos', photos.block());
    publishLayout();
  }

  home.on('loaded', publishAll);
  home.on('entities-changed', publishLayoutSoon);
  home.on('change', flushWaiters);


  // ---------------------------------------------------------------- music browsing (Home Assistant's media browser)
  function thumb(t) {
    if (typeof t !== 'string' || !t || t.length > 2000) return null;
    if (/^https?:\/\/[^\s"'<>]+$/i.test(t)) return t;
    if (t.startsWith('/api/')) return `api/picture?path=${encodeURIComponent(t)}`;
    return null;
  }
  function browseItem(x) {
    return {
      title: String((x && x.title) || '').slice(0, 200), id: x && x.media_content_id, type: x && x.media_content_type,
      cls: (x && x.media_class) || null, play: Boolean(x && x.can_play), open: Boolean(x && x.can_expand), thumb: thumb(x && x.thumbnail),
    };
  }
  // Pictures, cameras and voices have nothing to play on a speaker.
  const NOT_MUSIC = /^media-source:\/\/(ai_task|camera|image|image_upload|tts|synology_dsm|google_photos|immich|frigate|unifiprotect|reolink|nest|xbox|onvif|motioneye|netatmo)(\/|$)/;
  const isMusic = (x) => !(x && typeof x.media_content_id === 'string' && NOT_MUSIC.test(x.media_content_id));
  function browseResult(r) {
    return { ...browseItem(r || {}), children: ((r && r.children) || []).filter(isMusic).slice(0, 300).map(browseItem) };
  }
  const SEARCH_MEDIA = 4194304; // MediaPlayerEntityFeature.SEARCH_MEDIA

  // ---------------------------------------------------------------- long-poll
  function flushWaiters() {
    for (const w of [...waiters]) {
      const d = home.delta(w.since, w.epoch);
      if (d === null) finishWaiter(w, 200, { resync: true });
      else if (d.n > 0) finishWaiter(w, 200, d);
    }
  }

  function finishWaiter(w, status, body) {
    if (!waiters.has(w)) return;
    waiters.delete(w);
    clearTimeout(w.timer);
    sendJson(w.req, w.res, status, body);
  }

  function dropDeviceWaiters(deviceId) {
    for (const w of [...waiters]) if (w.deviceId === deviceId) finishWaiter(w, 401, { error: 'not paired' });
  }

  // ---------------------------------------------------------------- helpers
  function headersFor(req, type, extra = {}) {
    const h = {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extra,
    };
    if (type.startsWith('text/html')) {
      h['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; "
        + "img-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'";
      h['Cache-Control'] = 'no-cache';
    }
    return h;
  }

  function send(req, res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
    const h = headersFor(req, type, extra);
    let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    const accepts = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (accepts && !req.foyerIngress && COMPRESSIBLE.test(type) && buf.length > 1024) {
      buf = zlib.gzipSync(buf);
      h['Content-Encoding'] = 'gzip';
      h.Vary = 'Accept-Encoding';
    }
    h['Content-Length'] = buf.length;
    res.writeHead(status, h);
    res.end(req.method === 'HEAD' ? undefined : buf);
  }

  function sendJson(req, res, status, obj, extra = {}) {
    send(req, res, status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store', ...extra });
  }

  function readBody(req, limit, asJson = true) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > limit) {
          reject(Object.assign(new Error('too large'), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (!asJson) return resolve(buf);
        try {
          resolve(buf.length ? JSON.parse(buf.toString('utf8')) : {});
        } catch (e) {
          reject(Object.assign(new Error('bad JSON'), { status: 400 }));
        }
      });
      req.on('error', reject);
    });
  }

  const pageCache = new Map();
  function servePage(req, res, file) {
    let html = pageCache.get(file);
    if (!html) {
      html = fs.readFileSync(path.join(cfg.publicDir, file), 'utf8').replace(/\{\{V\}\}/g, assetStamp);
      if (process.env.FOYER_DEV !== '1') pageCache.set(file, html);
    }
    send(req, res, 200, html, TYPES['.html']);
  }

  function serveStatic(req, res, rel, versioned) {
    const full = path.normalize(path.join(cfg.publicDir, rel));
    if (!full.startsWith(cfg.publicDir + path.sep)) return send(req, res, 404, 'Not found');
    fs.stat(full, (err, st) => {
      if (err || !st.isFile()) return send(req, res, 404, 'Not found');
      const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
      const cache = versioned ? 'public, max-age=31536000, immutable' : 'no-cache';
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag, 'Cache-Control': cache });
        return res.end();
      }
      const type = TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream';
      fs.readFile(full, (e2, buf) => {
        if (e2) return send(req, res, 500, 'Error');
        return send(req, res, 200, buf, type, { ETag: etag, 'Cache-Control': cache });
      });
    });
  }

  function context(req, fromIngress, ip) {
    if (fromIngress) {
      return { kind: 'ingress', admin: true, fromHa: true, user: req.headers['x-remote-user-display-name'] || null };
    }
    const token = parseCookies(req.headers.cookie)[COOKIE];
    const device = pairing.deviceByToken(token);
    if (device) {
      return { kind: 'device', admin: Boolean(device.admin), fromHa: cfg.mode === 'standalone' && Boolean(device.admin), device };
    }
    if (cfg.mode === 'demo') {
      const loopback = ip === '127.0.0.1' || ip === '::1';
      return { kind: 'demo', admin: loopback, fromHa: true };
    }
    return { kind: 'anon', admin: false, fromHa: false };
  }

  function sessionInfo(ctx) {
    return {
      kind: ctx.kind,
      admin: ctx.admin,
      paired: ctx.kind !== 'anon',
      demo: cfg.mode === 'demo',
      mode: cfg.mode,
      version: cfg.version,
      name: ctx.device ? ctx.device.name : null,
      ha: home.homeInfo(),
      standaloneNeedsAdmin: cfg.mode === 'standalone' && !pairing.hasAdmin(),
    };
  }

  async function accessInfo() {
    let port = cfg.port;
    const ips = [];
    if (cfg.isAddon) {
      const auth = { headers: { Authorization: `Bearer ${cfg.haToken}` }, signal: AbortSignal.timeout(5000) };
      try {
        const j = await (await fetch(`${cfg.supervisorUrl}/addons/self/info`, auth)).json();
        const net = j && j.data && j.data.network;
        if (net && Object.prototype.hasOwnProperty.call(net, `${cfg.port}/tcp`)) port = net[`${cfg.port}/tcp`];
      } catch (e) { log.debug(`addon info: ${e.message}`); }
      try {
        const j = await (await fetch(`${cfg.supervisorUrl}/network/info`, auth)).json();
        for (const itf of (j && j.data && j.data.interfaces) || []) {
          for (const a of (itf.ipv4 && itf.ipv4.address) || []) ips.push(String(a).split('/')[0]);
        }
      } catch (e) { log.debug(`network info: ${e.message}`); }
    } else {
      for (const list of Object.values(os.networkInterfaces())) {
        for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
      }
    }
    return { port, ips, hostnames: cfg.isAddon ? ['homeassistant.local'] : [], directAccess: cfg.directAccess && port !== null };
  }

  function catalog() {
    const entities = home.eligibleIds().map((id) => {
      const st = home.states.get(id);
      return {
        id,
        name: home.displayName(id, st),
        full: (st.attributes && st.attributes.friendly_name) || id,
        area: home.areaOf(id),
        domain: id.split('.')[0],
        dc: (st.attributes && st.attributes.device_class) || null,
        state: st.state,
      };
    });
    return { areas: home.areas, entities, faces: FACE_IDS, home: home.homeInfo() };
  }

  function applySettings(prev) {
    const s = store.settings;
    home.setBlock('settings', clientSettings());
    home.setBlock('photos', photos.block());
    publishLayout();
    if (prev.weatherEntity !== s.weatherEntity) home.setupWeather().catch((e) => log.warn(`weather: ${e.message}`));
    if (JSON.stringify(prev.calendars) !== JSON.stringify(s.calendars)) home.loadCalendar().catch((e) => log.warn(`calendar: ${e.message}`));
  }

  // ---------------------------------------------------------------- routes
  async function route(req, res, ctx, url) {
    const p = url.pathname;
    const m = req.method;
    const authed = ctx.kind !== 'anon';
    const mutating = m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';

    if (mutating && req.headers['x-foyer'] !== '1') return sendJson(req, res, 403, { error: 'refused' });

    if (m === 'GET' || m === 'HEAD') {
      if (p === '/' || p === '/index.html') return servePage(req, res, 'index.html');
      // Settings now live inside the dashboard (like the iPad's Settings app).
      if (p === '/settings') return send(req, res, 302, '', 'text/plain', { Location: './?settings=1' });
      if (p === '/manifest.webmanifest') {
        let start = url.searchParams.get('start') || './';
        if (!/^\/[\w\-./?=&%]*$/.test(start) || start.startsWith('//')) start = './';
        const manifest = {
          name: 'Foyer', short_name: 'Foyer', start_url: start, scope: './', display: 'standalone', orientation: 'any',
          background_color: '#000000', theme_color: '#000000',
          icons: [
            { src: 'img/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        };
        return send(req, res, 200, JSON.stringify(manifest), 'application/manifest+json; charset=utf-8', { 'Cache-Control': 'no-cache' });
      }
      if (/^\/(js|css|img)\/[\w./-]+$/.test(p)) {
        return serveStatic(req, res, p.slice(1), url.searchParams.has('v') && process.env.FOYER_DEV !== '1');
      }
      if (p === '/favicon.ico') return serveStatic(req, res, 'img/favicon.png', false);
      if (p === '/api/session') return sendJson(req, res, 200, sessionInfo(ctx));
      const demoPhoto = /^\/demo\/photo-([1-3])\.svg$/.exec(p);
      if (demoPhoto && cfg.mode === 'demo') return send(req, res, 200, photoSvg(Number(demoPhoto[1])), 'image/svg+xml', { 'Cache-Control': 'max-age=86400' });
    }

    if (p === '/api/pair' && m === 'POST') {
      if (ctx.kind === 'ingress') return sendJson(req, res, 400, { error: 'already signed in through Home Assistant' });
      const body = await readBody(req, 4096);
      try {
        const { device, token } = pairing.pair({
          code: body.code, name: body.name, ua: req.headers['user-agent'], ip: req.foyerIp, standalone: cfg.mode === 'standalone',
        });
        const cookie = `${COOKIE}=${token}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax`;
        return sendJson(req, res, 200, { ok: true, name: device.name, admin: device.admin }, { 'Set-Cookie': cookie });
      } catch (e) {
        if (e instanceof PairingError) {
          const extra = e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {};
          return sendJson(req, res, e.status, { error: e.message, retryAfter: e.retryAfter || 0 }, extra);
        }
        throw e;
      }
    }

    if (!authed) return sendJson(req, res, 401, { error: 'not paired' });

    if (p === '/api/unpair' && m === 'POST' && ctx.device) {
      pairing.remove(ctx.device.id);
      return sendJson(req, res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` });
    }

    if (p === '/api/snapshot' && m === 'GET') {
      return sendJson(req, res, 200, { ...home.snapshot(), session: sessionInfo(ctx) });
    }

    if (p === '/api/prefs' && m === 'PUT') {
      const body = await readBody(req, 64 * 1024);
      const patch = {};
      for (const k of Object.keys(body || {})) {
        if (SCREEN_PREFS.includes(k) || (ctx.admin && k === 'sensitiveFromHaOnly')) patch[k] = body[k];
      }
      const prev = store.settings;
      const next = sanitizeSettings(patch, prev);
      store.setSettings(next);
      applySettings(prev);
      return sendJson(req, res, 200, { ok: true, settings: clientSettings() });
    }

    // Photos can be added from any screen (they stay in /media/foyer/photos).
    if (p === '/api/photos' && m === 'POST') {
      const buf = await readBody(req, 20 * 1024 * 1024, false);
      const item = photos.add(buf, { w: parseInt(url.searchParams.get('w'), 10), h: parseInt(url.searchParams.get('h'), 10) });
      home.setBlock('photos', photos.block());
      return sendJson(req, res, 200, { ok: true, id: item.id });
    }
    const ph = /^\/api\/photos\/([0-9a-f]{12})(\/move)?$/.exec(p);
    if (ph) {
      let ok = false;
      if (!ph[2] && m === 'DELETE') ok = photos.remove(ph[1]);
      else if (ph[2] && m === 'POST') ok = photos.move(ph[1], url.searchParams.get('d') === '-1' ? -1 : 1);
      else return sendJson(req, res, 405, { error: 'method' });
      home.setBlock('photos', photos.block());
      return sendJson(req, res, ok ? 200 : 404, { ok });
    }

    if (p === '/api/browse' && m === 'GET') {
      const id = url.searchParams.get('entity_id') || '';
      if (!/^media_player\.[a-z0-9_]+$/.test(id) || !home.isEligible(id)) return sendJson(req, res, 404, { error: 'unknown speaker' });
      if (!source.browseMedia) return sendJson(req, res, 501, { error: 'browsing is not available' });
      try {
        const r = await source.browseMedia(home.libraryFor(id), url.searchParams.get('id') || undefined, url.searchParams.get('type') || undefined);
        return sendJson(req, res, 200, browseResult(r));
      } catch (e) {
        return sendJson(req, res, 502, { error: e.message });
      }
    }

    if (p === '/api/search' && m === 'GET') {
      const id = url.searchParams.get('entity_id') || '';
      const q = (url.searchParams.get('q') || '').trim();
      if (!/^media_player\.[a-z0-9_]+$/.test(id) || !home.isEligible(id)) return sendJson(req, res, 404, { error: 'unknown speaker' });
      if (!q || q.length > 100) return sendJson(req, res, 400, { error: 'bad search' });
      const lib = home.libraryFor(id);
      const st = home.states.get(lib);
      if (!source.searchMedia || !st || !((st.attributes && st.attributes.supported_features) & SEARCH_MEDIA)) {
        return sendJson(req, res, 501, { error: 'this speaker cannot search' });
      }
      try {
        const found = await source.searchMedia(lib, q);
        return sendJson(req, res, 200, { title: q, children: found.filter(isMusic).slice(0, 100).map(browseItem) });
      } catch (e) {
        return sendJson(req, res, 502, { error: e.message });
      }
    }

    const pic = p === '/api/picture' && m === 'GET' ? url.searchParams.get('path') : null;
    if (pic) {
      try {
        const img = await source.picture(pic);
        return send(req, res, 200, img.body, img.type, { 'Cache-Control': 'private, max-age=86400' });
      } catch (e) {
        return send(req, res, 404, 'Not found');
      }
    }

    if (p === '/api/arrange' && m === 'PUT') {
      // Any screen of the home may arrange the tile faces from the screen itself (one layout for all screens).
      // Scripts and buttons can run anything: only Home Assistant (or the standalone admin) may add them.
      const body = await readBody(req, 64 * 1024);
      const patch = {};
      const face = body.face;
      if (face !== undefined) {
        if (face !== 'home_plus' && face !== 'home') return sendJson(req, res, 400, { error: 'unknown face' });
        if (body.tiles === null) {
          patch.layouts = { [face]: null };
        } else if (Array.isArray(body.tiles)) {
          let tiles = body.tiles;
          if (!ctx.admin) {
            const current = computeLayouts().tiles;
            const placedBefore = new Set();
            for (const f of Object.keys(current)) for (const t of current[f]) if (t.entity) placedBefore.add(t.entity);
            tiles = tiles.filter((t) => !(t && typeof t.entity === 'string'
              && LAYOUT_ONLY.has(t.entity.split('.')[0]) && !placedBefore.has(t.entity)));
          }
          patch.layouts = { [face]: tiles };
        } else {
          return sendJson(req, res, 400, { error: 'bad tiles' });
        }
      }
      if (typeof body.wallpaper === 'string') patch.wallpaper = body.wallpaper;
      const prev = store.settings;
      const next = sanitizeSettings(patch, prev);
      store.setSettings(next);
      applySettings(prev);
      const tiles = face ? computeLayouts().tiles[face] : null;
      return sendJson(req, res, 200, { ok: true, tiles, auto: face ? !Array.isArray(next.layouts[face]) : null, wallpaper: next.wallpaper });
    }

    if (p === '/api/poll' && m === 'GET') {
      const since = parseInt(url.searchParams.get('v'), 10) || 0;
      const epoch = url.searchParams.get('e') || '';
      const d = home.delta(since, epoch);
      if (d === null) return sendJson(req, res, 200, { resync: true });
      // wait=0: answer at once (the screen checks that it is back online before waiting again).
      if (d.n > 0 || url.searchParams.get('wait') === '0') return sendJson(req, res, 200, d);
      const w = { since, epoch, req, res, deviceId: ctx.device ? ctx.device.id : null };
      w.timer = setTimeout(() => finishWaiter(w, 200, { epoch: home.epoch, v: home.v, e: {}, b: {}, n: 0 }), POLL_TIMEOUT);
      waiters.add(w);
      req.on('close', () => {
        if (waiters.has(w)) {
          waiters.delete(w);
          clearTimeout(w.timer);
        }
      });
      return undefined;
    }

    if (p === '/api/action' && m === 'POST') {
      if (!home.ready) return sendJson(req, res, 503, { error: 'Home Assistant is not connected' });
      const body = await readBody(req, 8192);
      try {
        const calls = resolveAction(body, {
          ctx, home, layoutEntities, settings: store.settings, sensitiveFromHaOnly: cfg.sensitiveFromHaOnly,
        });
        for (const c of calls) {
          // A HomePod with a Music Assistant twin: Apple Music goes to the twin, the buttons to the one that plays.
          if (c.domain === 'media_player' && c.target && typeof c.target.entity_id === 'string') {
            c.target = { ...c.target, entity_id: home.mediaTarget(c.target.entity_id, c.service) };
          }
          await source.callService(c.domain, c.service, c.data, c.target);
        }
        // A new event does not always change the calendar's state: fetch the events again.
        if (calls.some((c) => c.domain === 'calendar')) setTimeout(() => home.loadCalendar().catch(() => {}), 800);
        return sendJson(req, res, 200, { ok: true, calls: calls.length });
      } catch (e) {
        if (e instanceof PolicyError) return sendJson(req, res, e.status, { error: e.message });
        log.warn(`Action failed: ${e.message}`);
        return sendJson(req, res, 502, { error: e.message });
      }
    }

    const cam = /^\/api\/camera\/(camera\.[a-z0-9_]+)$/.exec(p);
    if (cam && m === 'GET') {
      if (!home.isEligible(cam[1])) return send(req, res, 404, 'Not found');
      try {
        const img = await source.cameraImage(cam[1]);
        return send(req, res, 200, img.body, img.type, { 'Cache-Control': 'no-store' });
      } catch (e) {
        return send(req, res, 502, 'Camera unavailable');
      }
    }

    const art = /^\/api\/art\/(media_player\.[a-z0-9_]+)$/.exec(p);
    if (art && m === 'GET') {
      const st = home.states.get(home.speakerFor(art[1]));
      const pic = st && st.attributes && st.attributes.entity_picture;
      if (!home.isEligible(art[1]) || !pic) return send(req, res, 404, 'Not found');
      try {
        const img = await source.picture(pic);
        return send(req, res, 200, img.body, img.type, { 'Cache-Control': 'private, max-age=3600' });
      } catch (e) {
        return send(req, res, 502, 'Artwork unavailable');
      }
    }

    const photoFile = /^\/photos\/([\w-]+\.(?:jpg|png))$/.exec(p);
    if (photoFile && m === 'GET') {
      const f = photos.file(photoFile[1]);
      if (!f) return send(req, res, 404, 'Not found');
      return fs.readFile(f.path, (err, buf) => (err ? send(req, res, 404, 'Not found')
        : send(req, res, 200, buf, f.type, { 'Cache-Control': 'private, max-age=31536000, immutable' })));
    }

    // ------------------------------------------------------------ admin (Home Assistant's sidebar, or the standalone admin iPad)
    if (p.startsWith('/api/admin/')) {
      if (!ctx.admin) return sendJson(req, res, 403, { error: 'Ask the person who set up Foyer.' });
      return adminRoute(req, res, ctx, url, p, m);
    }

    return send(req, res, 404, 'Not found');
  }

  async function adminRoute(req, res, ctx, url, p, m) {
    if (p === '/api/admin/catalog' && m === 'GET') return sendJson(req, res, 200, catalog());
    if (p === '/api/admin/settings' && m === 'GET') {
      const { suggested } = computeLayouts();
      return sendJson(req, res, 200, { settings: store.settings, suggested, photos: photos.block(), access: await accessInfo() });
    }
    if (p === '/api/admin/settings' && m === 'PUT') {
      const body = await readBody(req, 256 * 1024);
      const prev = store.settings;
      const next = sanitizeSettings(body, prev);
      store.setSettings(next);
      applySettings(prev);
      return sendJson(req, res, 200, { ok: true, settings: next });
    }
    if (p === '/api/admin/photos' && m === 'POST') {
      const buf = await readBody(req, 20 * 1024 * 1024, false);
      const item = photos.add(buf, { w: parseInt(url.searchParams.get('w'), 10), h: parseInt(url.searchParams.get('h'), 10) });
      home.setBlock('photos', photos.block());
      publishLayoutSoon();
      return sendJson(req, res, 200, { ok: true, id: item.id });
    }
    const pm = /^\/api\/admin\/photos\/([0-9a-f]{12})(\/mask|\/move)?$/.exec(p);
    if (pm) {
      const [, id, sub] = pm;
      let ok = false;
      if (!sub && m === 'DELETE') ok = photos.remove(id);
      else if (sub === '/mask' && m === 'PUT') ok = Boolean(photos.setMask(id, await readBody(req, 8 * 1024 * 1024, false)));
      else if (sub === '/mask' && m === 'DELETE') ok = photos.clearMask(id);
      else if (sub === '/move' && m === 'POST') ok = photos.move(id, url.searchParams.get('d') === '-1' ? -1 : 1);
      else return sendJson(req, res, 405, { error: 'method' });
      home.setBlock('photos', photos.block());
      return sendJson(req, res, ok ? 200 : 404, { ok });
    }
    if (p === '/api/admin/setup-code' && m === 'POST') {
      const c = pairing.createCode('setup');
      return sendJson(req, res, 200, { code: c.code, display: c.display, expires: c.expires, access: await accessInfo() });
    }
    if (p === '/api/admin/access' && m === 'GET') return sendJson(req, res, 200, await accessInfo());
    if (p === '/api/admin/devices' && m === 'GET') return sendJson(req, res, 200, { devices: pairing.list(), self: ctx.device ? ctx.device.id : null });
    const dm = /^\/api\/admin\/devices\/([0-9a-f]{12})(\/admin)?$/.exec(p);
    if (dm) {
      const [, id, sub] = dm;
      if (!sub && m === 'PATCH') {
        const body = await readBody(req, 4096);
        return sendJson(req, res, pairing.rename(id, body.name) ? 200 : 404, { ok: true });
      }
      if (!sub && m === 'DELETE') {
        const ok = pairing.remove(id);
        dropDeviceWaiters(id);
        return sendJson(req, res, ok ? 200 : 404, { ok });
      }
      if (sub === '/admin' && m === 'POST') return sendJson(req, res, pairing.makeAdmin(id) ? 200 : 404, { ok: true });
    }
    return sendJson(req, res, 404, { error: 'not found' });
  }

  // ---------------------------------------------------------------- server
  const server = http.createServer((req, res) => {
    const ip = normalizeIp(req.socket.remoteAddress);
    const fromIngress = cfg.isAddon && ip === cfg.ingressProxyIp;
    req.foyerIp = ip;
    req.foyerIngress = fromIngress;
    if (req.url === '/healthz' && (ip === '127.0.0.1' || ip === '::1')) {
      return send(req, res, 200, home.ready || cfg.mode === 'demo' ? 'ok' : 'waiting for Home Assistant');
    }
    if (!fromIngress) {
      if (cfg.isAddon && !cfg.directAccess) return send(req, res, 403, 'Direct access is turned off in the add-on options.');
      if (!cfg.allowPublic && !isPrivateIp(ip)) return send(req, res, 403, 'Foyer only answers devices on your home network.');
      if (!isAllowedHost(req.headers.host, cfg.allowedHosts)) {
        return send(req, res, 421, 'Foyer does not know this address. Add it to allowed_hosts in the add-on options.');
      }
    }
    let url;
    try {
      url = new URL(req.url, 'http://foyer.invalid');
    } catch (e) {
      return send(req, res, 400, 'Bad request');
    }
    const ctx = context(req, fromIngress, ip);
    route(req, res, ctx, url).catch((e) => {
      if (!res.headersSent) sendJson(req, res, e.status || 500, { error: e.status ? e.message : 'internal error' });
      if (!e.status) log.error(`${req.method} ${url.pathname}: ${e.stack || e.message}`);
    });
    return undefined;
  });
  server.keepAliveTimeout = 65000;

  async function logPairingCode() {
    const needs = pairing.devices.length === 0 || (cfg.mode === 'standalone' && !pairing.hasAdmin());
    if (!needs || !cfg.directAccess) return;
    const c = pairing.createCode('log');
    const access = await accessInfo().catch(() => ({ port: cfg.port, ips: [] }));
    const where = (access.ips.length ? access.ips : ['<adresse-de-home-assistant>']).map((ip) => `http://${ip}:${access.port}`).join('  ou  ');
    log.info('-------------------------------------------------------------------------------');
    log.info(`Pour installer un iPad : ouvrez ${where} dans Safari,`);
    log.info('ajoutez Foyer à l\'écran d\'accueil (Partager → Sur l\'écran d\'accueil), ouvrez-le depuis son icône,');
    log.info(`puis tapez le code d'appairage : ${c.display}   (une seule fois, valable 7 jours)`);
    log.info('-------------------------------------------------------------------------------');
  }

  return {
    server, home, store, pairing, photos, source,
    start() {
      home.start();
      if (cfg.mode === 'demo') publishAll();
      return new Promise((resolve) => {
        server.listen(cfg.port, () => {
          log.info(`Foyer ${cfg.version} (${cfg.mode}) listening on port ${cfg.port}.`);
          logPairingCode().catch(() => {});
          resolve();
        });
      });
    },
    stop() {
      for (const w of [...waiters]) finishWaiter(w, 503, { error: 'stopping' });
      home.stop();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

if (require.main === module) {
  const cfg = loadConfig();
  if (cfg.mode === 'addon' && !cfg.haToken) log.error('No Home Assistant sign-in (SUPERVISOR_TOKEN) was given to the add-on.');
  const app = createApp(cfg);
  app.start();
  const shutdown = () => {
    log.info('Stopping Foyer.');
    try { app.store.save(); } catch (e) { /* ignore */ }
    app.stop().finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { createApp };
