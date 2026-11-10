/* Foyer: the alarm on the wall iPad. While the alarm arms, a countdown (and a way to cancel); when someone comes
   in, the keypad and the entry countdown; when it goes off, a full-screen warning and a siren from the iPad itself
   (Settings → Alarm turns the siren off once a real siren does the job). Any alarm panel of Home Assistant. ES5. */
(function (w) {
  'use strict';
  var F = w.F;
  var doc = w.document;
  function T(fr, en) { return F.lang === 'en' ? en : fr; }
  var AL = F.alarm = { el: null, id: null, mode: null, muted: null, hidden: null };

  // ------------------------------------------------------------------ sound (Safari plays it only after a first touch)
  var ctx = null;
  var siren = null;
  function unlock() {
    try {
      if (!ctx) {
        var C = w.AudioContext || w.webkitAudioContext;
        if (C) ctx = new C();
      }
      if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    } catch (e) { ctx = null; }
  }
  doc.addEventListener('touchstart', unlock, true);
  doc.addEventListener('mousedown', unlock, true);
  doc.addEventListener('keydown', unlock, true);

  function sirenOn() {
    if (siren || !ctx) return;
    try {
      var o = ctx.createOscillator();
      var lfo = ctx.createOscillator();
      var depth = ctx.createGain();
      var g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 980;
      lfo.type = 'triangle';
      lfo.frequency.value = 0.85;
      depth.gain.value = 420;
      lfo.connect(depth);
      depth.connect(o.frequency);
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.4);
      o.start();
      lfo.start();
      siren = { o: o, lfo: lfo, g: g };
    } catch (e) { siren = null; }
  }
  function sirenOff() {
    if (!siren) return;
    try {
      var t = ctx.currentTime;
      siren.g.gain.setTargetAtTime(0.0001, t, 0.05);
      siren.o.stop(t + 0.4);
      siren.lfo.stop(t + 0.4);
    } catch (e) { /* already stopped */ }
    siren = null;
  }
  function chirp() {
    if (!ctx) return;
    try {
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.frequency.value = 1320;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.start(t);
      o.stop(t + 0.15);
    } catch (e) { /* no sound */ }
  }

  // ------------------------------------------------------------------ which alarm needs the screen
  var RANK = { triggered: 3, pending: 2, arming: 1 };
  function active() {
    var best = null;
    var ids = F.entitiesOf('alarm_control_panel');
    for (var i = 0; i < ids.length; i++) {
      var e = F.e(ids[i]);
      if (e && RANK[e.s] && (!best || RANK[e.s] > RANK[F.e(best).s])) best = ids[i];
    }
    return best;
  }
  /** Seconds left in the exit or entry delay, when the panel says (Alarmo does). */
  function secondsLeft(e) {
    var d = e && e.at && +e.at.delay;
    if (!d || !e.lc) return null;
    return Math.max(0, Math.ceil((e.lc + d * 1000 - F.now()) / 1000));
  }
  function clock(s) {
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function modeName(e) {
    var m = (e.at && (e.at.next_state || e.at.arm_mode)) || '';
    if (/away/.test(m)) return T('mode absent', 'away');
    if (/home/.test(m)) return T('mode présent', 'home');
    if (/night/.test(m)) return T('mode nuit', 'night');
    if (/vacation/.test(m)) return T('mode vacances', 'vacation');
    return '';
  }

  function disarm(id, code) {
    F.call(id, 'alarm_disarm', code ? { code: code } : {});
  }

  // ------------------------------------------------------------------ the screen
  function close() {
    if (AL.el && AL.el.parentNode) AL.el.parentNode.removeChild(AL.el);
    AL.el = null;
    AL.id = null;
    AL.mode = null;
    sirenOff();
  }

  function build(id, e) {
    close();
    AL.id = id;
    AL.mode = e.s;
    var full = e.s !== 'arming';
    var root = AL.el = F.el('div', 'al al-' + e.s + (full ? ' al-full' : ''), doc.body);
    var card = F.el('div', 'al-card', root);
    var head = F.el('div', 'al-head', card);
    F.icon(e.s === 'triggered' ? 'alarm-light' : (e.s === 'pending' ? 'shield-alert' : 'shield-lock'), 'al-ic', head);
    var txt = F.el('div', 'al-txt', head);
    F.el('div', 'al-title', txt, e.s === 'triggered' ? T('Alarme déclenchée', 'Alarm triggered')
      : (e.s === 'pending' ? T('Entrée détectée', 'Entry detected') : T('Armement de l\'alarme', 'Arming the alarm')));
    AL.subEl = F.el('div', 'al-sub', txt, '');
    AL.countEl = F.el('div', 'al-count', card, '');
    var needsCode = Boolean(e.at && e.at.code_format);
    if (e.s === 'arming') {
      var row = F.el('div', 'btn-row', card);
      F.button(row, T('Annuler', 'Cancel'), 'close', '', function () {
        if (needsCode) {
          AL.hidden = null;
          build(id, F.e(id));
          showPad(id);
        } else disarm(id);
      });
      F.button(row, T('Masquer', 'Hide'), 'chevron-down', '', function () {
        AL.hidden = id + ':' + e.lc;
        close();
      });
    } else {
      if (needsCode) F.keypad(card, function (code) { disarm(id, code); }, T('Code de l\'alarme', 'Alarm code'));
      else {
        var r2 = F.el('div', 'btn-row', card);
        F.button(r2, T('Désarmer', 'Disarm'), 'shield-off-outline', 'btn-strong', function () { disarm(id); });
      }
      if (e.s === 'triggered') {
        var r3 = F.el('div', 'btn-row al-mute', card);
        AL.muteBtn = F.button(r3, T('Couper le son sur cet écran', 'Silence this screen'), 'volume-off', '', function () {
          AL.muted = id + ':' + F.e(id).lc;
          sirenOff();
          F.cls(AL.muteBtn, 'hidden', true);
        });
      }
    }
    refresh();
    w.setTimeout(function () { F.cls(root, 'show', true); }, 10);
  }
  function showPad(id) {
    if (!AL.el) return;
    var card = AL.el.querySelector('.al-card');
    if (card.querySelector('.keypad')) return;
    F.keypad(card, function (code) { disarm(id, code); }, T('Code pour annuler', 'Code to cancel'));
  }

  function refresh() {
    if (!AL.id) return;
    var e = F.e(AL.id);
    if (!e) return;
    var left = secondsLeft(e);
    var name = e.n + (modeName(e) ? ' · ' + modeName(e) : '');
    F.text(AL.subEl, name);
    F.text(AL.countEl, left === null ? '' : clock(left));
    if (e.s === 'triggered') {
      var wantSiren = F.settings().alarmSiren !== false && AL.muted !== AL.id + ':' + e.lc;
      if (wantSiren) sirenOn(); else sirenOff();
    } else if (e.s === 'pending' && left !== null && left > 0) {
      chirp();
    }
  }

  function update() {
    var id = active();
    var e = id ? F.e(id) : null;
    if (!e) {
      if (AL.el) close();
      return;
    }
    if (e.s === 'arming' && AL.hidden === id + ':' + e.lc) {
      if (AL.el) close();
      return;
    }
    if (AL.id !== id || AL.mode !== e.s) {
      build(id, e);
      // Someone at the door or a break-in: wake the screen.
      if (e.s !== 'arming' && F.onUserActivity) F.onUserActivity();
    } else refresh();
  }

  F.onChange(function (changed, blocks, full) {
    if (full || blocks.settings) {
      update();
      return;
    }
    for (var id in changed) {
      if (changed.hasOwnProperty(id) && id.indexOf('alarm_control_panel.') === 0) {
        update();
        return;
      }
    }
  });
  w.setInterval(function () { if (AL.id) refresh(); }, 1000);
}(window));
