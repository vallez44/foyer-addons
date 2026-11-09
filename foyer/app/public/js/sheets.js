/* Foyer: full pages over the faces (a light, a room, the weather…), sliders, keypad, confirmations. ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var doc = w.document;

  // ------------------------------------------------------------------ taps without the 300 ms delay
  F.onTap = function (el, fn) {
    var sx = 0;
    var sy = 0;
    var moved = false;
    var touched = false;
    el.addEventListener('touchstart', function (ev) {
      touched = true;
      var p = ev.touches[0];
      sx = p.clientX;
      sy = p.clientY;
      moved = false;
      F.cls(el, 'pressed', true);
    }, false);
    el.addEventListener('touchmove', function (ev) {
      var p = ev.touches[0];
      if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) {
        moved = true;
        F.cls(el, 'pressed', false);
      }
    }, false);
    el.addEventListener('touchend', function (ev) {
      F.cls(el, 'pressed', false);
      w.setTimeout(function () { touched = false; }, 700);
      if (!moved) {
        ev.preventDefault();
        ev.stopPropagation();
        fn(ev);
      }
    }, false);
    el.addEventListener('click', function (ev) {
      if (touched) return;
      ev.stopPropagation();
      fn(ev);
    }, false);
  };

  F.button = function (parent, label, icon, cls, fn) {
    var b = F.el('div', 'btn' + (cls ? ' ' + cls : ''), parent);
    if (icon) b.iconEl = F.icon(icon, 'btn-ic', b);
    if (label !== null && label !== undefined && label !== '') b.labelEl = F.el('span', 'btn-t', b, label);
    if (fn) F.onTap(b, fn);
    return b;
  };

  // ------------------------------------------------------------------ toast
  var toastEl = null;
  var toastTimer = null;
  F.toast = function (msg) {
    if (!toastEl) toastEl = F.el('div', 'toast', doc.body);
    F.text(toastEl, msg);
    F.cls(toastEl, 'show', true);
    w.clearTimeout(toastTimer);
    toastTimer = w.setTimeout(function () { F.cls(toastEl, 'show', false); }, 3200);
  };

  // ------------------------------------------------------------------ sliders
  function pointY(ev) {
    var p = ev.touches && ev.touches.length ? ev.touches[0] : (ev.changedTouches && ev.changedTouches.length ? ev.changedTouches[0] : ev);
    return { x: p.clientX, y: p.clientY };
  }

  /** iOS-style big slider. Vertical by default. opts: value (0-100), onChange(v, final), label(v), horizontal. */
  F.slider = function (parent, opts) {
    var horiz = Boolean(opts.horizontal);
    var el = F.el('div', 'slider ' + (horiz ? 'slider-h' : 'slider-v') + (opts.cls ? ' ' + opts.cls : ''), parent);
    var fill = F.el('div', 'slider-fill', el);
    var txt = F.el('div', 'slider-text', el);
    var ic = opts.icon ? F.icon(opts.icon, 'slider-icon', el) : null;
    var s = { el: el, value: opts.value || 0, dragging: false };
    function render() {
      var v = F.clamp(s.value, 0, 100);
      if (horiz) fill.style.width = v + '%';
      else fill.style.height = v + '%';
      F.text(txt, opts.label ? opts.label(v) : Math.round(v) + ' %');
      if (ic && opts.iconFor) F.setIcon(ic, opts.iconFor(v));
    }
    s.set = function (v) {
      if (s.dragging) return;
      s.value = v;
      render();
    };
    var start = null;
    var base = 0;
    var lastSent = 0;
    var size = 1;
    function down(ev) {
      var p = pointY(ev);
      start = p;
      base = s.value;
      s.dragging = true;
      size = horiz ? el.offsetWidth : el.offsetHeight;
      F.cls(el, 'active', true);
      if (ev.type === 'mousedown') {
        // With a mouse, jump to where it was clicked.
        var r = el.getBoundingClientRect();
        s.value = horiz ? ((p.x - r.left) / r.width) * 100 : ((r.bottom - p.y) / r.height) * 100;
        s.value = F.clamp(Math.round(s.value), 0, 100);
        base = s.value;
        render();
        doc.addEventListener('mousemove', move, false);
        doc.addEventListener('mouseup', up, false);
      }
      ev.preventDefault();
      ev.stopPropagation();
    }
    function move(ev) {
      if (!start) return;
      var p = pointY(ev);
      var delta = horiz ? (p.x - start.x) / size : (start.y - p.y) / size;
      var v = F.clamp(Math.round(base + delta * 100), 0, 100);
      if (v !== s.value) {
        s.value = v;
        render();
        var now = F.now();
        if (opts.onChange && now - lastSent > 400) {
          lastSent = now;
          opts.onChange(v, false);
        }
      }
      ev.preventDefault();
      ev.stopPropagation();
    }
    function up(ev) {
      if (!start) return;
      start = null;
      F.cls(el, 'active', false);
      doc.removeEventListener('mousemove', move, false);
      doc.removeEventListener('mouseup', up, false);
      if (opts.onChange) opts.onChange(s.value, true);
      w.setTimeout(function () { s.dragging = false; }, 1500);
      ev.preventDefault();
      ev.stopPropagation();
    }
    el.addEventListener('touchstart', down, false);
    el.addEventListener('touchmove', move, false);
    el.addEventListener('touchend', up, false);
    el.addEventListener('touchcancel', up, false);
    el.addEventListener('mousedown', down, false);
    render();
    return s;
  };

  // ------------------------------------------------------------------ keypad
  F.keypad = function (parent, onDone, label) {
    var box = F.el('div', 'keypad', parent);
    var shown = F.el('div', 'kp-code', box, label || F.t('code'));
    var code = '';
    function render() { F.text(shown, code ? new Array(code.length + 1).join('•') : (label || F.t('code'))); }
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
    var grid = F.el('div', 'kp-grid', box);
    for (var i = 0; i < keys.length; i++) {
      (function (k) {
        F.button(grid, k, null, 'kp-key' + (k === 'OK' ? ' kp-ok' : ''), function () {
          if (k === '⌫') code = code.slice(0, -1);
          else if (k === 'OK') {
            if (code) onDone(code);
            code = '';
          } else if (code.length < 12) code += k;
          render();
        });
      }(keys[i]));
    }
    return box;
  };

  // ------------------------------------------------------------------ sheet
  var open = [];
  function Sheet(title, sub, cls) {
    var self = this;
    this.back = F.el('div', 'sheet-back', doc.body);
    this.panel = F.el('div', 'sheet' + (cls ? ' ' + cls : ''), this.back);
    this.x = F.el('div', 'sheet-x', this.panel);
    F.icon('close', '', this.x);
    this.head = F.el('div', 'sheet-head', this.panel);
    this.titleEl = F.el('div', 'sheet-title', this.head, title || '');
    this.subEl = F.el('div', 'sheet-sub', this.head, sub || '');
    this.body = F.el('div', 'sheet-body', this.panel);
    this.refreshers = [];
    this.timers = [];
    F.onTap(this.x, function () { self.close(); });
    this.back.addEventListener('touchstart', function (ev) { if (ev.target === self.back) self.close(); ev.stopPropagation(); }, false);
    this.back.addEventListener('mousedown', function (ev) { if (ev.target === self.back) self.close(); }, false);
    this.panel.addEventListener('touchmove', function (ev) {
      if (!self.panel.scrollHeight || self.panel.scrollHeight <= self.panel.clientHeight) ev.preventDefault();
      ev.stopPropagation();
    }, false);
    open.push(this);
    w.setTimeout(function () { F.cls(self.back, 'show', true); }, 10);
    if (F.onUserActivity) F.onUserActivity();
  }
  Sheet.prototype.close = function () {
    var self = this;
    for (var i = 0; i < this.timers.length; i++) w.clearInterval(this.timers[i]);
    var idx = open.indexOf(this);
    if (idx >= 0) open.splice(idx, 1);
    F.cls(this.back, 'show', false);
    w.setTimeout(function () { if (self.back.parentNode) self.back.parentNode.removeChild(self.back); }, 260);
  };
  Sheet.prototype.onRefresh = function (fn) { this.refreshers.push(fn); };
  Sheet.prototype.every = function (ms, fn) { this.timers.push(w.setInterval(fn, ms)); };
  Sheet.prototype.section = function (label) {
    var s = F.el('div', 'sheet-sec', this.body);
    if (label) F.el('div', 'sheet-sec-t', s, label);
    return s;
  };
  F.Sheet = Sheet;
  F.closeSheets = function () {
    while (open.length) open[open.length - 1].close();
  };
  F.sheetOpen = function () { return open.length > 0; };

  F.onChange(function (changed, blocks, full) {
    for (var i = 0; i < open.length; i++) {
      for (var j = 0; j < open[i].refreshers.length; j++) {
        try { open[i].refreshers[j](changed, blocks, full); } catch (e) { if (w.console) w.console.error(e); }
      }
    }
  });

  F.confirm = function (message, okLabel, onOk) {
    var s = new Sheet(message, '', 'sheet-small');
    var row = F.el('div', 'btn-row', s.body);
    F.button(row, F.t('cancel'), null, 'btn-quiet', function () { s.close(); });
    F.button(row, okLabel, null, 'btn-strong', function () {
      s.close();
      onOk();
    });
  };

  function areaLine(e) {
    var a = e ? F.area(e.a) : null;
    return a ? a.name : '';
  }
  function sinceText(e) {
    if (!e || !e.lc) return '';
    var d = new Date(e.lc);
    var txt = F.sameDay(d, new Date()) ? F.time(d) : F.cap(F.dayName(d, true)) + ' ' + F.time(d);
    return F.t('since', { t: txt });
  }

  // ------------------------------------------------------------------ entity pages
  var S = F.sheets = {};

  S.open = function (id) {
    var e = F.e(id);
    if (!e) return;
    var d = F.domain(id);
    var fn = S[d] || S.generic;
    fn(id, e);
  };

  function bigToggle(sheet, id) {
    var b = F.el('div', 'big-toggle', sheet.body);
    var ic = F.icon('power', '', b);
    var lbl = F.el('div', 'big-toggle-t', sheet.body);
    function r() {
      var e = F.e(id);
      if (!e) return;
      F.setIcon(ic, F.entityIcon(id, e));
      F.cls(b, 'on', F.isActive(id, e));
      F.cls(b, 'alert', F.isAlert(id, e));
      F.text(lbl, F.stateText(id, e));
    }
    F.onTap(b, function () { if (!F.primaryAction({ el: b }, id, F.e(id))) F.toggle(id); });
    sheet.onRefresh(function (c) { if (c[id]) r(); });
    r();
    return b;
  }

  S.light = function (id, e) {
    var sheet = new Sheet(e.n, areaLine(e), 'sheet-light');
    var dim = F.dimmable(id, e);
    if (dim) {
      var sl = F.slider(sheet.body, {
        value: F.levelOf(id, e),
        cls: 'slider-light',
        icon: 'lightbulb-on',
        iconFor: function (v) { return v > 0 ? 'lightbulb-on' : 'lightbulb-outline'; },
        label: function (v) { return v > 0 ? Math.round(v) + ' %' : F.t('off_f'); },
        onChange: function (v) {
          var patch = function (c) {
            c.s = v > 0 ? 'on' : 'off';
            c.at.brightness = Math.round(v * 2.55);
          };
          if (v === 0) F.call(id, 'turn_off', {}, patch);
          else F.call(id, 'turn_on', { brightness_pct: Math.max(1, v) }, patch);
        }
      });
      sheet.onRefresh(function (c) { if (c[id]) sl.set(F.levelOf(id, F.e(id))); });
    } else {
      bigToggle(sheet, id);
    }
    var row = F.el('div', 'btn-row', sheet.body);
    var pw = F.button(row, F.t('turn_off'), 'power', 'btn-wide', function () { F.toggle(id); });
    function r() {
      var x = F.e(id);
      if (!x) return;
      F.text(pw.labelEl, x.s === 'on' ? F.t('turn_off') : F.t('turn_on'));
    }
    sheet.onRefresh(function (c) { if (c[id]) r(); });
    r();
    var modes = (e.at && e.at.supported_color_modes) || [];
    if (modes.indexOf('color_temp') >= 0 || modes.indexOf('xy') >= 0 || modes.indexOf('hs') >= 0 || modes.indexOf('rgb') >= 0) {
      var chips = F.el('div', 'chips', sheet.body);
      var temps = [[2700, F.lang === 'en' ? 'Warm' : 'Chaud', '#ffb35c'], [4000, F.lang === 'en' ? 'Neutral' : 'Neutre', '#fff1d6'], [6000, F.lang === 'en' ? 'Cool' : 'Froid', '#d9ecff']];
      for (var i = 0; i < temps.length; i++) {
        (function (tk) {
          var c = F.button(chips, tk[1], null, 'chip', function () {
            F.call(id, 'turn_on', { color_temp_kelvin: tk[0] }, function (x) { x.s = 'on'; });
          });
          var dot = F.el('span', 'chip-dot', null);
          dot.style.backgroundColor = tk[2];
          c.insertBefore(dot, c.firstChild);
        }(temps[i]));
      }
    }
  };

  S.switch = function (id, e) {
    var sheet = new Sheet(e.n, areaLine(e));
    bigToggle(sheet, id);
  };
  S.input_boolean = S.switch;
  S.humidifier = S.switch;
  S.valve = S.switch;

  S.fan = function (id, e) {
    var sheet = new Sheet(e.n, areaLine(e));
    if (F.dimmable(id, e)) {
      var sl = F.slider(sheet.body, {
        value: F.levelOf(id, e),
        icon: 'fan',
        label: function (v) { return v > 0 ? Math.round(v) + ' %' : F.t('off'); },
        onChange: function (v) { F.call(id, 'set_percentage', { percentage: v }, function (c) { c.s = v > 0 ? 'on' : 'off'; c.at.percentage = v; }); }
      });
      sheet.onRefresh(function (c) { if (c[id]) sl.set(F.levelOf(id, F.e(id))); });
      var row = F.el('div', 'btn-row', sheet.body);
      F.button(row, F.t('turn_off'), 'power', 'btn-wide', function () { F.call(id, 'turn_off', {}, function (c) { c.s = 'off'; }); });
    } else bigToggle(sheet, id);
  };

  S.cover = function (id, e) {
    var sheet = new Sheet(e.n, areaLine(e));
    if (F.dimmable(id, e)) {
      var sl = F.slider(sheet.body, {
        value: F.levelOf(id, e),
        icon: 'window-shutter-open',
        label: function (v) { return v >= 100 ? F.t('open') : (v <= 0 ? F.t('closed') : Math.round(v) + ' %'); },
        onChange: function (v) { F.call(id, 'set_cover_position', { position: v }); }
      });
      sheet.onRefresh(function (c) { if (c[id]) sl.set(F.levelOf(id, F.e(id))); });
    } else bigToggle(sheet, id);
    var row = F.el('div', 'btn-row', sheet.body);
    F.button(row, F.t('open_cmd'), 'chevron-up', '', function () {
      var x = F.e(id);
      var dc = x && x.at && x.at.device_class;
      if (dc === 'garage' || dc === 'gate') F.confirm(F.t('confirm_open', { name: x.n }), F.t('open_cmd'), function () { F.call(id, 'open_cover'); });
      else F.call(id, 'open_cover');
    });
    F.button(row, F.t('stop'), 'stop', '', function () { F.call(id, 'stop_cover'); });
    F.button(row, F.t('close_cmd'), 'chevron-down', '', function () { F.call(id, 'close_cover'); });
  };

  S.lock = function (id, e) {
    var sheet = new Sheet(e.n, areaLine(e));
    bigToggle(sheet, id);
    var needsCode = Boolean(e.at && e.at.code_format);
    if (needsCode) {
      F.keypad(sheet.body, function (code) {
        var x = F.e(id);
        F.call(id, x && x.s === 'locked' ? 'unlock' : 'lock', { code: code });
      });
    } else {
      var row = F.el('div', 'btn-row', sheet.body);
      var b = F.button(row, F.t('lock'), null, 'btn-wide', function () {
        var x = F.e(id);
        if (x.s === 'locked') {
          F.confirm(F.t('confirm_unlock', { name: x.n }), F.t('unlock'), function () { F.call(id, 'unlock', {}, function (c) { c.s = 'unlocking'; }); });
        } else F.call(id, 'lock', {}, function (c) { c.s = 'locking'; });
      });
      var r = function () {
        var x = F.e(id);
        if (x) F.text(b.labelEl, x.s === 'locked' ? F.t('unlock') : F.t('lock'));
      };
      sheet.onRefresh(function (c) { if (c[id]) r(); });
      r();
    }
  };

  S.alarm_control_panel = function (id, e) {
    var sheet = new Sheet(e.n, F.t(e.s));
    sheet.onRefresh(function (c) { if (c[id]) F.text(sheet.subEl, F.t(F.e(id).s)); });
    var code = null;
    var needsCode = Boolean(e.at && e.at.code_format);
    function send(service) {
      var data = code ? { code: code } : {};
      F.call(id, service, data);
      code = null;
    }
    var row = F.el('div', 'btn-row btn-row-wrap', sheet.body);
    F.button(row, F.t('arm_home'), 'shield-home', '', function () { send('alarm_arm_home'); });
    F.button(row, F.t('arm_away'), 'shield-lock', '', function () { send('alarm_arm_away'); });
    F.button(row, F.t('arm_night'), 'shield-moon', '', function () { send('alarm_arm_night'); });
    F.button(row, F.t('disarm'), 'shield-off-outline', 'btn-strong', function () { send('alarm_disarm'); });
    if (needsCode) F.keypad(sheet.body, function (c) { code = c; F.toast(F.t('code') + ' ✓'); });
  };

  S.climate = function (id, e) {
    var sheet = new Sheet(e.n && e.n.toLowerCase() !== 'thermostat' ? e.n : F.t('thermostat'), areaLine(e), 'sheet-climate');
    var box = F.el('div', 'cl-box', sheet.body);
    var minus = F.button(box, '', 'minus', 'cl-btn', null);
    var mid = F.el('div', 'cl-mid', box);
    var big = F.el('div', 'cl-target', mid);
    var cur = F.el('div', 'cl-current', mid);
    var plus = F.button(box, '', 'plus', 'cl-btn', null);
    var target = null;
    var timer = null;
    function r() {
      var x = F.e(id);
      if (!x) return;
      var at = x.at || {};
      var v = target !== null ? target : at.temperature;
      F.text(big, x.s === 'off' ? F.t('off') : F.tempPrecise(v));
      F.text(cur, F.t('current') + ' ' + F.tempPrecise(at.current_temperature) + (at.hvac_action ? ' · ' + F.t(at.hvac_action) : ''));
    }
    function nudge(dir) {
      var x = F.e(id);
      var at = x.at || {};
      var step = at.target_temp_step || 0.5;
      var base = target !== null ? target : (at.temperature !== undefined ? at.temperature : 20);
      target = F.clamp(Math.round((base + dir * step) * 10) / 10, at.min_temp || 7, at.max_temp || 35);
      r();
      w.clearTimeout(timer);
      timer = w.setTimeout(function () {
        var v = target;
        F.call(id, 'set_temperature', { temperature: v }, function (c) { c.at.temperature = v; }, function () { target = null; r(); });
      }, 900);
    }
    F.onTap(minus, function () { nudge(-1); });
    F.onTap(plus, function () { nudge(1); });
    sheet.onRefresh(function (c) { if (c[id]) r(); });
    r();
    var modes = (e.at && e.at.hvac_modes) || [];
    if (modes.length) {
      var chips = F.el('div', 'chips', sheet.body);
      var btns = {};
      for (var i = 0; i < modes.length; i++) {
        (function (m) {
          btns[m] = F.button(chips, m === 'off' ? F.t('off') : F.t(m), null, 'chip', function () {
            F.call(id, 'set_hvac_mode', { hvac_mode: m }, function (c) { c.s = m; });
          });
        }(modes[i]));
      }
      var rm = function () {
        var x = F.e(id);
        for (var k in btns) if (btns.hasOwnProperty(k)) F.cls(btns[k], 'sel', x && x.s === k);
      };
      sheet.onRefresh(function (c) { if (c[id]) rm(); });
      rm();
    }
  };

  S.media_player = function (id, e) {
    F.lastSpeaker = id;
    var sheet = new Sheet(e.n, areaLine(e), 'sheet-media');
    var art = F.el('div', 'mp-art', sheet.body);
    var title = F.el('div', 'mp-title', sheet.body);
    var artist = F.el('div', 'mp-artist', sheet.body);
    var row = F.el('div', 'mp-controls', sheet.body);
    F.button(row, '', 'skip-previous', 'mp-btn', function () { F.call(id, 'media_previous_track'); });
    var play = F.button(row, '', 'play', 'mp-btn mp-play', function () {
      F.call(id, 'media_play_pause', {}, function (c) { c.s = c.s === 'playing' ? 'paused' : 'playing'; });
    });
    F.button(row, '', 'skip-next', 'mp-btn', function () { F.call(id, 'media_next_track'); });
    var vol = F.slider(sheet.body, {
      horizontal: true,
      value: Math.round(((e.at && e.at.volume_level) || 0) * 100),
      icon: 'volume-high',
      cls: 'slider-volume',
      label: function (v) { return F.t('volume') + ' ' + Math.round(v) + ' %'; },
      onChange: function (v) { F.call(id, 'volume_set', { volume_level: v / 100 }); }
    });
    function r() {
      var x = F.e(id);
      if (!x) return;
      var at = x.at || {};
      F.text(title, at.media_title || F.t('nothing_playing'));
      F.text(artist, at.media_artist || F.t(x.s));
      F.setBg(art, at.pic || null);
      F.cls(art, 'empty', !at.pic);
      F.setIcon(play.iconEl, x.s === 'playing' ? 'pause' : 'play');
      if (at.volume_level !== undefined) vol.set(Math.round(at.volume_level * 100));
    }
    sheet.onRefresh(function (c) { if (c[id]) r(); });
    r();
    var others = F.entitiesOf('media_player');
    if (others.length > 1) {
      var sec = sheet.section(F.t('pick_speaker'));
      var chips = F.el('div', 'chips', sec);
      for (var i = 0; i < others.length; i++) {
        (function (oid) {
          var o = F.e(oid);
          F.button(chips, o.n, o.s === 'playing' ? 'play' : 'speaker', 'chip' + (oid === id ? ' sel' : ''), function () {
            sheet.close();
            S.open(oid);
          });
        }(others[i]));
      }
    }
  };

  S.camera = function (id) {
    var e = F.e(id);
    var sheet = new Sheet(e ? e.n : '', e ? areaLine(e) : '', 'sheet-camera');
    var img = F.el('div', 'cam-big', sheet.body);
    function load() {
      var url = 'api/camera/' + id + '?t=' + F.now();
      var im = new w.Image();
      im.onload = function () { F.setBg(img, url); };
      im.src = url;
    }
    load();
    sheet.every(2000, load);
  };

  S.scene = function (id, e) {
    var sheet = new Sheet(e.n, F.t('scene'), 'sheet-small');
    var row = F.el('div', 'btn-row', sheet.body);
    F.button(row, F.lang === 'en' ? 'Run' : 'Activer', 'creation', 'btn-wide btn-strong', function () {
      F.call(id, F.domain(id) === 'button' || F.domain(id) === 'input_button' ? 'press' : 'turn_on');
      sheet.close();
    });
  };
  S.script = S.scene;
  S.button = S.scene;
  S.input_button = S.scene;

  S.generic = function (id, e) {
    var sheet = new Sheet(e.n, areaLine(e), 'sheet-small');
    var big = F.el('div', 'gen-state', sheet.body);
    var since = F.el('div', 'gen-since', sheet.body);
    function r() {
      var x = F.e(id);
      if (!x) return;
      F.text(big, F.stateText(id, x));
      F.text(since, sinceText(x));
      F.cls(big, 'alert', F.isAlert(id, x));
    }
    sheet.onRefresh(function (c) { if (c[id]) r(); });
    r();
  };

  // ------------------------------------------------------------------ room and home
  function deviceRow(parent, id) {
    var row = F.el('div', 'dev-row', parent);
    var ic = F.icon('home', 'dev-ic', row);
    var txt = F.el('div', 'dev-txt', row);
    var name = F.el('div', 'dev-name', txt);
    var st = F.el('div', 'dev-state', txt);
    var sw = F.el('div', 'dev-switch', row);
    F.el('div', 'dev-knob', sw);
    var d = F.domain(id);
    var toggleable = d === 'light' || d === 'switch' || d === 'fan' || d === 'input_boolean' || d === 'humidifier';
    if (!toggleable) sw.style.display = 'none';
    function r() {
      var e = F.e(id);
      if (!e) return;
      F.setIcon(ic, F.entityIcon(id, e));
      F.text(name, e.n);
      F.text(st, F.stateText(id, e));
      F.cls(row, 'on', F.isActive(id, e));
      F.cls(row, 'alert', F.isAlert(id, e));
    }
    F.onTap(sw, function () { F.toggle(id); });
    F.onTap(row, function () { S.open(id); });
    r();
    return r;
  }

  S.room = function (areaId) {
    var a = F.area(areaId);
    if (!a) return;
    var sheet = new Sheet(a.name, '', 'sheet-room');
    var ids = F.entitiesIn(areaId);
    var order = ['light', 'switch', 'fan', 'cover', 'lock', 'climate', 'media_player', 'binary_sensor', 'sensor', 'camera', 'vacuum', 'input_boolean', 'humidifier', 'valve'];
    ids.sort(function (x, y) { return order.indexOf(F.domain(x)) - order.indexOf(F.domain(y)); });
    var list = F.el('div', 'dev-list', sheet.body);
    var refreshers = {};
    var shown = 0;
    for (var i = 0; i < ids.length; i++) {
      if (order.indexOf(F.domain(ids[i])) < 0) continue;
      refreshers[ids[i]] = deviceRow(list, ids[i]);
      shown++;
    }
    if (!shown) F.el('div', 'sheet-empty', list, F.t('no_devices'));
    var s = F.roomSummary(areaId);
    F.text(sheet.subEl, F.lightsText(s.on) + (s.temp !== null ? ' · ' + F.tempPrecise(s.temp) : ''));
    sheet.onRefresh(function (c) {
      for (var id in c) if (c.hasOwnProperty(id) && refreshers[id]) refreshers[id]();
      var x = F.roomSummary(areaId);
      F.text(sheet.subEl, F.lightsText(x.on) + (x.temp !== null ? ' · ' + F.tempPrecise(x.temp) : ''));
    });
    if (s.lights.length) {
      var row = F.el('div', 'btn-row', sheet.body);
      F.button(row, F.t('turn_off'), 'lightbulb-group-outline', '', function () { F.act({ action: 'room_off', area: areaId }); });
    }
  };

  S.house = function () {
    var st = F.block('status');
    var sheet = new Sheet((st && st.name) || F.t('house'), F.t('rooms'), 'sheet-room');
    var list = F.el('div', 'dev-list', sheet.body);
    var areas = F.store.areas;
    for (var i = 0; i < areas.length; i++) {
      (function (a) {
        if (!F.entitiesIn(a.id).length) return;
        var row = F.el('div', 'dev-row', list);
        F.icon(F.areaIcon(a), 'dev-ic', row);
        var txt = F.el('div', 'dev-txt', row);
        F.el('div', 'dev-name', txt, a.name);
        var s = F.roomSummary(a.id);
        F.el('div', 'dev-state', txt, F.lightsText(s.on) + (s.temp !== null ? ' · ' + F.tempPrecise(s.temp) : ''));
        F.cls(row, 'on', s.on > 0);
        F.onTap(row, function () { S.room(a.id); });
      }(areas[i]));
    }
    var row2 = F.el('div', 'btn-row', sheet.body);
    F.button(row2, F.t('all_off'), 'power', '', function () { F.act({ action: 'all_off' }); });
  };

  // ------------------------------------------------------------------ weather and calendar pages
  S.weather = function () {
    var id = F.weatherEntity();
    var e = id ? F.e(id) : null;
    var st = F.block('status');
    var sheet = new Sheet((st && st.name) || F.t('outside'), e ? F.weatherText(e.s) : F.t('weather_unavailable'), 'sheet-weather');
    if (!e) return;
    var at = e.at || {};
    var top = F.el('div', 'ws-top', sheet.body);
    F.icon(F.weatherIcon(e.s, F.isNight()), 'ws-icon', top);
    F.el('div', 'ws-temp', top, F.temp(at.temperature));
    var facts = F.el('div', 'ws-facts', sheet.body);
    var hl = F.todayHiLo();
    if (hl) F.el('div', 'ws-fact', facts, F.hiLoText(hl));
    if (at.apparent_temperature !== undefined) F.el('div', 'ws-fact', facts, F.t('feels') + ' ' + F.temp(at.apparent_temperature));
    if (at.humidity !== undefined) F.el('div', 'ws-fact', facts, F.t('humidity') + ' ' + Math.round(at.humidity) + ' %');
    if (at.wind_speed !== undefined) F.el('div', 'ws-fact', facts, F.t('wind') + ' ' + Math.round(at.wind_speed) + ' ' + (at.wind_speed_unit || 'km/h'));
    var b = F.block('weather');
    var i;
    if (b && b.hourly && b.hourly.length) {
      var hs = sheet.section(F.t('hourly'));
      var strip = F.el('div', 'ws-hours', hs);
      for (i = 0; i < Math.min(12, b.hourly.length); i++) {
        var f = b.hourly[i];
        var d = F.parseDate(f.t);
        var c = F.el('div', 'ws-h', strip);
        F.el('div', 'ws-h-t', c, d ? F.time(d, false) : '');
        F.icon(F.weatherIcon(f.c, d && (d.getHours() < 7 || d.getHours() >= 19)), 'ws-h-i', c);
        F.el('div', 'ws-h-v', c, F.temp(f.hi));
      }
    }
    if (b && b.daily && b.daily.length) {
      var ds = sheet.section(F.t('daily'));
      for (i = 0; i < Math.min(7, b.daily.length); i++) {
        var g = b.daily[i];
        var dd = F.parseDate(g.t);
        var row = F.el('div', 'ws-day', ds);
        F.el('div', 'ws-day-n', row, dd ? (F.sameDay(dd, new Date()) ? F.t('today') : F.cap(F.dayName(dd))) : '');
        F.icon(F.weatherIcon(g.c, false), 'ws-day-i', row);
        F.el('div', 'ws-day-v', row, F.temp(g.lo) + ' / ' + F.temp(g.hi));
      }
    }
  };

  S.calendar = function () {
    var sheet = new Sheet(F.t('events_week'), '', 'sheet-calendar');
    var b = F.block('calendar');
    if (!b || !b.calendars || !b.calendars.length) {
      F.el('div', 'sheet-empty', sheet.body, F.t('no_calendar'));
      return;
    }
    var now = new Date();
    var any = false;
    for (var d = 0; d < 7; d++) {
      var day = new Date(now.getTime() + d * 86400000);
      var list = F.eventsFor(day);
      if (!list.length) continue;
      any = true;
      var sec = sheet.section(d === 0 ? F.t('today') : (d === 1 ? F.t('tomorrow') : F.cap(F.dayName(day)) + ' ' + day.getDate()));
      for (var i = 0; i < list.length; i++) {
        var row = F.el('div', 'ev-row', sec);
        var bar = F.el('div', 'ev-bar', row);
        bar.style.backgroundColor = F.calColor(list[i].ev.cal);
        F.el('div', 'ev-title', row, list[i].ev.title);
        F.el('div', 'ev-time', row, F.eventTime(list[i]) + (list[i].ev.loc ? ' · ' + list[i].ev.loc : ''));
      }
    }
    if (!any) F.el('div', 'sheet-empty', sheet.body, F.t('no_events'));
  };
}(window));
