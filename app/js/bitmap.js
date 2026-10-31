/* OLED-Grafikeditor: Bild-Feld für Blöcke und Pixel-Editor */
'use strict';

/* Bildformat wie bei drawBitmap(): Zeile für Zeile, je Zeile (Breite+7)/8 Bytes, höchstes Bit = linkes Pixel */
const Bitmap = {
  rowBytes: w => Math.ceil(w / 8),
  parse(v) {
    try { const o = JSON.parse(v); if (o.w > 0 && o.h > 0 && typeof o.d === 'string') return o; } catch (e) { /* ungültig */ }
    return null;
  },
  toPixels(o) {
    const px = new Uint8Array(o.w * o.h), rb = this.rowBytes(o.w);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const byte = parseInt(o.d.substr((y * rb + (x >> 3)) * 2, 2), 16) || 0;
      px[y * o.w + x] = (byte >> (7 - (x & 7))) & 1;
    }
    return px;
  },
  fromPixels(w, h, px) {
    const rb = this.rowBytes(w);
    let d = '';
    for (let y = 0; y < h; y++) for (let b = 0; b < rb; b++) {
      let byte = 0;
      for (let i = 0; i < 8; i++) { const x = b * 8 + i; if (x < w && px[y * w + x]) byte |= 0x80 >> i; }
      d += byte.toString(16).padStart(2, '0');
    }
    return JSON.stringify({ w, h, d });
  },
  thumb(o, scale) {
    const cv = document.createElement('canvas'); cv.width = o.w * scale; cv.height = o.h * scale;
    const g = cv.getContext('2d'); g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#9be1ff';
    const px = this.toPixels(o);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (px[y * o.w + x]) g.fillRect(x * scale, y * scale, scale, scale);
    return cv.toDataURL();
  },
};

const HEART = (() => {
  const rows = ['0000000000000000', '0011100000111000', '0111110001111100', '1111111011111110', '1111111111111110', '1111111111111110', '0111111111111100', '0011111111111000',
    '0001111111110000', '0000111111100000', '0000011111000000', '0000001110000000', '0000000100000000', '0000000000000000'];
  const px = new Uint8Array(16 * 14);
  rows.forEach((r, y) => [...r].forEach((c, x) => { px[y * 16 + x] = c === '1' ? 1 : 0; }));
  return Bitmap.fromPixels(16, 14, px);
})();

/* ---------- Blockly-Feld mit Bildvorschau ---------- */
function FieldBitmap(value, validator, config) {
  FieldBitmap.superClass_.constructor.call(this, value || HEART, validator, config);
}
Blockly.utils.object.inherits(FieldBitmap, Blockly.Field);
FieldBitmap.fromJson = o => new FieldBitmap(o.value);
FieldBitmap.prototype.SERIALIZABLE = true;
FieldBitmap.prototype.EDITABLE = true;
FieldBitmap.prototype.CURSOR = 'pointer';
FieldBitmap.prototype.doClassValidation_ = function (v) { return Bitmap.parse(v) ? v : null; };
FieldBitmap.prototype.getText_ = function () { const o = Bitmap.parse(this.getValue()); return o ? `Bild ${o.w}×${o.h}` : 'Bild'; };
FieldBitmap.prototype.initView = function () {
  this.createBorderRect_();
  if (this.borderRect_) { this.borderRect_.setAttribute('fill', '#0b0b0b'); this.borderRect_.setAttribute('stroke', '#ffffff'); this.borderRect_.setAttribute('fill-opacity', '1'); }
  this.imageElement_ = Blockly.utils.dom.createSvgElement('image', { x: 3, y: 3 }, this.fieldGroup_);
};
FieldBitmap.prototype.render_ = function () {
  const o = Bitmap.parse(this.getValue());
  if (!o || !this.imageElement_) return;
  const scale = Math.max(1, Math.min(4, Math.floor(Math.min(72 / o.w, 32 / o.h))));
  const w = o.w * scale, h = o.h * scale;
  this.imageElement_.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', Bitmap.thumb(o, scale));
  this.imageElement_.setAttribute('width', w); this.imageElement_.setAttribute('height', h);
  this.size_.width = w + 6; this.size_.height = Math.max(h + 6, 22);
  this.imageElement_.setAttribute('y', (this.size_.height - h) / 2);
  if (this.borderRect_) { this.borderRect_.setAttribute('width', this.size_.width); this.borderRect_.setAttribute('height', this.size_.height); this.borderRect_.setAttribute('rx', 3); this.borderRect_.setAttribute('ry', 3); }
};
FieldBitmap.prototype.updateSize_ = function () {};
FieldBitmap.prototype.showEditor_ = function () { BitmapEditor.open(this.getValue(), v => this.setValue(v)); };
Blockly.fieldRegistry.register('field_bitmap', FieldBitmap);

/* ---------- Pixel-Editor ---------- */
const BitmapEditor = {
  open(value, onOk) {
    const o = Bitmap.parse(value) || Bitmap.parse(HEART);
    this.w = o.w; this.h = o.h; this.px = Bitmap.toPixels(o); this.tool = 'pen'; this.undo = [];
    const dlg = document.querySelector('#dlg');
    if (dlg.open) dlg.close();
    App.freshForm();
    dlg.classList.add('wide');
    document.querySelector('#dlgForm').innerHTML = `
      <h2>OLED-Grafikeditor</h2>
      <div class="bm-bar">
        <div class="seg small bm-tools"><button type="button" data-tool="pen" class="on">Stift</button><button type="button" data-tool="erase">Radierer</button><button type="button" data-tool="line">Linie</button><button type="button" data-tool="rect">Rechteck</button><button type="button" data-tool="circle">Kreis</button><button type="button" data-tool="fill">Füllen</button><button type="button" data-tool="text">Text</button></div>
        <label class="bm-opt"><input type="checkbox" name="bfill"> gefüllt</label>
        <span class="bm-opt bm-textopt">Text <input type="text" name="btext" value="Hallo" size="10"> Größe <select name="bsize"><option>1</option><option>2</option><option>3</option></select></span>
      </div>
      <div class="bm-bar">
        <button type="button" class="btn small" data-act="undo">↶ Zurück</button>
        <button type="button" class="btn small" data-act="clear">Leeren</button>
        <button type="button" class="btn small" data-act="invert">Invertieren</button>
        <button type="button" class="btn small" data-act="import">Bild laden …</button>
        <span class="bm-size">Breite <input type="number" min="1" max="128" name="bw" value="${this.w}"> Höhe <input type="number" min="1" max="64" name="bh" value="${this.h}"> Pixel</span>
      </div>
      <div class="bm-stage"><canvas id="bmCanvas"></canvas></div>
      <p class="bm-hint">Stift: klicken oder ziehen. Linie, Rechteck, Kreis: von einem Punkt zum anderen ziehen. Text: an die gewünschte Stelle klicken. Rechte Maustaste zeichnet schwarz. Das ganze Display hat 128 × 64 Pixel.</p>
      <input type="file" id="bmFile" accept="image/*" hidden>
      <div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary" value="ok">Übernehmen</button></div>`;
    const f = document.querySelector('#dlgForm');
    this.cv = f.querySelector('#bmCanvas');
    this.draw();
    f.querySelector('.bm-tools').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      this.tool = b.dataset.tool;
      this.cv.style.cursor = this.tool === 'text' ? 'text' : 'crosshair';
      f.querySelectorAll('.bm-tools button').forEach(x => x.classList.toggle('on', x === b));
    });
    f.querySelector('.bm-bar').addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'import') { f.querySelector('#bmFile').click(); return; }
      this.snapshot();
      if (a.dataset.act === 'clear') this.px.fill(0);
      if (a.dataset.act === 'invert') this.px = this.px.map(v => 1 - v);
      if (a.dataset.act === 'undo') { this.undo.pop(); const u = this.undo.pop(); if (u) { this.w = u.w; this.h = u.h; this.px = u.px; f.bw.value = this.w; f.bh.value = this.h; } }
      this.draw();
    });
    const resize = () => {
      const w = Math.max(1, Math.min(128, Math.round(Number(f.bw.value) || 1))), h = Math.max(1, Math.min(64, Math.round(Number(f.bh.value) || 1)));
      if (w === this.w && h === this.h) return;
      this.snapshot();
      const n = new Uint8Array(w * h);
      for (let y = 0; y < Math.min(h, this.h); y++) for (let x = 0; x < Math.min(w, this.w); x++) n[y * w + x] = this.px[y * this.w + x];
      this.w = w; this.h = h; this.px = n; this.draw();
    };
    f.bw.addEventListener('change', resize); f.bh.addEventListener('change', resize);
    f.querySelector('#bmFile').addEventListener('change', e => this.importImage(e.target.files[0]));
    this.bindCanvas();
    dlg.showModal();
    dlg.onclose = () => {
      if (dlg.open) return;
      dlg.classList.remove('wide');
      if (dlg.returnValue === 'ok') onOk(Bitmap.fromPixels(this.w, this.h, this.px));
    };
  },

  snapshot() { this.undo.push({ w: this.w, h: this.h, px: this.px.slice() }); if (this.undo.length > 50) this.undo.shift(); },

  cell() { return Math.max(3, Math.min(28, Math.floor(Math.min(760 / this.w, 380 / this.h)))); },

  draw() {
    const c = this.cell(), cv = this.cv;
    cv.width = this.w * c; cv.height = this.h * c;
    const g = cv.getContext('2d');
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#9be1ff';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.px[y * this.w + x]) g.fillRect(x * c, y * c, c, c);
    if (c >= 5) {
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= this.w; x++) { g.moveTo(x * c + 0.5, 0); g.lineTo(x * c + 0.5, cv.height); }
      for (let y = 0; y <= this.h; y++) { g.moveTo(0, y * c + 0.5); g.lineTo(cv.width, y * c + 0.5); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.beginPath();
      for (let x = 8; x < this.w; x += 8) { g.moveTo(x * c + 0.5, 0); g.lineTo(x * c + 0.5, cv.height); }
      for (let y = 8; y < this.h; y += 8) { g.moveTo(0, y * c + 0.5); g.lineTo(cv.width, y * c + 0.5); }
      g.stroke();
    }
  },

  bindCanvas() {
    const cv = this.cv, f = document.querySelector('#dlgForm');
    cv.style.cursor = 'crosshair';
    const at = e => { const r = cv.getBoundingClientRect(), c = this.cell(); return [Math.floor((e.clientX - r.left) / c), Math.floor((e.clientY - r.top) / c)]; };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      const [x, y] = at(e);
      this.snapshot();
      this.paintVal = (e.button === 2 || this.tool === 'erase') ? 0 : 1;
      if (this.tool === 'fill') { this.flood(x, y, this.paintVal); this.draw(); return; }
      if (this.tool === 'text') { this.text(x, y, f.btext.value, Number(f.bsize.value) || 1, this.paintVal); this.draw(); return; }
      cv.setPointerCapture(e.pointerId);
      if (this.tool === 'pen' || this.tool === 'erase') { this.painting = true; this.set(x, y); return; }
      this.shape = { x0: x, y0: y, base: this.px.slice(), filled: f.bfill.checked };
    });
    cv.addEventListener('pointermove', e => {
      const [x, y] = at(e);
      if (this.painting) this.set(x, y);
      else if (this.shape) { this.px = this.shape.base.slice(); this.drawShape(this.shape, x, y); this.draw(); }
    });
    cv.addEventListener('pointerup', e => {
      if (this.shape) { const [x, y] = at(e); this.px = this.shape.base.slice(); this.drawShape(this.shape, x, y); this.draw(); }
      this.painting = false; this.shape = null;
    });
  },

  put(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = v; },

  drawShape(sh, x1, y1) {
    const v = this.paintVal, x0 = sh.x0, y0 = sh.y0;
    if (this.tool === 'line') {
      let x = x0, y = y0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) { this.put(x, y, v); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
    } else if (this.tool === 'rect') {
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (sh.filled || x === xa || x === xb || y === ya || y === yb) this.put(x, y, v);
    } else if (this.tool === 'circle') {
      const r = Math.round(Math.hypot(x1 - x0, y1 - y0));
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (sh.filled ? d <= r * r + r : (d <= r * r + r && d >= r * r - r)) this.put(x0 + x, y0 + y, v);
      }
    }
  },

  text(x0, y0, str, size, v) {
    let cx = x0;
    for (const ch of String(str)) {
      for (const [x, y] of fontGlyph(ch)) for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) this.put(cx + x * size + a, y0 + y * size + b, v);
      cx += 6 * size;
    }
  },

  set(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (this.px[y * this.w + x] === this.paintVal) return;
    this.px[y * this.w + x] = this.paintVal;
    this.draw();
  },

  flood(x, y, to) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const from = this.px[y * this.w + x];
    if (from === to) return;
    const st = [[x, y]];
    while (st.length) {
      const [a, b] = st.pop();
      if (a < 0 || b < 0 || a >= this.w || b >= this.h || this.px[b * this.w + a] !== from) continue;
      this.px[b * this.w + a] = to;
      st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
  },

  importImage(file) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      this.snapshot();
      const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, this.w, this.h);
      const k = Math.min(this.w / img.width, this.h / img.height);
      const dw = img.width * k, dh = img.height * k;
      g.drawImage(img, (this.w - dw) / 2, (this.h - dh) / 2, dw, dh);
      const d = g.getImageData(0, 0, this.w, this.h).data;
      for (let i = 0; i < this.w * this.h; i++) {
        const lum = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
        this.px[i] = lum < 128 ? 1 : 0; // dunkle Stellen leuchten
      }
      URL.revokeObjectURL(img.src);
      this.draw();
    };
    img.src = URL.createObjectURL(file);
  },
};
