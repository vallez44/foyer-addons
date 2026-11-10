/* Foyer: the apps. Swipe up from the bottom of a face: Foyer's own apps (Music on the HomePods, Reminders,
   Timers, World Clock, Calendar…) and, on iPad, Apple's apps (Music, Calendar, Podcasts, TV, Find My…). ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var doc = w.document;
  function T(fr, en) { return F.lang === 'en' ? en : fr; }
  function grad(a, b) { return 'linear-gradient(180deg, ' + a + ' 0%, ' + b + ' 100%)'; }
  var A = F.apps = { isOpen: false };

  // id, icon, background, glyph colour, label, Foyer's own version, Apple's app (URL scheme)
  F.APPS = [
    { id: 'home', icon: 'home', bg: grad('#ffd45a', '#ff9f0a'), label: function () { return T('Maison', 'Home'); }, inside: function () { F.sheets.house(); }, apple: 'com.apple.home://' },
    { id: 'music', icon: 'music', bg: grad('#ff6f8a', '#fc3c44'), label: function () { return T('Musique', 'Music'); }, inside: function (arg) { openMusic(arg); }, apple: 'music://' },
    { id: 'calendar', icon: 'calendar-month', bg: '#ffffff', fg: '#ff3b30', label: function () { return T('Calendrier', 'Calendar'); }, inside: function () { F.sheets.calendar(); }, apple: 'calshow://' },
    { id: 'reminders', icon: 'format-list-bulleted', bg: '#ffffff', fg: '#ff9500', label: function () { return T('Rappels', 'Reminders'); }, inside: function (arg) { openReminders(arg); }, apple: 'x-apple-reminderkit://' },
    { id: 'weather', icon: 'weather-partly-cloudy', bg: grad('#5ac8fa', '#2f7fe0'), label: function () { return T('Météo', 'Weather'); }, inside: function () { F.sheets.weather(); }, apple: 'weather://' },
    { id: 'photos', icon: 'image-multiple', bg: '#ffffff', fg: '#ff9500', label: function () { return 'Photos'; }, inside: function () { goFace('photos'); }, apple: 'photos-redirect://' },
    { id: 'timers', icon: 'timer-outline', bg: '#1c1c1e', label: function () { return T('Minuteurs', 'Timers'); }, inside: function () { openTimers(); }, apple: 'clock-timer://' },
    { id: 'worldclock', icon: 'earth', bg: '#1c1c1e', label: function () { return T('Horloge mondiale', 'World Clock'); }, inside: function () { openWorldClock(); }, apple: 'clock-worldclock://' },
    { id: 'alarms', icon: 'alarm', bg: '#1c1c1e', fg: '#ff9f0a', label: function () { return T('Alarmes', 'Alarms'); }, apple: 'clock-alarm://' },
    { id: 'podcasts', icon: 'podcast', bg: grad('#d36cf5', '#8e3fdc'), label: function () { return 'Podcasts'; }, apple: 'podcasts://' },
    { id: 'news', icon: 'newspaper-variant', bg: '#ffffff', fg: '#ff2d55', label: function () { return 'News'; }, apple: 'applenews://' },
    { id: 'books', icon: 'book-open-variant', bg: grad('#ffb340', '#ff7a00'), label: function () { return T('Livres', 'Books'); }, apple: 'ibooks://' },
    { id: 'tv', icon: 'television-classic', bg: '#1c1c1e', label: function () { return 'TV'; }, apple: 'videos://' },
    { id: 'safari', icon: 'compass', bg: '#ffffff', fg: '#007aff', label: function () { return 'Safari'; }, apple: 'x-web-search://' },
    { id: 'findmy', icon: 'map-marker-radius', bg: grad('#6ee27a', '#2fb24c'), label: function () { return T('Localiser', 'Find My'); }, apple: 'findmy://' },
    { id: 'shortcuts', icon: 'rocket-launch', bg: grad('#ff7ab6', '#5e5ce6'), label: function () { return T('Raccourcis', 'Shortcuts'); }, apple: 'shortcuts://' },
    { id: 'maps', icon: 'map-marker-path', bg: grad('#7ad16c', '#3ea0f7'), label: function () { return T('Plans', 'Maps'); }, apple: 'maps://' },
    { id: 'homeassistant', icon: 'home-assistant', bg: grad('#41bdf5', '#0d8fd6'), label: function () { return 'Home Assistant'; }, inside: function () { F.openHomeAssistant(); } },
    { id: 'settings', icon: 'cog', bg: grad('#aeaeb2', '#6e6e73'), label: function () { return T('Réglages', 'Settings'); }, inside: function () { F.settingsUI.show(); } }
  ];

  // Solid colours for the rows in Settings → Apps.
  var ROW_COLORS = {
    home: '#ff9f0a', music: '#fc3c44', calendar: '#ff3b30', reminders: '#ff9500', weather: '#2f7fe0', photos: '#ff9500', timers: '#3a3a3c',
    worldclock: '#3a3a3c', alarms: '#ff9f0a', podcasts: '#8e3fdc', news: '#ff2d55', books: '#ff7a00', tv: '#3a3a3c', safari: '#007aff',
    findmy: '#2fb24c', shortcuts: '#5e5ce6', maps: '#3ea0f7', homeassistant: '#0d8fd6', settings: '#8e8e93'
  };
  for (var c = 0; c < F.APPS.length; c++) F.APPS[c].color = ROW_COLORS[F.APPS[c].id] || '#8e8e93';

  function appById(id) {
    for (var i = 0; i < F.APPS.length; i++) if (F.APPS[i].id === id) return F.APPS[i];
    return null;
  }

  function goFace(id) {
    if (F.pager.find(id) >= 0) F.pager.goTo(id);
    else w.location.href = './?face=' + id;
  }

  /** Opens an app: Foyer's own one, or Apple's when chosen in Settings → Apps (or when Foyer has none). */
  A.open = function (id, arg) {
    var a = appById(id);
    if (!a) return;
    var prefs = F.settings().apps || {};
    var useApple = a.apple && F.isIOS && (!a.inside || (prefs.apple && prefs.apple[id]));
    A.hide();
    if (useApple) {
      w.location.href = a.apple;
      return;
    }
    if (a.inside) a.inside(arg);
  };
  /** Foyer's own version, whatever Settings → Apps says (used from Settings and from the speaker pages). */
  A.openInside = function (id, arg) {
    var a = appById(id);
    if (!a || !a.inside) return;
    A.hide();
    a.inside(arg);
  };

  // ------------------------------------------------------------------ the apps screen
  A.show = function () {
    if (!A.root) {
      A.root = F.el('div', 'hs', doc.body);
      A.root.addEventListener('touchstart', function (ev) {
        ev.stopPropagation();
        if (F.onUserActivity) F.onUserActivity();
      }, false);
      A.root.addEventListener('touchmove', function (ev) { ev.preventDefault(); ev.stopPropagation(); }, false);
      A.root.addEventListener('mousedown', function (ev) { ev.stopPropagation(); }, false);
    }
    var root = A.root;
    F.clear(root);
    var now = new Date();
    var head = F.el('div', 'hs-head', root);
    F.el('div', 'hs-time', head, F.time(now, false));
    F.el('div', 'hs-date', head, F.cap(F.dayName(now)) + ' ' + now.getDate() + ' ' + F.monthName(now));
    var grid = F.el('div', 'hs-grid', root);
    var hidden = (F.settings().apps && F.settings().apps.hidden) || {};
    for (var i = 0; i < F.APPS.length; i++) {
      var a = F.APPS[i];
      if (hidden[a.id] && a.id !== 'settings') continue;
      if (!a.inside && !F.isIOS) continue;
      (function (app) {
        var cell = F.el('div', 'hs-app', grid);
        var ic = F.el('div', 'hs-icon', cell);
        ic.style.background = app.bg;
        var g = F.icon(app.icon, '', ic);
        g.style.fill = app.fg || '#ffffff';
        F.el('div', 'hs-label', cell, app.label());
        F.onTap(cell, function () { A.open(app.id); });
      }(a));
    }
    F.el('div', 'hs-hint', root, T('Touchez ailleurs pour revenir', 'Tap anywhere else to go back'));
    F.onTap(root, function (ev) { if (ev.target === root || ev.target === grid) A.hide(); });
    A.isOpen = true;
    w.setTimeout(function () { F.cls(root, 'show', true); }, 10);
  };

  A.hide = function () {
    if (!A.root || !A.isOpen) return;
    A.isOpen = false;
    F.cls(A.root, 'show', false);
  };

  // ------------------------------------------------------------------ Music: the HomePods, what plays, and what can be played
  function openMusic(entityId) {
    var players = F.entitiesOf('media_player');
    var sheet = new F.Sheet(T('Musique', 'Music'), '', 'sheet-music');
    if (!players.length) {
      F.el('div', 'sheet-empty', sheet.body, F.t('no_speaker'));
      return;
    }
    var st = { speaker: entityId && F.e(entityId) ? entityId : (F.pickSpeaker() || players[0]), path: [] };
    var spk = F.el('div', 'mu-speakers', sheet.body);
    var np = F.el('div', 'mu-np', sheet.body);
    var art = F.el('div', 'mu-art', np);
    var info = F.el('div', 'mu-info', np);
    var title = F.el('div', 'mu-title', info);
    var artist = F.el('div', 'mu-artist', info);
    var ctr = F.el('div', 'mu-ctr', info);
    F.button(ctr, '', 'skip-previous', 'mp-btn', function () { F.call(st.speaker, 'media_previous_track'); });
    var play = F.button(ctr, '', 'play', 'mp-btn mp-play', function () {
      F.call(st.speaker, 'media_play_pause', {}, function (c) { c.s = c.s === 'playing' ? 'paused' : 'playing'; });
    });
    F.button(ctr, '', 'skip-next', 'mp-btn', function () { F.call(st.speaker, 'media_next_track'); });
    var vol = F.slider(info, {
      horizontal: true, value: 0, icon: 'volume-high', cls: 'slider-volume',
      label: function (v) { return F.t('volume') + ' ' + Math.round(v) + ' %'; },
      onChange: function (v) { F.call(st.speaker, 'volume_set', { volume_level: v / 100 }); }
    });
    // Search (Music Assistant: Apple Music, the library, radios).
    var search = F.el('div', 'mu-search', sheet.body);
    var sInput = doc.createElement('input');
    sInput.type = 'search';
    sInput.className = 'rm-input mu-search-in';
    sInput.placeholder = T('Artistes, morceaux, albums, playlists…', 'Artists, songs, albums, playlists…');
    sInput.setAttribute('autocomplete', 'off');
    sInput.setAttribute('autocorrect', 'off');
    sInput.setAttribute('autocapitalize', 'off');
    sInput.setAttribute('spellcheck', 'false');
    sInput.setAttribute('enterkeyhint', 'search');
    search.appendChild(sInput);
    F.icon('magnify', 'mu-search-ic', search);
    var browse = F.el('div', 'mu-browse', sheet.body);
    var sTimer = null;
    var seq = 0;
    sInput.addEventListener('input', function () {
      w.clearTimeout(sTimer);
      sTimer = w.setTimeout(runSearch, 500);
    }, false);
    sInput.addEventListener('keydown', function (ev) {
      if (ev.keyCode !== 13) return;
      w.clearTimeout(sTimer);
      runSearch();
      sInput.blur();
    }, false);

    var MA_TITLES = {
      artists: ['Artistes', 'Artists'], albums: ['Albums', 'Albums'], tracks: ['Morceaux', 'Songs'], playlists: ['Playlists', 'Playlists'],
      radio: ['Radios', 'Radios'], podcasts: ['Podcasts', 'Podcasts'], audiobooks: ['Livres audio', 'Audiobooks']
    };
    function titleOf(it) {
      var t = it.type === 'music_assistant' && MA_TITLES[it.id];
      return t ? T(t[0], t[1]) : it.title;
    }
    function canSearch() {
      var e = F.e(st.speaker);
      var at = (e && e.at) || {};
      return Boolean(at.ma || ((at.supported_features || 0) & 4194304));
    }
    function playItem(it) {
      F.call(st.speaker, 'play_media', { media_content_id: it.id, media_content_type: it.type }, function (c) { c.s = 'playing'; c.at.media_title = it.title; });
      F.toast(T('Lecture sur ', 'Playing on ') + F.e(st.speaker).n);
    }

    function renderSpeakers() {
      F.clear(spk);
      for (var i = 0; i < players.length; i++) {
        (function (id) {
          var e = F.e(id);
          if (!e || (e.s === 'unavailable' && id !== st.speaker)) return;
          var b = F.button(spk, e.n, e.s === 'playing' ? 'play' : F.entityIcon(id, e), 'chip' + (id === st.speaker ? ' sel' : ''), function () {
            st.speaker = id;
            st.path = [];
            sInput.value = '';
            F.lastSpeaker = id;
            renderSpeakers();
            renderNow();
            load(null);
          });
          if (e.a && F.area(e.a)) b.title = F.area(e.a).name;
        }(players[i]));
      }
    }
    function renderNow() {
      var e = F.e(st.speaker);
      if (!e) return;
      var at = e.at || {};
      F.text(title, at.media_title || F.t('nothing_playing'));
      F.text(artist, at.media_artist ? at.media_artist + (at.app_name ? ' · ' + at.app_name : '') : e.n);
      F.setBg(art, at.pic || null);
      F.cls(art, 'empty', !at.pic);
      F.setIcon(play.iconEl, e.s === 'playing' ? 'pause' : 'play');
      if (at.volume_level !== undefined) vol.set(Math.round(at.volume_level * 100));
    }
    /** One list of things to play: a row opens (album, artist, folder); the red button plays. */
    function renderList(kids) {
      var list = F.el('div', 'mu-list', browse);
      for (var i = 0; i < kids.length; i++) {
        (function (it) {
          var r = F.el('div', 'mu-item', list);
          var th = F.el('div', 'mu-thumb', r);
          if (it.thumb) F.setBg(th, it.thumb);
          else F.icon(it.open && !it.play ? 'folder-music' : 'music-note', '', th);
          F.el('div', 'mu-item-t', r, titleOf(it));
          if (it.play) {
            var pb = F.icon('play-circle', 'mu-item-play', r);
            if (it.open) F.onTap(pb, function () { playItem(it); });
          }
          if (it.open) F.icon('chevron-right', 'mu-item-open', r);
          F.onTap(r, function () {
            if (it.open) {
              st.path.push(it);
              load(it);
            } else if (it.play) {
              playItem(it);
            }
          });
        }(kids[i]));
      }
    }
    function header(label) {
      var head = F.el('div', 'mu-head', browse);
      if (st.path.length) {
        var back = F.button(head, T('Retour', 'Back'), 'chevron-left', 'chip', function () {
          st.path.pop();
          load(st.path.length ? st.path[st.path.length - 1] : null);
        });
        back.style.marginLeft = '0';
      }
      F.el('span', 'mu-head-t', head, label);
    }
    function load(item) {
      var my = ++seq;
      F.cls(search, 'hidden', !canSearch());
      F.clear(browse);
      var wait = F.el('div', 'mu-wait', browse, '…');
      var url = 'api/browse?entity_id=' + encodeURIComponent(st.speaker);
      if (item) url += '&id=' + encodeURIComponent(item.id || '') + '&type=' + encodeURIComponent(item.type || '');
      F.xhr('GET', url, null, function (status, data) {
        if (my !== seq) return;
        if (wait.parentNode) wait.parentNode.removeChild(wait);
        var root = data && data.type === 'music_assistant' && !data.id;
        header(root ? T('Bibliothèque', 'Library') : (data && data.title ? titleOf(data) : T('Parcourir', 'Browse')));
        var kids = (status === 200 && data && data.children) || [];
        if (!kids.length) {
          var st2 = F.block('status') || {};
          F.el('div', 'mu-empty', browse, status === 200
            ? T('Rien à parcourir ici.', 'Nothing to browse here.')
            : T('Cette enceinte ne propose pas de bibliothèque.', 'This speaker has no library.'));
          if (!(st2.caps && st2.caps.musicAssistant)) {
            F.el('div', 'mu-empty sub', browse, T('Pour vos playlists Apple Music sur les HomePod, ajoutez Music Assistant à Home Assistant (voir Réglages → Musique).',
              'For your Apple Music playlists on the HomePods, add Music Assistant to Home Assistant (see Settings → Music).'));
          }
          return;
        }
        renderList(kids);
      }, 30000);
    }
    function runSearch() {
      var q = sInput.value.replace(/^\s+|\s+$/g, '');
      if (!q) {
        load(st.path.length ? st.path[st.path.length - 1] : null);
        return;
      }
      var my = ++seq;
      F.clear(browse);
      var wait = F.el('div', 'mu-wait', browse, '…');
      F.xhr('GET', 'api/search?entity_id=' + encodeURIComponent(st.speaker) + '&q=' + encodeURIComponent(q.slice(0, 100)), null, function (status, data) {
        if (my !== seq) return;
        if (wait.parentNode) wait.parentNode.removeChild(wait);
        var kids = (status === 200 && data && data.children) || [];
        st.path = [];
        header(T('Résultats', 'Results'));
        if (!kids.length) {
          F.el('div', 'mu-empty', browse, status === 200
            ? T('Aucun résultat pour « ' + q + ' ».', 'No results for "' + q + '".')
            : T('La recherche n\'a pas abouti.', 'The search did not work.'));
          if (status === 200) {
            F.el('div', 'mu-empty sub', browse, T('Pour chercher dans Apple Music, connectez votre compte dans Music Assistant (voir Réglages → Musique).',
              'To search Apple Music, sign in to your account in Music Assistant (see Settings → Music).'));
          }
          return;
        }
        renderList(kids);
      }, 30000);
    }
    renderSpeakers();
    renderNow();
    load(null);
    sheet.onRefresh(function (c) {
      var any = false;
      for (var i = 0; i < players.length; i++) if (c[players[i]]) any = true;
      if (any) {
        renderNow();
        renderSpeakers();
      }
    });
    if (F.isIOS) {
      var row = F.el('div', 'btn-row', sheet.body);
      F.button(row, T('Ouvrir l\'app Musique d\'Apple', 'Open Apple\'s Music app'), 'music', '', function () { w.location.href = 'music://'; });
    }
  }

  // ------------------------------------------------------------------ Reminders: Home Assistant's lists
  function openReminders(listId) {
    var lists = F.entitiesOf('todo');
    var sheet = new F.Sheet(T('Rappels', 'Reminders'), '', 'sheet-lists');
    if (!lists.length) {
      F.el('div', 'sheet-empty', sheet.body, T('Aucune liste dans Home Assistant', 'No lists in Home Assistant'));
      return;
    }
    var cur = listId && F.e(listId) ? listId : lists[0];
    var chips = F.el('div', 'chips', sheet.body);
    var box = F.el('div', 'rm-list', sheet.body);
    var add = F.el('div', 'rm-add', sheet.body);
    var input = doc.createElement('input');
    input.type = 'text';
    input.className = 'rm-input';
    input.placeholder = T('Nouveau rappel', 'New reminder');
    add.appendChild(input);
    F.button(add, T('Ajouter', 'Add'), 'plus', 'btn-strong rm-addbtn', function () {
      var v = String(input.value || '').replace(/^\s+|\s+$/g, '');
      if (!v) return;
      input.value = '';
      F.act({ entity_id: cur, service: 'add_item', data: { item: v } });
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.keyCode === 13) {
        ev.preventDefault();
        var v = String(input.value || '').replace(/^\s+|\s+$/g, '');
        if (!v) return;
        input.value = '';
        F.act({ entity_id: cur, service: 'add_item', data: { item: v } });
      }
    }, false);
    function render() {
      F.clear(chips);
      for (var i = 0; i < lists.length; i++) {
        (function (id) {
          F.button(chips, F.e(id).n, null, 'chip' + (id === cur ? ' sel' : ''), function () {
            cur = id;
            render();
          });
        }(lists[i]));
      }
      F.clear(box);
      var b = F.block('todo');
      var l = b && b.lists ? b.lists[cur] : null;
      if (!l || !l.open.length) {
        F.el('div', 'sheet-empty', box, F.t('list_empty'));
        return;
      }
      for (var k = 0; k < l.open.length; k++) {
        (function (it) {
          var r = F.el('div', 'rm-item', box);
          var c = F.icon('circle-outline', 'rm-check', r);
          F.el('div', 'rm-t', r, it.t);
          F.onTap(r, function () {
            F.setIcon(c, 'check-circle');
            F.cls(r, 'done', true);
            F.act({ entity_id: cur, service: 'update_item', data: { item: it.uid || it.t, status: 'completed' } });
          });
        }(l.open[k]));
      }
      if (l.done) F.el('div', 'rm-done', box, T(l.done + ' terminé(s)', l.done + ' completed'));
    }
    render();
    sheet.onRefresh(function (c, blocks) { if (blocks.todo) render(); });
  }

  // ------------------------------------------------------------------ Calendar: a new event (iCloud through CalDAV → your iPhone)
  F.newEvent = function (day) {
    // Only the calendars that accept new events (iCloud through CalDAV does; holidays and birthdays do not).
    var all = F.entitiesOf('calendar');
    var cals = all.filter(function (id) {
      var at = F.e(id).at || {};
      return (at.supported_features || 0) & 1;
    });
    if (!cals.length && F.store.session && F.store.session.demo) cals = all;
    if (!cals.length) {
      F.toast(F.t('no_calendar'));
      return;
    }
    var sheet = new F.Sheet(T('Nouvel événement', 'New Event'), '', 'sheet-event');
    var d = day ? new Date(day.getTime()) : new Date();
    var form = F.el('div', 'ev-form', sheet.body);
    function field(label, el) {
      var f = F.el('label', 'ev-field', form);
      F.el('span', 'ev-label', f, label);
      f.appendChild(el);
      return el;
    }
    function input(type, value) {
      var i = doc.createElement('input');
      i.type = type;
      i.className = 'ev-input';
      if (value !== undefined) i.value = value;
      return i;
    }
    function select(options, value) {
      var sel = doc.createElement('select');
      sel.className = 'ev-input';
      for (var i = 0; i < options.length; i++) {
        var o = doc.createElement('option');
        o.value = options[i][0];
        o.appendChild(doc.createTextNode(options[i][1]));
        if (options[i][0] === value) o.selected = true;
        sel.appendChild(o);
      }
      return sel;
    }
    var nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    var title = field(T('Titre', 'Title'), input('text', ''));
    title.placeholder = T('Ex. Dîner chez Léa', 'e.g. Dinner at Lea\'s');
    var dateIn = field(T('Jour', 'Day'), input('date', d.getFullYear() + '-' + F.pad2(d.getMonth() + 1) + '-' + F.pad2(d.getDate())));
    var timeIn = field(T('Début', 'Starts'), input('time', F.pad2(nextHour.getHours()) + ':00'));
    var dur = field(T('Durée', 'Duration'), select([['30', '30 min'], ['60', '1 h'], ['90', '1 h 30'], ['120', '2 h'], ['180', '3 h'], ['day', T('Toute la journée', 'All day')]], '60'));
    var calOpts = cals.map(function (id) { return [id, F.e(id).n]; });
    var def = F.settings().defaultCalendar;
    var cal = field(T('Agenda', 'Calendar'), select(calOpts, def && cals.indexOf(def) >= 0 ? def : cals[0]));
    var where = field(T('Lieu', 'Location'), input('text', ''));
    where.placeholder = T('Facultatif', 'Optional');
    var row = F.el('div', 'btn-row', sheet.body);
    F.button(row, F.t('cancel'), null, 'btn-quiet', function () { sheet.close(); });
    F.button(row, T('Ajouter', 'Add'), 'plus', 'btn-strong', function () {
      var summary = String(title.value || '').replace(/^\s+|\s+$/g, '');
      if (!summary || !dateIn.value) {
        F.toast(T('Indiquez un titre et un jour', 'Give a title and a day'));
        return;
      }
      var data = { summary: summary };
      if (where.value) data.location = where.value;
      if (dur.value === 'day') {
        var p = dateIn.value.split('-');
        var nd = new Date(+p[0], +p[1] - 1, +p[2] + 1);
        data.start_date = dateIn.value;
        data.end_date = nd.getFullYear() + '-' + F.pad2(nd.getMonth() + 1) + '-' + F.pad2(nd.getDate());
      } else {
        var tp = (timeIn.value || '09:00').split(':');
        var dp = dateIn.value.split('-');
        var start = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1], 0);
        var end = new Date(start.getTime() + parseInt(dur.value, 10) * 60000);
        var fmt = function (x) {
          return x.getFullYear() + '-' + F.pad2(x.getMonth() + 1) + '-' + F.pad2(x.getDate()) + 'T' + F.pad2(x.getHours()) + ':' + F.pad2(x.getMinutes()) + ':00';
        };
        data.start_date_time = fmt(start);
        data.end_date_time = fmt(end);
      }
      F.act({ entity_id: cal.value, service: 'create_event', data: data }, null, function (ok) {
        if (ok) {
          F.toast(T('Événement ajouté', 'Event added'));
          sheet.close();
        }
      });
    });
    w.setTimeout(function () { try { title.focus(); } catch (e) { /* ignore */ } }, 350);
  };

  // ------------------------------------------------------------------ Timers (kept on this screen, ring here)
  var TM = { list: [] };
  function storeTimers() {
    try { w.localStorage.setItem('foyer.timers', JSON.stringify(TM.list)); } catch (e) { /* private mode */ }
  }
  try { TM.list = JSON.parse(w.localStorage.getItem('foyer.timers') || '[]') || []; } catch (e) { TM.list = []; }

  var audio = null;
  function unlockAudio() {
    try {
      if (!audio) {
        var Ctx = w.AudioContext || w.webkitAudioContext;
        if (Ctx) audio = new Ctx();
      }
      if (audio && audio.state === 'suspended' && audio.resume) audio.resume();
    } catch (e) { audio = null; }
  }
  function beep() {
    if (!audio) return;
    try {
      var t0 = audio.currentTime;
      for (var i = 0; i < 3; i++) {
        var o = audio.createOscillator();
        var g = audio.createGain();
        o.frequency.value = 880;
        o.connect(g);
        g.connect(audio.destination);
        g.gain.setValueAtTime(0.0001, t0 + i * 0.3);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.3 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.22);
        o.start(t0 + i * 0.3);
        o.stop(t0 + i * 0.3 + 0.25);
      }
    } catch (e) { /* no sound */ }
  }

  function left(t) { return t.paused ? t.left : Math.max(0, t.end - F.now()); }
  function fmtLeft(ms) {
    var sec = Math.ceil(ms / 1000);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var ss = sec % 60;
    return (h ? h + ':' + F.pad2(m) : m) + ':' + F.pad2(ss);
  }

  function addTimer(min) {
    unlockAudio();
    TM.list.push({ id: String(F.now()), total: min * 60000, end: F.now() + min * 60000, paused: false, left: 0, label: min + ' min' });
    storeTimers();
    tickTimers();
  }

  var ringing = null;
  function ring(t) {
    if (ringing) return;
    var box = ringing = F.el('div', 'tm-ring', doc.body);
    F.icon('timer-sand', 'tm-ring-ic', box);
    F.el('div', 'tm-ring-t', box, T('Minuteur terminé', 'Timer done'));
    F.el('div', 'tm-ring-s', box, t.label);
    var stop = F.button(box, T('Arrêter', 'Stop'), null, 'btn-strong tm-stop', function () {
      w.clearInterval(box.beeper);
      if (box.parentNode) box.parentNode.removeChild(box);
      ringing = null;
    });
    stop.style.minWidth = '220px';
    beep();
    box.beeper = w.setInterval(beep, 1500);
    if (F.onUserActivity) F.onUserActivity();
  }

  var pill = null;
  function tickTimers() {
    var running = [];
    for (var i = TM.list.length - 1; i >= 0; i--) {
      var t = TM.list[i];
      if (!t.paused && t.end <= F.now()) {
        TM.list.splice(i, 1);
        storeTimers();
        ring(t);
      } else running.push(t);
    }
    if (!pill) {
      pill = F.el('div', 'tm-pill', doc.body);
      F.onTap(pill, function () { openTimers(); });
    }
    if (!running.length) {
      F.cls(pill, 'show', false);
    } else {
      running.sort(function (a, b) { return left(a) - left(b); });
      F.clear(pill);
      F.icon('timer-outline', '', pill);
      F.el('span', '', pill, fmtLeft(left(running[0])));
      F.cls(pill, 'show', true);
    }
    if (TM.render) TM.render();
  }
  w.setInterval(tickTimers, 1000);

  function openTimers() {
    var sheet = new F.Sheet(T('Minuteurs', 'Timers'), '', 'sheet-timers');
    var presets = F.el('div', 'tm-presets', sheet.body);
    var mins = [1, 3, 5, 10, 15, 20, 30, 45, 60, 90];
    for (var i = 0; i < mins.length; i++) {
      (function (m) {
        var b = F.el('div', 'tm-preset', presets);
        F.el('div', 'tm-preset-v', b, m < 60 ? String(m) : (m / 60) + (m % 60 ? '' : ''));
        F.el('div', 'tm-preset-u', b, m < 60 ? 'min' : (m === 60 ? T('heure', 'hour') : 'h 30'));
        if (m === 90) F.text(b.firstChild, '1');
        F.onTap(b, function () { addTimer(m); });
      }(mins[i]));
    }
    var list = F.el('div', 'tm-list', sheet.body);
    TM.render = function () {
      if (!list.parentNode || !sheet.back.parentNode) {
        TM.render = null;
        return;
      }
      F.clear(list);
      if (!TM.list.length) {
        F.el('div', 'sheet-empty', list, T('Touchez une durée pour lancer un minuteur.', 'Tap a duration to start a timer.'));
        return;
      }
      for (var k = 0; k < TM.list.length; k++) {
        (function (t) {
          var r = F.el('div', 'tm-item', list);
          F.el('div', 'tm-left', r, fmtLeft(left(t)));
          F.el('div', 'tm-label', r, t.label);
          var ctr = F.el('div', 'tm-ctr', r);
          F.button(ctr, '', t.paused ? 'play' : 'pause', 'mp-btn', function () {
            if (t.paused) {
              t.end = F.now() + t.left;
              t.paused = false;
            } else {
              t.left = left(t);
              t.paused = true;
            }
            storeTimers();
            TM.render();
          });
          F.button(ctr, '', 'close', 'mp-btn', function () {
            TM.list.splice(TM.list.indexOf(t), 1);
            storeTimers();
            tickTimers();
          });
        }(TM.list[k]));
      }
    };
    TM.render();
  }

  // ------------------------------------------------------------------ World Clock
  var CITIES = [
    ['Paris', 'Europe/Paris'], ['Londres|London', 'Europe/London'], ['New York', 'America/New_York'], ['Montréal|Montreal', 'America/Toronto'],
    ['Los Angeles', 'America/Los_Angeles'], ['Rio de Janeiro', 'America/Sao_Paulo'], ['Dubaï|Dubai', 'Asia/Dubai'], ['Shanghai', 'Asia/Shanghai'],
    ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney']
  ];
  /** The wall-clock time in a time zone, as a UTC timestamp (to compare with the time here). */
  function wallIn(tz, d) {
    try {
      var f = new w.Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false });
      if (!f.formatToParts) return null;
      var ps = f.formatToParts(d);
      var o = {};
      for (var i = 0; i < ps.length; i++) o[ps[i].type] = parseInt(ps[i].value, 10);
      if (o.hour === 24) o.hour = 0;
      return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute);
    } catch (e) {
      return null;
    }
  }
  function tzTime(tz, d) {
    try {
      return new w.Intl.DateTimeFormat(F.lang === 'en' ? 'en-US' : 'fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: F.lang === 'en' }).format(d);
    } catch (e) {
      return null;
    }
  }
  /** "Today, +6 h", "Tomorrow, +9 h", like the Clock app. */
  function dayLine(tz, now) {
    var there = wallIn(tz, now);
    if (there === null) return '';
    var here = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    var mins = Math.round((there - here) / 60000);
    var days = Math.floor(there / 86400000) - Math.floor(here / 86400000);
    var day = days > 0 ? T('Demain', 'Tomorrow') : (days < 0 ? T('Hier', 'Yesterday') : T('Aujourd\'hui', 'Today'));
    if (!mins) return day;
    var a = Math.abs(mins);
    var h = Math.floor(a / 60) + ' h' + (a % 60 ? ' ' + F.pad2(a % 60) : '');
    return day + ', ' + (mins > 0 ? '+' : '−') + h;
  }
  function openWorldClock() {
    var sheet = new F.Sheet(T('Horloge mondiale', 'World Clock'), '', 'sheet-world');
    var list = F.el('div', 'wc-list', sheet.body);
    function render() {
      F.clear(list);
      var now = new Date();
      for (var i = 0; i < CITIES.length; i++) {
        var c = CITIES[i];
        var name = c[0].split('|');
        var t = tzTime(c[1], now);
        if (!t) continue;
        var r = F.el('div', 'wc-item', list);
        var city = F.el('div', 'wc-city', r);
        F.el('div', 'wc-name', city, F.lang === 'en' && name[1] ? name[1] : name[0]);
        F.el('div', 'wc-day', city, dayLine(c[1], now));
        F.el('div', 'wc-time', r, t);
      }
    }
    render();
    sheet.every(15000, render);
  }
}(window));
