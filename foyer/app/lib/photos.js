'use strict';
const fs = require('fs');
const path = require('path');
const { randomId } = require('./util');

const MAX_PHOTOS = 200;
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b) => b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

/** Your photos, kept in /media/foyer/photos (also visible in Home Assistant's Media browser). */
class Photos {
  constructor({ store, mediaDir, log, demo }) {
    this.store = store;
    this.dir = path.join(mediaDir, 'photos');
    this.log = log;
    this.demo = demo;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
    } catch (e) {
      log.warn(`Cannot create ${this.dir}: ${e.message}`);
    }
  }

  get items() { return this.store.data.photos; }

  block() {
    const items = this.items.map((p) => ({
      id: p.id,
      src: `photos/${p.id}.${p.ext}?v=${p.added}`,
      mask: p.mask ? `photos/${p.id}-mask.png?v=${p.mask}` : null,
      w: p.w || null,
      h: p.h || null,
      pos: p.pos || null,
    }));
    if (!items.length && this.demo) {
      for (let i = 1; i <= 3; i += 1) items.push({ id: `demo${i}`, src: `demo/photo-${i}.svg`, mask: null, w: 1600, h: 1200, demo: true });
    }
    return { items, interval: this.store.settings.photoInterval };
  }

  add(buf, meta = {}) {
    if (this.items.length >= MAX_PHOTOS) throw Object.assign(new Error('too many photos'), { status: 409 });
    let ext = null;
    if (isJpeg(buf)) ext = 'jpg';
    else if (isPng(buf)) ext = 'png';
    if (!ext) throw Object.assign(new Error('only JPEG or PNG pictures'), { status: 415 });
    const id = randomId(6);
    fs.writeFileSync(path.join(this.dir, `${id}.${ext}`), buf);
    const w = Number.isInteger(meta.w) && meta.w > 0 && meta.w < 20000 ? meta.w : null;
    const h = Number.isInteger(meta.h) && meta.h > 0 && meta.h < 20000 ? meta.h : null;
    const item = { id, ext, w, h, added: Date.now(), mask: null, pos: null };
    this.items.push(item);
    this.store.save();
    return item;
  }

  /** Your own wallpaper (one at a time), kept next to the photos so it stays out of the slideshow. */
  setWallpaper(buf) {
    let ext = null;
    if (isJpeg(buf)) ext = 'jpg';
    else if (isPng(buf)) ext = 'png';
    if (!ext) throw Object.assign(new Error('only JPEG or PNG pictures'), { status: 415 });
    const dir = path.dirname(this.dir);
    for (const old of ['wallpaper.jpg', 'wallpaper.png']) {
      try { fs.unlinkSync(path.join(dir, old)); } catch (e) { /* none yet */ }
    }
    fs.writeFileSync(path.join(dir, `wallpaper.${ext}`), buf);
    return randomId(4);
  }

  wallpaperFile() {
    const dir = path.dirname(this.dir);
    for (const [name, type] of [['wallpaper.jpg', 'image/jpeg'], ['wallpaper.png', 'image/png']]) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) return { path: f, type };
    }
    return null;
  }

  setMask(id, buf) {
    const p = this.items.find((x) => x.id === id);
    if (!p) throw Object.assign(new Error('unknown photo'), { status: 404 });
    if (!isPng(buf)) throw Object.assign(new Error('the mask must be a PNG'), { status: 415 });
    fs.writeFileSync(path.join(this.dir, `${id}-mask.png`), buf);
    p.mask = Date.now();
    this.store.save();
    return p;
  }

  clearMask(id) {
    const p = this.items.find((x) => x.id === id);
    if (!p) return false;
    try { fs.unlinkSync(path.join(this.dir, `${id}-mask.png`)); } catch (e) { /* ignore */ }
    p.mask = null;
    this.store.save();
    return true;
  }

  remove(id) {
    const p = this.items.find((x) => x.id === id);
    if (!p) return false;
    for (const f of [`${id}.${p.ext}`, `${id}-mask.png`]) {
      try { fs.unlinkSync(path.join(this.dir, f)); } catch (e) { /* ignore */ }
    }
    this.store.data.photos = this.items.filter((x) => x.id !== id);
    this.store.save();
    return true;
  }

  move(id, delta) {
    const list = this.items;
    const i = list.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
    this.store.save();
    return true;
  }

  /** Resolves "abc123.jpg" / "abc123-mask.png" to a file on disk, or null. Never leaves the photos folder. */
  file(name) {
    const m = /^([0-9a-f]{12})(-mask)?\.(jpg|png)$/.exec(name || '');
    if (!m) return null;
    const p = this.items.find((x) => x.id === m[1]);
    if (!p) return null;
    if (m[2] && (!p.mask || m[3] !== 'png')) return null;
    if (!m[2] && m[3] !== p.ext) return null;
    return { path: path.join(this.dir, name), type: m[3] === 'png' ? 'image/png' : 'image/jpeg' };
  }
}

module.exports = { Photos, isJpeg, isPng };
