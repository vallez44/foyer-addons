/* Foyer: Settings, inside the dashboard, laid out like the iPad's Settings app:
   grouped rows with coloured icons on the left, the chosen page on the right. ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var doc = w.document;
  var UI = F.settingsUI = { isOpen: false, current: null };

  var FACE_ICONS = {
    photos: 'image', home_plus: 'apps', analog: 'clock-outline', home: 'home', flow: 'weather-night', modular: 'calendar-today',
    weather: 'weather-partly-cloudy', calendar: 'calendar-month', clock: 'timer-outline', cameras: 'cctv'
  };
  var WALLPAPERS = {
    amber: 'linear-gradient(152deg, #ffc04a, #ef7a14 60%, #dc5410)', ocean: 'linear-gradient(152deg, #7dd6ff, #2774d8 60%, #1c4fb0)',
    lavender: 'linear-gradient(152deg, #d6c8ff, #8a6ce2 60%, #6546c6)', sage: 'linear-gradient(152deg, #cdeac0, #66a682 60%, #3f8064)',
    graphite: 'linear-gradient(152deg, #66666c, #333338 60%, #1d1d21)'
  };

  function sess() { return F.store.session || {}; }
  function isAdmin() { return Boolean(sess().admin); }
  function s() { return F.settings(); }
  function T(fr, en) { return F.lang === 'en' ? en : fr; }

  // ------------------------------------------------------------------ sections
  function sectionsList() {
    return [
    { id: 'ha', icon: 'home-assistant', color: '#41bdf5', label: 'Home Assistant', value: haValue, group: 1 },
    { id: 'screens', icon: 'tablet', color: '#5856d6', label: T('Écran d\'accueil et autres iPad', 'Home Screen & Other iPads'), admin: true, group: 1 },
    { id: 'paired', icon: 'devices', color: '#007aff', label: T('Écrans associés', 'Paired Screens'), admin: true, group: 1 },
    { id: 'faces', icon: 'clock-outline', color: '#32ade6', label: T('Cadrans', 'Faces'), group: 2 },
    { id: 'photos', icon: 'image-multiple', color: '#ff9500', label: T('Photos', 'Photos'), group: 2 },
    { id: 'display', icon: 'brightness-6', color: '#007aff', label: T('Affichage et nuit', 'Display & Night'), group: 2 },
    { id: 'apps', icon: 'apps', color: '#5856d6', label: T('Apps', 'Apps'), group: 3 },
    { id: 'music', icon: 'music', color: '#ff2d55', label: T('Musique', 'Music'), value: musicValue, group: 3 },
    { id: 'calendar', icon: 'calendar-month', color: '#ff3b30', label: T('Agenda et rappels', 'Calendar & Reminders'), group: 3 },
    { id: 'sensors', icon: 'thermometer', color: '#30b0c7', label: T('Capteurs des HomePod', 'HomePod Sensors'), group: 3 },
    { id: 'alarm', icon: 'alarm-light', color: '#ff3b30', label: T('Alarme', 'Alarm'), group: 3 },
    { id: 'security', icon: 'shield-lock', color: '#8e8e93', label: T('Sécurité', 'Security'), admin: true, group: 4 },
    { id: 'about', icon: 'information', color: '#8e8e93', label: T('À propos', 'About'), value: function () { return sess().version || ''; }, group: 4 },
    { id: 'privacy', icon: 'lock', color: '#007aff', label: T('Confidentialité', 'Privacy'), group: 4 }
    ];
  }

  function visibleSections() {
    var all = sectionsList();
    var out = [];
    for (var i = 0; i < all.length; i++) if (!all[i].admin || isAdmin()) out.push(all[i]);
    return out;
  }
  function sectionById(id) {
    var all = visibleSections();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function haValue() {
    var st = F.block('status');
    if (sess().demo) return T('Démo', 'Sample Home');
    return st && st.connected ? T('Connecté', 'Connected') : T('Hors ligne', 'Offline');
  }
  function musicValue() {
    var id = s().speaker;
    var e = id ? F.e(id) : null;
    return e ? e.n : T('Automatique', 'Automatic');
  }

  // ------------------------------------------------------------------ small builders
  function icon(name, cls, parent) { return F.icon(name, cls || '', parent); }

  function group(parent, header, footer) {
    var wrap = F.el('div', 'st-group', parent);
    if (header) F.el('div', 'st-sec-h', wrap, header);
    var card = F.el('div', 'st-card', wrap);
    if (footer) F.el('div', 'st-foot', wrap, footer);
    return card;
  }

  /** opts: icon, color, label, sub, value, chevron, onTap, toggle {on, onChange}, danger, blue, check, extra(el) */
  function row(card, o) {
    var r = F.el('div', 'st-row' + (o.icon ? ' has-ic' : '') + (o.danger ? ' danger' : '') + (o.blue ? ' blue' : ''), card);
    if (o.icon) {
      var ic = F.el('div', 'st-ic', r);
      ic.style.backgroundColor = o.color || '#8e8e93';
      icon(o.icon, '', ic);
    }
    var txt = F.el('div', 'st-txt', r);
    F.el('div', 'st-label', txt, o.label);
    if (o.sub) F.el('div', 'st-sub', txt, o.sub);
    var right = F.el('div', 'st-right', r);
    if (o.value !== undefined && o.value !== null) r.valueEl = F.el('span', 'st-value', right, o.value);
    if (o.check) icon('check', 'st-check', right);
    if (o.toggle) {
      var sw = F.el('div', 'st-switch' + (o.toggle.on ? ' on' : ''), right);
      F.el('div', 'st-knob', sw);
      r.switchEl = sw;
      F.onTap(r, function () {
        var on = !F.hasClass(sw, 'on');
        F.cls(sw, 'on', on);
        o.toggle.onChange(on);
      });
    } else if (o.onTap) {
      if (o.chevron !== false) icon('chevron-right', 'st-chev', right);
      F.onTap(r, function () { o.onTap(r); });
    }
    if (o.extra) o.extra(right);
    return r;
  }

  /** A menu under a row, like iPadOS pop-up buttons. options: [{label, value}] */
  function menu(anchor, options, current, onPick) {
    closeMenu();
    var m = UI.menuEl = F.el('div', 'st-menu', UI.root);
    for (var i = 0; i < options.length; i++) {
      (function (opt) {
        var it = F.el('div', 'st-menu-item' + (opt.value === current ? ' sel' : ''), m);
        F.el('span', '', it, opt.label);
        if (opt.value === current) icon('check', 'st-menu-check', it);
        F.onTap(it, function () {
          closeMenu();
          onPick(opt.value);
        });
      }(options[i]));
    }
    var r = anchor.getBoundingClientRect();
    var root = UI.root.getBoundingClientRect();
    var mw = Math.max(260, Math.min(360, r.width * 0.6));
    var left = Math.min(r.right - mw - 12, root.width - mw - 12);
    var top = r.bottom - root.top - 6;
    F.css(m, { left: Math.max(12, left) + 'px', top: top + 'px', width: mw + 'px' });
    var mh = m.offsetHeight;
    if (top + mh > root.height - 12) F.css(m, { top: Math.max(12, r.top - root.top - mh + 6) + 'px' });
    UI.menuShield = F.el('div', 'st-shield', UI.root);
    F.onTap(UI.menuShield, closeMenu);
    UI.root.appendChild(m);
  }
  function closeMenu() {
    if (UI.menuEl && UI.menuEl.parentNode) UI.menuEl.parentNode.removeChild(UI.menuEl);
    if (UI.menuShield && UI.menuShield.parentNode) UI.menuShield.parentNode.removeChild(UI.menuShield);
    UI.menuEl = null;
    UI.menuShield = null;
  }

  function selectRow(card, label, options, current, onPick, opts) {
    var cur = null;
    for (var i = 0; i < options.length; i++) if (options[i].value === current) cur = options[i].label;
    var r = row(card, {
      label: label, value: cur || '—', icon: opts && opts.icon, color: opts && opts.color, chevron: false,
      onTap: function (el) { menu(el, options, current, onPick); }
    });
    icon('unfold-more-horizontal', 'st-updown', r.lastChild);
    return r;
  }

  function segmented(card, label, options, current, onPick) {
    var r = row(card, { label: label });
    var seg = F.el('div', 'st-seg', r.lastChild);
    for (var i = 0; i < options.length; i++) {
      (function (opt) {
        var b = F.el('div', 'st-seg-b' + (opt.value === current ? ' sel' : ''), seg, opt.label);
        F.onTap(b, function () {
          var all = seg.childNodes;
          for (var k = 0; k < all.length; k++) F.cls(all[k], 'sel', all[k] === b);
          onPick(opt.value);
        });
      }(options[i]));
    }
    return r;
  }

  function sliderRow(card, label, value, min, max, step, onChange) {
    var r = row(card, { label: label });
    F.cls(r, 'st-slider-row', true);
    var input = doc.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.className = 'st-range';
    input.addEventListener('change', function () { onChange(parseFloat(input.value)); }, false);
    input.addEventListener('touchstart', function (ev) { ev.stopPropagation(); }, false);
    r.appendChild(input);
    return r;
  }

  function text(parent, t) { return F.el('p', 'st-text', parent, t); }

  // ------------------------------------------------------------------ saving
  function save(patch, cb) {
    F.xhr('PUT', 'api/prefs', patch, function (status, data) {
      if (status === 200 && data && data.settings) {
        F.setBlock('settings', data.settings);
        if (cb) cb(true);
      } else {
        F.toast((data && data.error) || F.t('error'));
        if (cb) cb(false);
      }
    }, 15000);
  }
  UI.save = save;

  // ------------------------------------------------------------------ frame
  function build() {
    var root = UI.root = F.el('div', 'st', doc.body);
    UI.nav = F.el('div', 'st-nav', root);
    UI.main = F.el('div', 'st-main', root);
    root.addEventListener('touchmove', function (ev) { ev.stopPropagation(); }, false);
    root.addEventListener('touchstart', function (ev) {
      ev.stopPropagation();
      if (F.onUserActivity) F.onUserActivity();
    }, false);
    root.addEventListener('mousedown', function (ev) { ev.stopPropagation(); }, false);
  }

  function renderNav() {
    var nav = UI.nav;
    F.clear(nav);
    var head = F.el('div', 'st-head', nav);
    var x = F.el('div', 'st-round', head);
    icon('close', '', x);
    F.onTap(x, UI.hide);
    F.el('div', 'st-h1', head, T('Réglages', 'Settings'));
    var sw = F.el('div', 'st-search-wrap', nav);
    icon('magnify', 'st-search-ic', sw);
    var input = doc.createElement('input');
    input.type = 'search';
    input.className = 'st-search';
    input.placeholder = T('Rechercher', 'Search');
    input.value = UI.query || '';
    sw.appendChild(input);
    input.addEventListener('input', function () {
      UI.query = input.value;
      renderNavList();
    }, false);
    UI.navList = F.el('div', 'st-navlist', nav);
    renderNavList();
  }

  function renderNavList() {
    var list = UI.navList;
    F.clear(list);
    var q = String(UI.query || '').toLowerCase();
    if (!q) {
      var card = F.el('div', 'st-card st-appcard', list);
      var logo = F.el('div', 'st-applogo', card);
      icon('home-heart', '', logo);
      var t = F.el('div', 'st-apptxt', card);
      F.el('div', 'st-appname', t, 'Foyer');
      F.el('div', 'st-apptag', t, T('Votre iPad, un nouveau rôle.', 'Your iPad, a new role.'));
      F.onTap(card, function () { UI.go('about'); });
    }
    var secs = visibleSections();
    var lastGroup = null;
    var c = null;
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      if (q && sec.label.toLowerCase().indexOf(q) < 0) continue;
      if (sec.group !== lastGroup || !c) {
        c = F.el('div', 'st-card', list);
        lastGroup = sec.group;
      }
      (function (sc) {
        var r = row(c, {
          icon: sc.icon, color: sc.color, label: sc.label, value: sc.value ? sc.value() : null, chevron: !UI.wide,
          onTap: function () { UI.go(sc.id); }
        });
        F.cls(r, 'sel', UI.wide && UI.current === sc.id);
      }(sec));
    }
  }

  function renderMain() {
    var main = UI.main;
    F.clear(main);
    closeMenu();
    var sec = sectionById(UI.current);
    if (!sec) return;
    var head = F.el('div', 'st-mainhead', main);
    if (!UI.wide) {
      var back = F.el('div', 'st-round', head);
      icon('chevron-left', '', back);
      F.onTap(back, function () {
        UI.current = null;
        layout();
      });
    }
    F.el('div', 'st-h1', head, sec.label);
    var body = F.el('div', 'st-body', main);
    var fn = PAGES[sec.id];
    if (fn) fn(body);
    main.scrollTop = 0;
  }

  function layout() {
    var wd = w.innerWidth;
    UI.wide = wd >= 820;
    F.cls(UI.root, 'wide', UI.wide);
    F.cls(UI.root, 'detail', !UI.wide && Boolean(UI.current));
    if (UI.wide && !UI.current) UI.current = isAdmin() ? 'ha' : 'faces';
    renderNav();
    if (UI.current) renderMain();
  }

  UI.show = function (id) {
    if (!UI.root) build();
    if (F.edit && F.edit.active) F.edit.finish(true);
    F.closeSheets();
    if (F.cc) F.cc.hide();
    UI.isOpen = true;
    if (id && sectionById(id)) UI.current = id;
    F.cls(UI.root, 'show', true);
    layout();
  };
  UI.hide = function () {
    if (!UI.root) return;
    UI.isOpen = false;
    closeMenu();
    F.cls(UI.root, 'show', false);
  };
  UI.go = function (id) {
    UI.current = id;
    layout();
  };
  UI.refresh = function () {
    if (!UI.isOpen || UI.menuEl) return;
    var active = doc.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    layout();
  };
  w.addEventListener('resize', function () { if (UI.isOpen) layout(); }, false);
  F.onChange(function (changed, blocks) {
    if (UI.isOpen && (blocks.settings || blocks.photos || blocks.status) && !UI.busy) UI.refresh();
  });

  // ------------------------------------------------------------------ pages
  var PAGES = {};

  PAGES.ha = function (body) {
    var st = F.block('status') || {};
    var c = group(body);
    row(c, { label: T('État', 'Status'), value: haValue() });
    row(c, { label: T('Maison', 'Home'), value: st.name || '—' });
    var n = 0;
    for (var id in F.store.entities) if (F.store.entities.hasOwnProperty(id)) n++;
    row(c, { label: T('Appareils', 'Devices'), value: String(n) });
    row(c, { label: T('Pièces', 'Rooms'), value: String(F.store.areas.length) });
    var c2 = group(body, null, T('Foyer montre ce que contrôle Home Assistant. Vos pièces, scènes et appareils se règlent dans Home Assistant ; ils apparaissent ici tout seuls.',
      'Foyer shows what Home Assistant controls. Rooms, scenes and devices are set up in Home Assistant and show up here by themselves.'));
    row(c2, {
      label: T('Ouvrir Home Assistant', 'Open Home Assistant'), blue: true, chevron: false,
      onTap: function () { F.openHomeAssistant(); }
    });
  };

  PAGES.screens = function (body) {
    if (sess().kind === 'ingress') {
      var c = group(body, null, T('Ouvre Foyer sur son propre port, en plein écran dans Safari. Touchez Partager, puis « Sur l\'écran d\'accueil ». Ouvert depuis sa nouvelle icône, Foyer se configure tout seul.',
        'Opens Foyer on its own port, full screen in Safari. Tap Share, then Add to Home Screen. Opened from its new icon, Foyer sets itself up.'));
      row(c, { label: T('Mettre Foyer sur l\'écran d\'accueil de cet iPad', 'Put Foyer on This iPad\'s Home Screen'), blue: true, chevron: false, onTap: function () { F.fullScreenHere(); } });
    }
    var c2 = group(body, null, T('Pour un iPad qui n\'ouvre pas Home Assistant, une tablette Android ou un écran sans compte : une adresse et un code valable une seule fois, pendant 7 jours.',
      'For an iPad that cannot open Home Assistant, an Android tablet or a screen without an account: an address and a code that works once, for 7 days.'));
    var sheet = F.el('div', 'st-setup', body);
    row(c2, {
      label: T('Créer une fiche d\'installation', 'Make a Setup Sheet'), blue: true, chevron: false,
      onTap: function () { makeSetupSheet(sheet); }
    });
  };

  function loadQr(cb) {
    if (w.qrcode) return cb();
    var sc = doc.createElement('script');
    sc.src = 'js/vendor/qrcode.js';
    sc.onload = cb;
    doc.body.appendChild(sc);
  }

  function makeSetupSheet(box) {
    F.xhr('POST', 'api/admin/setup-code', {}, function (status, data) {
      if (status !== 200 || !data) {
        F.toast(F.t('error'));
        return;
      }
      var port = (data.access && data.access.port) || 8110;
      var hosts = [];
      var bh = w.location.hostname;
      try { bh = w.top.location.hostname || bh; } catch (e) { /* other origin */ }
      if (bh && !/^(localhost|127\.)/.test(bh)) hosts.push(bh);
      var ips = (data.access && data.access.ips) || [];
      for (var i = 0; i < ips.length; i++) if (hosts.indexOf(ips[i]) < 0) hosts.push(ips[i]);
      if (!hosts.length) hosts.push('homeassistant.local');
      F.clear(box);
      var card = F.el('div', 'st-card st-sheet', box);
      var qrBox = F.el('div', 'st-qr', card);
      var info = F.el('div', 'st-sheet-info', card);
      F.el('div', 'st-sub', info, T('Adresse', 'Address'));
      for (var h = 0; h < hosts.length; h++) F.el('div', 'st-sheet-addr', info, 'http://' + hosts[h] + ':' + port);
      F.el('div', 'st-sub', info, T('Code (une seule fois, 7 jours)', 'Code (once, 7 days)'));
      F.el('div', 'st-sheet-code', info, data.display);
      text(info, T('Sur l\'iPad : ouvrez l\'adresse dans Safari (ou scannez le QR code), touchez Partager → « Sur l\'écran d\'accueil », ouvrez Foyer depuis sa nouvelle icône et tapez le code.',
        'On the iPad: open the address in Safari (or scan the QR code), tap Share → Add to Home Screen, open Foyer from its new icon and type the code.'));
      loadQr(function () {
        try {
          var qr = w.qrcode(0, 'M');
          qr.addData('http://' + hosts[0] + ':' + port + '/?setup=' + data.code);
          qr.make();
          var img = doc.createElement('img');
          img.src = qr.createDataURL(6, 2);
          qrBox.appendChild(img);
        } catch (e) { /* no QR */ }
      });
    }, 15000);
  }

  PAGES.paired = function (body) {
    var c = group(body, null, T('Un écran inutilisé pendant 90 jours doit être associé à nouveau. Retirer un écran le déconnecte immédiatement.',
      'A screen not used for 90 days must pair again. Removing a screen stops it at once.'));
    var wait = row(c, { label: T('Chargement…', 'Loading…') });
    F.xhr('GET', 'api/admin/devices', null, function (status, data) {
      if (wait.parentNode) wait.parentNode.removeChild(wait);
      var list = (data && data.devices) || [];
      if (!list.length) row(c, { label: T('Aucun écran associé par son propre port', 'No screen paired on its own port') });
      for (var i = 0; i < list.length; i++) {
        (function (d) {
          row(c, {
            icon: 'tablet', color: '#007aff', label: d.name + (d.admin ? ' · admin' : ''),
            sub: T('Vu ', 'Seen ') + agoText(d.lastSeen),
            onTap: function (el) {
              menu(el, [{ label: T('Renommer', 'Rename'), value: 'rename' }, { label: T('Retirer', 'Remove'), value: 'remove' }], null, function (v) {
                if (v === 'rename') {
                  var name = w.prompt(T('Nom de l\'écran', 'Screen name'), d.name);
                  if (name) F.xhr('PATCH', 'api/admin/devices/' + d.id, { name: name }, function () { UI.go('paired'); });
                } else if (w.confirm(T('Retirer « ' + d.name + ' » ?', 'Remove “' + d.name + '”?'))) {
                  F.xhr('DELETE', 'api/admin/devices/' + d.id, null, function () { UI.go('paired'); });
                }
              });
            }
          });
        }(list[i]));
      }
    }, 15000);
  };

  function agoText(ms) {
    var sec = Math.round((F.now() - ms) / 1000);
    if (sec < 90) return T('à l\'instant', 'just now');
    if (sec < 3600) return T('il y a ' + Math.round(sec / 60) + ' min', Math.round(sec / 60) + ' min ago');
    if (sec < 86400) return T('il y a ' + Math.round(sec / 3600) + ' h', Math.round(sec / 3600) + ' h ago');
    return T('il y a ' + Math.round(sec / 86400) + ' j', Math.round(sec / 86400) + ' d ago');
  }

  PAGES.faces = function (body) {
    var faces = (s().faces || []).slice();
    var on = [];
    for (var i = 0; i < faces.length; i++) if (faces[i].on) on.push({ label: F.FACE_NAMES[faces[i].id], value: faces[i].id });
    var c0 = group(body);
    selectRow(c0, T('Cadran de départ', 'Start Face'), on, s().startFace, function (v) { save({ startFace: v }); });
    var c = group(body, T('Cadrans', 'Faces'), T('Glissez vers la gauche ou la droite sur l\'iPad pour passer d\'un cadran à l\'autre. Les flèches changent l\'ordre.',
      'Swipe left or right on the iPad to change faces. The arrows change the order.'));
    for (var k = 0; k < faces.length; k++) {
      (function (f, idx) {
        row(c, {
          icon: FACE_ICONS[f.id] || 'apps', color: f.on ? '#32ade6' : '#c7c7cc', label: F.FACE_NAMES[f.id],
          toggle: {
            on: f.on,
            onChange: function (v) {
              var next = faces.map(function (x) { return { id: x.id, on: x.id === f.id ? v : x.on }; });
              var any = false;
              for (var a = 0; a < next.length; a++) if (next[a].on) any = true;
              if (!any) return;
              save({ faces: next });
            }
          },
          extra: function (right) {
            var up = F.el('div', 'st-arrow' + (idx === 0 ? ' off' : ''), right);
            icon('chevron-up', '', up);
            var dn = F.el('div', 'st-arrow' + (idx === faces.length - 1 ? ' off' : ''), right);
            icon('chevron-down', '', dn);
            right.insertBefore(dn, right.firstChild);
            right.insertBefore(up, right.firstChild);
            var move = function (d) {
              var j = idx + d;
              if (j < 0 || j >= faces.length) return;
              var next = faces.slice();
              var tmp = next[idx];
              next[idx] = next[j];
              next[j] = tmp;
              save({ faces: next });
            };
            F.onTap(up, function () { move(-1); });
            F.onTap(dn, function () { move(1); });
          }
        });
      }(faces[k], k));
    }
  };

  PAGES.photos = function (body) {
    var c = group(body, null, T('Vos photos restent chez vous, dans le dossier /media/foyer/photos de Home Assistant. Elles sont réduites avant l\'envoi.',
      'Your photos stay at home, in Home Assistant\'s /media/foyer/photos folder. They are made smaller before they are sent.'));
    var input = doc.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    body.appendChild(input);
    var progress = F.el('div', 'st-foot st-progress', body);
    row(c, { icon: 'image-plus', color: '#ff9500', label: T('Ajouter des photos', 'Add Photos'), blue: true, chevron: false, onTap: function () { input.click(); } });
    input.addEventListener('change', function () {
      var files = [];
      for (var i = 0; i < input.files.length; i++) files.push(input.files[i]);
      input.value = '';
      uploadAll(files, progress);
    }, false);
    var items = [];
    var all = F.photoItems();
    for (var j = 0; j < all.length; j++) if (!all[j].demo) items.push(all[j]);
    var grid = F.el('div', 'st-photos', body);
    if (!items.length) F.el('div', 'st-foot', grid, T('Aucune photo pour le moment.', 'No photos yet.'));
    for (var k = 0; k < items.length; k++) {
      (function (p) {
        var cell = F.el('div', 'st-photo', grid);
        F.setBg(cell, p.src);
        var del = F.el('div', 'st-photo-del', cell);
        icon('close', '', del);
        F.onTap(del, function () {
          if (!w.confirm(T('Supprimer cette photo ?', 'Delete this photo?'))) return;
          F.xhr('DELETE', 'api/photos/' + p.id, null, function () { UI.go('photos'); });
        });
      }(items[k]));
    }
    var c2 = group(body);
    var opts = [[60, '1 min'], [300, '5 min'], [900, '15 min'], [3600, T('1 heure', '1 hour')], [86400, T('1 jour', '1 day')]].map(function (x) { return { value: x[0], label: x[1] }; });
    selectRow(c2, T('Changer de photo toutes les', 'Change photo every'), opts, s().photoInterval, function (v) { save({ photoInterval: v }); });
  };

  function uploadAll(files, progress) {
    var n = 0;
    UI.busy = true;
    function next() {
      if (n >= files.length) {
        UI.busy = false;
        F.text(progress, '');
        F.toast(T('Photos ajoutées', 'Photos added'));
        UI.go('photos');
        return;
      }
      F.text(progress, T('Envoi ', 'Sending ') + (n + 1) + ' / ' + files.length + '…');
      resize(files[n], function (buf, wd, ht) {
        n++;
        if (!buf) return next();
        var x = new w.XMLHttpRequest();
        x.open('POST', 'api/photos?w=' + wd + '&h=' + ht, true);
        x.setRequestHeader('X-Foyer', '1');
        x.setRequestHeader('Content-Type', 'image/jpeg');
        x.onreadystatechange = function () { if (x.readyState === 4) next(); };
        x.send(buf);
      });
    }
    next();
  }

  function resize(file, cb) {
    var url = (w.URL || w.webkitURL).createObjectURL(file);
    var img = new w.Image();
    img.onload = function () {
      var max = 2048;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var cw = Math.round(img.width * scale);
      var ch = Math.round(img.height * scale);
      var canvas = doc.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
      (w.URL || w.webkitURL).revokeObjectURL(url);
      var data = canvas.toDataURL('image/jpeg', 0.86);
      var bin = w.atob(data.split(',')[1]);
      var arr = new w.Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      cb(arr.buffer, cw, ch);
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }

  PAGES.display = function (body) {
    var st = s();
    var c = group(body, T('Fond d\'écran', 'Wallpaper'));
    var r = F.el('div', 'st-swatches', c);
    for (var id in WALLPAPERS) {
      if (!WALLPAPERS.hasOwnProperty(id)) continue;
      (function (wid) {
        var sw = F.el('div', 'st-swatch' + ((st.wallpaper || 'amber') === wid ? ' sel' : ''), r);
        sw.style.background = WALLPAPERS[wid];
        F.onTap(sw, function () { save({ wallpaper: wid }); });
      }(id));
    }
    var c2 = group(body, null, T('Le verre dépoli demande un iPad récent ; le style plat convient aux anciens iPad.', 'Frosted glass needs a recent iPad; Flat suits older iPads.'));
    segmented(c2, T('Style', 'Style'), [{ label: T('Verre', 'Glass'), value: 'glass' }, { label: T('Dépoli', 'Frosted'), value: 'frosted' }, { label: T('Plat', 'Flat'), value: 'flat' }], st.style || 'glass', function (v) { save({ style: v }); });
    var c3 = group(body, T('Cet écran', 'This Screen'));
    sliderRow(c3, T('Luminosité', 'Brightness'), Math.round((1 - F.getUserDim() / 0.85) * 100), 10, 100, 5, function (v) { F.setUserDim((1 - v / 100) * 0.85); });
    var night = st.night || {};
    var c4 = group(body, T('Nuit', 'Night'), T('La nuit, Foyer passe sur le cadran choisi et assombrit l\'écran. Touchez l\'écran pour le rallumer une minute.',
      'At night Foyer switches to the chosen face and dims the screen. Touch the screen to brighten it for a minute.'));
    row(c4, { label: T('Mode nuit', 'Night Mode'), toggle: { on: night.enabled, onChange: function (v) { save({ night: { enabled: v } }); } } });
    var times = [];
    for (var h = 0; h < 24; h++) {
      for (var m = 0; m < 60; m += 30) {
        var v = F.pad2(h) + ':' + F.pad2(m);
        times.push({ label: v, value: v });
      }
    }
    selectRow(c4, T('Début', 'From'), times, night.from, function (x) { save({ night: { from: x } }); });
    selectRow(c4, T('Fin', 'To'), times, night.to, function (x) { save({ night: { to: x } }); });
    var nf = ['flow', 'clock', 'analog', 'photos'].map(function (fid) { return { label: F.FACE_NAMES[fid], value: fid }; });
    selectRow(c4, T('Cadran la nuit', 'Night Face'), nf, night.face, function (x) { save({ night: { face: x } }); });
    sliderRow(c4, T('Assombrir', 'Dim'), Math.round((night.dim || 0) * 100), 0, 85, 5, function (x) { save({ night: { dim: x / 100 } }); });
    var c5 = group(body);
    var ret = [[0, T('Jamais', 'Never')], [60, '1 min'], [300, '5 min'], [900, '15 min'], [3600, T('1 heure', '1 hour')]].map(function (x) { return { value: x[0], label: x[1] }; });
    selectRow(c5, T('Revenir au cadran de départ', 'Back to the Start Face'), ret, st.returnAfter || 0, function (x) { save({ returnAfter: x }); });
    var langs = [{ label: T('Comme Home Assistant', 'Like Home Assistant'), value: null }, { label: 'Français', value: 'fr' }, { label: 'English', value: 'en' }];
    selectRow(c5, T('Langue', 'Language'), langs, st.lang || null, function (x) { save({ lang: x }); });
  };

  PAGES.apps = function (body) {
    var apps = (s().apps) || { apple: {}, hidden: {} };
    var ios = F.isIOS;
    var both = F.APPS.filter(function (a) { return a.inside && a.apple; });
    var c = group(body, T('Ouvrir dans l\'app d\'Apple', 'Open in Apple\'s App'), ios
      ? T('L\'app d\'Apple prend tout l\'écran ; balayez vers le haut pour revenir. Si l\'iPad est verrouillé sur Foyer avec Accès guidé, désactivez-le pour utiliser ceci.',
        'Apple\'s app takes over the screen; swipe up to come back. If the iPad is locked to Foyer with Guided Access, turn it off to use this.')
      : T('Les apps d\'Apple ne s\'ouvrent que sur iPad et iPhone.', 'Apple\'s apps only open on iPad and iPhone.'));
    for (var i = 0; i < both.length; i++) {
      (function (a) {
        row(c, {
          icon: a.icon, color: a.color, label: a.label(),
          toggle: {
            on: Boolean(apps.apple && apps.apple[a.id]),
            onChange: function (v) {
              var apple = copyMap(apps.apple);
              if (v) apple[a.id] = true; else delete apple[a.id];
              save({ apps: { apple: apple, hidden: apps.hidden || {} } });
            }
          }
        });
      }(both[i]));
    }
    var c2 = group(body, T('Sur l\'écran d\'accueil de Foyer', 'On Foyer\'s Home Screen'), T('Balayez vers le haut depuis le bas d\'un cadran pour ouvrir l\'écran d\'accueil des apps.',
      'Swipe up from the bottom of a face to open the apps.'));
    for (var k = 0; k < F.APPS.length; k++) {
      (function (a) {
        if (a.id === 'settings') return;
        if (!a.inside && !ios) return;
        row(c2, {
          icon: a.icon, color: a.color, label: a.label(),
          toggle: {
            on: !(apps.hidden && apps.hidden[a.id]),
            onChange: function (v) {
              var hidden = copyMap(apps.hidden);
              if (v) delete hidden[a.id]; else hidden[a.id] = true;
              save({ apps: { apple: apps.apple || {}, hidden: hidden } });
            }
          }
        });
      }(F.APPS[k]));
    }
  };
  function copyMap(m) {
    var o = {};
    for (var k in (m || {})) if (m.hasOwnProperty(k)) o[k] = m[k];
    return o;
  }

  PAGES.music = function (body) {
    var st = F.block('status') || {};
    var caps = st.caps || {};
    var players = F.entitiesOf('media_player');
    var c = group(body);
    var opts = [{ label: T('Automatique (celle qui joue)', 'Automatic (the one playing)'), value: null }];
    for (var i = 0; i < players.length; i++) opts.push({ label: F.e(players[i]).n, value: players[i] });
    selectRow(c, T('Enceinte par défaut', 'Default Speaker'), opts, s().speaker || null, function (v) { save({ speaker: v }); });
    var c2 = group(body, T('Par Home Assistant', 'Through Home Assistant'));
    if (!players.length) row(c2, { label: T('Aucune enceinte dans Home Assistant', 'No speakers in Home Assistant') });
    for (var k = 0; k < players.length; k++) {
      (function (id) {
        var e = F.e(id);
        row(c2, {
          icon: F.entityIcon(id, e), color: e.s === 'playing' ? '#34c759' : '#8e8e93', label: e.n,
          sub: ((e.at && e.at.model) ? e.at.model + ' · ' : '') + F.stateText(id, e),
          onTap: function () {
            UI.hide();
            F.apps.openInside('music', id);
          }
        });
      }(players[k]));
    }
    var c3 = group(body, T('Sources', 'Sources'), caps.musicAssistant
      ? T('Music Assistant est installé : l\'app Musique de Foyer cherche et lance Apple Music sur les HomePod. Pour relier votre compte, ouvrez Music Assistant, puis Paramètres → Music sources → Apple Music, et connectez-vous avec votre identifiant Apple (à refaire tous les 6 mois). Les HomePod doivent accepter AirPlay de « Tout le monde sur ce réseau » (app Maison → Réglages de la maison → Haut-parleurs et TV).',
        'Music Assistant is installed: Foyer\'s Music app searches and plays Apple Music on the HomePods. To link your account, open Music Assistant, then Settings → Music sources → Apple Music, and sign in with your Apple Account (again every 6 months). The HomePods must accept AirPlay from "Everyone on the same network" (Home app → Home Settings → Speakers & TV).')
      : T('Pour lancer vos playlists Apple Music sur les HomePod depuis Foyer, ajoutez Music Assistant dans Home Assistant (fournisseurs Apple Music et AirPlay). En attendant, l\'app Musique d\'Apple s\'ouvre depuis Foyer et envoie la musique aux HomePod par AirPlay.',
        'To start Apple Music playlists on the HomePods from Foyer, add Music Assistant to Home Assistant (Apple Music and AirPlay providers). Meanwhile Apple\'s Music app opens from Foyer and plays to the HomePods over AirPlay.'));
    row(c3, { icon: 'music', color: '#ff2d55', label: 'Apple Music', value: caps.musicAssistant ? 'Music Assistant' : T('App Musique d\'Apple', 'Apple Music app') });
    row(c3, { icon: 'radio', color: '#ff9500', label: T('Radios', 'Radio'), value: caps.radio ? T('Par Home Assistant', 'Through Home Assistant') : '—' });
    row(c3, { icon: 'speaker-multiple', color: '#5856d6', label: 'Music Assistant', value: caps.musicAssistant ? T('Installé', 'Installed') : T('Non installé', 'Not installed') });
    if (caps.musicAssistant) {
      // Its own page (port 8095): the Apple sign-in only comes back there.
      row(c3, {
        icon: 'link-variant', color: '#007aff', label: T('Ouvrir Music Assistant', 'Open Music Assistant'), blue: true,
        onTap: function () { w.open('http://' + w.location.hostname + ':8095/', '_blank'); }
      });
    }
  };

  PAGES.calendar = function (body) {
    var cals = F.entitiesOf('calendar');
    var shown = s().calendars;
    var c = group(body, T('Agendas affichés', 'Calendars Shown'), T('Vos agendas iCloud arrivent dans Home Assistant par CalDAV : un événement ajouté dans Foyer apparaît aussi sur votre iPhone.',
      'Your iCloud calendars reach Home Assistant through CalDAV: an event added in Foyer also shows up on your iPhone.'));
    if (!cals.length) row(c, { label: T('Aucun agenda dans Home Assistant', 'No calendars in Home Assistant') });
    for (var i = 0; i < cals.length; i++) {
      (function (id) {
        row(c, {
          icon: 'calendar-month', color: F.calColor(id), label: F.e(id).n,
          toggle: {
            on: !shown || shown.indexOf(id) >= 0,
            onChange: function (v) {
              var list = shown ? shown.slice() : cals.slice();
              var at = list.indexOf(id);
              if (v && at < 0) list.push(id);
              if (!v && at >= 0) list.splice(at, 1);
              save({ calendars: list.length === cals.length ? null : list });
            }
          }
        });
      }(cals[i]));
    }
    var writable = cals.filter(function (id) { return ((F.e(id).at || {}).supported_features || 0) & 1; });
    if (writable.length) {
      var c2 = group(body);
      var opts = writable.map(function (id) { return { label: F.e(id).n, value: id }; });
      var def = s().defaultCalendar;
      selectRow(c2, T('Agenda des nouveaux événements', 'Calendar for New Events'), opts, def && writable.indexOf(def) >= 0 ? def : writable[0], function (v) { save({ defaultCalendar: v }); });
      row(c2, { label: T('Nouvel événement', 'New Event'), blue: true, chevron: false, onTap: function () { F.newEvent(); } });
    }
    var lists = F.entitiesOf('todo');
    var c3 = group(body, T('Rappels', 'Reminders'), T('Les listes de Home Assistant, dont celles de votre iPhone si elles arrivent par CalDAV.', 'Home Assistant\'s lists, including your iPhone\'s when they arrive through CalDAV.'));
    if (!lists.length) row(c3, { label: T('Aucune liste', 'No lists') });
    for (var k = 0; k < lists.length; k++) {
      (function (id) {
        row(c3, { icon: 'format-list-bulleted', color: '#ff9500', label: F.e(id).n, value: F.e(id).s, onTap: function () { UI.hide(); F.apps.openInside('reminders', id); } });
      }(lists[k]));
    }
  };

  PAGES.sensors = function (body) {
    var found = [];
    for (var id in F.store.entities) {
      if (!F.store.entities.hasOwnProperty(id) || F.domain(id) !== 'sensor') continue;
      var se = F.store.entities[id];
      var sdc = se.at && se.at.device_class;
      // The HomePod readings land in a room's « Température … » / « Humidité … » sensors.
      if (/homepod/.test(id) || /homepod/i.test(se.fn || '') || ((sdc === 'temperature' || sdc === 'humidity') && se.a)) found.push(id);
    }
    found.sort();
    var c = group(body, 'HomePod', T('Les HomePod mesurent la température et l\'humidité, mais Apple ne les partage qu\'avec l\'app Maison. Une automatisation de la Maison d\'Apple les envoie à Home Assistant toutes les 15 minutes ; Foyer les montre ensuite dans chaque pièce.',
      'HomePods measure temperature and humidity, but Apple only shares them with the Home app. An automation in Apple\'s Home sends them to Home Assistant every 15 minutes; Foyer then shows them in each room.'));
    if (!found.length) row(c, { label: T('Pas encore de mesure reçue', 'No reading received yet'), sub: T('Voir la documentation de Foyer, section HomePod', 'See Foyer\'s documentation, HomePod section') });
    for (var i = 0; i < found.length; i++) {
      var e = F.e(found[i]);
      var a = F.area(e.a);
      row(c, { icon: F.entityIcon(found[i], e), color: '#30b0c7', label: e.n, sub: a ? a.name : null, value: F.stateText(found[i], e) });
    }
  };

  PAGES.alarm = function (body) {
    var panels = F.entitiesOf('alarm_control_panel');
    var c = group(body, T('Alarmes de Home Assistant', 'Home Assistant Alarms'), T('Foyer montre l\'armement (avec le compte à rebours de sortie), demande le code à l\'entrée et affiche l\'alarme en plein écran quand elle se déclenche. Les notifications, les lampes qui clignotent, la sirène et les caméras se règlent dans Home Assistant (automatisations ou Alarmo).',
      'Foyer shows arming (with the exit countdown), asks for the code on entry and shows the alarm full screen when it goes off. Notifications, flashing lights, the siren and cameras are set up in Home Assistant (automations or Alarmo).'));
    if (!panels.length) row(c, { label: T('Aucune alarme dans Home Assistant', 'No alarm in Home Assistant') });
    for (var i = 0; i < panels.length; i++) {
      (function (id) {
        var e = F.e(id);
        row(c, {
          icon: F.entityIcon(id, e), color: e.s === 'disarmed' ? '#8e8e93' : (e.s === 'triggered' ? '#ff3b30' : '#34c759'),
          label: e.n, sub: (e.at && e.at.code_format) ? T('Code demandé pour désarmer', 'Code required to disarm') : T('Sans code', 'No code'),
          value: F.stateText(id, e),
          onTap: function () { UI.hide(); F.sheets.open(id); }
        });
      }(panels[i]));
    }
    var c2 = group(body, T('Sur cet iPad', 'On this iPad'), T('Tant qu\'il n\'y a pas de vraie sirène, l\'iPad sonne quand l\'alarme se déclenche. Safari ne laisse jouer un son qu\'après un premier toucher de l\'écran depuis le dernier chargement de Foyer, et le volume de l\'iPad doit être monté.',
      'Until there is a real siren, the iPad sounds when the alarm goes off. Safari only plays sound after the screen has been touched once since Foyer last loaded, and the iPad\'s volume must be up.'));
    row(c2, {
      label: T('Sirène sur les iPad', 'Siren on the iPads'),
      toggle: { on: s().alarmSiren !== false, onChange: function (v) { save({ alarmSiren: v }); } }
    });
  };

  PAGES.security = function (body) {
    var c = group(body, null, T('Activé, les écrans associés affichent les serrures, l\'alarme et les portes de garage mais ne peuvent ni déverrouiller, ni désarmer, ni ouvrir (sauf par une scène ou un script que vous avez créé). Un iPad ne peut jamais modifier Home Assistant lui-même.',
      'When on, paired screens show locks, alarms and garage doors but cannot unlock, disarm or open them (unless a scene or script you made does). An iPad can never change Home Assistant itself.'));
    row(c, {
      label: T('Serrures, alarme et garage depuis Home Assistant uniquement', 'Locks, Alarms & Garage Doors Only From Home Assistant'),
      toggle: { on: Boolean(s().sensitiveFromHaOnly), onChange: function (v) { save({ sensitiveFromHaOnly: v }); } }
    });
  };

  PAGES.about = function (body) {
    var c = group(body);
    row(c, { label: 'Foyer', value: sess().version || '' });
    row(c, { label: T('Mode', 'Mode'), value: { addon: T('Add-on Home Assistant', 'Home Assistant add-on'), standalone: T('Conteneur autonome', 'Standalone container'), demo: T('Démo', 'Demo') }[sess().mode] || sess().mode });
    row(c, { label: T('Cet écran', 'This screen'), value: sess().name || (sess().kind === 'ingress' ? 'Home Assistant' : '—') });
    var c2 = group(body, null, T('Logiciel libre (MIT). Icônes Material Design Icons (Apache 2.0). QR codes : qrcode-generator de Kazuhiko Arase (MIT).',
      'Free software (MIT). Material Design Icons (Apache 2.0). QR codes: qrcode-generator by Kazuhiko Arase (MIT).'));
    row(c2, { label: T('Code source', 'Source code'), blue: true, chevron: false, onTap: function () { w.open('https://github.com/vallez44/foyer-addons', '_blank'); } });
  };

  PAGES.privacy = function (body) {
    var c = group(body, T('Ce qui sort de chez vous', 'What leaves your home'));
    row(c, { icon: 'home-heart', color: '#34c759', label: T('Rien', 'Nothing'), sub: T('Foyer tourne sur votre Home Assistant. Pas de compte, pas de licence, pas de statistiques.', 'Foyer runs on your Home Assistant. No account, no license, no analytics.') });
    var c2 = group(body, T('Ce que cet écran peut faire', 'What this screen can do'));
    row(c2, { icon: 'check', color: '#34c759', label: T('Allumer, ouvrir, verrouiller, lancer vos scènes, lire la musique', 'Switch, open, lock, run your scenes, play music') });
    row(c2, { icon: 'check', color: '#34c759', label: T('Ajouter un événement ou un rappel, des photos', 'Add an event, a reminder, photos') });
    var c3 = group(body, T('Ce qu\'il ne peut pas faire', 'What it cannot do'), T('Foyer refuse ces demandes avant qu\'elles n\'atteignent Home Assistant. L\'iPad ne reçoit jamais de jeton Home Assistant.', 'Foyer refuses these before they reach Home Assistant. The iPad never gets a Home Assistant token.'));
    row(c3, { icon: 'close', color: '#ff3b30', label: T('Modifier Home Assistant : modules, utilisateurs, sauvegardes, mises à jour, réglages', 'Change Home Assistant: add-ons, users, backups, updates, settings') });
    row(c3, { icon: 'close', color: '#ff3b30', label: T('Lancer un script ou un bouton qui n\'est pas sur un cadran', 'Run a script or button that is not on a face') });
  };
}(window));
