/* Foyer: the home as this iPad knows it, kept current by long-polling (works on every Safari). */
(function (w) {
  'use strict';
  var F = w.F;
  var S = F.store = { epoch: null, v: 0, entities: {}, areas: [], areaById: {}, blocks: {}, session: null, online: true, pending: {} };
  var listeners = [];
  var pollBackoff = 1000;
  var polling = false;
  var pollXhr = null;

  F.onChange = function (fn) { listeners.push(fn); };

  function emit(changed, blocks, full) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](changed || {}, blocks || {}, Boolean(full)); } catch (e) { if (w.console) w.console.error(e); }
    }
  }
  F.emitEntity = function (id) {
    var c = {};
    c[id] = true;
    emit(c, null, false);
  };

  function indexAreas() {
    S.areaById = {};
    for (var i = 0; i < S.areas.length; i++) S.areaById[S.areas[i].id] = S.areas[i];
  }

  function applySnapshot(snap) {
    S.epoch = snap.epoch;
    S.v = snap.v;
    S.entities = snap.entities || {};
    S.areas = snap.areas || [];
    indexAreas();
    S.blocks = snap.blocks || {};
    if (snap.session) S.session = snap.session;
    S.pending = {};
    emit(null, null, true);
  }

  function applyDelta(d) {
    S.v = d.v;
    var changed = {};
    var blocks = {};
    var any = false;
    var id;
    for (id in d.e) {
      if (!d.e.hasOwnProperty(id)) continue;
      if (d.e[id] === null) delete S.entities[id];
      else S.entities[id] = d.e[id];
      if (S.pending[id]) delete S.pending[id];
      changed[id] = true;
      any = true;
    }
    for (var b in d.b) {
      if (!d.b.hasOwnProperty(b)) continue;
      S.blocks[b] = d.b[b];
      blocks[b] = true;
      any = true;
    }
    if (any) emit(changed, blocks, false);
  }

  function setOnline(v) {
    if (S.online === v) return;
    S.online = v;
    emit(null, { _online: true }, false);
  }

  F.loadSession = function (cb) {
    F.xhr('GET', 'api/session', null, function (status, data) {
      if (status === 200 && data) {
        S.session = data;
        cb(data);
      } else {
        w.setTimeout(function () { F.loadSession(cb); }, 3000);
      }
    }, 15000);
  };

  F.loadSnapshot = function (cb) {
    F.xhr('GET', 'api/snapshot', null, function (status, data) {
      if (status === 200 && data) {
        applySnapshot(data);
        setOnline(true);
        if (cb) cb(true);
      } else if (status === 401) {
        if (F.onUnpaired) F.onUnpaired();
      } else {
        setOnline(false);
        w.setTimeout(function () { F.loadSnapshot(cb); }, 3000);
      }
    }, 30000);
  };

  function poll() {
    polling = true;
    pollXhr = F.xhr('GET', 'api/poll?v=' + S.v + '&e=' + encodeURIComponent(S.epoch || ''), null, function (status, data) {
      pollXhr = null;
      if (status === 200 && data) {
        setOnline(true);
        pollBackoff = 1000;
        if (data.resync) {
          F.loadSnapshot(function () { poll(); });
          return;
        }
        applyDelta(data);
        poll();
      } else if (status === 401) {
        polling = false;
        if (F.onUnpaired) F.onUnpaired();
      } else {
        setOnline(false);
        w.setTimeout(poll, pollBackoff);
        pollBackoff = Math.min(pollBackoff * 2, 15000);
      }
    }, 45000);
  }
  F.startPolling = function () {
    if (!polling) poll();
  };
  /** After the iPad wakes up, do not wait for a stale request. */
  F.repoll = function () {
    if (pollXhr) {
      try { pollXhr.abort(); } catch (e) { /* ignore */ }
    }
  };

  // ------------------------------------------------------------------ reading
  F.e = function (id) { return S.entities[id] || null; };
  F.area = function (id) { return S.areaById[id] || null; };
  F.block = function (name) { return S.blocks[name] || null; };
  F.settings = function () { return S.blocks.settings || {}; };
  F.isPending = function (id) { return Boolean(S.pending[id]); };
  F.entitiesIn = function (areaId, domains) {
    var out = [];
    for (var id in S.entities) {
      if (!S.entities.hasOwnProperty(id)) continue;
      if (S.entities[id].a !== areaId) continue;
      if (domains && domains.indexOf(F.domain(id)) < 0) continue;
      out.push(id);
    }
    out.sort();
    return out;
  };
  F.entitiesOf = function (domain) {
    var out = [];
    for (var id in S.entities) {
      if (S.entities.hasOwnProperty(id) && F.domain(id) === domain) out.push(id);
    }
    out.sort();
    return out;
  };
  F.isNight = function () {
    var sun = F.e('sun.sun');
    if (sun) return sun.s === 'below_horizon';
    var h = new Date().getHours();
    return h < 7 || h >= 19;
  };

  // ------------------------------------------------------------------ acting
  /**
   * Sends an action. `optimistic` patches the entity right away (the real state replaces it when it arrives,
   * or the old one comes back after 6 s).
   */
  F.act = function (payload, optimistic, cb) {
    var id = payload.entity_id;
    var orig = id ? S.entities[id] : null;
    if (id && orig) {
      var token = {};
      S.pending[id] = token;
      if (optimistic) {
        var copy = JSON.parse(JSON.stringify(orig));
        optimistic(copy);
        S.entities[id] = copy;
      }
      F.emitEntity(id);
      w.setTimeout(function () {
        if (S.pending[id] === token) {
          delete S.pending[id];
          if (optimistic && S.entities[id] !== orig) S.entities[id] = orig;
          F.emitEntity(id);
        }
      }, 6000);
    }
    F.xhr('POST', 'api/action', payload, function (status, data) {
      if (status !== 200) {
        if (id && orig) {
          delete S.pending[id];
          S.entities[id] = orig;
          F.emitEntity(id);
        }
        if (F.toast) F.toast((data && data.error) || F.t('error'));
      }
      if (cb) cb(status === 200, data);
    }, 20000);
  };

  F.call = function (entityId, service, data, optimistic, cb) {
    F.act({ entity_id: entityId, service: service, data: data || {} }, optimistic, cb);
  };

  F.toggle = function (id) {
    var e = F.e(id);
    if (!e) return;
    var d = F.domain(id);
    if (d === 'cover') {
      F.call(id, e.s === 'closed' || e.s === 'closing' ? 'open_cover' : 'close_cover', {}, function (c) {
        c.s = c.s === 'closed' || c.s === 'closing' ? 'opening' : 'closing';
      });
      return;
    }
    F.call(id, 'toggle', {}, function (c) {
      c.s = c.s === 'on' ? 'off' : 'on';
      if (c.s === 'off' && c.at) delete c.at.brightness;
    });
  };
}(window));
