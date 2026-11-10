/* Foyer: tiles. Each type knows how to build, update, answer a tap, a drag and a long press. ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var T = F.tileTypes = {};

  // ------------------------------------------------------------------ Tile
  function Tile(spec, face) {
    this.spec = spec;
    this.face = face;
    this.type = T[spec.type] ? spec.type : 'entity';
    this.T = T[this.type];
    this.el = F.el('div', 'tile tile-' + this.type + ' size-' + (spec.size || 'S'));
    this.el.foyerTile = this;
    this.w = 0;
    this.h = 0;
    this.T.build(this);
  }
  Tile.prototype.setBox = function (x, y, wd, ht) {
    this.w = wd;
    this.h = ht;
    F.css(this.el, { left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: Math.round(wd) + 'px', height: Math.round(ht) + 'px' });
    var base = F.clamp(Math.min(ht * 0.095, wd * 0.12), 11, 26);
    if (this.spec.size === 'W') base = F.clamp(Math.min(ht * 0.105, wd * 0.07), 11, 26);
    this.el.style.fontSize = base.toFixed(1) + 'px';
    this.el.style.borderRadius = Math.round(F.clamp(Math.min(wd, ht) * 0.13, 14, 30)) + 'px';
    if (this.T.resize) this.T.resize(this);
    this.update();
  };
  Tile.prototype.update = function () {
    try { this.T.update(this); } catch (e) { if (w.console) w.console.error(e); }
  };
  Tile.prototype.entity = function () { return this.spec.entity ? F.e(this.spec.entity) : null; };
  Tile.prototype.relevant = function (changed, blocks) {
    if (this.spec.entity && changed[this.spec.entity]) return true;
    if (this.T.relevant) return this.T.relevant(this, changed, blocks);
    return false;
  };
  Tile.prototype.tick = function (now) {
    if (this.T.tick) this.T.tick(this, now);
  };
  F.Tile = Tile;

  function anyChanged(changed, ids) {
    for (var i = 0; i < ids.length; i++) if (changed[ids[i]]) return true;
    return false;
  }
  function col(t) {
    if (!t.col) t.col = F.el('div', 't-col', t.el);
    return t.col;
  }
  function flash(t) {
    F.cls(t.el, 'flash', true);
    w.setTimeout(function () { F.cls(t.el, 'flash', false); }, 650);
  }
  F.flashTile = flash;

  // ------------------------------------------------------------------ device tile
  function levelOf(id, e) {
    var d = F.domain(id);
    if (!e) return 0;
    if (d === 'light') return e.s === 'on' ? Math.round(((e.at && e.at.brightness) || 255) / 2.55) : 0;
    if (d === 'fan') return e.s === 'on' ? ((e.at && e.at.percentage) || 100) : 0;
    if (d === 'cover') return e.at && e.at.current_position !== undefined ? e.at.current_position : (e.s === 'open' ? 100 : 0);
    return 0;
  }
  F.levelOf = levelOf;

  function dimmable(id, e) {
    var d = F.domain(id);
    if (!e || e.s === 'unavailable') return false;
    if (d === 'light') {
      var modes = (e.at && e.at.supported_color_modes) || [];
      return modes.length > 0 && !(modes.length === 1 && modes[0] === 'onoff');
    }
    if (d === 'fan') return Boolean(e.at && (e.at.supported_features & 1));
    if (d === 'cover') return Boolean(e.at && (e.at.supported_features & 4)) && (e.at.device_class !== 'garage' && e.at.device_class !== 'gate');
    return false;
  }
  F.dimmable = dimmable;

  /** What a tap on the icon half does. Returns true when handled. */
  function primary(t, id, e) {
    var d = F.domain(id);
    var dc = e && e.at && e.at.device_class;
    if (!e || e.s === 'unavailable') return false;
    switch (d) {
      case 'light': case 'switch': case 'fan': case 'input_boolean': case 'humidifier':
        F.toggle(id);
        return true;
      case 'cover':
        if ((dc === 'garage' || dc === 'gate') && (e.s === 'closed' || e.s === 'closing')) {
          F.confirm(F.t('confirm_open', { name: e.n }), F.t('open_cmd'), function () { F.toggle(id); });
        } else F.toggle(id);
        return true;
      case 'lock':
        if (e.s === 'locked') {
          F.confirm(F.t('confirm_unlock', { name: e.n }), F.t('unlock'), function () {
            if (e.at && e.at.code_format) F.sheets.open(id);
            else F.call(id, 'unlock', {}, function (c) { c.s = 'unlocking'; });
          });
        } else F.call(id, 'lock', {}, function (c) { c.s = 'locking'; });
        return true;
      case 'scene':
        F.call(id, 'turn_on');
        flash(t);
        return true;
      case 'script':
        F.call(id, 'turn_on');
        flash(t);
        return true;
      case 'button': case 'input_button':
        F.call(id, 'press');
        flash(t);
        return true;
      case 'media_player':
        F.call(id, 'media_play_pause', {}, function (c) { c.s = c.s === 'playing' ? 'paused' : 'playing'; });
        return true;
      case 'valve':
        F.call(id, 'toggle');
        return true;
      default:
        return false;
    }
  }
  F.primaryAction = primary;

  T.entity = {
    build: function (t) {
      var c = col(t);
      t.icon = F.icon('home', 't-icon', c);
      t.name = F.el('div', 't-name', c);
      t.sub = F.el('div', 't-sub', c);
      t.levelEl = F.el('div', 't-level', t.el);
      t.levelFill = F.el('div', 't-level-fill', t.levelEl);
      t.levelText = F.el('div', 't-level-text', t.levelEl);
    },
    update: function (t) {
      var id = t.spec.entity;
      var e = t.entity();
      var d = F.domain(id);
      if (!e) {
        F.setIcon(t.icon, 'alert-circle');
        F.text(t.name, t.spec.name || id);
        F.text(t.sub, F.t('unavailable'));
        F.cls(t.el, 'unavail', true);
        return;
      }
      F.setIcon(t.icon, F.entityIcon(id, e));
      F.text(t.name, t.spec.name || e.n);
      var area = F.area(e.a);
      var state = F.stateText(id, e);
      var sub = state;
      if (d === 'scene' || d === 'script') sub = state;
      else if (area && t.spec.size !== 'W') sub = area.name + ' · ' + state;
      else if (area) sub = area.name + ' · ' + state;
      F.text(t.sub, sub);
      var alert = F.isAlert(id, e);
      F.cls(t.el, 'alert', alert);
      F.cls(t.el, 'on', !alert && F.isActive(id, e));
      F.cls(t.el, 'unavail', e.s === 'unavailable');
      F.cls(t.el, 'pending', F.isPending(id));
      F.cls(t.el, 'd-' + d, true);
    },
    tap: function (t, fx, fy) {
      var id = t.spec.entity;
      var e = t.entity();
      if (fy > 0.62 || !primary(t, id, e)) F.sheets.open(id);
    },
    press: function (t) { F.sheets.open(t.spec.entity); },
    canDrag: function (t) { return dimmable(t.spec.entity, t.entity()); },
    dragStart: function (t) {
      t.dragBase = levelOf(t.spec.entity, t.entity());
      t.dragValue = t.dragBase;
      F.cls(t.el, 'dragging', true);
      T.entity.showLevel(t, t.dragBase);
    },
    dragMove: function (t, dx, dy) {
      var v = Math.round(F.clamp(t.dragBase - (dy / (t.h * 0.85)) * 100, 0, 100));
      if (v === t.dragValue) return;
      t.dragValue = v;
      T.entity.showLevel(t, v);
      var nowMs = F.now();
      if (!t.lastSent || nowMs - t.lastSent > 450) {
        t.lastSent = nowMs;
        T.entity.sendLevel(t, v, true);
      }
    },
    dragEnd: function (t) {
      T.entity.sendLevel(t, t.dragValue, false);
      t.lastSent = 0;
      w.setTimeout(function () { F.cls(t.el, 'dragging', false); }, 700);
    },
    showLevel: function (t, v) {
      t.levelFill.style.height = v + '%';
      F.text(t.levelText, v + ' %');
    },
    sendLevel: function (t, v, live) {
      var id = t.spec.entity;
      var d = F.domain(id);
      var patch = function (c) {
        if (d === 'light') {
          c.s = v > 0 ? 'on' : 'off';
          c.at.brightness = Math.round(v * 2.55);
        } else if (d === 'fan') {
          c.s = v > 0 ? 'on' : 'off';
          c.at.percentage = v;
        } else {
          c.at.current_position = v;
          c.s = v > 0 ? 'open' : 'closed';
        }
      };
      if (d === 'light') {
        if (v === 0) F.call(id, 'turn_off', {}, patch);
        else F.call(id, 'turn_on', { brightness_pct: v }, patch);
      } else if (d === 'fan') F.call(id, 'set_percentage', { percentage: v }, patch);
      else if (d === 'cover') F.call(id, 'set_cover_position', { position: v }, patch);
      if (!live) F.emitEntity(id);
    }
  };

  // ------------------------------------------------------------------ thermostat (or a temperature when there is none)
  T.thermostat = {
    build: function (t) {
      t.big = F.el('div', 'th-temp', t.el);
      t.name = F.el('div', 'th-name', t.el);
      t.sub = F.el('div', 'th-sub', t.el);
      t.down = F.el('div', 'th-btn th-down', t.el);
      F.icon('chevron-down', '', t.down);
      t.up = F.el('div', 'th-btn th-up', t.el);
      F.icon('chevron-up', '', t.up);
      t.target = null;
      t.sendTimer = null;
    },
    resize: function (t) {
      // The number is the point of this tile: as big as the tile allows.
      t.big.style.fontSize = Math.round(Math.min(t.h * 0.36, t.w * 0.42)) + 'px';
    },
    climateId: function (t) {
      var id = t.spec.entity;
      if (id && F.domain(id) === 'climate' && F.e(id)) return id;
      var list = F.entitiesOf('climate');
      return list[0] || null;
    },
    update: function (t) {
      var id = T.thermostat.climateId(t);
      var e = id ? F.e(id) : null;
      if (e) {
        t.climate = id;
        var at = e.at || {};
        var target = t.target !== null ? t.target : at.temperature;
        if (target === undefined || target === null) {
          target = at.target_temp_low !== undefined ? at.target_temp_low : at.current_temperature;
        }
        F.text(t.big, e.s === 'off' ? F.t('off') : F.tempPrecise(target).replace('°', ''));
        F.cls(t.big, 'off', e.s === 'off');
        F.text(t.name, t.spec.name || (e.n && e.n.toLowerCase() !== 'thermostat' ? e.n : F.t('thermostat')));
        var area = F.area(e.a);
        var cur = at.current_temperature !== undefined ? F.tempPrecise(at.current_temperature) : '';
        F.text(t.sub, (area ? area.name : '') + (area && cur ? ' · ' : '') + cur);
        F.cls(t.el, 'heating', at.hvac_action === 'heating');
        F.cls(t.el, 'cooling', at.hvac_action === 'cooling');
        F.cls(t.el, 'no-arrows', e.s === 'off');
        return;
      }
      t.climate = null;
      F.cls(t.el, 'no-arrows', true);
      var sid = t.spec.entity && F.e(t.spec.entity) ? t.spec.entity : null;
      var s = sid ? F.e(sid) : null;
      var wb = F.block('weather');
      var we = wb ? F.e(wb.entity) : null;
      if (s && F.domain(sid) === 'sensor') {
        F.text(t.big, F.temp(s.s).replace('°', '') + '°');
        F.text(t.name, t.spec.name || s.n);
        var a = F.area(s.a);
        F.text(t.sub, a ? a.name : F.t('inside'));
      } else if (we) {
        F.text(t.big, F.temp(we.at && we.at.temperature));
        F.text(t.name, F.t('outside'));
        F.text(t.sub, F.weatherText(we.s));
      } else {
        F.text(t.big, '—');
        F.text(t.name, F.t('temperature'));
        F.text(t.sub, '');
      }
    },
    relevant: function (t, changed, blocks) {
      return Boolean((t.climate && changed[t.climate]) || blocks.weather || (!t.climate && anyChanged(changed, F.entitiesOf('weather'))));
    },
    tap: function (t, fx, fy) {
      if (!t.climate) return;
      var e = F.e(t.climate);
      if (e && e.s !== 'off' && fy > 0.62 && (fx < 0.35 || fx > 0.65)) {
        T.thermostat.nudge(t, fx < 0.5 ? -1 : 1);
        return;
      }
      F.sheets.open(t.climate);
    },
    press: function (t) { if (t.climate) F.sheets.open(t.climate); },
    nudge: function (t, dir) {
      var e = F.e(t.climate);
      if (!e) return;
      var at = e.at || {};
      var step = at.target_temp_step || 0.5;
      var base = t.target !== null ? t.target : (at.temperature !== undefined ? at.temperature : at.current_temperature || 20);
      var next = F.clamp(Math.round((base + dir * step) * 10) / 10, at.min_temp || 7, at.max_temp || 35);
      t.target = next;
      T.thermostat.update(t);
      F.cls(dir < 0 ? t.down : t.up, 'hit', true);
      w.setTimeout(function () { F.cls(dir < 0 ? t.down : t.up, 'hit', false); }, 160);
      w.clearTimeout(t.sendTimer);
      t.sendTimer = w.setTimeout(function () {
        var id = t.climate;
        var v = t.target;
        F.call(id, 'set_temperature', { temperature: v }, function (c) { c.at.temperature = v; }, function () {
          t.target = null;
          T.thermostat.update(t);
        });
      }, 1100);
    }
  };

  // ------------------------------------------------------------------ analog clock (drawn on the wallpaper, no glass)
  F.buildClock = function (parent, opts) {
    opts = opts || {};
    var s = F.svg('svg', { viewBox: '0 0 100 100', 'class': 'aclock' + (opts.cls ? ' ' + opts.cls : '') }, parent);
    var i;
    if (opts.numbers) {
      for (i = 1; i <= 12; i++) {
        var a = (i / 12) * Math.PI * 2;
        var tx = F.svg('text', { x: (50 + Math.sin(a) * 37).toFixed(2), y: (50 - Math.cos(a) * 37 + 4.2).toFixed(2), 'class': 'ac-num', 'text-anchor': 'middle' }, s);
        tx.appendChild(w.document.createTextNode(String(i)));
      }
      for (i = 0; i < 60; i++) {
        if (i % 5 === 0) continue;
        var b = (i / 60) * Math.PI * 2;
        F.svg('line', {
          x1: (50 + Math.sin(b) * 46).toFixed(2), y1: (50 - Math.cos(b) * 46).toFixed(2),
          x2: (50 + Math.sin(b) * 48).toFixed(2), y2: (50 - Math.cos(b) * 48).toFixed(2), 'class': 'ac-min'
        }, s);
      }
    } else {
      for (i = 0; i < 12; i++) {
        F.svg('rect', { x: '48.4', y: '3', width: '3.2', height: i % 3 === 0 ? '11' : '8.5', rx: '1.6', 'class': 'ac-tick', transform: 'rotate(' + (i * 30) + ' 50 50)' }, s);
      }
    }
    var hour = F.svg('line', { x1: '50', y1: '53', x2: '50', y2: opts.numbers ? '27' : '24', 'class': 'ac-hour' }, s);
    var minute = F.svg('line', { x1: '50', y1: '55', x2: '50', y2: opts.numbers ? '12' : '9', 'class': 'ac-minute' }, s);
    var second = F.svg('line', { x1: '50', y1: '58', x2: '50', y2: '8', 'class': 'ac-second' }, s);
    F.svg('circle', { cx: '50', cy: '50', r: '2.6', 'class': 'ac-center' }, s);
    F.svg('circle', { cx: '50', cy: '50', r: '1.1', 'class': 'ac-pin' }, s);
    var clock = {
      el: s,
      set: function (d) {
        var sec = d.getSeconds();
        var min = d.getMinutes() + sec / 60;
        var hr = (d.getHours() % 12) + min / 60;
        hour.setAttribute('transform', 'rotate(' + (hr * 30).toFixed(2) + ' 50 50)');
        minute.setAttribute('transform', 'rotate(' + (min * 6).toFixed(2) + ' 50 50)');
        second.setAttribute('transform', 'rotate(' + (sec * 6) + ' 50 50)');
      }
    };
    clock.set(new Date());
    return clock;
  };

  T.clock = {
    build: function (t) {
      t.clock = F.buildClock(t.el, {});
    },
    resize: function (t) {
      var d = Math.min(t.w, t.h) * 0.96;
      F.css(t.clock.el, { width: d + 'px', height: d + 'px', left: ((t.w - d) / 2) + 'px', top: ((t.h - d) / 2) + 'px' });
    },
    update: function () {},
    tick: function (t, now) { t.clock.set(now); },
    tap: function () { F.pager && F.pager.goTo('analog'); }
  };

  // ------------------------------------------------------------------ weather
  function weatherEntity(t) {
    var id = t.spec.entity;
    if (id && F.e(id)) return id;
    var b = F.block('weather');
    if (b && b.entity && F.e(b.entity)) return b.entity;
    return F.entitiesOf('weather')[0] || null;
  }
  F.weatherEntity = function () {
    var b = F.block('weather');
    if (b && b.entity && F.e(b.entity)) return b.entity;
    return F.entitiesOf('weather')[0] || null;
  };
  F.todayHiLo = function () {
    var b = F.block('weather');
    if (!b || !b.daily || !b.daily.length) return null;
    var today = new Date();
    for (var i = 0; i < b.daily.length; i++) {
      var d = F.parseDate(b.daily[i].t);
      if (d && (F.sameDay(d, today) || d.getTime() > today.getTime())) return b.daily[i];
    }
    return b.daily[0];
  };
  F.hiLoText = function (f) {
    if (!f) return '';
    return F.t('high') + ' ' + F.temp(f.hi) + (f.lo !== undefined && f.lo !== null ? '  ' + F.t('low') + ' ' + F.temp(f.lo) : '');
  };

  T.weather = {
    build: function (t) {
      t.loc = F.el('div', 'w-loc', t.el);
      t.big = F.el('div', 'w-temp', t.el);
      t.cond = F.el('div', 'w-cond', t.el);
      t.condIcon = F.icon('weather-cloudy', 'w-icon', t.cond);
      t.condText = F.el('span', 'w-cond-text', t.cond);
      t.hilo = F.el('div', 'w-hilo', t.el);
      t.hours = F.el('div', 'w-hours', t.el);
    },
    update: function (t) {
      var id = weatherEntity(t);
      t.wid = id;
      var e = id ? F.e(id) : null;
      if (!e) {
        F.text(t.loc, '');
        F.text(t.big, '—');
        F.text(t.condText, F.t('weather_unavailable'));
        F.text(t.hilo, '');
        F.clear(t.hours);
        return;
      }
      var home = F.block('status');
      F.text(t.loc, (home && home.name) || e.n);
      F.text(t.big, F.temp(e.at && e.at.temperature));
      F.setIcon(t.condIcon, F.weatherIcon(e.s, F.isNight()));
      F.text(t.condText, F.weatherText(e.s));
      F.text(t.hilo, F.hiLoText(F.todayHiLo()));
      F.clear(t.hours);
      var b = F.block('weather');
      var big = t.spec.size === 'M' || t.spec.size === 'L' || t.spec.size === 'XL' || t.spec.size === 'T';
      if (big && b && b.hourly && b.hourly.length) {
        var n = t.spec.size === 'L' || t.spec.size === 'XL' ? 7 : 5;
        for (var i = 0; i < Math.min(n, b.hourly.length); i++) {
          var f = b.hourly[i];
          var d = F.parseDate(f.t);
          var cell = F.el('div', 'w-h', t.hours);
          F.el('div', 'w-h-t', cell, d ? (F.lang === 'en' ? (d.getHours() % 12 || 12) + (d.getHours() >= 12 ? 'PM' : 'AM') : d.getHours() + ' h') : '');
          var night = d ? (d.getHours() < 7 || d.getHours() >= 19) : false;
          F.icon(F.weatherIcon(f.c, night), 'w-h-i', cell);
          F.el('div', 'w-h-v', cell, F.temp(f.hi));
        }
      }
    },
    relevant: function (t, changed, blocks) { return Boolean(blocks.weather || (t.wid && changed[t.wid]) || changed['sun.sun']); },
    tap: function (t) { F.sheets.weather(); },
    press: function () { F.sheets.weather(); }
  };

  // ------------------------------------------------------------------ photo
  F.photoIndex = function (count, interval) {
    if (!count) return -1;
    return Math.floor(F.now() / 1000 / Math.max(10, interval || 300)) % count;
  };
  F.photoItems = function () {
    var b = F.block('photos');
    return (b && b.items) || [];
  };
  function setBg(el, url) {
    el.style.backgroundImage = url ? 'url("' + String(url).replace(/["\\\n\r]/g, '') + '")' : 'none';
  }
  F.setBg = setBg;

  T.photo = {
    build: function (t) {
      t.a = F.el('div', 'ph-layer', t.el);
      t.b = F.el('div', 'ph-layer', t.el);
      t.empty = F.el('div', 'ph-empty', t.el);
      F.icon('image-plus', '', t.empty);
      F.el('div', 'ph-empty-t', t.empty, F.t('add_photo'));
      t.idx = -2;
      t.front = t.a;
    },
    update: function (t) { T.photo.tick(t, null, true); },
    relevant: function (t, changed, blocks) { return Boolean(blocks.photos); },
    tick: function (t, now, force) {
      var items = F.photoItems();
      var b = F.block('photos');
      var idx = F.photoIndex(items.length, b && b.interval);
      F.cls(t.el, 'is-empty', !items.length);
      if (idx === t.idx && !force) return;
      t.idx = idx;
      if (idx < 0) {
        setBg(t.a, null);
        setBg(t.b, null);
        return;
      }
      var url = items[idx].src;
      if (t.front.foyerUrl === url || t.loading === url) return;
      t.loading = url;
      var img = new w.Image();
      img.onload = function () {
        if (t.loading === url) t.loading = null;
        if (t.front.foyerUrl === url) return;
        var back = t.front === t.a ? t.b : t.a;
        F.cls(back, 'instant', !t.front.foyerUrl);
        setBg(back, url);
        back.foyerUrl = url;
        F.cls(back, 'show', true);
        F.cls(t.front, 'show', false);
        t.front = back;
      };
      img.onerror = function () { if (t.loading === url) t.loading = null; };
      img.src = url;
    },
    tap: function (t) { F.pager && F.pager.goTo('photos'); }
  };

  // ------------------------------------------------------------------ up next (calendar)
  F.eventsFor = function (day) {
    var b = F.block('calendar');
    var out = [];
    if (!b || !b.events) return out;
    var start = F.dayStart(day).getTime();
    var end = start + 86400000;
    for (var i = 0; i < b.events.length; i++) {
      var ev = b.events[i];
      var s = F.parseDate(ev.start);
      var e = F.parseDate(ev.end) || s;
      if (!s) continue;
      if (s.getTime() < end && e.getTime() > start) out.push({ ev: ev, s: s, e: e });
    }
    return out;
  };
  F.calColor = function (calId) {
    var b = F.block('calendar');
    var colors = ['#ff453a', '#0a84ff', '#30d158', '#bf5af2', '#ff9f0a', '#64d2ff'];
    if (!b || !b.calendars) return colors[0];
    for (var i = 0; i < b.calendars.length; i++) if (b.calendars[i].id === calId) return colors[i % colors.length];
    return colors[0];
  };
  F.eventTime = function (x) {
    if (x.ev.allDay) return F.t('all_day');
    return F.time(x.s) + ' – ' + F.time(x.e);
  };
  /** The next things on the calendar: what is left today, otherwise the coming days. */
  F.upNext = function (max) {
    var now = new Date();
    var out = [];
    for (var d = 0; d < 7 && out.length < max; d++) {
      var day = new Date(now.getTime() + d * 86400000);
      var list = F.eventsFor(day);
      for (var i = 0; i < list.length && out.length < max; i++) {
        if (list[i].e.getTime() > now.getTime()) {
          list[i].day = d;
          out.push(list[i]);
        }
      }
    }
    return out;
  };

  T.agenda = {
    build: function (t) {
      t.left = F.el('div', 'ag-left', t.el);
      t.dname = F.el('div', 'ag-day', t.left);
      t.dnum = F.el('div', 'ag-num', t.left);
      t.list = F.el('div', 'ag-list', t.el);
    },
    update: function (t) {
      var now = new Date();
      F.text(t.dname, F.dayName(now));
      F.text(t.dnum, now.getDate());
      F.clear(t.list);
      var b = F.block('calendar');
      if (!b || !b.calendars || !b.calendars.length) {
        F.el('div', 'ag-empty', t.list, F.t('no_calendar'));
        return;
      }
      var max = t.h > 160 ? 3 : 2;
      var items = F.upNext(max);
      if (!items.length) {
        F.el('div', 'ag-empty', t.list, F.t('no_events'));
        return;
      }
      for (var i = 0; i < items.length; i++) {
        var row = F.el('div', 'ag-ev', t.list);
        var bar = F.el('div', 'ag-bar', row);
        bar.style.backgroundColor = F.calColor(items[i].ev.cal);
        F.el('div', 'ag-title', row, items[i].ev.title);
        var when = F.eventTime(items[i]);
        if (items[i].day === 1) when = F.t('tomorrow') + ' · ' + when;
        else if (items[i].day > 1) when = F.cap(F.dayName(items[i].s, true)) + ' · ' + when;
        F.el('div', 'ag-time', row, when);
      }
      t.lastDay = now.getDate();
      t.lastMin = Math.floor(now.getTime() / 300000);
    },
    relevant: function (t, changed, blocks) { return Boolean(blocks.calendar); },
    tick: function (t, now) {
      if (now.getDate() !== t.lastDay || Math.floor(now.getTime() / 300000) !== t.lastMin) T.agenda.update(t);
    },
    tap: function () { F.sheets.calendar(); },
    press: function () { F.sheets.calendar(); }
  };

  // ------------------------------------------------------------------ camera
  T.camera = {
    build: function (t) {
      t.img = F.el('div', 'cam-img', t.el);
      t.label = F.el('div', 'cam-label', t.el);
      t.last = 0;
    },
    update: function (t) {
      var e = t.entity();
      F.text(t.label, t.spec.name || (e ? e.n : F.t('no_cameras')));
      T.camera.tick(t, new Date(), true);
    },
    tick: function (t, now, force) {
      if (!t.spec.entity) return;
      var nowMs = now.getTime();
      if (!force && nowMs - t.last < 10000) return;
      t.last = nowMs;
      var url = 'api/camera/' + t.spec.entity + '?t=' + nowMs;
      var img = new w.Image();
      img.onload = function () { setBg(t.img, url); };
      img.src = url;
    },
    tap: function (t) { if (t.spec.entity) F.sheets.camera(t.spec.entity); }
  };

  // ------------------------------------------------------------------ room
  function roomSummary(areaId) {
    var lights = F.entitiesIn(areaId, ['light']);
    var on = 0;
    for (var i = 0; i < lights.length; i++) if (F.e(lights[i]).s === 'on') on++;
    var temp = null;
    var climates = F.entitiesIn(areaId, ['climate']);
    if (climates.length && F.e(climates[0]).at && F.e(climates[0]).at.current_temperature !== undefined) temp = F.e(climates[0]).at.current_temperature;
    if (temp === null) {
      var sensors = F.entitiesIn(areaId, ['sensor']);
      for (var j = 0; j < sensors.length; j++) {
        var s = F.e(sensors[j]);
        if (s.at && s.at.device_class === 'temperature' && !isNaN(parseFloat(s.s))) {
          temp = parseFloat(s.s);
          break;
        }
      }
    }
    return { lights: lights, on: on, temp: temp };
  }
  F.roomSummary = roomSummary;
  F.lightsText = function (on) {
    if (!on) return F.t('lights_off');
    return on === 1 ? F.t('lights_on_1') : F.t('lights_on_n', { n: on });
  };

  T.room = {
    build: function (t) {
      var c = col(t);
      t.icon = F.icon('home', 't-icon', c);
      t.name = F.el('div', 't-name', c);
      t.sub = F.el('div', 't-sub', c);
      t.temp = F.el('div', 'room-temp', t.el);
    },
    update: function (t) {
      var a = F.area(t.spec.area);
      if (!a) {
        F.text(t.name, t.spec.name || '—');
        F.text(t.sub, '');
        return;
      }
      var s = roomSummary(a.id);
      t.ids = F.entitiesIn(a.id);
      F.setIcon(t.icon, F.areaIcon(a));
      F.text(t.name, t.spec.name || a.name);
      F.text(t.sub, F.lightsText(s.on));
      F.text(t.temp, s.temp !== null ? F.tempPrecise(s.temp) : '');
      F.cls(t.el, 'on', s.on > 0);
    },
    relevant: function (t, changed) { return anyChanged(changed, t.ids || []); },
    tap: function (t, fx, fy) {
      if (fy > 0.62) {
        F.sheets.room(t.spec.area);
        return;
      }
      var s = roomSummary(t.spec.area);
      if (!s.lights.length) {
        F.sheets.room(t.spec.area);
        return;
      }
      F.act({ action: 'room_toggle', area: t.spec.area });
      flash(t);
    },
    press: function (t) { F.sheets.room(t.spec.area); }
  };

  // ------------------------------------------------------------------ the whole home
  function homeSummary() {
    var lights = F.entitiesOf('light');
    var on = 0;
    var open = 0;
    var i;
    for (i = 0; i < lights.length; i++) if (F.e(lights[i]).s === 'on') on++;
    for (var id in F.store.entities) {
      if (F.store.entities.hasOwnProperty(id) && F.isAlert(id, F.store.entities[id])) open++;
    }
    return { on: on, open: open, lights: lights };
  }
  F.homeSummary = homeSummary;

  T.house = {
    build: function (t) {
      var c = col(t);
      t.icon = F.icon('home', 't-icon', c);
      t.name = F.el('div', 't-name', c);
      t.sub = F.el('div', 't-sub', c);
    },
    update: function (t) {
      var s = homeSummary();
      var st = F.block('status');
      F.text(t.name, t.spec.name || (st && st.name) || F.t('house'));
      var parts = [F.lightsText(s.on)];
      if (s.open) parts.push(s.open === 1 ? F.t('doors_open_1') : F.t('doors_open_n', { n: s.open }));
      F.text(t.sub, parts.join(' · '));
      F.cls(t.el, 'alert', s.open > 0);
    },
    relevant: function () { return true; },
    tap: function () { F.sheets.house(); }
  };

  // ------------------------------------------------------------------ "all off"
  T.action = {
    build: function (t) {
      var c = col(t);
      t.icon = F.icon('power', 't-icon', c);
      t.name = F.el('div', 't-name', c, F.t('all_off'));
      t.sub = F.el('div', 't-sub', c);
    },
    update: function (t) {
      var s = homeSummary();
      F.text(t.name, t.spec.name || F.t('all_off'));
      F.text(t.sub, F.lightsText(s.on));
      t.ids = s.lights;
    },
    relevant: function (t, changed) { return anyChanged(changed, t.ids || []); },
    tap: function (t) {
      F.act({ action: 'all_off' });
      flash(t);
    }
  };

  // ------------------------------------------------------------------ now playing
  F.pickSpeaker = function () {
    var list = F.entitiesOf('media_player');
    var pref = F.settings().speaker;
    if (pref && F.e(pref) && F.e(pref).s === 'playing') return pref;
    for (var i = 0; i < list.length; i++) if (F.e(list[i]).s === 'playing') return list[i];
    if (pref && F.e(pref)) return pref;
    if (F.lastSpeaker && F.e(F.lastSpeaker)) return F.lastSpeaker;
    for (i = 0; i < list.length; i++) if (F.e(list[i]).s === 'paused') return list[i];
    return list[0] || null;
  };

  T.media = {
    build: function (t) {
      t.art = F.el('div', 'md-art', t.el);
      t.title = F.el('div', 'md-title', t.el);
      t.artist = F.el('div', 'md-artist', t.el);
      t.btn = F.el('div', 'md-btn', t.el);
      t.btnIcon = F.icon('play', '', t.btn);
    },
    update: function (t) {
      var id = t.spec.entity && F.e(t.spec.entity) ? t.spec.entity : F.pickSpeaker();
      t.mid = id;
      var e = id ? F.e(id) : null;
      if (!e) {
        F.text(t.title, F.t('no_speaker'));
        F.text(t.artist, '');
        setBg(t.art, null);
        return;
      }
      var at = e.at || {};
      F.text(t.title, at.media_title || F.t('nothing_playing'));
      F.text(t.artist, at.media_artist || e.n);
      setBg(t.art, at.pic || null);
      F.setIcon(t.btnIcon, e.s === 'playing' ? 'pause' : 'play');
    },
    relevant: function (t, changed) { return anyChanged(changed, F.entitiesOf('media_player')); },
    tap: function (t, fx, fy) {
      if (!t.mid) return;
      if (fy > 0.6) {
        F.lastSpeaker = t.mid;
        F.call(t.mid, 'media_play_pause', {}, function (c) { c.s = c.s === 'playing' ? 'paused' : 'playing'; });
      } else F.sheets.open(t.mid);
    }
  };

  // ------------------------------------------------------------------ date, sun, list, sensor
  T.date = {
    build: function (t) {
      t.day = F.el('div', 'dt-day', t.el);
      t.num = F.el('div', 'dt-num', t.el);
      t.month = F.el('div', 'dt-month', t.el);
    },
    update: function (t) {
      var d = new Date();
      F.text(t.day, F.cap(F.dayName(d)));
      F.text(t.num, d.getDate());
      F.text(t.month, F.cap(F.monthName(d)));
      t.last = d.getDate();
    },
    tick: function (t, now) { if (now.getDate() !== t.last) T.date.update(t); }
  };

  F.sunTimes = function () {
    var s = F.e('sun.sun');
    if (!s || !s.at) return null;
    return { rise: F.parseDate(s.at.next_rising), set: F.parseDate(s.at.next_setting) };
  };

  T.sun = {
    build: function (t) {
      t.label = F.el('div', 'sun-label', t.el);
      t.big = F.el('div', 'sun-time', t.el);
      t.other = F.el('div', 'sun-other', t.el);
    },
    update: function (t) {
      var st = F.sunTimes();
      if (!st || !st.rise || !st.set) {
        F.text(t.big, '—');
        return;
      }
      var riseFirst = st.rise.getTime() < st.set.getTime();
      var first = riseFirst ? st.rise : st.set;
      var second = riseFirst ? st.set : st.rise;
      F.text(t.label, F.t(riseFirst ? 'sunrise' : 'sunset'));
      F.text(t.big, F.time(first));
      F.text(t.other, F.t(riseFirst ? 'sunset_s' : 'sunrise_s') + ' ' + F.time(second));
    },
    relevant: function (t, changed) { return Boolean(changed['sun.sun']); }
  };

  T.todo = {
    build: function (t) {
      t.title = F.el('div', 'td-title', t.el);
      t.list = F.el('div', 'td-list', t.el);
    },
    update: function (t) {
      var b = F.block('todo');
      var id = t.spec.entity || (b && b.lists ? Object.keys(b.lists)[0] : null);
      var e = id ? F.e(id) : null;
      F.text(t.title, t.spec.name || (e ? e.n : F.t('lists')));
      F.clear(t.list);
      var l = b && b.lists && id ? b.lists[id] : null;
      if (!l || !l.open.length) {
        F.el('div', 'td-empty', t.list, F.t('list_empty'));
        return;
      }
      for (var i = 0; i < Math.min(l.open.length, 6); i++) F.el('div', 'td-item', t.list, l.open[i].t);
    },
    relevant: function (t, changed, blocks) { return Boolean(blocks.todo); }
  };

  T.sensor = {
    build: function (t) {
      t.name = F.el('div', 'sn-name', t.el);
      t.big = F.el('div', 'sn-value', t.el);
    },
    update: function (t) {
      var e = t.entity();
      F.text(t.name, t.spec.name || (e ? e.n : '—'));
      F.text(t.big, e ? F.stateText(t.spec.entity, e) : '—');
    },
    tap: function (t) { if (t.spec.entity) F.sheets.open(t.spec.entity); }
  };

  // ------------------------------------------------------------------ energy: now (a meter) or yesterday (Linky)
  function kwh(v) { return F.num(v, v < 10 ? 1 : 0) + ' kWh'; }
  function euros(v) { return v === null || v === undefined ? '' : F.num(v, 2) + ' €'; }
  function watts(e) {
    var v = parseFloat(e.s);
    if (isNaN(v)) return '—';
    if (e.at && /kW/i.test(e.at.unit_of_measurement || '')) v *= 1000;
    return v >= 1000 ? F.num(v / 1000, 2) + ' kW' : F.num(v) + ' W';
  }
  function dayLabel(key) {
    var p = key.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var y = new Date();
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return F.t('yesterday');
    return F.cap(F.dayName(d));
  }
  F.energySummary = function () {
    var b = F.block('energy');
    if (!b) return null;
    var days = b.days || [];
    var last = days.length ? days[days.length - 1] : null;
    var live = b.live ? F.e(b.live) : null;
    return { b: b, days: days, last: last, live: live && live.s !== 'unavailable' ? live : null };
  };

  T.energy = {
    build: function (t) {
      t.head = F.el('div', 'en-head', t.el);
      F.icon('lightning-bolt', 'en-ic', t.head);
      t.label = F.el('span', 'en-label', t.head);
      t.big = F.el('div', 'en-big', t.el);
      t.sub = F.el('div', 'en-sub', t.el);
      t.bars = F.el('div', 'en-bars', t.el);
    },
    update: function (t) {
      var x = F.energySummary();
      F.clear(t.bars);
      if (!x || (!x.live && !x.last)) {
        F.text(t.label, F.t('energy'));
        F.text(t.big, '—');
        F.text(t.sub, F.t('energy_none'));
        return;
      }
      if (x.live) {
        F.text(t.label, F.t('energy_now'));
        F.text(t.big, watts(x.live));
        F.text(t.sub, x.last ? dayLabel(x.last.d) + ' ' + kwh(x.last.kwh) + (x.last.eur !== null ? ' · ' + euros(x.last.eur) : '') : '');
      } else {
        F.text(t.label, dayLabel(x.last.d));
        F.text(t.big, kwh(x.last.kwh));
        var m = x.b.month || {};
        var parts = [];
        if (x.last.eur !== null) parts.push(euros(x.last.eur));
        if (m.kwh !== null && m.kwh !== undefined) parts.push(F.t('this_month') + ' ' + kwh(m.kwh));
        F.text(t.sub, parts.join(' · '));
      }
      // The last seven days, the most recent brighter.
      var days = x.days.slice(-7);
      var max = 0;
      for (var i = 0; i < days.length; i++) max = Math.max(max, days[i].kwh || 0);
      for (var j = 0; j < days.length; j++) {
        var col = F.el('div', 'en-col' + (j === days.length - 1 ? ' last' : ''), t.bars);
        var bar = F.el('div', 'en-bar', col);
        bar.style.height = (max ? Math.max(6, Math.round((days[j].kwh || 0) / max * 100)) : 6) + '%';
        var p = days[j].d.split('-');
        F.el('div', 'en-day', col, F.dayName(new Date(+p[0], +p[1] - 1, +p[2])).charAt(0).toUpperCase());
      }
    },
    relevant: function (t, changed, blocks) {
      var b = F.block('energy');
      return Boolean(blocks.energy || (b && b.live && changed[b.live]));
    },
    tap: function () { F.energySheet(); }
  };

  F.energySheet = function () {
    var x = F.energySummary();
    var sheet = new F.Sheet(F.t('energy'), x && x.live ? F.t('energy_now') + ' ' + watts(x.live) : '', 'sheet-energy');
    if (!x || !x.days.length) {
      F.el('div', 'sheet-empty', sheet.body, F.t('energy_none'));
    } else {
      var list = F.el('div', 'en-list', sheet.body);
      for (var i = x.days.length - 1; i >= 0; i--) {
        var r = F.el('div', 'en-row', list);
        F.el('div', 'en-row-d', r, dayLabel(x.days[i].d) + ' ' + x.days[i].d.slice(8, 10) + '/' + x.days[i].d.slice(5, 7));
        F.el('div', 'en-row-v', r, kwh(x.days[i].kwh) + (x.days[i].eur !== null ? '  ·  ' + euros(x.days[i].eur) : ''));
      }
      var m = x.b.month || {};
      if (m.kwh !== null && m.kwh !== undefined) {
        var r2 = F.el('div', 'en-row en-total', list);
        F.el('div', 'en-row-d', r2, F.cap(F.t('this_month')));
        F.el('div', 'en-row-v', r2, kwh(m.kwh) + (m.eur !== null ? '  ·  ' + euros(m.eur) : ''));
      }
    }
    if (!x || !x.live) F.el('div', 'sheet-note', sheet.body, F.t('energy_live_hint'));
  };
}(window));
