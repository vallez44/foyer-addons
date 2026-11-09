/* Foyer: arranging tiles on the screen itself. Hold a tile, then drag it, resize it (S W M L),
   remove it (−), add one (+) or change what it shows (⇄). OK saves for every screen. ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var E = F.edit = { active: false, face: null, items: [], selected: null, dragging: null, dirty: false };
  var GRID_FACES = { home_plus: 1, home: 1 };
  var SIZES = ['S', 'W', 'M', 'L'];
  var IDLE_SAVE = 120000;

  E.isEditing = function (f) { return E.active && E.face === f; };
  E.canEdit = function (f) {
    var s = F.store.session;
    return Boolean(f && GRID_FACES[f.id] && s && s.kind !== 'anon');
  };

  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  // ------------------------------------------------------------------ enter / leave
  E.enter = function (f, tile) {
    if (E.active || !E.canEdit(f)) return false;
    F.closeSheets();
    if (F.cc) F.cc.hide();
    E.active = true;
    E.face = f;
    E.dirty = false;
    E.selected = null;
    E.dragging = null;
    // Tiles that do not fit are not on the screen: leave them out of the arrangement (they can be added back with +).
    var all = F.gridSpecs(f);
    var fit = F.gridBoxes(f, all).boxes;
    var specs = [];
    for (var s = 0; s < all.length; s++) if (fit[s]) specs.push(all[s]);
    E.items = [];
    for (var i = 0; i < specs.length; i++) {
      var existing = null;
      for (var k = 0; k < f.tiles.length; k++) {
        if (f.tiles[k].spec === specs[i]) {
          existing = f.tiles[k];
          break;
        }
      }
      var spec = copy(specs[i]);
      var t = existing || new F.Tile(spec, f);
      t.spec = spec;
      if (!existing) f.grid.appendChild(t.el);
      E.items.push({ spec: spec, tile: t });
    }
    f.tiles = E.items.map(function (it) { return it.tile; });
    buildLayer(f);
    F.cls(f.el, 'editing', true);
    F.cls(w.document.body, 'arranging', true);
    E.relayout(true);
    E.dirty = specs.length !== all.length;
    showHint(F.t('edit_hint'), 5000);
    poke();
    return true;
  };

  E.finish = function (save) {
    if (!E.active) return;
    var f = E.face;
    var specs = E.items.map(function (it) { return it.spec; });
    if (save && E.dirty) {
      F.xhr('PUT', 'api/arrange', { face: f.id, tiles: specs }, function (status, data) {
        if (status === 200) F.toast(F.t('layout_saved'));
        else F.toast((data && data.error) || F.t('error'));
      }, 20000);
      var lay = F.block('layout');
      if (lay && lay.tiles) {
        lay.tiles[f.id] = specs;
        if (lay.auto) lay.auto[f.id] = false;
      }
    }
    w.clearTimeout(E.idleTimer);
    E.active = false;
    E.face = null;
    E.items = [];
    E.selected = null;
    E.dragging = null;
    if (f.editLayer && f.editLayer.parentNode) f.editLayer.parentNode.removeChild(f.editLayer);
    f.editLayer = null;
    F.cls(f.el, 'editing', false);
    F.cls(w.document.body, 'arranging', false);
    f.sig = '';
    F.gridRender(f, true);
  };

  function poke() {
    w.clearTimeout(E.idleTimer);
    E.idleTimer = w.setTimeout(function () { E.finish(true); }, IDLE_SAVE);
  }

  // ------------------------------------------------------------------ overlay: badges, size bar, bottom bar
  function action(el, fn) {
    el.foyerEditAction = fn;
    return el;
  }

  function buildLayer(f) {
    var layer = f.editLayer = F.el('div', 'edit-layer', f.el);
    E.badges = F.el('div', 'edit-badges', layer);
    E.sizebar = F.el('div', 'edit-sizebar', layer);
    E.sizeBtns = {};
    for (var i = 0; i < SIZES.length; i++) {
      (function (sz) {
        E.sizeBtns[sz] = action(F.el('div', 'edit-size', E.sizebar, sz), function () { setSize(E.selected, sz); });
      }(SIZES[i]));
    }
    F.el('div', 'edit-sep', E.sizebar);
    var change = action(F.el('div', 'edit-size edit-change', E.sizebar), function () {
      var it = E.selected;
      if (it) openPicker(F.t('change_tile'), function (spec) { replace(it, spec); });
    });
    F.icon('swap-horizontal', '', change);
    E.hint = F.el('div', 'edit-hint', layer);
    var bar = F.el('div', 'edit-bar', layer);
    action(F.el('div', 'edit-btn round', bar, '+'), function () {
      openPicker(F.t('add_tile'), function (spec) { add(spec); });
    });
    action(F.el('div', 'edit-btn', bar, F.t('customize')), openCustomize);
    action(F.el('div', 'edit-btn strong', bar, F.t('edit_done')), function () { E.finish(true); });
  }

  function makeBadge(it) {
    it.badge = action(F.el('div', 'edit-badge', E.badges), function () { remove(it); });
  }

  /** Puts every tile in its spot for the current order and sizes (animated unless instant). */
  E.relayout = function (instant) {
    var f = E.face;
    if (!f) return;
    var specs = E.items.map(function (it) { return it.spec; });
    var geo = F.gridBoxes(f, specs);
    F.cls(f.el, 'edit-instant', Boolean(instant));
    var hidden = 0;
    for (var i = 0; i < E.items.length; i++) {
      var it = E.items[i];
      var b = geo.boxes[i];
      it.box = b;
      if (!it.badge) makeBadge(it);
      it.tile.el.style.webkitAnimationDelay = (-(i % 5) * 0.07) + 's';
      it.tile.el.style.animationDelay = (-(i % 5) * 0.07) + 's';
      if (!b) {
        hidden++;
        it.tile.el.style.display = 'none';
        it.badge.style.display = 'none';
        continue;
      }
      it.tile.el.style.display = '';
      it.badge.style.display = it === E.dragging ? 'none' : '';
      F.css(it.badge, { left: Math.round(b.x - 11) + 'px', top: Math.round(b.y - 11) + 'px' });
      if (it !== E.dragging) it.tile.setBox(b.x, b.y, b.w, b.h);
    }
    F.placeWall(f, specs, geo.boxes);
    placeSizebar();
    if (instant) w.setTimeout(function () { if (E.face) F.cls(E.face.el, 'edit-instant', false); }, 40);
    return hidden;
  };

  /** Would these tiles (in this order, at these sizes) all fit on the screen? */
  function allFit(specs) {
    var b = F.gridBoxes(E.face, specs).boxes;
    for (var i = 0; i < b.length; i++) if (!b[i]) return false;
    return true;
  }

  function showHint(text, ms) {
    if (!E.hint) return;
    F.text(E.hint, text);
    F.cls(E.hint, 'show', true);
    w.clearTimeout(E.hintTimer);
    E.hintTimer = w.setTimeout(function () { if (E.hint) F.cls(E.hint, 'show', false); }, ms || 3500);
  }

  function select(it) {
    if (E.selected && E.selected.tile) F.cls(E.selected.tile.el, 'selected', false);
    E.selected = it && it.box ? it : null;
    if (E.selected) F.cls(E.selected.tile.el, 'selected', true);
    placeSizebar();
  }

  function placeSizebar() {
    var it = E.selected;
    var bar = E.sizebar;
    if (!bar) return;
    if (!it || !it.box || E.dragging) {
      bar.style.display = 'none';
      return;
    }
    for (var k in E.sizeBtns) if (E.sizeBtns.hasOwnProperty(k)) F.cls(E.sizeBtns[k], 'sel', it.spec.size === k);
    bar.style.display = 'block';
    var b = it.box;
    var bw = bar.offsetWidth || 280;
    var bh = bar.offsetHeight || 52;
    var x = F.clamp(b.x + b.w / 2 - bw / 2, 8, E.face.w - bw - 8);
    var y = b.y - bh - 10;
    if (y < (F.safeTop || 0) + 6) y = b.y + b.h + 10;
    if (y + bh > E.face.h - 80) y = b.y + 10;
    F.css(bar, { left: Math.round(x) + 'px', top: Math.round(y) + 'px' });
  }

  // ------------------------------------------------------------------ changes
  function setSize(it, size) {
    if (!it || it.spec.size === size) return;
    var trial = E.items.map(function (x) { return x === it ? { type: x.spec.type, size: size } : x.spec; });
    if (!allFit(trial)) {
      showHint(F.t('no_room_left'), 3500);
      return;
    }
    it.spec.size = size;
    it.tile.el.className = it.tile.el.className.replace(/\bsize-\w+\b/, 'size-' + size);
    E.dirty = true;
    E.relayout(false);
    select(it);
    poke();
  }

  function remove(it) {
    var i = E.items.indexOf(it);
    if (i < 0) return;
    E.items.splice(i, 1);
    if (it.tile.el.parentNode) it.tile.el.parentNode.removeChild(it.tile.el);
    if (it.badge && it.badge.parentNode) it.badge.parentNode.removeChild(it.badge);
    if (E.selected === it) E.selected = null;
    E.face.tiles = E.items.map(function (x) { return x.tile; });
    E.dirty = true;
    E.relayout(false);
    poke();
  }

  function add(spec) {
    var f = E.face;
    var specs = E.items.map(function (x) { return x.spec; });
    if (!allFit(specs.concat([spec]))) {
      spec.size = 'S';
      if (!allFit(specs.concat([spec]))) {
        showHint(F.t('no_room_left'), 4000);
        return;
      }
    }
    var it = { spec: spec, tile: new F.Tile(spec, f) };
    f.grid.appendChild(it.tile.el);
    E.items.push(it);
    E.relayout(true);
    f.tiles = E.items.map(function (x) { return x.tile; });
    E.dirty = true;
    select(it);
    poke();
  }

  function replace(it, spec) {
    var f = E.face;
    spec.size = it.spec.size;
    var t = new F.Tile(spec, f);
    f.grid.insertBefore(t.el, it.tile.el);
    if (it.tile.el.parentNode) it.tile.el.parentNode.removeChild(it.tile.el);
    it.spec = spec;
    it.tile = t;
    f.tiles = E.items.map(function (x) { return x.tile; });
    E.dirty = true;
    E.relayout(true);
    select(it);
    poke();
  }

  // ------------------------------------------------------------------ gestures (called by the pager while editing)
  var G = null;

  function findUp(el, prop) {
    while (el && el !== w.document) {
      if (el[prop]) return el;
      el = el.parentNode;
    }
    return null;
  }

  function itemOfTile(tile) {
    for (var i = 0; i < E.items.length; i++) if (E.items[i].tile === tile) return E.items[i];
    return null;
  }

  /** fromHold: this touch is the long press that opened arranging (lifting the finger selects the tile). */
  E.down = function (x, y, target, fromHold) {
    poke();
    var act = findUp(target, 'foyerEditAction');
    var tileEl = act ? null : findUp(target, 'foyerTile');
    G = { x: x, y: y, act: act, item: tileEl ? itemOfTile(tileEl.foyerTile) : null, moved: false, hold: Boolean(fromHold) };
    if (act) F.cls(act, 'pressed', true);
  };

  E.move = function (x, y, ev) {
    if (!G) return;
    var dx = x - G.x;
    var dy = y - G.y;
    if (!G.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      G.moved = true;
      if (G.act) F.cls(G.act, 'pressed', false);
      if (G.item && G.item.box) startDrag(G.item, G.x, G.y);
    }
    if (E.dragging) {
      moveDrag(x, y);
      if (ev) ev.preventDefault();
    }
  };

  E.up = function () {
    var g = G;
    G = null;
    if (!g) return;
    if (g.act) F.cls(g.act, 'pressed', false);
    if (E.dragging) {
      drop();
      return;
    }
    if (g.moved) return;
    if (g.act) g.act.foyerEditAction();
    else if (g.item) select(g.hold || E.selected !== g.item ? g.item : null);
    else select(null);
  };

  function startDrag(it, x, y) {
    E.dragging = it;
    it.grab = { x: x - it.box.x, y: y - it.box.y };
    F.cls(it.tile.el, 'lifted', true);
    it.badge.style.display = 'none';
    select(null);
    placeSizebar();
  }

  function follow(it, x, y) {
    var b = it.box;
    if (!b) return;
    F.transform(it.tile.el, 'translate3d(' + Math.round(x - it.grab.x - b.x) + 'px,' + Math.round(y - it.grab.y - b.y) + 'px,0) scale(1.05)');
  }

  function moveDrag(x, y) {
    var it = E.dragging;
    follow(it, x, y);
    var now = F.now();
    if (now - (E.lastSwap || 0) < 160) return;
    var from = E.items.indexOf(it);
    var target = -1;
    for (var i = 0; i < E.items.length; i++) {
      var o = E.items[i];
      if (o === it || !o.box) continue;
      var b = o.box;
      var mx = b.w * 0.15;
      var my = b.h * 0.15;
      if (x > b.x + mx && x < b.x + b.w - mx && y > b.y + my && y < b.y + b.h - my) {
        target = i;
        break;
      }
    }
    if (target < 0 || target === from) return;
    var order = E.items.slice();
    order.splice(from, 1);
    order.splice(target, 0, it);
    // A move that would push a tile off the screen is not made.
    if (!allFit(order.map(function (z) { return z.spec; }))) return;
    E.items = order;
    E.relayout(false);
    E.lastSwap = now;
    E.dirty = true;
    E.face.tiles = E.items.map(function (z) { return z.tile; });
    follow(it, x, y);
  }

  function drop() {
    var it = E.dragging;
    E.dragging = null;
    F.cls(it.tile.el, 'lifted', false);
    F.transform(it.tile.el, '');
    E.relayout(false);
    select(it);
    poke();
  }

  // ------------------------------------------------------------------ picker: what a tile shows
  function pickCell(parent, icon, label, fn) {
    var c = F.el('div', 'pk-cell', parent);
    F.icon(icon, '', c);
    F.el('div', 'pk-label', c, label);
    F.onTap(c, fn);
    return c;
  }

  var WIDGETS = [
    ['clock', 'w_clock', 'clock-outline', 'M'], ['weather', 'w_weather', 'weather-partly-cloudy', 'W'], ['photo', 'w_photo', 'image', 'L'],
    ['agenda', 'w_agenda', 'calendar', 'W'], ['media', 'w_media', 'music-note', 'W'], ['house', 'w_house', 'home', 'W'],
    ['action', 'w_all_off', 'power', 'W'], ['date', 'w_date', 'calendar-today', 'S'], ['sun', 'w_sun', 'weather-sunset-up', 'S']
  ];
  var DEVICE_DOMAINS = ['light', 'switch', 'fan', 'cover', 'lock', 'climate', 'media_player', 'scene', 'alarm_control_panel', 'binary_sensor',
    'sensor', 'camera', 'vacuum', 'valve', 'humidifier', 'input_boolean', 'water_heater', 'script', 'button', 'input_button'];
  var ADMIN_ONLY = { script: 1, button: 1, input_button: 1 };

  function openPicker(title, onPick) {
    var sheet = new F.Sheet(title, '', 'sheet-picker');
    var done = function (spec) {
      sheet.close();
      onPick(spec);
    };
    var admin = Boolean(F.store.session && F.store.session.admin);
    var sec = sheet.section(F.t('widgets'));
    var grid = F.el('div', 'pk-grid', sec);
    var widgets = WIDGETS.slice();
    var climates = F.entitiesOf('climate');
    if (climates.length) widgets.unshift(['thermostat', 'w_thermostat', 'thermostat', 'M']);
    else widgets.push(['thermostat', 'w_temperature', 'thermometer', 'M']);
    if (F.entitiesOf('todo').length) widgets.push(['todo', 'w_list', 'format-list-checks', 'W']);
    for (var i = 0; i < widgets.length; i++) {
      (function (wd) {
        pickCell(grid, wd[2], F.t(wd[1]), function () {
          var spec = { type: wd[0], size: wd[3] };
          if (wd[0] === 'action') spec.action = 'all_off';
          if (wd[0] === 'thermostat' && climates.length) spec.entity = climates[0];
          done(spec);
        });
      }(widgets[i]));
    }
    var areas = F.store.areas;
    var withDevices = [];
    for (var a = 0; a < areas.length; a++) if (F.entitiesIn(areas[a].id).length) withDevices.push(areas[a]);
    if (withDevices.length) {
      var rs = sheet.section(F.t('rooms'));
      var rgrid = F.el('div', 'pk-grid', rs);
      for (var r = 0; r < withDevices.length; r++) {
        (function (area) {
          pickCell(rgrid, F.areaIcon(area), area.name, function () { done({ type: 'room', area: area.id, size: 'W' }); });
        }(withDevices[r]));
      }
    }
    var groups = withDevices.map(function (ar) { return { name: ar.name, id: ar.id }; });
    groups.push({ name: F.t('no_room'), id: null });
    for (var g = 0; g < groups.length; g++) {
      var ids = [];
      for (var id in F.store.entities) {
        if (!F.store.entities.hasOwnProperty(id)) continue;
        var e = F.store.entities[id];
        var d = F.domain(id);
        if ((e.a || null) !== groups[g].id || DEVICE_DOMAINS.indexOf(d) < 0) continue;
        if (ADMIN_ONLY[d] && !admin) continue;
        ids.push(id);
      }
      if (!ids.length) continue;
      ids.sort(function (x, y) {
        var dx = DEVICE_DOMAINS.indexOf(F.domain(x));
        var dy = DEVICE_DOMAINS.indexOf(F.domain(y));
        return dx !== dy ? dx - dy : (F.e(x).n < F.e(y).n ? -1 : 1);
      });
      var ds = sheet.section(groups[g].id ? groups[g].name : F.t('devices') + ' · ' + groups[g].name);
      var list = F.el('div', 'dev-list', ds);
      for (var n = 0; n < ids.length; n++) {
        (function (eid) {
          var ent = F.e(eid);
          var row = F.el('div', 'dev-row pk-row', list);
          F.icon(F.entityIcon(eid, ent), 'dev-ic', row);
          var txt = F.el('div', 'dev-txt', row);
          F.el('div', 'dev-name', txt, ent.n);
          F.el('div', 'dev-state', txt, F.stateText(eid, ent));
          F.onTap(row, function () {
            var dom = F.domain(eid);
            if (dom === 'camera') done({ type: 'camera', entity: eid, size: 'W' });
            else done({ type: 'entity', entity: eid, size: dom === 'scene' || dom === 'script' ? 'W' : 'S' });
          });
        }(ids[n]));
      }
    }
  }

  // ------------------------------------------------------------------ customize: wallpaper, back to the suggestion
  var WALLPAPERS = {
    amber: 'linear-gradient(152deg, #ffc04a, #ef7a14 60%, #dc5410)', ocean: 'linear-gradient(152deg, #7dd6ff, #2774d8 60%, #1c4fb0)',
    lavender: 'linear-gradient(152deg, #d6c8ff, #8a6ce2 60%, #6546c6)', sage: 'linear-gradient(152deg, #cdeac0, #66a682 60%, #3f8064)',
    graphite: 'linear-gradient(152deg, #66666c, #333338 60%, #1d1d21)'
  };

  function openCustomize() {
    var f = E.face;
    var sheet = new F.Sheet(F.t('customize'), F.FACE_NAMES[f.id] || '', 'sheet-small');
    var sec = sheet.section(F.t('wallpaper'));
    var row = F.el('div', 'wp-row', sec);
    var current = F.settings().wallpaper || 'amber';
    for (var id in WALLPAPERS) {
      if (!WALLPAPERS.hasOwnProperty(id)) continue;
      (function (wid) {
        var sw = F.el('div', 'wp-swatch' + (wid === current ? ' sel' : ''), row);
        sw.style.background = WALLPAPERS[wid];
        F.onTap(sw, function () {
          var s = F.settings();
          s.wallpaper = wid;
          if (E.face) E.relayout(false);
          F.xhr('PUT', 'api/arrange', { wallpaper: wid }, null, 15000);
          var all = row.childNodes;
          for (var k = 0; k < all.length; k++) F.cls(all[k], 'sel', all[k] === sw);
        });
      }(id));
    }
    var btns = F.el('div', 'btn-row', sheet.body);
    F.button(btns, F.t('back_to_suggestion'), 'refresh', '', function () {
      sheet.close();
      F.confirm(F.t('back_to_suggestion') + ' ?', F.t('confirm_ok'), function () {
        var face = E.face;
        E.dirty = false;
        E.finish(false);
        F.xhr('PUT', 'api/arrange', { face: face.id, tiles: null }, function (status) {
          F.toast(status === 200 ? F.t('layout_saved') : F.t('error'));
        }, 15000);
      });
    });
    if (F.store.session && F.store.session.admin) {
      F.button(btns, F.t('all_settings'), 'cog', '', function () {
        E.finish(true);
        w.location.href = 'settings';
      });
    }
  }
}(window));
