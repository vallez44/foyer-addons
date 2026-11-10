/* Foyer: start-up, pairing, swiping between faces, Control Center, night mode. ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var doc = w.document;
  var root = doc.getElementById('root');
  var LIGHT_FACES = { calendar: 1, analog: 1 };

  function store(key, val) {
    try {
      if (val === undefined) return w.localStorage.getItem('foyer.' + key);
      w.localStorage.setItem('foyer.' + key, val);
    } catch (e) { /* private mode */ }
    return null;
  }

  function measureSafeTop() {
    var probe = F.el('div', 'safe-probe', doc.body);
    var v = probe.offsetHeight || 0;
    doc.body.removeChild(probe);
    F.safeTop = v;
  }

  // ------------------------------------------------------------------ pager
  var P = F.pager = { faces: [], index: 0, ids: '' };

  P.build = function () {
    if (F.edit && F.edit.active) return;
    var s = F.settings();
    var ids = [];
    var list = s.faces || [];
    for (var i = 0; i < list.length; i++) if (list[i].on && F.faceTypes[list[i].id]) ids.push(list[i].id);
    if (!ids.length) ids = ['home_plus'];
    // ?face=x opens that face even when it is not turned on (the settings page uses it for previews).
    var asked = F.query('face');
    if (asked && F.faceTypes[asked] && ids.indexOf(asked) < 0) ids.push(asked);
    var sig = ids.join(',');
    if (sig === P.ids) return;
    var current = P.faces[P.index] ? P.faces[P.index].id : null;
    P.ids = sig;
    F.clear(P.strip);
    P.faces = [];
    for (var j = 0; j < ids.length; j++) {
      var f = new F.Face(ids[j]);
      P.strip.appendChild(f.el);
      P.faces.push(f);
    }
    var start = F.query('face') || current || s.startFace;
    P.index = Math.max(0, P.find(start));
    P.layout();
    P.buildDots();
    P.setIndex(P.index, false);
  };

  P.find = function (id) {
    for (var i = 0; i < P.faces.length; i++) if (P.faces[i].id === id) return i;
    return -1;
  };

  P.layout = function () {
    var W = w.innerWidth;
    var H = w.innerHeight;
    measureSafeTop();
    P.W = W;
    P.H = H;
    var landscape = W >= H;
    for (var i = 0; i < P.faces.length; i++) {
      P.faces[i].el.style.left = (i * W) + 'px';
      P.faces[i].layout(W, H, landscape);
    }
    P.translate(-P.index * W, false);
  };

  P.translate = function (x, animate) {
    F.cls(P.strip, 'animate', Boolean(animate));
    F.transform(P.strip, 'translate3d(' + Math.round(x) + 'px,0,0)');
  };

  P.setIndex = function (i, animate) {
    i = F.clamp(i, 0, P.faces.length - 1);
    var prev = P.faces[P.index];
    P.index = i;
    P.translate(-i * P.W, animate);
    for (var k = 0; k < P.faces.length; k++) {
      var f = P.faces[k];
      if (k === i && !f.visible) f.show();
      else if (k !== i && f.visible) f.hide();
    }
    var cur = P.faces[i];
    if (cur) {
      cur.tick(new Date());
      F.cls(doc.body, 'light-face', Boolean(LIGHT_FACES[cur.id]));
    }
    P.updateDots();
    if (prev !== cur) P.showDots();
  };

  P.goTo = function (id) {
    var i = typeof id === 'number' ? id : P.find(id);
    if (i >= 0) P.setIndex(i, true);
  };
  P.current = function () { return P.faces[P.index]; };

  P.buildDots = function () {
    F.clear(P.dots);
    P.dotEls = [];
    if (P.faces.length < 2) return;
    for (var i = 0; i < P.faces.length; i++) P.dotEls.push(F.el('div', 'dot', P.dots));
  };
  P.updateDots = function () {
    for (var i = 0; i < (P.dotEls || []).length; i++) F.cls(P.dotEls[i], 'on', i === P.index);
  };
  P.showDots = function () {
    F.cls(P.dots, 'show', true);
    w.clearTimeout(P.dotsTimer);
    P.dotsTimer = w.setTimeout(function () { F.cls(P.dots, 'show', false); }, 2600);
  };

  // ------------------------------------------------------------------ gestures (touch, and mouse for testing on a computer)
  function findUp(el, prop) {
    while (el && el !== P.el) {
      if (el[prop]) return el;
      el = el.parentNode;
    }
    return null;
  }

  var G = null;
  function gStart(x, y, target, isTouch) {
    activity();
    if (F.edit.active) {
      // Arranging tiles: every touch goes to the editor.
      G = { edit: true, touch: isTouch, mode: 'edit' };
      F.edit.down(x, y, target);
      return;
    }
    var tileEl = findUp(target, 'foyerTile');
    var tapEl = findUp(target, 'foyerTap');
    G = { x: x, y: y, lx: x, ly: y, t: F.now(), mode: null, tile: tileEl ? tileEl.foyerTile : null, tapEl: tapEl, dx: 0, dy: 0, touch: isTouch, target: target };
    var g = G;
    var arrange = Boolean(g.tile && F.edit.canEdit(g.tile.face));
    g.pressTimer = w.setTimeout(function () {
      if (G === g && g.tile) F.cls(g.tile.el, 'pressed', true);
    }, 70);
    g.longTimer = w.setTimeout(function () {
      if (G !== g || g.mode) return;
      if (arrange) {
        // Hold a tile: the tiles start to wiggle; keep the finger down to drag it right away.
        F.cls(g.tile.el, 'pressed', false);
        if (F.edit.enter(g.tile.face, g.tile)) {
          g.edit = true;
          g.mode = 'edit';
          F.edit.down(g.lx, g.ly, g.target, true);
        }
      } else if (g.tile && g.tile.T.press) {
        g.mode = 'press';
        F.cls(g.tile.el, 'pressed', false);
        g.tile.T.press(g.tile);
      }
    }, arrange ? 800 : 550);
  }

  function gMove(x, y, ev) {
    var g = G;
    if (!g) return;
    if (g.edit) {
      F.edit.move(x, y, ev);
      if (ev) ev.preventDefault();
      return;
    }
    g.lx = x;
    g.ly = y;
    g.dx = x - g.x;
    g.dy = y - g.y;
    var ax = Math.abs(g.dx);
    var ay = Math.abs(g.dy);
    if (!g.mode) {
      var draggable = Boolean(g.tile && g.tile.T.canDrag && g.tile.T.canDrag(g.tile));
      if (ax > 12 && ax > ay) g.mode = 'swipe';
      else if (ay > 12 && ay > ax) {
        if (g.dy < 0 && !draggable && g.y > P.H - Math.max(110, P.H * 0.16)) g.mode = 'apps';
        else if (draggable) {
          g.mode = 'drag';
          g.tile.T.dragStart(g.tile);
        } else if (g.y < Math.max(90, P.H * 0.14) && g.dy > 0) g.mode = 'cc';
        else g.mode = 'none';
      }
      if (g.mode) {
        w.clearTimeout(g.longTimer);
        w.clearTimeout(g.pressTimer);
        if (g.tile) F.cls(g.tile.el, 'pressed', false);
      }
    }
    if (g.mode === 'swipe') {
      var dx = g.dx;
      if ((P.index === 0 && dx > 0) || (P.index === P.faces.length - 1 && dx < 0)) dx *= 0.3;
      P.translate(-P.index * P.W + dx, false);
      if (ev) ev.preventDefault();
    } else if (g.mode === 'drag') {
      g.tile.T.dragMove(g.tile, g.dx, g.dy);
      if (ev) ev.preventDefault();
    } else if (g.mode === 'cc') {
      CC.pull(g.dy);
      if (ev) ev.preventDefault();
    } else if (g.mode === 'apps') {
      // Swipe up from the bottom of a face: the apps, like the iPad's home screen.
      if (!g.appsShown && g.dy < -50) {
        g.appsShown = true;
        F.apps.show();
      }
      if (ev) ev.preventDefault();
    }
  }

  function gEnd(ev) {
    var g = G;
    G = null;
    if (!g) return;
    if (g.edit) {
      F.edit.up();
      if (ev && g.touch) ev.preventDefault();
      return;
    }
    w.clearTimeout(g.longTimer);
    w.clearTimeout(g.pressTimer);
    if (g.tile) F.cls(g.tile.el, 'pressed', false);
    var dt = Math.max(1, F.now() - g.t);
    if (g.mode === 'swipe') {
      var v = g.dx / dt;
      var next = P.index;
      if (g.dx < -P.W * 0.18 || v < -0.45) next = P.index + 1;
      else if (g.dx > P.W * 0.18 || v > 0.45) next = P.index - 1;
      P.setIndex(next, true);
    } else if (g.mode === 'drag') {
      g.tile.T.dragEnd(g.tile);
    } else if (g.mode === 'cc') {
      CC.release(g.dy);
    } else if (!g.mode) {
      if (g.tile) {
        var r = g.tile.el.getBoundingClientRect();
        var fx = (g.x - r.left) / r.width;
        var fy = (g.y - r.top) / r.height;
        if (g.tile.T.tap) g.tile.T.tap(g.tile, fx, fy);
      } else if (g.tapEl) {
        g.tapEl.foyerTap();
      } else {
        P.showDots();
      }
    }
    if (ev && g.touch && g.mode !== 'none') ev.preventDefault();
  }

  function bindGestures() {
    var el = P.el;
    el.addEventListener('touchstart', function (ev) {
      if (ev.touches.length > 1) {
        G = null;
        return;
      }
      var t = ev.touches[0];
      gStart(t.clientX, t.clientY, ev.target, true);
    }, false);
    el.addEventListener('touchmove', function (ev) {
      if (!G) return;
      var t = ev.touches[0];
      gMove(t.clientX, t.clientY, ev);
      if (G && G.mode !== 'none') ev.preventDefault();
    }, false);
    el.addEventListener('touchend', gEnd, false);
    el.addEventListener('touchcancel', function () {
      if (G && G.edit) F.edit.up();
      if (G && G.mode === 'swipe') P.setIndex(P.index, true);
      G = null;
    }, false);
    var mouseDown = false;
    el.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      mouseDown = true;
      gStart(ev.clientX, ev.clientY, ev.target, false);
    }, false);
    doc.addEventListener('mousemove', function (ev) {
      if (mouseDown) gMove(ev.clientX, ev.clientY, ev);
    }, false);
    doc.addEventListener('mouseup', function (ev) {
      if (!mouseDown) return;
      mouseDown = false;
      gEnd(ev);
    }, false);
    doc.addEventListener('keydown', function (ev) {
      if (F.settingsUI.isOpen) {
        if (ev.keyCode === 27 && !F.sheetOpen()) F.settingsUI.hide();
        else if (ev.keyCode === 27) F.closeSheets();
        return;
      }
      if (F.apps.isOpen) {
        if (ev.keyCode === 27) F.apps.hide();
        return;
      }
      if (F.sheetOpen()) {
        if (ev.keyCode === 27) F.closeSheets();
        return;
      }
      if (F.edit.active) {
        if (ev.keyCode === 27 || ev.keyCode === 13) F.edit.finish(true);
        return;
      }
      if (ev.keyCode === 37) P.setIndex(P.index - 1, true);
      if (ev.keyCode === 39) P.setIndex(P.index + 1, true);
      if (ev.keyCode === 40) CC.show();
      if (ev.keyCode === 38 || ev.keyCode === 27) CC.hide();
    }, false);
  }

  // ------------------------------------------------------------------ dimming, night, idle, wake lock
  var dimEl = null;
  var userDim = parseFloat(store('dim') || '0') || 0;
  var night = false;
  var lastActivity = F.now();
  var nightLiftUntil = 0;

  function applyDim() {
    var s = F.settings();
    var v = userDim;
    if (night && F.now() > nightLiftUntil) v = Math.max(v, (s.night && s.night.dim) || 0);
    dimEl.style.opacity = v;
    dimEl.style.display = v > 0.01 ? 'block' : 'none';
  }
  F.setUserDim = function (v) {
    userDim = F.clamp(v, 0, 0.85);
    store('dim', String(userDim));
    applyDim();
  };
  F.getUserDim = function () { return userDim; };

  function toMin(s) {
    var p = String(s || '0:0').split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function nightCheck() {
    if (F.edit.active) return;
    var s = F.settings().night;
    var now = new Date();
    var m = now.getHours() * 60 + now.getMinutes();
    var inNight = false;
    if (s && s.enabled) {
      var a = toMin(s.from);
      var b = toMin(s.to);
      inNight = a > b ? (m >= a || m < b) : (m >= a && m < b);
    }
    if (inNight && !night) {
      night = true;
      if (P.find(s.face) >= 0) P.goTo(s.face);
    } else if (!inNight && night) {
      night = false;
      P.goTo(F.settings().startFace);
    }
    applyDim();
  }

  function activity() {
    lastActivity = F.now();
    if (night) {
      nightLiftUntil = lastActivity + 60000;
      applyDim();
    }
    requestWake();
  }
  F.onUserActivity = activity;

  function idleCheck() {
    if (F.edit.active) return;
    var s = F.settings();
    var nowMs = F.now();
    if (night && nightLiftUntil && nowMs > nightLiftUntil) {
      nightLiftUntil = 0;
      applyDim();
      var nf = s.night && s.night.face;
      if (nf && P.find(nf) >= 0 && P.current() && P.current().id !== nf && !F.sheetOpen()) P.goTo(nf);
    }
    if ((F.settingsUI.isOpen || F.apps.isOpen) && nowMs - lastActivity > Math.max(300, s.returnAfter || 0) * 1000) {
      F.settingsUI.hide();
      F.apps.hide();
      F.closeSheets();
    }
    if (!night && s.returnAfter > 0 && nowMs - lastActivity > s.returnAfter * 1000 && !F.sheetOpen() && !CC.open && !F.settingsUI.isOpen) {
      var cur = P.current();
      if (cur && cur.id !== s.startFace && P.find(s.startFace) >= 0) P.goTo(s.startFace);
      lastActivity = nowMs;
    }
  }

  var wakeLock = null;
  function requestWake() {
    var n = w.navigator;
    if (!n.wakeLock || wakeLock || doc.visibilityState === 'hidden') return;
    try {
      n.wakeLock.request('screen').then(function (l) {
        wakeLock = l;
        l.addEventListener('release', function () { wakeLock = null; });
      }, function () {});
    } catch (e) { /* not allowed yet */ }
  }

  // ------------------------------------------------------------------ Control Center
  var CC = F.cc = { open: false };
  CC.build = function () {
    CC.back = F.el('div', 'cc-back', doc.body);
    CC.panel = F.el('div', 'cc', CC.back);
    CC.back.addEventListener('touchstart', function (ev) { if (ev.target === CC.back) CC.hide(); }, false);
    CC.back.addEventListener('mousedown', function (ev) { if (ev.target === CC.back) CC.hide(); }, false);
    CC.panel.addEventListener('touchmove', function (ev) { ev.preventDefault(); }, false);
  };
  CC.render = function () {
    var p = CC.panel;
    F.clear(p);
    var grid = F.el('div', 'cc-grid', p);
    // Now playing
    var mid = F.pickSpeaker();
    var np = F.el('div', 'cc-mod cc-np', grid);
    var art = F.el('div', 'cc-art', np);
    var txt = F.el('div', 'cc-np-txt', np);
    var e = mid ? F.e(mid) : null;
    var at = (e && e.at) || {};
    F.el('div', 'cc-np-title', txt, e ? (at.media_title || F.t('nothing_playing')) : F.t('no_speaker'));
    F.el('div', 'cc-np-sub', txt, e ? (at.media_artist ? at.media_artist + ' · ' + e.n : e.n) : '');
    F.setBg(art, at.pic || null);
    var ctr = F.el('div', 'cc-np-ctr', np);
    if (mid) {
      F.button(ctr, '', 'skip-previous', 'cc-ic', function () { F.call(mid, 'media_previous_track'); });
      F.button(ctr, '', e && e.s === 'playing' ? 'pause' : 'play', 'cc-ic', function () {
        F.call(mid, 'media_play_pause', {}, function (c) { c.s = c.s === 'playing' ? 'paused' : 'playing'; }, function () { w.setTimeout(CC.render, 400); });
      });
      F.button(ctr, '', 'skip-next', 'cc-ic', function () { F.call(mid, 'media_next_track'); });
      F.onTap(art, function () { CC.hide(); F.sheets.open(mid); });
    }
    // Screen dim
    var dimMod = F.el('div', 'cc-mod cc-slider', grid);
    F.slider(dimMod, {
      value: Math.round((1 - userDim / 0.85) * 100), icon: 'brightness-6', cls: 'slider-cc',
      label: function () { return F.t('screen'); },
      onChange: function (v) { F.setUserDim((1 - v / 100) * 0.85); }
    });
    // Volume
    var volMod = F.el('div', 'cc-mod cc-slider', grid);
    if (mid) {
      F.slider(volMod, {
        value: Math.round((at.volume_level || 0) * 100), icon: 'volume-high', cls: 'slider-cc',
        label: function () { return F.t('volume'); },
        onChange: function (v) { F.call(mid, 'volume_set', { volume_level: v / 100 }); }
      });
    } else F.cls(volMod, 'disabled', true);
    // Quick buttons: first light, first lock, a scene (or all off)
    var quick = F.el('div', 'cc-mod cc-quick', grid);
    var lights = F.entitiesOf('light');
    var locks = F.entitiesOf('lock');
    var scenes = F.entitiesOf('scene');
    function quickBtn(id) {
      var x = F.e(id);
      var b = F.button(quick, x.n, F.entityIcon(id, x), 'cc-q' + (F.isActive(id, x) ? ' on' : '') + (F.isAlert(id, x) ? ' alert' : ''), function () {
        if (!F.primaryAction({ el: b }, id, F.e(id))) F.sheets.open(id);
        w.setTimeout(CC.render, 500);
      });
    }
    if (lights.length) quickBtn(lights[0]);
    if (locks.length) quickBtn(locks[0]);
    if (scenes.length) quickBtn(scenes[0]);
    else F.button(quick, F.t('all_off'), 'power', 'cc-q', function () { F.act({ action: 'all_off' }); });
    // System row
    var sys = F.el('div', 'cc-sys', p);
    var sess = F.store.session || {};
    if (F.edit.canEdit(P.current())) {
      F.button(sys, F.t('edit_layout'), 'pencil', 'cc-sysbtn', function () {
        CC.hide();
        F.edit.enter(P.current());
      });
    }
    F.button(sys, 'Apps', 'apps', 'cc-sysbtn', function () {
      CC.hide();
      F.apps.show();
    });
    F.button(sys, F.t('settings'), 'cog', 'cc-sysbtn', function () {
      CC.hide();
      F.settingsUI.show();
    });
    if (sess.kind === 'ingress' && sess.admin) F.button(sys, F.t('full_screen'), 'tablet', 'cc-sysbtn', fullScreenHere);
    F.button(sys, F.t('refresh'), 'refresh', 'cc-sysbtn', function () { w.location.reload(); });
  };
  CC.show = function () {
    if (!CC.back) return;
    CC.render();
    CC.open = true;
    F.cls(CC.back, 'show', true);
    F.transform(CC.panel, '');
  };
  CC.hide = function () {
    if (!CC.back) return;
    CC.open = false;
    F.cls(CC.back, 'show', false);
  };
  CC.pull = function (dy) {
    if (!CC.open) {
      CC.render();
      CC.open = true;
      F.cls(CC.back, 'dragging', true);
    }
    var hgt = CC.panel.offsetHeight || 400;
    var y = Math.min(0, dy - hgt);
    CC.back.style.opacity = F.clamp(dy / hgt, 0, 1);
    CC.back.style.visibility = 'visible';
    F.transform(CC.panel, 'translate3d(0,' + y + 'px,0)');
  };
  CC.release = function (dy) {
    F.cls(CC.back, 'dragging', false);
    CC.back.style.opacity = '';
    CC.back.style.visibility = '';
    F.transform(CC.panel, '');
    if (dy > 90) CC.show();
    else CC.hide();
  };

  /** Home Assistant itself: the same tab inside Home Assistant, a new one on a screen paired by its own port. */
  F.openHomeAssistant = function () {
    var sess = F.store.session || {};
    if (sess.kind === 'ingress') {
      try {
        w.top.location.href = '/';
        return;
      } catch (e) { /* not the same origin */ }
    }
    var st = F.block('status') || {};
    var url = st.url || (w.location.protocol + '//' + w.location.hostname + ':8123/');
    var win = null;
    try { win = w.open(url, '_blank'); } catch (e2) { win = null; }
    if (!win) w.location.href = url;
  };
  F.fullScreenHere = function () { fullScreenHere(); };

  function fullScreenHere() {
    var win = null;
    try { win = w.open('', '_blank'); } catch (e) { win = null; }
    F.xhr('POST', 'api/admin/setup-code', {}, function (status, data) {
      if (status !== 200 || !data) {
        if (win) win.close();
        F.toast(F.t('error'));
        return;
      }
      var host = w.location.hostname;
      try { host = w.top.location.hostname || host; } catch (e) { /* not same origin */ }
      var port = data.access && data.access.port ? data.access.port : 8110;
      var url = 'http://' + host + ':' + port + '/?setup=' + data.code;
      if (win) win.location.href = url;
      else {
        try { w.top.location.href = url; } catch (e2) { w.location.href = url; }
      }
    });
  }

  // ------------------------------------------------------------------ status pills (demo, offline)
  var pill = null;
  function updatePill() {
    if (!pill) pill = F.el('div', 'status-pill', doc.body);
    var S = F.store;
    var st = F.block('status');
    var msg = '';
    if (!S.online) msg = F.t('reconnecting');
    else if (st && st.connected === false) msg = F.t('not_connected');
    else if (S.session && S.session.demo) msg = F.t('demo_line');
    F.text(pill, msg);
    F.cls(pill, 'show', Boolean(msg));
    F.cls(pill, 'warn', msg !== F.t('demo_line'));
  }

  // ------------------------------------------------------------------ pairing
  function guessDeviceName() {
    var ua = w.navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && w.navigator.maxTouchPoints > 1)) return 'iPad';
    return '';
  }

  function pairWith(code, onError) {
    F.xhr('POST', 'api/pair', { code: code, name: guessDeviceName() }, function (status, data) {
      if (status === 200) {
        w.location.replace(w.location.pathname);
      } else if (status === 429) {
        onError(F.t('pair_wait', { n: (data && data.retryAfter) || 60 }));
      } else {
        onError(F.t('pair_wrong'));
      }
    }, 15000);
  }

  function showPairing() {
    F.clear(root);
    doc.body.className = 'pairing';
    var setup = F.query('setup');
    var box = F.el('div', 'pair', root);
    F.icon('home-heart', 'pair-logo', box);
    if (setup && F.isIOS && !F.standalone) {
      F.el('div', 'pair-title', box, F.t('a2hs_title'));
      F.el('div', 'pair-text', box, F.t('a2hs_text'));
      F.el('div', 'pair-share', box);
      F.icon('arrow-left', 'pair-arrow', box);
      var err0 = F.el('div', 'pair-err', box);
      F.button(box, F.t('a2hs_safari'), null, 'btn-quiet pair-alt', function () { pairWith(setup, function (m) { F.text(err0, m); }); });
      return;
    }
    if (setup) {
      F.el('div', 'pair-title', box, F.t('pair_title'));
      var err1 = F.el('div', 'pair-err', box);
      pairWith(setup, function (m) {
        F.text(err1, m);
        w.setTimeout(function () { w.location.replace(w.location.pathname); }, 2500);
      });
      return;
    }
    F.el('div', 'pair-title', box, F.t('pair_title'));
    F.el('div', 'pair-text', box, F.t('pair_text'));
    var err = F.el('div', 'pair-err', box);
    F.keypad(box, function (code) {
      F.text(err, '');
      pairWith(code, function (m) { F.text(err, m); });
    }, '•••• ••••');
  }
  F.onUnpaired = function () { w.location.reload(); };

  // ------------------------------------------------------------------ boot
  function applyLang() {
    var s = F.settings();
    var st = F.block('status');
    F.lang = s.lang || (st && st.lang) || ((w.navigator.language || 'fr').slice(0, 2) === 'en' ? 'en' : 'fr');
    doc.documentElement.lang = F.lang;
  }

  function start() {
    doc.body.className = 'app' + (F.isOldSafari ? ' classic' : '');
    F.clear(root);
    P.el = F.el('div', 'pager', root);
    P.strip = F.el('div', 'strip', P.el);
    P.dots = F.el('div', 'dots', root);
    dimEl = F.el('div', 'dimmer', doc.body);
    CC.build();
    bindGestures();
    applyLang();
    P.build();

    F.onChange(function (changed, blocks, full) {
      if (full || blocks.settings || blocks.status) {
        applyLang();
        var s = F.settings();
        F.cls(doc.body, 'flat', s.style === 'flat');
        F.cls(doc.body, 'frosted', s.style === 'frosted');
        P.build();
      }
      for (var i = 0; i < P.faces.length; i++) P.faces[i].update(changed, blocks, full);
      if (blocks._online || blocks.status || full) updatePill();
      if (CC.open && !CC.dragging) {
        for (var id in changed) {
          if (changed.hasOwnProperty(id) && /^(media_player|light|lock|scene)\./.test(id)) {
            CC.render();
            break;
          }
        }
      }
    });
    for (var i = 0; i < P.faces.length; i++) P.faces[i].update({}, {}, true);
    F.cls(doc.body, 'flat', F.settings().style === 'flat');
    F.cls(doc.body, 'frosted', F.settings().style === 'frosted');
    updatePill();

    var resizeTimer = null;
    w.addEventListener('resize', function () {
      w.clearTimeout(resizeTimer);
      resizeTimer = w.setTimeout(P.layout, 120);
    }, false);
    w.addEventListener('orientationchange', function () { w.setTimeout(P.layout, 300); }, false);
    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'visible') {
        F.repoll();
        requestWake();
        activity();
      }
    }, false);

    var lastSec = -1;
    w.setInterval(function () {
      var now = new Date();
      if (now.getSeconds() === lastSec) return;
      lastSec = now.getSeconds();
      var cur = P.current();
      if (cur) cur.tick(now);
      if (lastSec % 10 === 0) {
        for (var k = 0; k < P.faces.length; k++) if (k !== P.index) P.faces[k].tick(now);
      }
      if (lastSec % 15 === 0) {
        nightCheck();
        idleCheck();
      }
    }, 250);
    nightCheck();
    if (F.query('nopoll') !== '1') F.startPolling();
    if (F.store.session && F.store.session.kind === 'ingress') {
      var hint = F.el('div', 'corner-btn', doc.body);
      F.icon('cog', '', hint);
      F.onTap(hint, function () { CC.show(); });
    }
    w.setTimeout(function () { F.cls(doc.body, 'ready', true); }, 50);
    if (F.query('settings') === '1') {
      F.settingsUI.show(F.query('page') || null);
      if (w.history && w.history.replaceState) {
        try { w.history.replaceState(null, '', w.location.pathname); } catch (e) { /* ignore */ }
      }
    }
    if (F.query('apps') === '1') F.apps.show();
  }

  function addManifest() {
    var l = doc.createElement('link');
    l.rel = 'manifest';
    l.href = 'manifest.webmanifest?start=' + encodeURIComponent(w.location.pathname);
    doc.head.appendChild(l);
  }

  function boot() {
    if (F.query('noanim') === '1') doc.documentElement.className += ' no-anim';
    measureSafeTop();
    F.loadSession(function (session) {
      F.lang = (session.ha && session.ha.lang) || 'fr';
      if (session.kind !== 'ingress') addManifest();
      if (!session.paired) {
        showPairing();
        return;
      }
      if (F.query('setup') && w.history && w.history.replaceState) {
        try { w.history.replaceState(null, '', w.location.pathname); } catch (e) { /* ignore */ }
      }
      F.loadSnapshot(function () { start(); });
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, false);
  else boot();
}(window));
