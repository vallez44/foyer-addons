/* Foyer: settings, opened from Home Assistant's sidebar (or by the admin iPad in standalone). */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') e[k] = Boolean(v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', (window.FOYER_ICONS || {})[name] || '');
  svg.append(p);
  return svg;
}

async function api(method, path, body, rawType) {
  const headers = { 'X-Foyer': '1' };
  let payload;
  if (rawType) {
    headers['Content-Type'] = rawType;
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const r = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

let toastTimer;
function toast(msg = 'Enregistré', err = false) {
  const t = $('#saved');
  t.textContent = msg;
  t.classList.toggle('err', err);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ------------------------------------------------------------------ state
const S = { settings: null, suggested: {}, photos: { items: [] }, access: null };
const C = { areas: [], entities: [], byId: new Map(), home: {} };
let layoutFace = 'home_plus';

const FACES = {
  photos: ['Photos', "Vos photos, avec l'heure derrière les personnes."],
  home_plus: ['Maison Modulaire Plus', "Le thermostat, l'heure, la météo, l'agenda, la caméra et vos scènes sur un seul écran."],
  analog: ['Analogique', "Une horloge lisible depuis l'autre bout de la pièce."],
  home: ['Maison Modulaire', 'Lumières, serrures, thermostat et scènes en grandes tuiles. Une touche chacune.'],
  flow: ['Flux', 'Un cadran calme pour la nuit : chaque forme est une pièce et brille quand ses lumières sont allumées.'],
  modular: ['Modulaire', 'La date, le mois, la musique, le soleil, une horloge et la météo dans une grille.'],
  weather: ['Météo', "Aujourd'hui en un grand chiffre, avec le lever du soleil, le vent et l'humidité."],
  calendar: ['Calendrier', "Cette semaine, et ce qui est prévu aujourd'hui."],
  clock: ['Horloge', "L'heure, aussi grande que l'écran le permet."],
  cameras: ['Caméras', 'Vos caméras côte à côte.'],
};

const TILE_TYPES = [
  ['entity', 'Appareil'], ['thermostat', 'Thermostat'], ['clock', 'Horloge'], ['weather', 'Météo'], ['photo', 'Photo'],
  ['agenda', 'À venir (agenda)'], ['camera', 'Caméra'], ['room', 'Pièce'], ['house', 'Maison (résumé)'], ['action', 'Tout éteindre'],
  ['media', 'Musique en cours'], ['date', 'Date'], ['sun', 'Soleil'], ['todo', 'Liste'], ['sensor', 'Capteur'],
];
const TYPE_LABEL = Object.fromEntries(TILE_TYPES);
const DOMAIN_LABEL = {
  light: 'Lumières', switch: 'Interrupteurs', fan: 'Ventilateurs', cover: 'Volets et portes', lock: 'Serrures', climate: 'Thermostats',
  media_player: 'Enceintes et TV', scene: 'Scènes', script: 'Scripts', input_boolean: 'Interrupteurs virtuels', alarm_control_panel: 'Alarmes',
  binary_sensor: 'Détecteurs', sensor: 'Capteurs', camera: 'Caméras', vacuum: 'Aspirateurs', button: 'Boutons', input_button: 'Boutons',
  valve: 'Vannes', humidifier: 'Humidificateurs', water_heater: 'Chauffe-eau', person: 'Personnes', weather: 'Météo', todo: 'Listes',
};
const TARGET_DOMAINS = {
  entity: ['light', 'switch', 'fan', 'cover', 'lock', 'climate', 'media_player', 'scene', 'script', 'input_boolean', 'alarm_control_panel',
    'binary_sensor', 'sensor', 'camera', 'vacuum', 'button', 'input_button', 'valve', 'humidifier', 'water_heater', 'person'],
  thermostat: ['climate', 'sensor'],
  weather: ['weather'],
  camera: ['camera'],
  media: ['media_player'],
  todo: ['todo'],
  sensor: ['sensor', 'binary_sensor'],
};
const WALLPAPERS = {
  amber: 'linear-gradient(152deg, #ffc04a, #ef7a14 60%, #dc5410)', ocean: 'linear-gradient(152deg, #7dd6ff, #2774d8 60%, #1c4fb0)',
  lavender: 'linear-gradient(152deg, #d6c8ff, #8a6ce2 60%, #6546c6)', sage: 'linear-gradient(152deg, #cdeac0, #66a682 60%, #3f8064)',
  graphite: 'linear-gradient(152deg, #66666c, #333338 60%, #1d1d21)',
};

const areaName = (id) => (C.areas.find((a) => a.id === id) || {}).name || '';
const entityLabel = (id) => {
  const e = C.byId.get(id);
  if (!e) return id;
  const a = areaName(e.area);
  return a ? `${e.name} · ${a}` : e.name;
};

// ------------------------------------------------------------------ saving
let pending = {};
let saveTimer;
function save(partial, now = false) {
  pending = deepMerge(pending, partial);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, now ? 0 : 350);
}
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
  }
  return out;
}
async function flush() {
  const body = pending;
  pending = {};
  try {
    const r = await api('PUT', 'api/admin/settings', body);
    S.settings = r.settings;
    if ('layouts' in body || 'thermostatEntity' in body || 'weatherEntity' in body || 'calendars' in body) await reload(false);
    toast();
  } catch (e) {
    toast(`Erreur : ${e.message}`, true);
  }
}

async function reload(all = true) {
  const r = await api('GET', 'api/admin/settings');
  Object.assign(S, r);
  if (all) {
    const cat = await api('GET', 'api/admin/catalog');
    C.areas = cat.areas;
    C.entities = cat.entities;
    C.byId = new Map(cat.entities.map((e) => [e.id, e]));
    C.home = cat.home || {};
  }
}

// ------------------------------------------------------------------ faces
function renderFaces() {
  const list = $('#faces-list');
  list.replaceChildren();
  const faces = S.settings.faces;
  faces.forEach((f, i) => {
    const [name, desc] = FACES[f.id] || [f.id, ''];
    const isStart = S.settings.startFace === f.id;
    list.append(h('div', { class: 'row' },
      h('button', {
        class: `icon-btn star${isStart ? ' on' : ''}`, title: 'Cadran de départ',
        onclick: () => { save({ startFace: f.id, faces: faces.map((x) => (x.id === f.id ? { ...x, on: true } : x)) }); S.settings.startFace = f.id; f.on = true; renderFaces(); },
      }, icon(isStart ? 'star' : 'star-outline')),
      h('div', { class: 'grow' }, h('div', { class: 'name', text: name }), h('div', { class: 'desc', text: desc })),
      h('a', { class: 'btn small quiet', href: `./?face=${f.id}`, target: '_blank', text: 'Aperçu' }),
      h('button', { class: 'icon-btn', disabled: i === 0, title: 'Monter', onclick: () => moveFace(i, -1) }, icon('chevron-up')),
      h('button', { class: 'icon-btn', disabled: i === faces.length - 1, title: 'Descendre', onclick: () => moveFace(i, 1) }, icon('chevron-down')),
      h('label', { class: 'switch' },
        h('input', {
          type: 'checkbox', checked: f.on,
          onchange: (ev) => {
            const next = faces.map((x) => (x.id === f.id ? { ...x, on: ev.target.checked } : x));
            if (!next.some((x) => x.on)) { ev.target.checked = true; return; }
            S.settings.faces = next;
            save({ faces: next });
          },
        }), h('span')),
    ));
  });
}
function moveFace(i, d) {
  const faces = S.settings.faces.slice();
  const j = i + d;
  [faces[i], faces[j]] = [faces[j], faces[i]];
  S.settings.faces = faces;
  save({ faces });
  renderFaces();
}

// ------------------------------------------------------------------ layout editor
function currentTiles() {
  const custom = S.settings.layouts[layoutFace];
  return Array.isArray(custom) ? custom : (S.suggested[layoutFace] || []);
}
function isAuto() { return !Array.isArray(S.settings.layouts[layoutFace]); }

function tileTitle(t) {
  if (t.name) return t.name;
  if (t.entity) return (C.byId.get(t.entity) || {}).name || t.entity;
  if (t.area) return areaName(t.area) || t.area;
  return TYPE_LABEL[t.type] || t.type;
}

function renderPreview() {
  const box = $('#layout-preview');
  box.replaceChildren();
  const [cols, rows] = window.FOYER_LAYOUT.gridFor(layoutFace, true);
  const tiles = currentTiles();
  const placed = window.FOYER_LAYOUT.place(tiles, cols, rows);
  const gap = 1.2;
  const cw = (100 - gap * (cols - 1)) / cols;
  const ch = (100 - gap * (rows - 1)) / rows;
  for (const p of placed) {
    const t = p.tile;
    const light = t.type === 'thermostat';
    const el = h('div', { class: `pv-tile${light ? ' light' : ''}` },
      tileTitle(t), h('small', { text: t.type === 'entity' ? areaName((C.byId.get(t.entity) || {}).area) : TYPE_LABEL[t.type] }));
    Object.assign(el.style, {
      left: `${p.x * (cw + gap)}%`, top: `${p.y * (ch + gap)}%`,
      width: `${p.w * cw + (p.w - 1) * gap}%`, height: `${p.h * ch + (p.h - 1) * gap}%`,
    });
    box.append(el);
  }
  const dropped = tiles.length - placed.length;
  $('#layout-dropped').textContent = dropped > 0
    ? `${dropped} tuile${dropped > 1 ? 's' : ''} ne tien${dropped > 1 ? 'nent' : 't'} pas sur l'écran (en mode paysage) et ${dropped > 1 ? 'sont masquées' : 'est masquée'}.`
    : '';
}

function targetSelect(t, onChange) {
  if (t.type === 'room') {
    return h('select', { class: 'target', onchange: (ev) => onChange({ area: ev.target.value }) },
      C.areas.map((a) => h('option', { value: a.id, selected: a.id === t.area, text: a.name })));
  }
  const domains = TARGET_DOMAINS[t.type];
  if (!domains) return h('span', { class: 'target desc', text: '—' });
  const sel = h('select', { class: 'target', onchange: (ev) => onChange({ entity: ev.target.value || undefined }) });
  if (['thermostat', 'weather', 'media', 'todo'].includes(t.type)) sel.append(h('option', { value: '', text: 'Automatique', selected: !t.entity }));
  for (const d of domains) {
    const list = C.entities.filter((e) => e.domain === d && (t.type !== 'thermostat' || d === 'climate' || e.dc === 'temperature'));
    if (!list.length) continue;
    sel.append(h('optgroup', { label: DOMAIN_LABEL[d] || d },
      list.map((e) => h('option', { value: e.id, selected: e.id === t.entity, text: entityLabel(e.id) }))));
  }
  return sel;
}

function renderLayout() {
  $$('#layout-face button').forEach((b) => b.classList.toggle('sel', b.dataset.face === layoutFace));
  const auto = isAuto();
  $('#layout-mode-text').textContent = auto
    ? 'Suggestion automatique, faite à partir de vos pièces et appareils.'
    : 'Disposition personnalisée.';
  $('#layout-customize').hidden = !auto;
  $('#layout-reset').hidden = auto;
  $('#layout-add').hidden = auto;
  renderPreview();
  const list = $('#layout-list');
  list.replaceChildren();
  const tiles = currentTiles();
  tiles.forEach((t, i) => {
    if (auto) {
      list.append(h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', { class: 'name', text: tileTitle(t) }),
          h('div', { class: 'desc', text: `${TYPE_LABEL[t.type] || t.type} · ${window.FOYER_LAYOUT.SIZE_NAMES[t.size] || t.size}` }))));
      return;
    }
    const update = (patch) => {
      const next = tiles.slice();
      next[i] = { ...t, ...patch };
      for (const k of Object.keys(next[i])) if (next[i][k] === undefined) delete next[i][k];
      commitLayout(next);
    };
    list.append(h('div', { class: 'row tile-row' },
      h('select', {
        class: 'type',
        onchange: (ev) => {
          const type = ev.target.value;
          const first = (TARGET_DOMAINS[type] && C.entities.find((e) => TARGET_DOMAINS[type].includes(e.domain))) || null;
          const next = { type, size: t.size };
          if (type === 'room') next.area = (C.areas[0] || {}).id;
          else if (type === 'action') next.action = 'all_off';
          else if (TARGET_DOMAINS[type] && !['thermostat', 'weather', 'media', 'todo'].includes(type) && first) next.entity = first.id;
          const all = tiles.slice();
          all[i] = next;
          commitLayout(all);
        },
      }, TILE_TYPES.map(([id, label]) => h('option', { value: id, selected: id === t.type, text: label }))),
      targetSelect(t, update),
      h('select', { class: 'size', onchange: (ev) => update({ size: ev.target.value }) },
        Object.entries(window.FOYER_LAYOUT.SIZE_NAMES).map(([id, label]) => h('option', { value: id, selected: id === t.size, text: `${label} (${window.FOYER_LAYOUT.SIZES[id].join('×')})` }))),
      h('button', { class: 'icon-btn', disabled: i === 0, onclick: () => { const n = tiles.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; commitLayout(n); } }, icon('chevron-up')),
      h('button', { class: 'icon-btn', disabled: i === tiles.length - 1, onclick: () => { const n = tiles.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; commitLayout(n); } }, icon('chevron-down')),
      h('button', { class: 'icon-btn', title: 'Retirer', onclick: () => commitLayout(tiles.filter((_, k) => k !== i)) }, icon('close')),
    ));
  });
}

function commitLayout(tiles) {
  S.settings.layouts = { ...S.settings.layouts, [layoutFace]: tiles };
  save({ layouts: { [layoutFace]: tiles } });
  renderLayout();
}

// ------------------------------------------------------------------ photos
async function resizeImage(file, max = 2048) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const hgt = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = hgt;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
  return { blob, w, h: hgt };
}

function renderPhotos() {
  $('#photo-interval').value = String(S.settings.photoInterval);
  const grid = $('#photo-grid');
  grid.replaceChildren();
  const items = (S.photos.items || []).filter((p) => !p.demo);
  if (!items.length) {
    grid.append(h('p', { class: 'hint', text: 'Aucune photo pour le moment. Le cadran Photos et la tuile Photo affichent « Ajoutez des photos ».' }));
    return;
  }
  items.forEach((p, i) => {
    const el = h('div', { class: 'photo' },
      p.mask ? h('span', { class: 'badge', text: 'Détourée' }) : null,
      h('div', { class: 'tools' },
        h('button', { class: 'icon-btn', title: 'Avant', disabled: i === 0, onclick: () => photoOp('POST', `${p.id}/move?d=-1`) }, icon('chevron-left')),
        h('button', { class: 'icon-btn', title: 'Après', disabled: i === items.length - 1, onclick: () => photoOp('POST', `${p.id}/move?d=1`) }, icon('chevron-right')),
        h('button', { class: 'icon-btn', title: 'Supprimer', onclick: () => { if (confirm('Supprimer cette photo ?')) photoOp('DELETE', p.id); } }, icon('close'))));
    el.style.backgroundImage = `url("${p.src}")`;
    grid.append(el);
  });
}

async function photoOp(method, path) {
  try {
    await api(method, `api/admin/photos/${path}`);
    await reload(false);
    renderPhotos();
  } catch (e) {
    toast(`Erreur : ${e.message}`, true);
  }
}

async function uploadPhotos(files) {
  const prog = $('#photo-progress');
  let n = 0;
  for (const file of files) {
    n += 1;
    prog.textContent = `Envoi ${n} / ${files.length}…`;
    try {
      const { blob, w, h: hh } = await resizeImage(file);
      await api('POST', `api/admin/photos?w=${w}&h=${hh}`, blob, 'image/jpeg');
    } catch (e) {
      toast(`${file.name} : ${e.message}`, true);
    }
  }
  prog.textContent = '';
  await reload(false);
  renderPhotos();
  toast(files.length > 1 ? 'Photos ajoutées' : 'Photo ajoutée');
}

// ------------------------------------------------------------------ iPads
function browserHost() {
  try { return window.top.location.hostname || window.location.hostname; } catch (e) { return window.location.hostname; }
}

async function openFullScreen() {
  const win = window.open('', '_blank');
  try {
    const r = await api('POST', 'api/admin/setup-code', {});
    const url = `http://${browserHost()}:${r.access.port || 8110}/?setup=${r.code}`;
    if (win) win.location.href = url;
    else window.top.location.href = url;
  } catch (e) {
    if (win) win.close();
    toast(`Erreur : ${e.message}`, true);
  }
}

async function makeSheet() {
  const r = await api('POST', 'api/admin/setup-code', {});
  const port = r.access.port || 8110;
  const hosts = [];
  const bh = browserHost();
  if (bh && !/^(localhost|127\.)/.test(bh)) hosts.push(bh);
  for (const ip of r.access.ips || []) if (!hosts.includes(ip)) hosts.push(ip);
  for (const n of r.access.hostnames || []) if (!hosts.includes(n)) hosts.push(n);
  const urls = hosts.map((x) => `http://${x}:${port}`);
  const sheet = $('#sheet');
  sheet.hidden = false;
  sheet.replaceChildren();
  const qr = window.qrcode(0, 'M');
  qr.addData(`${urls[0]}/?setup=${r.code}`);
  qr.make();
  const expires = new Date(r.expires).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  sheet.append(
    h('img', { src: qr.createDataURL(6, 2), alt: 'QR code' }),
    h('div', { class: 'grow' },
      h('div', { class: 'desc', text: 'Adresse' }),
      urls.map((u) => h('div', { class: 'addr', text: u })),
      h('div', { class: 'desc', text: `Code (une seule fois, jusqu'au ${expires})`, style: 'margin-top:10px' }),
      h('div', { class: 'code', text: r.display }),
      h('ol', {},
        h('li', { text: "Sur l'iPad, ouvrez Safari et tapez l'adresse (ou scannez le QR code avec l'appareil photo)." }),
        h('li', { text: "Touchez Partager, puis « Sur l'écran d'accueil », puis Ajouter." }),
        h('li', { text: "Ouvrez Foyer depuis sa nouvelle icône et tapez le code." })),
      h('button', { class: 'btn small', style: 'margin-top:12px', onclick: () => { sheet.closest('.card').classList.add('print-me'); window.print(); } }, 'Imprimer')),
  );
}

function ago(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 90) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

async function renderDevices() {
  const box = $('#devices');
  const r = await api('GET', 'api/admin/devices');
  box.replaceChildren();
  if (!r.devices.length) {
    box.append(h('p', { class: 'hint', text: "Aucun écran associé par son propre port. Les iPad qui ouvrent Foyer depuis la barre latérale de Home Assistant n'ont pas besoin d'être associés." }));
    return;
  }
  for (const d of r.devices) {
    box.append(h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('input', {
          type: 'text', value: d.name, maxlength: '40',
          onchange: async (ev) => { await api('PATCH', `api/admin/devices/${d.id}`, { name: ev.target.value }); toast(); },
        }),
        d.admin ? h('span', { class: 'badge-admin', text: 'admin' }) : null,
        h('div', { class: 'desc', text: `Associé le ${new Date(d.created).toLocaleDateString('fr-FR')} · vu ${ago(d.lastSeen)}` })),
      h('button', {
        class: 'btn small danger',
        onclick: async () => {
          if (!confirm(`Retirer « ${d.name} » ? Il devra être associé à nouveau.`)) return;
          await api('DELETE', `api/admin/devices/${d.id}`);
          renderDevices();
        },
      }, 'Retirer')));
  }
}

// ------------------------------------------------------------------ options
function fillEntitySelect(sel, domain, value, autoLabel = 'Automatique') {
  sel.replaceChildren(h('option', { value: '', text: autoLabel }));
  for (const e of C.entities.filter((x) => x.domain === domain)) {
    sel.append(h('option', { value: e.id, selected: e.id === value, text: entityLabel(e.id) }));
  }
  sel.value = value || '';
}

function renderOptions() {
  const s = S.settings;
  const sw = $('#wallpaper');
  sw.replaceChildren();
  for (const [id, bg] of Object.entries(WALLPAPERS)) {
    const b = h('button', { class: `swatch${s.wallpaper === id ? ' sel' : ''}`, title: id, onclick: () => { s.wallpaper = id; save({ wallpaper: id }); renderOptions(); } });
    b.style.background = bg;
    sw.append(b);
  }
  $$('#style button').forEach((b) => {
    b.classList.toggle('sel', b.dataset.v === s.style);
    b.onclick = () => { s.style = b.dataset.v; save({ style: s.style }); renderOptions(); };
  });
  $('#lang').value = s.lang || '';
  $('#return-after').value = String(s.returnAfter || 0);
  $('#night-enabled').checked = s.night.enabled;
  $('#night-from').value = s.night.from;
  $('#night-to').value = s.night.to;
  $('#night-face').value = s.night.face;
  $('#night-dim').value = String(s.night.dim);
  fillEntitySelect($('#weather-entity'), 'weather', s.weatherEntity, 'Automatique (la première météo)');
  fillEntitySelect($('#thermostat-entity'), 'climate', s.thermostatEntity, 'Automatique (le premier thermostat)');
  fillEntitySelect($('#speaker'), 'media_player', s.speaker, "Automatique (celle qui joue)");
  const cals = $('#calendars');
  cals.replaceChildren();
  const all = C.entities.filter((e) => e.domain === 'calendar');
  if (!all.length) cals.append(h('span', { class: 'desc', text: 'Aucun agenda dans Home Assistant.' }));
  for (const e of all) {
    const checked = !Array.isArray(s.calendars) || s.calendars.includes(e.id);
    cals.append(h('label', {}, h('input', {
      type: 'checkbox', checked,
      onchange: () => {
        const ids = $$('input', cals).map((x, i) => (x.checked ? all[i].id : null)).filter(Boolean);
        s.calendars = ids.length === all.length ? null : ids;
        save({ calendars: s.calendars });
      },
    }), e.name));
  }
  $('#sensitive').checked = Boolean(s.sensitiveFromHaOnly);
}

function bindOptions() {
  $('#lang').onchange = (ev) => save({ lang: ev.target.value || null });
  $('#return-after').onchange = (ev) => save({ returnAfter: parseInt(ev.target.value, 10) });
  $('#night-enabled').onchange = (ev) => save({ night: { enabled: ev.target.checked } });
  $('#night-from').onchange = (ev) => save({ night: { from: ev.target.value } });
  $('#night-to').onchange = (ev) => save({ night: { to: ev.target.value } });
  $('#night-face').onchange = (ev) => save({ night: { face: ev.target.value } });
  $('#night-dim').onchange = (ev) => save({ night: { dim: parseFloat(ev.target.value) } });
  $('#weather-entity').onchange = (ev) => save({ weatherEntity: ev.target.value || null });
  $('#thermostat-entity').onchange = (ev) => save({ thermostatEntity: ev.target.value || null });
  $('#speaker').onchange = (ev) => save({ speaker: ev.target.value || null });
  $('#sensitive').onchange = (ev) => save({ sensitiveFromHaOnly: ev.target.checked });
  $('#photo-interval').onchange = (ev) => save({ photoInterval: parseInt(ev.target.value, 10) });
}

// ------------------------------------------------------------------ start
function showTab(id) {
  $$('#tabs button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === id));
  $$('.tab').forEach((t) => t.classList.toggle('sel', t.id === `tab-${id}`));
  if (id === 'ipads') renderDevices().catch((e) => toast(`Erreur : ${e.message}`, true));
  try { sessionStorage.setItem('foyer.tab', id); } catch (e) { /* ignore */ }
}

async function start() {
  $('#logo').append(icon('home-heart'));
  await reload(true);
  $('#subtitle').textContent = `${C.home.name || 'Maison'} · ${C.entities.length} appareils · ${C.areas.length} pièces`;
  $$('#tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  $$('#layout-face button').forEach((b) => { b.onclick = () => { layoutFace = b.dataset.face; renderLayout(); }; });
  $('#layout-customize').onclick = () => commitLayout(currentTiles().map((t) => ({ ...t })));
  $('#layout-reset').onclick = () => {
    S.settings.layouts = { ...S.settings.layouts, [layoutFace]: null };
    save({ layouts: { [layoutFace]: null } }, true);
    renderLayout();
  };
  $('#layout-add').onclick = () => commitLayout([...currentTiles(), { type: 'entity', size: 'S', entity: (C.entities.find((e) => e.domain === 'light') || C.entities[0] || {}).id }]);
  $('#photo-input').onchange = (ev) => { const files = [...ev.target.files]; ev.target.value = ''; if (files.length) uploadPhotos(files); };
  $('#full-screen').onclick = openFullScreen;
  $('#make-sheet').onclick = () => makeSheet().catch((e) => toast(`Erreur : ${e.message}`, true));
  bindOptions();
  renderFaces();
  renderLayout();
  renderPhotos();
  renderOptions();
  let tab = 'faces';
  try { tab = sessionStorage.getItem('foyer.tab') || tab; } catch (e) { /* ignore */ }
  showTab(tab);
}

start().catch((e) => {
  document.querySelector('main').prepend(h('div', { class: 'card' }, h('h2', { text: 'Foyer ne répond pas' }), h('p', { class: 'hint', text: e.message })));
});
