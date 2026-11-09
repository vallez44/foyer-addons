/* Foyer: small helpers for old and new Safari alike (ES5, no build step). */
(function (w) {
  'use strict';
  var F = w.F = {};
  var doc = w.document;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // ------------------------------------------------------------------ DOM
  F.el = function (tag, cls, parent, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.appendChild(doc.createTextNode(String(text)));
    if (parent) parent.appendChild(e);
    return e;
  };
  F.text = function (e, s) {
    s = s === undefined || s === null ? '' : String(s);
    if (e.firstChild && e.firstChild.nodeType === 3 && !e.firstChild.nextSibling) {
      if (e.firstChild.nodeValue !== s) e.firstChild.nodeValue = s;
    } else {
      while (e.firstChild) e.removeChild(e.firstChild);
      e.appendChild(doc.createTextNode(s));
    }
    return e;
  };
  F.clear = function (e) {
    while (e && e.firstChild) e.removeChild(e.firstChild);
    return e;
  };
  F.hasClass = function (e, c) {
    return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0;
  };
  F.cls = function (e, c, on) {
    var has = F.hasClass(e, c);
    if (on && !has) e.className = (e.className ? e.className + ' ' : '') + c;
    else if (!on && has) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  };
  F.css = function (e, props) {
    for (var k in props) {
      if (props.hasOwnProperty(k)) e.style[k] = props[k];
    }
  };
  F.transform = function (e, t) {
    e.style.webkitTransform = t;
    e.style.transform = t;
  };
  F.svg = function (tag, attrs, parent) {
    var e = doc.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  };
  F.icon = function (name, cls, parent) {
    var key = String(name || '').replace(/^mdi:/, '');
    var d = (w.FOYER_ICONS || {})[key] || (w.FOYER_ICONS || {}).home;
    var s = F.svg('svg', { viewBox: '0 0 24 24', 'class': 'ic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    F.svg('path', { d: d }, s);
    if (parent) parent.appendChild(s);
    return s;
  };
  F.hasIcon = function (name) {
    return Boolean((w.FOYER_ICONS || {})[String(name || '').replace(/^mdi:/, '')]);
  };
  F.setIcon = function (svgEl, name) {
    var key = String(name || '').replace(/^mdi:/, '');
    var d = (w.FOYER_ICONS || {})[key] || (w.FOYER_ICONS || {}).home;
    var p = svgEl.firstChild;
    if (p && p.getAttribute('d') !== d) p.setAttribute('d', d);
  };

  // ------------------------------------------------------------------ timing
  var rafImpl = w.requestAnimationFrame || w.webkitRequestAnimationFrame;
  F.raf = function (cb) { return rafImpl ? rafImpl.call(w, cb) : w.setTimeout(cb, 16); };
  F.now = function () { return new Date().getTime(); };
  F.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  F.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  F.round = function (v, step) { step = step || 1; return Math.round(v / step) * step; };

  // ------------------------------------------------------------------ network (XHR: works back to iOS 3)
  F.xhr = function (method, url, body, cb, timeoutMs) {
    var x = new w.XMLHttpRequest();
    var done = false;
    var timer = null;
    function finish(status, data) {
      if (done) return;
      done = true;
      if (timer) w.clearTimeout(timer);
      if (cb) cb(status, data);
    }
    x.open(method, url, true);
    x.setRequestHeader('X-Foyer', '1');
    if (body !== null && body !== undefined && !(w.Blob && body instanceof w.Blob)) {
      x.setRequestHeader('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var data = null;
      try { data = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) { data = null; }
      finish(x.status, data);
    };
    if (timeoutMs) {
      timer = w.setTimeout(function () {
        try { x.abort(); } catch (e) { /* ignore */ }
        finish(0, null);
      }, timeoutMs);
    }
    try {
      x.send(body === undefined ? null : body);
    } catch (e) {
      finish(0, null);
    }
    return x;
  };

  // ------------------------------------------------------------------ words
  var FR = {
    on: 'Allumé', off: 'Éteint', on_f: 'Allumée', off_f: 'Éteinte', open: 'Ouvert', closed: 'Fermé', open_f: 'Ouverte', closed_f: 'Fermée',
    opening: 'Ouverture…', closing: 'Fermeture…', locked: 'Verrouillée', unlocked: 'Déverrouillée', locking: 'Verrouillage…', unlocking: 'Déverrouillage…',
    jammed: 'Bloquée', unavailable: 'Indisponible', unknown: '—', playing: 'Lecture', paused: 'En pause', idle: 'Inactif', standby: 'Veille',
    disarmed: 'Désarmée', armed_home: 'Armée (présence)', armed_away: 'Armée (absence)', armed_night: 'Armée (nuit)', armed_vacation: 'Armée (vacances)',
    armed_custom_bypass: 'Armée', arming: 'Armement…', pending: 'En attente…', triggered: 'Déclenchée', disarming: 'Désarmement…',
    heat: 'Chauffage', cool: 'Climatisation', auto: 'Auto', heat_cool: 'Auto', dry: 'Déshumidification', fan_only: 'Ventilation', heating: 'Chauffe', cooling: 'Refroidit',
    scene: 'Scène', script: 'Script', button: 'Bouton', home: 'Présent', not_home: 'Absent', motion: 'Mouvement', clear: 'Rien', detected: 'Détecté',
    cleaning: 'Nettoyage', docked: 'À la base', returning: 'Retour…',
    thermostat: 'Thermostat', temperature: 'Température', inside: 'Intérieur', outside: 'Extérieur', all_off: 'Tout éteindre', lights_off: 'Lumières éteintes',
    lights_on_1: '1 lumière allumée', lights_on_n: '{n} lumières allumées', all_quiet: 'Tout est calme', doors_open_1: '1 ouverture', doors_open_n: '{n} ouvertures',
    up_next: 'À venir', no_events: 'Rien de prévu', no_calendar: 'Aucun agenda', today: "Aujourd'hui", tomorrow: 'Demain', all_day: 'Toute la journée',
    sunrise: 'Lever du soleil', sunset: 'Coucher du soleil', sunrise_s: 'Lever', sunset_s: 'Coucher', wind: 'Vent', humidity: 'Humidité', feels: 'Ressenti',
    weather_unavailable: 'Météo indisponible', add_photo: 'Ajoutez des photos dans Réglages', no_cameras: 'Aucune caméra dans Home Assistant',
    no_speaker: 'Aucune enceinte', nothing_playing: 'Rien en lecture', play: 'Lecture', pause: 'Pause', house: 'Maison', rooms: 'Pièces',
    turn_on: 'Allumer', turn_off: 'Éteindre', lock: 'Verrouiller', unlock: 'Déverrouiller', open_cmd: 'Ouvrir', close_cmd: 'Fermer', stop: 'Stop',
    arm_home: 'Présence', arm_away: 'Absence', arm_night: 'Nuit', disarm: 'Désarmer', code: 'Code', confirm_unlock: 'Déverrouiller {name} ?',
    confirm_open: 'Ouvrir {name} ?', cancel: 'Annuler', since: 'depuis {t}', brightness: 'Luminosité', volume: 'Volume', speaker: 'Enceinte',
    position: 'Position', speed: 'Vitesse', mode: 'Mode', target: 'Consigne', current: 'Actuelle', settings: 'Réglages', full_screen: 'Plein écran sur cet iPad',
    refresh: 'Actualiser', screen: 'Écran', not_connected: 'Home Assistant ne répond pas', reconnecting: 'Reconnexion…', demo_line: 'Maison de démonstration',
    pair_title: 'Associer cet écran', pair_text: 'Tapez le code affiché dans Home Assistant (Foyer → Réglages → iPad) ou dans le journal de l\'add-on.',
    pair_button: 'Associer', pair_wrong: 'Code incorrect', pair_wait: 'Trop d\'essais. Réessayez dans {n} s.', pair_ok: 'Écran associé',
    a2hs_title: 'Ajoutez Foyer à l\'écran d\'accueil', a2hs_text: 'Touchez Partager, puis « Sur l\'écran d\'accueil », puis Ajouter. Ouvrez Foyer depuis sa nouvelle icône : il se configurera tout seul.',
    a2hs_safari: 'Continuer dans Safari', ask_admin: 'Demandez à la personne qui a installé Foyer.', list_empty: 'Liste vide', lists: 'Listes',
    controls: 'Commandes', dim: 'Assombrir', events_week: 'Cette semaine', pick_speaker: 'Choisir l\'enceinte', degrees: '°', more: 'Plus',
    hourly: 'Prochaines heures', daily: 'Prochains jours', low: 'Min', high: 'Max', no_devices: 'Aucun appareil', error: 'Action refusée', on_s: 'allumé', on_fs: 'allumée'
  };
  var EN = {
    on: 'On', off: 'Off', on_f: 'On', off_f: 'Off', open: 'Open', closed: 'Closed', open_f: 'Open', closed_f: 'Closed', opening: 'Opening…', closing: 'Closing…',
    locked: 'Locked', unlocked: 'Unlocked', locking: 'Locking…', unlocking: 'Unlocking…', jammed: 'Jammed', unavailable: 'Unavailable', unknown: '—',
    playing: 'Playing', paused: 'Paused', idle: 'Idle', standby: 'Standby', disarmed: 'Disarmed', armed_home: 'Armed home', armed_away: 'Armed away',
    armed_night: 'Armed night', armed_vacation: 'Armed vacation', armed_custom_bypass: 'Armed', arming: 'Arming…', pending: 'Pending…', triggered: 'Triggered',
    disarming: 'Disarming…', heat: 'Heat', cool: 'Cool', auto: 'Auto', heat_cool: 'Auto', dry: 'Dry', fan_only: 'Fan', heating: 'Heating', cooling: 'Cooling',
    scene: 'Scene', script: 'Script', button: 'Button', home: 'Home', not_home: 'Away', motion: 'Motion', clear: 'Clear', detected: 'Detected',
    cleaning: 'Cleaning', docked: 'Docked', returning: 'Returning…', thermostat: 'Thermostat', temperature: 'Temperature', inside: 'Inside', outside: 'Outside',
    all_off: 'All Off', lights_off: 'Lights off', lights_on_1: '1 light on', lights_on_n: '{n} lights on', all_quiet: 'All quiet', doors_open_1: '1 open',
    doors_open_n: '{n} open', up_next: 'Up Next', no_events: 'Nothing planned', no_calendar: 'No Calendar', today: 'Today', tomorrow: 'Tomorrow',
    all_day: 'All day', sunrise: 'Sunrise', sunset: 'Sunset', sunrise_s: 'Sunrise', sunset_s: 'Sunset', wind: 'Wind', humidity: 'Humidity', feels: 'Feels like',
    weather_unavailable: 'Weather Unavailable', add_photo: 'Add photos in Settings', no_cameras: 'No cameras in Home Assistant', no_speaker: 'No speakers',
    nothing_playing: 'Nothing playing', play: 'Play', pause: 'Pause', house: 'Home', rooms: 'Rooms', turn_on: 'Turn On', turn_off: 'Turn Off', lock: 'Lock',
    unlock: 'Unlock', open_cmd: 'Open', close_cmd: 'Close', stop: 'Stop', arm_home: 'Home', arm_away: 'Away', arm_night: 'Night', disarm: 'Disarm', code: 'Code',
    confirm_unlock: 'Unlock {name}?', confirm_open: 'Open {name}?', cancel: 'Cancel', since: 'since {t}', brightness: 'Brightness', volume: 'Volume',
    speaker: 'Speaker', position: 'Position', speed: 'Speed', mode: 'Mode', target: 'Target', current: 'Current', settings: 'Settings',
    full_screen: 'Full screen on this iPad', refresh: 'Refresh', screen: 'Screen', not_connected: 'Home Assistant is not answering', reconnecting: 'Reconnecting…',
    demo_line: 'Sample home', pair_title: 'Pair this screen', pair_text: 'Type the code shown in Home Assistant (Foyer → Settings → iPads) or in the add-on log.',
    pair_button: 'Pair', pair_wrong: 'Wrong code', pair_wait: 'Too many tries. Try again in {n} s.', pair_ok: 'Paired',
    a2hs_title: 'Add Foyer to your Home Screen', a2hs_text: 'Tap Share, then Add to Home Screen, then Add. Open Foyer from its new icon: it sets itself up.',
    a2hs_safari: 'Continue in Safari', ask_admin: 'Ask the person who set up Foyer.', list_empty: 'Empty list', lists: 'Lists', controls: 'Controls', dim: 'Dim',
    events_week: 'This week', pick_speaker: 'Choose speaker', degrees: '°', more: 'More', hourly: 'Next hours', daily: 'Next days', low: 'L', high: 'H',
    no_devices: 'No devices', error: 'Refused', on_s: 'on', on_fs: 'on'
  };
  var DAYS = { fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
  var MONTHS = {
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  F.lang = 'fr';
  F.t = function (key, vars) {
    var dict = F.lang === 'en' ? EN : FR;
    var s = dict[key] !== undefined ? dict[key] : (FR[key] !== undefined ? FR[key] : key);
    if (vars) {
      for (var k in vars) {
        if (vars.hasOwnProperty(k)) s = s.replace('{' + k + '}', vars[k]);
      }
    }
    return s;
  };
  F.cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  F.dayName = function (d, short) {
    var n = DAYS[F.lang === 'en' ? 'en' : 'fr'][d.getDay()];
    if (!short) return n;
    return F.lang === 'en' ? n.slice(0, 3) : n.slice(0, 3) + '.';
  };
  var MONTHS_SHORT_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  F.monthName = function (d, short) {
    var n = MONTHS[F.lang === 'en' ? 'en' : 'fr'][d.getMonth()];
    if (!short) return n;
    return F.lang === 'en' ? n.slice(0, 3) : MONTHS_SHORT_FR[d.getMonth()];
  };
  F.dayLetters = function () {
    return F.lang === 'en' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  };
  F.weekStartsMonday = function () { return F.lang !== 'en'; };

  /** 24 h in French, 12 h in English. */
  F.time = function (d, withAmPm) {
    var h = d.getHours();
    var m = F.pad2(d.getMinutes());
    if (F.lang === 'en') {
      var ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return h + ':' + m + (withAmPm === false ? '' : ' ' + ap);
    }
    return F.pad2(h) + ':' + m;
  };
  F.clockText = function (d) {
    if (F.lang === 'en') return (d.getHours() % 12 || 12) + ':' + F.pad2(d.getMinutes());
    return d.getHours() + ':' + F.pad2(d.getMinutes());
  };
  F.parseDate = function (s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var p = s.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]);
    }
    var t = Date.parse(s);
    if (isNaN(t)) {
      // Old Safari cannot parse ISO with offsets.
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
      if (!m) return null;
      t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
      if (m[7] && m[7] !== 'Z') {
        var sign = m[7].charAt(0) === '-' ? -1 : 1;
        var hm = m[7].replace(/[+-:]/g, '');
        t -= sign * (parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(2), 10)) * 60000;
      } else if (!m[7]) {
        t += new Date().getTimezoneOffset() * 60000;
      }
    }
    return new Date(t);
  };
  F.sameDay = function (a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };
  F.dayStart = function (d) {
    var x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  };
  F.num = function (v, digits) {
    var n = parseFloat(v);
    if (isNaN(n)) return '—';
    var s = digits ? n.toFixed(digits) : String(Math.round(n));
    return F.lang === 'fr' ? s.replace('.', ',') : s;
  };
  F.temp = function (v) {
    var n = parseFloat(v);
    if (isNaN(n)) return '—';
    return String(Math.round(n)) + '°';
  };
  F.tempPrecise = function (v) {
    var n = parseFloat(v);
    if (isNaN(n)) return '—';
    var r = Math.round(n * 2) / 2;
    return (r % 1 === 0 ? String(r) : F.num(r, 1)) + '°';
  };

  // ------------------------------------------------------------------ weather words and icons
  var WEATHER = {
    'clear-night': ['weather-night', 'Nuit claire', 'Clear'], cloudy: ['weather-cloudy', 'Nuageux', 'Cloudy'], exceptional: ['alert-circle', 'Exceptionnel', 'Exceptional'],
    fog: ['weather-fog', 'Brouillard', 'Fog'], hail: ['weather-hail', 'Grêle', 'Hail'], lightning: ['weather-lightning', 'Orages', 'Thunderstorms'],
    'lightning-rainy': ['weather-lightning-rainy', 'Orages et pluie', 'Thunderstorms'], partlycloudy: ['weather-partly-cloudy', 'Partiellement nuageux', 'Partly Cloudy'],
    pouring: ['weather-pouring', 'Averses', 'Pouring'], rainy: ['weather-rainy', 'Pluie', 'Rain'], snowy: ['weather-snowy', 'Neige', 'Snow'],
    'snowy-rainy': ['weather-snowy-rainy', 'Pluie et neige', 'Sleet'], sunny: ['weather-sunny', 'Ensoleillé', 'Sunny'], windy: ['weather-windy', 'Venteux', 'Windy'],
    'windy-variant': ['weather-windy-variant', 'Venteux', 'Windy']
  };
  F.weatherIcon = function (c, night) {
    if (night && c === 'sunny') return 'weather-night';
    if (night && c === 'partlycloudy') return 'weather-night-partly-cloudy';
    return (WEATHER[c] || WEATHER.cloudy)[0];
  };
  F.weatherText = function (c) {
    var x = WEATHER[c];
    if (!x) return c ? F.cap(String(c)) : '';
    return F.lang === 'en' ? x[2] : x[1];
  };

  // ------------------------------------------------------------------ entities
  F.domain = function (id) { return String(id || '').split('.')[0]; };
  var FEMININE = { lock: 1, cover: 1, alarm_control_panel: 1 };
  F.isOff = function (s) { return s === 'off' || s === 'closed' || s === 'locked' || s === 'idle' || s === 'standby' || s === 'disarmed' || s === 'docked'; };

  F.isActive = function (id, e) {
    if (!e) return false;
    var d = F.domain(id);
    var s = e.s;
    if (d === 'light' || d === 'switch' || d === 'fan' || d === 'input_boolean' || d === 'humidifier' || d === 'automation') return s === 'on';
    if (d === 'media_player') return s === 'playing';
    if (d === 'cover' || d === 'valve') return s === 'open' || s === 'opening';
    if (d === 'climate') return s !== 'off' && s !== 'unavailable';
    if (d === 'vacuum') return s === 'cleaning';
    if (d === 'alarm_control_panel') return s.indexOf('armed') === 0;
    return false;
  };

  /** Red tiles: something is open or unlocked that you would want to know about from across the room. */
  F.isAlert = function (id, e) {
    if (!e) return false;
    var d = F.domain(id);
    var dc = e.at && e.at.device_class;
    if (d === 'lock') return e.s === 'unlocked' || e.s === 'jammed' || e.s === 'open';
    if (d === 'binary_sensor' && (dc === 'door' || dc === 'window' || dc === 'garage_door' || dc === 'opening' || dc === 'smoke' || dc === 'moisture' || dc === 'gas' || dc === 'carbon_monoxide')) return e.s === 'on';
    if (d === 'cover' && (dc === 'garage' || dc === 'gate' || dc === 'door')) return e.s === 'open' || e.s === 'opening';
    if (d === 'alarm_control_panel') return e.s === 'triggered';
    return false;
  };

  F.entityIcon = function (id, e) {
    var d = F.domain(id);
    var s = e ? e.s : '';
    var dc = e && e.at ? e.at.device_class : null;
    if (e && e.i && F.hasIcon(e.i) && !(d === 'lock' || d === 'cover' || d === 'binary_sensor')) return e.i;
    switch (d) {
      case 'light': return s === 'on' ? 'lightbulb-on' : 'lightbulb-outline';
      case 'switch': {
        var nm = String((e && (e.fn || e.n)) || id).toLowerCase();
        if (/guirlande|string|no[eë]l|christmas|led/.test(nm)) return 'string-lights';
        if (/lampe|lumi|light|lamp|applique|spot|plafonnier|suspension/.test(nm)) return s === 'on' ? 'lightbulb-on' : 'lightbulb-outline';
        if (/ventil|fan/.test(nm)) return s === 'on' ? 'fan' : 'fan-off';
        if (/t[ée]l[ée]|tv|television/.test(nm)) return 'television';
        if (/caf[ée]|coffee/.test(nm)) return 'coffee';
        return dc === 'outlet' ? 'power-socket-eu' : (s === 'on' ? 'toggle-switch-variant' : 'toggle-switch-variant-off');
      }
      case 'fan': return s === 'on' ? 'fan' : 'fan-off';
      case 'cover':
        if (dc === 'garage') return s === 'closed' ? 'garage' : 'garage-open';
        if (dc === 'gate') return s === 'closed' ? 'gate' : 'gate-open';
        if (dc === 'door') return s === 'closed' ? 'door-closed' : 'door-open';
        if (dc === 'blind' || dc === 'curtain') return s === 'closed' ? 'blinds' : 'blinds-open';
        return s === 'closed' ? 'window-shutter' : 'window-shutter-open';
      case 'lock': return s === 'locked' ? 'lock' : 'lock-open-variant';
      case 'climate': return 'thermostat';
      case 'media_player': return 'speaker';
      case 'scene': return e && e.i && F.hasIcon(e.i) ? e.i : 'creation';
      case 'script': return 'script-text';
      case 'input_boolean': return s === 'on' ? 'toggle-switch-variant' : 'toggle-switch-variant-off';
      case 'alarm_control_panel': return s === 'disarmed' ? 'shield-off-outline' : (s === 'armed_night' ? 'shield-moon' : 'shield-home');
      case 'binary_sensor':
        if (dc === 'door') return s === 'on' ? 'door-open' : 'door-closed';
        if (dc === 'garage_door') return s === 'on' ? 'garage-open' : 'garage';
        if (dc === 'window' || dc === 'opening') return s === 'on' ? 'window-open-variant' : 'window-closed-variant';
        if (dc === 'motion' || dc === 'occupancy' || dc === 'presence') return 'motion-sensor';
        if (dc === 'moisture') return 'water';
        if (dc === 'smoke' || dc === 'gas' || dc === 'carbon_monoxide') return 'fire';
        return 'alert-circle';
      case 'sensor':
        if (dc === 'temperature') return 'thermometer';
        if (dc === 'humidity') return 'water-percent';
        return 'gesture-tap';
      case 'camera': return 'cctv';
      case 'weather': return 'weather-partly-cloudy';
      case 'vacuum': return 'robot-vacuum';
      case 'button': case 'input_button': return 'button-pointer';
      case 'person': return 'account';
      case 'valve': return 'water';
      case 'humidifier': return 'air-purifier';
      default: return 'home';
    }
  };

  F.stateText = function (id, e) {
    if (!e) return '';
    var d = F.domain(id);
    var s = e.s;
    var at = e.at || {};
    var dc = at.device_class;
    if (s === 'unavailable') return F.t('unavailable');
    if (d === 'light') {
      if (s === 'on' && at.brightness) return Math.max(1, Math.round(at.brightness / 2.55)) + ' %';
      return F.t(s === 'on' ? 'on_f' : 'off_f');
    }
    if (d === 'switch' || d === 'input_boolean' || d === 'humidifier') return F.t(s === 'on' ? 'on' : 'off');
    if (d === 'fan') return s === 'on' && at.percentage ? at.percentage + ' %' : F.t(s === 'on' ? 'on' : 'off');
    if (d === 'cover') {
      if (s === 'open' && at.current_position !== undefined && at.current_position < 100 && at.current_position > 0) return at.current_position + ' %';
      var fem = dc === 'garage' || dc === 'door' || dc === 'gate';
      if (s === 'open' || s === 'closed') return F.t(s + (fem ? '_f' : ''));
      return F.t(s);
    }
    if (d === 'binary_sensor') {
      if (dc === 'door' || dc === 'window' || dc === 'garage_door' || dc === 'opening') return F.t(s === 'on' ? 'open_f' : 'closed_f');
      if (dc === 'motion' || dc === 'occupancy' || dc === 'presence') return F.t(s === 'on' ? 'detected' : 'clear');
      return F.t(s === 'on' ? 'detected' : 'clear');
    }
    if (d === 'sensor') return F.num(s, at.device_class === 'temperature' ? 1 : 0) + (at.unit_of_measurement ? ' ' + at.unit_of_measurement : '');
    if (d === 'scene') return F.t('scene');
    if (d === 'script') return F.t('script');
    if (d === 'button' || d === 'input_button') return F.t('button');
    if (d === 'climate') return F.t(s);
    if (d === 'media_player') return s === 'playing' && at.media_title ? at.media_title : F.t(s);
    return F.t(s);
  };

  F.areaIcon = function (area) {
    if (!area) return 'home';
    if (area.icon && F.hasIcon(area.icon)) return area.icon;
    var n = (area.name || '').toLowerCase();
    var map = [
      [/salon|séjour|sejour|living|lounge/, 'sofa'], [/cuisine|kitchen/, 'silverware-fork-knife'], [/chambre|bed|dodo/, 'bed'],
      [/bain|sdb|douche|bath|shower/, 'shower'], [/wc|toilet/, 'toilet'], [/entrée|entree|hall|couloir|entry/, 'door'], [/bureau|office|study/, 'desk'],
      [/garage/, 'garage'], [/jardin|garden|terrasse|balcon|extérieur|exterieur|patio/, 'tree'], [/enfant|bébé|bebe|kid|nursery/, 'teddy-bear'],
      [/cellier|buanderie|laundry/, 'washing-machine'], [/escalier|stairs/, 'stairs'], [/salle à manger|dining/, 'silverware-fork-knife']
    ];
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(n)) return map[i][1];
    }
    return 'home-outline';
  };

  // ------------------------------------------------------------------ misc
  F.isOldSafari = (function () {
    var m = /OS (\d+)_\d+/.exec(w.navigator.userAgent);
    return Boolean(m && parseInt(m[1], 10) < 11);
  }());
  F.isIOS = /iPad|iPhone|iPod/.test(w.navigator.userAgent) || (w.navigator.platform === 'MacIntel' && w.navigator.maxTouchPoints > 1);
  F.standalone = Boolean(w.navigator.standalone) || (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches);
  F.query = function (name) {
    var m = new RegExp('[?&#]' + name + '=([^&#]*)').exec(w.location.href);
    return m ? decodeURIComponent(m[1]) : null;
  };
}(window));
