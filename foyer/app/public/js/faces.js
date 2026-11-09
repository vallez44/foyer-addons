/* Foyer: the ten faces. Each one has one job and is made to be read from across the room. ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var FT = F.faceTypes = {};

  function Face(id) {
    this.id = id;
    this.T = FT[id];
    this.el = F.el('div', 'face face-' + id);
    this.el.foyerFace = this;
    this.tiles = [];
    this.w = 0;
    this.h = 0;
    this.visible = false;
    this.T.build(this);
  }
  Face.prototype.layout = function (wd, ht, landscape) {
    this.w = wd;
    this.h = ht;
    this.landscape = landscape;
    F.css(this.el, { width: wd + 'px', height: ht + 'px' });
    if (this.T.layout) this.T.layout(this);
  };
  Face.prototype.update = function (changed, blocks, full) {
    if (this.T.update) this.T.update(this, changed, blocks, full);
  };
  Face.prototype.tick = function (now) {
    if (this.T.tick) this.T.tick(this, now);
  };
  Face.prototype.show = function () {
    this.visible = true;
    if (this.T.show) this.T.show(this);
  };
  Face.prototype.hide = function () {
    this.visible = false;
    if (this.T.hide) this.T.hide(this);
  };
  F.Face = Face;
  F.FACE_NAMES = {
    photos: 'Photos', home_plus: 'Maison Modulaire Plus', analog: 'Analogique', home: 'Maison Modulaire', flow: 'Flux',
    modular: 'Modulaire', weather: 'Météo', calendar: 'Calendrier', clock: 'Horloge', cameras: 'Caméras'
  };

  // ------------------------------------------------------------------ the two tile faces
  function wallpaperClass(f) {
    var s = F.settings();
    return 'wall wall-' + (s.wallpaper || 'amber');
  }

  function gridRender(f, force) {
    var lay = F.block('layout');
    var specs = (lay && lay.tiles && lay.tiles[f.id]) || [];
    var s = F.settings();
    var sig = JSON.stringify(specs) + '|' + f.w + 'x' + f.h + '|' + (s.wallpaper || '') + '|' + (F.safeTop || 0);
    if (sig === f.sig && !force) {
      for (var k = 0; k < f.tiles.length; k++) f.tiles[k].update();
      return;
    }
    f.sig = sig;
    f.wall.className = wallpaperClass(f);
    F.clear(f.grid);
    f.tiles = [];
    if (!f.w || !f.h) return;
    var g = w.FOYER_LAYOUT.gridFor(f.id, f.landscape);
    var cols = g[0];
    var rows = g[1];
    var placed = w.FOYER_LAYOUT.place(specs, cols, rows);
    var top = F.safeTop || 0;
    var pad = Math.round(F.clamp(Math.min(f.w, f.h) * 0.026, 10, 28));
    var gap = Math.round(pad * 0.72);
    var cw = (f.w - pad * 2 - gap * (cols - 1)) / cols;
    var ch = (f.h - top - pad * 2 - gap * (rows - 1)) / rows;
    var anchor = null;
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      var t = new F.Tile(p.tile, f);
      f.grid.appendChild(t.el);
      var x = pad + p.x * (cw + gap);
      var y = top + pad + p.y * (ch + gap);
      var tw = p.w * cw + (p.w - 1) * gap;
      var th = p.h * ch + (p.h - 1) * gap;
      t.setBox(x, y, tw, th);
      f.tiles.push(t);
      if (!anchor && p.tile.type === 'clock') anchor = { x: x, y: y, w: tw, h: th };
    }
    if (!anchor && f.tiles.length) {
      var t0 = f.tiles[0];
      anchor = { x: parseFloat(t0.el.style.left), y: parseFloat(t0.el.style.top), w: t0.w, h: t0.h };
    }
    if (anchor) {
      var r = Math.max(anchor.w, anchor.h) * 1.32;
      var cx = anchor.x + anchor.w / 2;
      var cy = anchor.y + anchor.h / 2;
      F.css(f.dial, { left: (cx - r) + 'px', top: (cy - r) + 'px', width: (2 * r) + 'px', height: (2 * r) + 'px' });
    }
    var r2 = f.h * 1.06;
    F.css(f.sweep, { left: (f.w * 1.04 - r2) + 'px', top: (f.h * 1.22 - r2) + 'px', width: (2 * r2) + 'px', height: (2 * r2) + 'px' });
  }

  function gridFace() {
    return {
      build: function (f) {
        f.wall = F.el('div', 'wall wall-amber', f.el);
        f.dial = F.el('div', 'wall-dial', f.wall);
        f.sweep = F.el('div', 'wall-sweep', f.wall);
        F.el('div', 'wall-sheen', f.wall);
        f.grid = F.el('div', 'grid', f.el);
        f.sig = '';
      },
      layout: function (f) { gridRender(f, true); },
      update: function (f, changed, blocks, full) {
        if (full || blocks.layout || blocks.settings || blocks.status) {
          gridRender(f, false);
          return;
        }
        for (var i = 0; i < f.tiles.length; i++) {
          if (f.tiles[i].relevant(changed, blocks)) f.tiles[i].update();
        }
      },
      tick: function (f, now) {
        for (var i = 0; i < f.tiles.length; i++) f.tiles[i].tick(now);
      }
    };
  }
  FT.home_plus = gridFace();
  FT.home = gridFace();

  // ------------------------------------------------------------------ Photos: your pictures, the time behind the people
  FT.photos = {
    build: function (f) {
      f.a = F.el('div', 'pf-img', f.el);
      f.b = F.el('div', 'pf-img', f.el);
      f.front = f.a;
      f.shade = F.el('div', 'pf-shade', f.el);
      f.timeWrap = F.el('div', 'pf-time-wrap', f.el);
      f.date = F.el('div', 'pf-date', f.timeWrap);
      f.time = F.el('div', 'pf-time', f.timeWrap);
      f.fg = F.el('div', 'pf-fg', f.el);
      f.empty = F.el('div', 'pf-empty', f.el);
      F.icon('image-plus', '', f.empty);
      F.el('div', 'pf-empty-t', f.empty, F.t('add_photo'));
      f.idx = -2;
    },
    layout: function (f) {
      var fs = Math.min(f.h * 0.34, f.w * 0.25);
      f.time.style.fontSize = Math.round(fs) + 'px';
      f.date.style.fontSize = Math.round(Math.max(16, fs * 0.11)) + 'px';
      f.timeWrap.style.top = Math.round((F.safeTop || 0) + f.h * 0.05) + 'px';
      FT.photos.tick(f, new Date(), true);
    },
    update: function (f, changed, blocks, full) {
      if (full || blocks.photos) FT.photos.tick(f, new Date(), true);
    },
    show: function (f) { FT.photos.tick(f, new Date(), true); },
    tick: function (f, now, force) {
      F.text(f.time, F.clockText(now));
      F.text(f.date, F.cap(F.dayName(now)) + ' ' + now.getDate() + ' ' + F.monthName(now));
      var items = F.photoItems();
      var b = F.block('photos');
      F.cls(f.el, 'is-empty', !items.length);
      var idx = F.photoIndex(items.length, b && b.interval);
      if (idx === f.idx && !force) return;
      f.idx = idx;
      if (idx < 0) return;
      var item = items[idx];
      if ((f.front.foyerUrl === item.src && f.fgMask === item.mask) || f.loading === item.src) return;
      f.loading = item.src;
      var img = new w.Image();
      img.onerror = function () { if (f.loading === item.src) f.loading = null; };
      img.onload = function () {
        if (f.loading === item.src) f.loading = null;
        if (f.front.foyerUrl === item.src && f.fgMask === item.mask) return;
        var back = f.front === f.a ? f.b : f.a;
        var first = !f.front.foyerUrl;
        F.cls(back, 'instant', first);
        F.setBg(back, item.src);
        back.foyerUrl = item.src;
        F.cls(back, 'show', true);
        F.cls(f.front, 'show', false);
        f.front = back;
        f.fgMask = item.mask;
        if (item.mask) {
          F.setBg(f.fg, item.src);
          var m = 'url("' + item.mask + '")';
          f.fg.style.webkitMaskImage = m;
          f.fg.style.maskImage = m;
          if (item.pos) {
            f.fg.style.backgroundPosition = item.pos;
            back.style.backgroundPosition = item.pos;
          }
          F.cls(f.fg, 'show', true);
        } else {
          F.cls(f.fg, 'show', false);
        }
      };
      img.src = item.src;
    }
  };

  // ------------------------------------------------------------------ Analog: a clock you can read from across the room
  FT.analog = {
    build: function (f) {
      f.svg = F.svg('svg', { 'class': 'an-svg' }, f.el);
      f.nums = {};
      var labels = ['12', '3', '6', '9'];
      for (var i = 0; i < labels.length; i++) {
        var tx = F.svg('text', { 'class': 'an-num', 'text-anchor': 'middle' }, f.svg);
        tx.appendChild(w.document.createTextNode(labels[i]));
        f.nums[labels[i]] = tx;
      }
      f.hour = F.svg('line', { 'class': 'an-hour' }, f.svg);
      f.minute = F.svg('line', { 'class': 'an-minute' }, f.svg);
      f.second = F.svg('line', { 'class': 'an-second' }, f.svg);
      f.dot = F.svg('circle', { 'class': 'an-dot' }, f.svg);
      f.date = F.el('div', 'an-date', f.el);
    },
    layout: function (f) {
      var W = f.w;
      var H = f.h;
      f.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      f.svg.setAttribute('width', W);
      f.svg.setAttribute('height', H);
      var R = Math.min(H, W) / 2;
      var cx = W / 2;
      var cy = H / 2;
      f.R = R;
      f.cx = cx;
      f.cy = cy;
      var fs = R * 1.02;
      var pos = { '12': [cx, cy - R * 0.05], '6': [cx, cy + R * 0.93], '9': [cx - R * 0.66, cy + R * 0.36], '3': [cx + R * 0.66, cy + R * 0.36] };
      for (var k in pos) {
        if (!pos.hasOwnProperty(k)) continue;
        f.nums[k].setAttribute('x', pos[k][0].toFixed(1));
        f.nums[k].setAttribute('y', pos[k][1].toFixed(1));
        f.nums[k].setAttribute('font-size', fs.toFixed(1));
      }
      var set = function (el, len, back, width) {
        el.setAttribute('x1', cx);
        el.setAttribute('y1', cy + back);
        el.setAttribute('x2', cx);
        el.setAttribute('y2', cy - len);
        el.setAttribute('stroke-width', width.toFixed(1));
      };
      set(f.hour, R * 0.5, R * 0.06, R * 0.075);
      set(f.minute, R * 0.82, R * 0.06, R * 0.052);
      set(f.second, R * 0.9, R * 0.14, Math.max(1.5, R * 0.011));
      f.dot.setAttribute('cx', cx);
      f.dot.setAttribute('cy', cy);
      f.dot.setAttribute('r', (R * 0.035).toFixed(1));
      f.date.style.fontSize = Math.round(Math.max(15, H * 0.032)) + 'px';
      FT.analog.tick(f, new Date());
    },
    tick: function (f, now) {
      if (!f.R) return;
      var sec = now.getSeconds();
      var min = now.getMinutes() + sec / 60;
      var hr = (now.getHours() % 12) + min / 60;
      var c = ' ' + f.cx + ' ' + f.cy + ')';
      f.hour.setAttribute('transform', 'rotate(' + (hr * 30).toFixed(2) + c);
      f.minute.setAttribute('transform', 'rotate(' + (min * 6).toFixed(2) + c);
      f.second.setAttribute('transform', 'rotate(' + (sec * 6) + c);
      F.text(f.date, F.dayName(now, true).toUpperCase() + ' ' + now.getDate());
    }
  };

  // ------------------------------------------------------------------ Flow: a quiet face; each shape is a room, it glows when its lights are on
  var FLOW_SHAPES = [
    [0.265, 0.12, 0.185, 0.33, 0.28, 'mint'], [0.47, 0.1, 0.09, 0.48, 0.5, 'mint'], [0.58, 0.27, 0.08, 0.18, 0.32, 'mint'],
    [0.26, 0.52, 0.2, 0.11, 0.5, 'lilac'], [0.33, 0.67, 0.11, 0.2, 0.32, 'lilac'], [0.56, 0.5, 0.07, 0.37, 0.5, 'mint']
  ];
  FT.flow = {
    build: function (f) {
      f.glow = F.el('div', 'flow-glow', f.el);
      f.stage = F.el('div', 'flow-stage', f.el);
      f.shapes = [];
      for (var i = 0; i < FLOW_SHAPES.length; i++) {
        var s = F.el('div', 'flow-shape flow-' + FLOW_SHAPES[i][5], f.stage);
        F.el('div', 'flow-hi', s);
        s.style.webkitAnimationDelay = (-i * 1.7) + 's';
        s.style.animationDelay = (-i * 1.7) + 's';
        s.style.webkitAnimationDuration = (9 + (i % 3) * 2.5) + 's';
        s.style.animationDuration = (9 + (i % 3) * 2.5) + 's';
        f.shapes.push(s);
      }
    },
    layout: function (f) {
      var sw = Math.min(f.w, f.h * 1.44);
      var sh = sw / 1.44;
      F.css(f.stage, { width: sw + 'px', height: sh + 'px', left: ((f.w - sw) / 2) + 'px', top: ((f.h - sh) / 2) + 'px' });
      for (var i = 0; i < FLOW_SHAPES.length; i++) {
        var d = FLOW_SHAPES[i];
        var wd = d[2] * sw;
        var ht = d[3] * sh;
        F.css(f.shapes[i], {
          left: (d[0] * sw) + 'px', top: (d[1] * sh) + 'px', width: wd + 'px', height: ht + 'px',
          borderRadius: (Math.min(wd, ht) * d[4]) + 'px'
        });
      }
      FT.flow.update(f, {}, {}, true);
    },
    update: function (f) {
      var rooms = [];
      var areas = F.store.areas;
      for (var i = 0; i < areas.length; i++) if (F.entitiesIn(areas[i].id, ['light']).length) rooms.push(areas[i].id);
      for (var j = 0; j < f.shapes.length; j++) {
        var lit = false;
        if (rooms.length) {
          var s = F.roomSummary(rooms[j % rooms.length]);
          lit = s.on > 0 && j < rooms.length;
        }
        F.cls(f.shapes[j], 'lit', lit);
      }
    }
  };

  // ------------------------------------------------------------------ Modular: date, month, music, sun, clock and weather in one grid
  FT.modular = {
    build: function (f) {
      f.cells = [];
      for (var i = 0; i < 6; i++) f.cells.push(F.el('div', 'mod-cell mod-c' + i, f.el));
      var c0 = f.cells[0];
      var top = F.el('div', 'mod-dayline', c0);
      f.dDay = F.el('span', 'mod-accent', top);
      f.dMon = F.el('span', '', top);
      f.dNum = F.el('div', 'mod-bignum', c0);
      var c1 = f.cells[1];
      f.mArt = F.el('div', 'mod-art', c1);
      f.mTitle = F.el('div', 'mod-mtitle', c1);
      f.mArtist = F.el('div', 'mod-martist', c1);
      f.mBtn = F.el('div', 'mod-mbtn', c1);
      f.mBtnIcon = F.icon('pause', '', f.mBtn);
      f.mBtnText = F.el('span', '', f.mBtn, F.t('pause'));
      f.mBtn.foyerTap = function () {
        if (!f.mid) return;
        F.lastSpeaker = f.mid;
        F.call(f.mid, 'media_play_pause', {}, function (c) { c.s = c.s === 'playing' ? 'paused' : 'playing'; });
      };
      c1.foyerTap = function () { if (f.mid) F.sheets.open(f.mid); };
      f.clock = F.buildClock(f.cells[2], { numbers: true, cls: 'mod-clock' });
      f.cal = F.el('div', 'mod-cal', f.cells[3]);
      var c4 = f.cells[4];
      f.sLabel = F.el('div', 'mod-accent mod-label', c4);
      f.sIcon = F.icon('weather-sunset-up', 'mod-label-ic', f.sLabel);
      f.sLabelT = F.el('span', '', f.sLabel);
      f.sBig = F.el('div', 'mod-big', c4);
      f.sOther = F.el('div', 'mod-small', c4);
      var c5 = f.cells[5];
      f.wLabel = F.el('div', 'mod-accent mod-label', c5);
      f.wLabelT = F.el('span', '', f.wLabel);
      F.icon('navigation', 'mod-label-ic mod-nav', f.wLabel);
      f.wBig = F.el('div', 'mod-big mod-temp', c5);
      f.wCond = F.el('div', 'mod-small', c5);
      f.wIcon = F.icon('weather-partly-cloudy', 'mod-wicon', f.wCond);
      f.wCondT = F.el('span', '', f.wCond);
      f.wHiLo = F.el('div', 'mod-small', c5);
      c5.foyerTap = function () { F.sheets.weather(); };
      f.cells[3].foyerTap = function () { F.sheets.calendar(); };
    },
    layout: function (f) {
      var top = F.safeTop || 0;
      var pad = Math.round(Math.min(f.w, f.h) * 0.05);
      var cols = f.landscape ? 3 : 2;
      var rows = f.landscape ? 2 : 3;
      var cw = (f.w - pad * 2) / cols;
      var ch = (f.h - top - pad * 2) / rows;
      var order = f.landscape ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 4, 3, 5];
      for (var i = 0; i < 6; i++) {
        var k = order.indexOf(i);
        var cx = k % cols;
        var cy = Math.floor(k / cols);
        F.css(f.cells[i], { left: (pad + cx * cw) + 'px', top: (top + pad + cy * ch) + 'px', width: (cw * 0.92) + 'px', height: (ch * 0.92) + 'px' });
        f.cells[i].style.fontSize = Math.round(ch * 0.075) + 'px';
      }
      var d = Math.min(cw * 0.92, ch * 0.92);
      F.css(f.clock.el, { width: d + 'px', height: d + 'px' });
      FT.modular.update(f, {}, {}, true);
    },
    update: function (f, changed, blocks, full) {
      var now = new Date();
      F.text(f.dDay, F.cap(F.dayName(now, true)) + ' ');
      F.text(f.dMon, F.cap(F.monthName(now, true)));
      F.text(f.dNum, now.getDate());
      FT.modular.music(f);
      if (full || blocks.calendar || f.calDay !== now.getDate()) FT.modular.month(f, now);
      FT.modular.sun(f);
      FT.modular.weather(f);
    },
    music: function (f) {
      var id = F.pickSpeaker();
      f.mid = id;
      var e = id ? F.e(id) : null;
      var at = (e && e.at) || {};
      F.text(f.mTitle, e ? (at.media_title || F.t('nothing_playing')) : F.t('no_speaker'));
      F.text(f.mArtist, e ? (at.media_artist || e.n) : '');
      F.setBg(f.mArt, at.pic || null);
      F.cls(f.mArt, 'empty', !at.pic);
      F.setIcon(f.mBtnIcon, e && e.s === 'playing' ? 'pause' : 'play');
      F.text(f.mBtnText, e && e.s === 'playing' ? F.t('pause') : F.t('play'));
      F.cls(f.mBtn, 'hidden', !e);
    },
    month: function (f, now) {
      f.calDay = now.getDate();
      F.clear(f.cal);
      F.el('div', 'mod-accent mod-mname', f.cal, F.monthName(now).toUpperCase());
      var grid = F.el('div', 'mod-mgrid', f.cal);
      var letters = F.dayLetters();
      var monday = F.weekStartsMonday();
      var i;
      for (i = 0; i < 7; i++) F.el('div', 'mod-dl', grid, letters[(i + (monday ? 1 : 0)) % 7]);
      var first = new Date(now.getFullYear(), now.getMonth(), 1);
      var offset = (first.getDay() - (monday ? 1 : 0) + 7) % 7;
      var days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (i = 0; i < offset; i++) F.el('div', 'mod-d', grid, '');
      for (i = 1; i <= days; i++) F.el('div', 'mod-d' + (i === now.getDate() ? ' today' : '') + (i < now.getDate() ? ' past' : ''), grid, i);
    },
    sun: function (f) {
      var st = F.sunTimes();
      if (!st || !st.rise || !st.set) {
        F.text(f.sLabelT, F.t('sunrise'));
        F.text(f.sBig, '—');
        return;
      }
      var riseFirst = st.rise.getTime() < st.set.getTime();
      F.setIcon(f.sIcon, riseFirst ? 'weather-sunset-up' : 'weather-sunset-down');
      F.text(f.sLabelT, F.t(riseFirst ? 'sunrise' : 'sunset'));
      F.text(f.sBig, F.time(riseFirst ? st.rise : st.set));
      F.text(f.sOther, F.t(riseFirst ? 'sunset' : 'sunrise') + ' ' + F.time(riseFirst ? st.set : st.rise));
    },
    weather: function (f) {
      var id = F.weatherEntity();
      var e = id ? F.e(id) : null;
      var st = F.block('status');
      F.text(f.wLabelT, (st && st.name) || F.t('outside'));
      if (!e) {
        F.text(f.wBig, '—');
        F.text(f.wCondT, F.t('weather_unavailable'));
        F.text(f.wHiLo, '');
        return;
      }
      F.text(f.wBig, F.temp(e.at && e.at.temperature));
      F.setIcon(f.wIcon, F.weatherIcon(e.s, F.isNight()));
      F.text(f.wCondT, F.weatherText(e.s));
      F.text(f.wHiLo, F.hiLoText(F.todayHiLo()));
    },
    tick: function (f, now) {
      f.clock.set(now);
      if (now.getDate() !== f.calDay) FT.modular.update(f, {}, {}, true);
    }
  };

  // ------------------------------------------------------------------ Weather: today in one large number
  function skyClass(cond, night) {
    if (cond === 'rainy' || cond === 'pouring' || cond === 'lightning-rainy' || cond === 'lightning' || cond === 'hail') return night ? 'sky-rain-night' : 'sky-rain';
    if (cond === 'snowy' || cond === 'snowy-rainy') return 'sky-snow';
    if (cond === 'fog') return 'sky-fog';
    if (night) return 'sky-night';
    if (cond === 'sunny') return 'sky-clear';
    if (cond === 'partlycloudy') return 'sky-partly';
    return 'sky-cloudy';
  }
  FT.weather = {
    build: function (f) {
      f.sky = F.el('div', 'wf-sky sky-cloudy', f.el);
      f.clouds = F.el('div', 'wf-clouds', f.el);
      f.tl = F.el('div', 'wf-tl', f.el);
      f.cond = F.el('div', 'wf-cond', f.tl);
      f.condIcon = F.icon('weather-cloudy', 'wf-cond-ic', f.cond);
      f.condText = F.el('span', '', f.cond);
      f.hilo = F.el('div', 'wf-hilo', f.tl);
      f.tr = F.el('div', 'wf-tr', f.el);
      f.big = F.el('div', 'wf-big', f.el);
      f.bottom = F.el('div', 'wf-bottom', f.el);
      f.stats = [];
      var icons = ['weather-sunset-up', 'weather-windy', 'water-percent'];
      for (var i = 0; i < 3; i++) {
        var s = F.el('div', 'wf-stat', f.bottom);
        var ic = F.icon(icons[i], 'wf-stat-ic', s);
        var v = F.el('div', 'wf-stat-v', s);
        var l = F.el('div', 'wf-stat-l', s);
        f.stats.push({ ic: ic, v: v, l: l });
      }
      f.el.foyerTap = function () { F.sheets.weather(); };
    },
    layout: function (f) {
      var top = (F.safeTop || 0) + Math.round(f.h * 0.035);
      f.tl.style.top = top + 'px';
      f.tr.style.top = top + 'px';
      var u = Math.max(14, Math.round(Math.min(f.w, f.h) * 0.028));
      f.tl.style.fontSize = u + 'px';
      f.tr.style.fontSize = u + 'px';
      f.bottom.style.fontSize = u + 'px';
      f.big.style.fontSize = Math.round(Math.min(f.h * 0.6, f.w * 0.36)) + 'px';
      FT.weather.update(f, {}, {}, true);
    },
    update: function (f) {
      var id = F.weatherEntity();
      var e = id ? F.e(id) : null;
      var night = F.isNight();
      if (!e) {
        F.text(f.big, '—');
        F.text(f.condText, F.t('weather_unavailable'));
        return;
      }
      var at = e.at || {};
      f.sky.className = 'wf-sky ' + skyClass(e.s, night);
      F.text(f.big, F.temp(at.temperature));
      F.setIcon(f.condIcon, F.weatherIcon(e.s, night));
      F.text(f.condText, F.weatherText(e.s));
      F.text(f.hilo, F.hiLoText(F.todayHiLo()));
      var st = F.sunTimes();
      var riseFirst = st && st.rise && st.set ? st.rise.getTime() < st.set.getTime() : true;
      F.setIcon(f.stats[0].ic, riseFirst ? 'weather-sunset-up' : 'weather-sunset-down');
      F.text(f.stats[0].v, st && st.rise ? F.time(riseFirst ? st.rise : st.set) : '—');
      F.text(f.stats[0].l, F.t(riseFirst ? 'sunrise_s' : 'sunset_s'));
      F.text(f.stats[1].v, at.wind_speed !== undefined ? Math.round(at.wind_speed) + ' ' + (at.wind_speed_unit || 'km/h') : '—');
      F.text(f.stats[1].l, F.t('wind'));
      F.text(f.stats[2].v, at.humidity !== undefined ? Math.round(at.humidity) + ' %' : '—');
      F.text(f.stats[2].l, F.t('humidity'));
    },
    tick: function (f, now) { F.text(f.tr, F.time(now)); }
  };

  // ------------------------------------------------------------------ Calendar: this week, and what is on today
  FT.calendar = {
    build: function (f) {
      f.head = F.el('div', 'cf-head', f.el);
      var left = F.el('div', 'cf-month', f.head);
      F.icon('chevron-left', 'cf-chev', left);
      f.month = F.el('span', '', left);
      f.time = F.el('div', 'cf-time', f.head);
      f.week = F.el('div', 'cf-week', f.el);
      f.list = F.el('div', 'cf-list', f.el);
      f.sel = F.dayStart(new Date());
    },
    layout: function (f) {
      var u = Math.max(14, Math.round(Math.min(f.w, f.h) * 0.03));
      f.el.style.fontSize = u + 'px';
      f.head.style.top = ((F.safeTop || 0) + Math.round(f.h * 0.04)) + 'px';
      FT.calendar.update(f, {}, {}, true);
    },
    update: function (f) {
      var today = F.dayStart(new Date());
      f.today = today.getTime();
      F.text(f.month, F.cap(F.monthName(f.sel)));
      F.clear(f.week);
      var monday = F.weekStartsMonday();
      var start = new Date(f.sel.getTime());
      start.setDate(start.getDate() - ((start.getDay() - (monday ? 1 : 0) + 7) % 7));
      var letters = F.dayLetters();
      for (var i = 0; i < 7; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var cell = F.el('div', 'cf-day', f.week);
        F.el('div', 'cf-dl', cell, letters[d.getDay()]);
        var num = F.el('div', 'cf-dn', cell, d.getDate());
        F.cls(num, 'today', d.getTime() === today.getTime());
        F.cls(num, 'sel', d.getTime() === f.sel.getTime() && d.getTime() !== today.getTime());
        if (F.eventsFor(d).length) F.el('div', 'cf-dot', cell);
        (function (day) {
          cell.foyerTap = function () {
            f.sel = day;
            FT.calendar.update(f);
          };
        }(d));
      }
      F.clear(f.list);
      var evs = F.eventsFor(f.sel);
      var b = F.block('calendar');
      if (!b || !b.calendars || !b.calendars.length) {
        F.el('div', 'cf-empty', f.list, F.t('no_calendar'));
        return;
      }
      if (!evs.length) F.el('div', 'cf-empty', f.list, F.t('no_events'));
      for (var j = 0; j < evs.length && j < 8; j++) {
        var row = F.el('div', 'cf-ev', f.list);
        var color = F.calColor(evs[j].ev.cal);
        var bar = F.el('div', 'cf-bar', row);
        bar.style.backgroundColor = color;
        var ttl = F.el('div', 'cf-title', row, evs[j].ev.title);
        ttl.style.color = color;
        var tm = F.el('div', 'cf-when', row);
        F.icon('clock-outline', 'cf-when-ic', tm);
        F.el('span', '', tm, F.eventTime(evs[j]));
        row.style.backgroundColor = hexA(color, 0.14);
      }
    },
    tick: function (f, now) {
      F.text(f.time, F.time(now));
      if (F.dayStart(now).getTime() !== f.today) {
        f.sel = F.dayStart(now);
        FT.calendar.update(f);
      }
    }
  };
  function hexA(hex, a) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }

  // ------------------------------------------------------------------ Clock: the time, as large as the screen allows
  FT.clock = {
    build: function (f) {
      f.digits = F.el('div', 'ck-digits', f.el);
      f.span = F.el('span', '', f.digits);
    },
    layout: function (f) {
      f.len = 0;
      FT.clock.tick(f, new Date());
    },
    tick: function (f, now) {
      var txt = F.clockText(now);
      F.text(f.span, txt);
      if (txt.length !== f.len && f.w) {
        f.len = txt.length;
        var fs = f.h * 0.95;
        f.digits.style.fontSize = Math.round(fs) + 'px';
        f.digits.style.lineHeight = Math.round(f.h) + 'px';
        var tries = 0;
        while (f.span.offsetWidth > f.w * 0.94 && tries < 30) {
          fs *= 0.96;
          f.digits.style.fontSize = Math.round(fs) + 'px';
          tries++;
        }
      }
    }
  };

  // ------------------------------------------------------------------ Home Camera: your cameras side by side
  FT.cameras = {
    build: function (f) {
      f.wrap = F.el('div', 'cams', f.el);
      f.items = [];
      f.empty = F.el('div', 'cams-empty', f.el);
      F.icon('cctv', '', f.empty);
      F.el('div', '', f.empty, F.t('no_cameras'));
    },
    layout: function (f) { FT.cameras.render(f); },
    update: function (f, changed, blocks, full) {
      var ids = F.entitiesOf('camera').join(',');
      if (full || ids !== f.ids) FT.cameras.render(f);
    },
    render: function (f) {
      var ids = F.entitiesOf('camera');
      f.ids = ids.join(',');
      F.clear(f.wrap);
      f.items = [];
      F.cls(f.el, 'is-empty', !ids.length);
      if (!ids.length || !f.w) return;
      ids = ids.slice(0, 6);
      var n = ids.length;
      var gap = 6;
      var boxes = [];
      var W = f.w;
      var H = f.h;
      if (n === 1) boxes = [[0, 0, W, H]];
      else if (n === 2) boxes = f.landscape ? [[0, 0, W / 2, H], [W / 2, 0, W / 2, H]] : [[0, 0, W, H / 2], [0, H / 2, W, H / 2]];
      else if (n === 3) boxes = [[0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W, H / 2]];
      else {
        var cols = n <= 4 ? 2 : 3;
        var rows = Math.ceil(n / cols);
        for (var i = 0; i < n; i++) boxes.push([(i % cols) * W / cols, Math.floor(i / cols) * H / rows, W / cols, H / rows]);
      }
      for (var j = 0; j < n; j++) {
        var b = boxes[j];
        var el = F.el('div', 'cam-cell', f.wrap);
        F.css(el, { left: (b[0] + gap / 2) + 'px', top: (b[1] + gap / 2) + 'px', width: (b[2] - gap) + 'px', height: (b[3] - gap) + 'px' });
        var img = F.el('div', 'cam-img', el);
        var e = F.e(ids[j]);
        F.el('div', 'cam-label', el, e ? e.n : ids[j]);
        (function (id) { el.foyerTap = function () { F.sheets.camera(id); }; }(ids[j]));
        f.items.push({ id: ids[j], img: img });
      }
      f.last = 0;
      FT.cameras.tick(f, new Date());
    },
    show: function (f) {
      f.last = 0;
      FT.cameras.tick(f, new Date());
    },
    tick: function (f, now) {
      if (!f.visible || now.getTime() - (f.last || 0) < 3000) return;
      f.last = now.getTime();
      for (var i = 0; i < f.items.length; i++) {
        (function (it) {
          var url = 'api/camera/' + it.id + '?t=' + now.getTime();
          var im = new w.Image();
          im.onload = function () { F.setBg(it.img, url); };
          im.src = url;
        }(f.items[i]));
      }
    }
  };
}(window));
