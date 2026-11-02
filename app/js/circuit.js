/* Schaltungs-Editor: Bauteile platzieren, verschieben, drehen, verdrahten */
'use strict';

const WIRE_COLORS = { gruen: '#2fa84f', rot: '#e53935', schwarz: '#222222', blau: '#1e6fd9', gelb: '#f2c200', orange: '#f57c00', lila: '#8e44ad', weiss: '#f2f2f2', grau: '#8a8a8a' };
const WIRE_COLOR_NAMES = { gruen: 'Grün', rot: 'Rot', schwarz: 'Schwarz', blau: 'Blau', gelb: 'Gelb', orange: 'Orange', lila: 'Lila', weiss: 'Weiß', grau: 'Grau' };

function makeComp(type, x, y, rot, props, id) {
  const def = COMPONENTS[type];
  const c = { id, type, x, y, rot: rot || 0, props: Object.assign({}, def.props, props || {}) };
  Object.defineProperty(c, 'def', { value: def, enumerable: false });
  return c;
}

class CircuitEditor {
  constructor(svg, app) {
    this.svg = svg;
    this.app = app;
    this.project = { components: [], wires: [] };
    this.view = { x: 40, y: 40, k: 1.6 };
    this.sel = null; // {kind:'comp'|'wire', id}
    this.wiring = null;
    this.drag = null;
    this.states = {};
    this.stateCache = {};
    this.nextId = 1;
    svg.innerHTML = `<defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="0.6" fill="var(--grid)"/></pattern></defs>
      <rect class="bg" x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid)"/>
      <g class="world"><g class="l-bb"></g><g class="l-comp"></g><g class="l-wire"></g><g class="l-sel"></g><g class="l-tmp"></g></g>`;
    this.world = svg.querySelector('.world');
    this.bg = svg.querySelector('.bg');
    this.L = { bb: svg.querySelector('.l-bb'), comp: svg.querySelector('.l-comp'), wire: svg.querySelector('.l-wire'), sel: svg.querySelector('.l-sel'), tmp: svg.querySelector('.l-tmp') };
    this.bindEvents();
    this.applyView();
  }

  /* ---------- Projekt ---------- */
  load(data) {
    this.project.components = (data.components || []).filter(c => COMPONENTS[c.type]).map(c => makeComp(c.type, c.x, c.y, c.rot, c.props, c.id));
    this.project.wires = (data.wires || []).map(w => ({ id: w.id, a: w.a, b: w.b, pts: w.pts || [], color: w.color || 'gruen' }));
    const ids = [...this.project.components, ...this.project.wires].map(o => parseInt(String(o.id).slice(1), 10) || 0);
    this.nextId = Math.max(0, ...ids) + 1;
    this.migrateRelays(data.components || []);
    this.sel = null; this.wiring = null; this.states = {}; this.stateCache = {};
    this.renderAll();
  }
  /* Ältere Projekte (bis 0.12.12): Das Relais-Modul hatte eine Stiftleiste VCC/GND/IN (x = 0/10/20) und steckte
     in der Steckplatine. Das neue Modul hat Schraubklemmen – die Verbindungen werden als Kabel übernommen. */
  migrateRelays(raw) {
    const holes = new Map();
    for (const c of this.project.components) if (c.def.isBreadboard) for (const p of c.def.pins) { const [x, y] = worldPin(c, p); holes.set(x + ',' + y, { c: c.id, p: p.id }); }
    for (const r of raw) {
      if (r.type !== 'relay' || (r.props && r.props.bauform)) continue;
      const c = this.project.components.find(x => x.id === r.id);
      if (!c) continue;
      [['VCC', 0, 'rot'], ['GND', 10, 'schwarz'], ['IN', 20, 'blau']].forEach(([pin, lx, color]) => {
        const [rx, ry] = rotPoint(lx, 0, c.rot || 0), h = holes.get((c.x + rx) + ',' + (c.y + ry));
        if (h) this.project.wires.push({ id: this.newId('w'), a: { c: c.id, p: pin }, b: h, pts: [], color });
      });
      c.y -= 30; // Platine etwas über die Steckplatine schieben
    }
  }
  toJSON() {
    return {
      components: this.project.components.map(({ id, type, x, y, rot, props }) => ({ id, type, x, y, rot, props })),
      wires: this.project.wires.map(w => ({ id: w.id, a: w.a, b: w.b, pts: w.pts, color: w.color })),
    };
  }
  newId(p) { return p + (this.nextId++); }
  comp(id) { return this.project.components.find(c => c.id === id); }

  addComponent(type, x, y, props) {
    const def = COMPONENTS[type];
    const [x0, y0, x1, y1] = def.bbox;
    const cx = Math.round((x - (x0 + x1) / 2) / 10) * 10;
    const cy = Math.round((y - (y0 + y1) / 2) / 10) * 10;
    this.app.pushUndo();
    const c = makeComp(type, cx, cy, 0, props, this.newId('c'));
    const others = this.project.components.filter(o => o.def.mcu);
    this.project.components.push(c);
    this.renderAll();
    this.select({ kind: 'comp', id: c.id });
    this.app.changed();
    if (def.mcu) this.app.onMcuAdded(def.mcu.kind, others.length > 0);
    return c;
  }

  addTemplate(x, y, withLcd) {
    this.app.pushUndo();
    const bx = Math.round((x - 165) / 10) * 10, by = Math.round((y - (withLcd ? 180 : 230)) / 10) * 10;
    const bb = makeComp('breadboard', bx, by, 0, {}, this.newId('c'));
    const esp = BOARD === 'esp32';
    const uno = esp ? makeComp('esp32exp', bx + 80, by + 320, 0, {}, this.newId('c')) : makeComp('uno', bx + 10, by + 260, 0, {}, this.newId('c'));
    this.project.components.push(bb, uno);
    const w = (a, b, color, pts) => this.project.wires.push({ id: this.newId('w'), a, b, color, pts: pts || [] });
    if (esp) {
      // Stromleiste des Expansion Boards: 3,3 V und GND auf die Steckplatine
      w({ c: uno.id, p: 'P3V3a' }, { c: bb.id, p: 'bp-1' }, 'rot', [[uno.x + 270, uno.y + 10], [uno.x + 270, by + 225], [bx - 20, by + 225], [bx - 20, by + 190]]);
      w({ c: uno.id, p: 'PGa' }, { c: bb.id, p: 'bm-2' }, 'schwarz', [[uno.x + 280, uno.y + 70], [uno.x + 280, by + 235], [bx - 30, by + 235], [bx - 30, by + 180]]);
    } else {
      w({ c: uno.id, p: '5V' }, { c: bb.id, p: 'bp-1' }, 'rot', [[uno.x + 160, uno.y + 230], [bx - 20, uno.y + 230], [bx - 20, by + 190]]);
      w({ c: uno.id, p: 'GND_1' }, { c: bb.id, p: 'bm-2' }, 'schwarz', [[uno.x + 170, uno.y + 240], [bx - 30, uno.y + 240], [bx - 30, by + 180]]);
    }
    w({ c: bb.id, p: 'bp-29' }, { c: bb.id, p: 'tp-29' }, 'rot', [[bx + 350, by + 190], [bx + 350, by + 20]]);
    w({ c: bb.id, p: 'bm-28' }, { c: bb.id, p: 'tm-28' }, 'schwarz', [[bx + 340, by + 180], [bx + 340, by + 10]]);
    if (withLcd) {
      const lcd = makeComp('lcd', bx + 100, by - 110, 0, {}, this.newId('c'));
      this.project.components.push(lcd);
      w({ c: lcd.id, p: 'GND' }, { c: bb.id, p: 'tm-2' }, 'schwarz', [[bx + 30, by - 110]]);
      if (esp) w({ c: lcd.id, p: 'VCC' }, { c: uno.id, p: 'P5Va' }, 'rot', [[bx - 45, by - 100], [bx - 45, by + 245], [uno.x + 290, by + 245], [uno.x + 290, uno.y + 40]]); // LCD braucht 5 V
      else w({ c: lcd.id, p: 'VCC' }, { c: bb.id, p: 'tp-3' }, 'rot', [[bx + 40, by - 100]]);
    }
    this.renderAll();
    this.app.changed();
  }

  deleteSelection() {
    if (!this.sel) return;
    this.app.pushUndo();
    if (this.sel.kind === 'comp') {
      const id = this.sel.id;
      this.project.components = this.project.components.filter(c => c.id !== id);
      this.project.wires = this.project.wires.filter(w => w.a.c !== id && w.b.c !== id);
    } else {
      this.project.wires = this.project.wires.filter(w => w.id !== this.sel.id);
    }
    this.select(null);
    this.renderAll();
    this.app.changed();
  }

  rotateSelection() {
    if (!this.sel || this.sel.kind !== 'comp') return;
    const c = this.comp(this.sel.id);
    if (!c || c.def.fixed) { this.app.toast('Arduino und Steckplatine lassen sich nicht drehen.'); return; }
    this.app.pushUndo();
    c.rot = ((c.rot || 0) + 90) % 360;
    this.renderAll();
    this.app.changed();
  }

  setProp(id, key, value, live) {
    const c = this.comp(id);
    if (!c) return;
    if (!live) this.app.pushUndo();
    c.props[key] = value;
    this.renderComp(c);
    if (!live) this.app.changed(); else this.app.changedSilently();
  }

  setWireColor(id, color) {
    const w = this.project.wires.find(x => x.id === id);
    if (!w) return;
    this.app.pushUndo();
    w.color = color;
    this.renderWires();
    this.app.changed();
  }

  select(sel) {
    this.sel = sel;
    this.renderSelection();
    this.renderWires();
    this.app.onSelect(sel);
  }

  /* ---------- Darstellung ---------- */
  applyView() {
    this.world.setAttribute('transform', `translate(${this.view.x} ${this.view.y}) scale(${this.view.k})`);
  }

  renderAll() {
    this.L.bb.innerHTML = '';
    this.L.comp.innerHTML = '';
    for (const c of this.project.components) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'comp comp-' + c.type);
      g.dataset.id = c.id;
      (c.def.isBreadboard ? this.L.bb : this.L.comp).appendChild(g);
      this.renderComp(c, g);
    }
    // Arduino nach unten, damit Kleinteile darüber liegen
    for (const g of [...this.L.comp.querySelectorAll('.comp-uno, .comp-esp32, .comp-esp32exp')]) this.L.comp.prepend(g);
    this.renderWires();
    this.renderSelection();
    this.markInsertions();
  }

  renderComp(c, g) {
    g = g || this.svg.querySelector(`.comp[data-id="${c.id}"]`);
    if (!g) return;
    g.setAttribute('transform', `translate(${c.x} ${c.y}) rotate(${c.rot || 0})`);
    g.innerHTML = c.def.render(c, this.states[c.id] || null);
  }

  renderStates(states) {
    this.states = states;
    for (const c of this.project.components) {
      const key = JSON.stringify(states[c.id] || null) + JSON.stringify(c.props);
      if (this.stateCache[c.id] !== key) { this.stateCache[c.id] = key; this.renderComp(c); }
    }
  }
  clearStates() { this.states = {}; this.stateCache = {}; for (const c of this.project.components) this.renderComp(c); this.markInsertions(); }

  pinPos(ref) {
    const c = this.comp(ref.c);
    if (!c) return null;
    const p = c.def.pins.find(pp => pp.id === ref.p);
    return p ? worldPin(c, p) : null;
  }

  wirePath(points) { return points.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '); }

  renderWires() {
    let s = '';
    const ed = this.drag && this.drag.kind === 'end' ? this.drag : null;
    for (const w of this.project.wires) {
      let a = this.pinPos(w.a), b = this.pinPos(w.b);
      if (!a || !b) continue;
      if (ed && ed.w === w) { if (ed.end === 'a') a = ed.pos; else b = ed.pos; }
      const pts = [a, ...w.pts, b];
      const d = this.wirePath(pts);
      const sel = this.sel && this.sel.kind === 'wire' && this.sel.id === w.id;
      const col = WIRE_COLORS[w.color] || WIRE_COLORS.gruen;
      s += `<g class="wire${sel ? ' selected' : ''}" data-id="${w.id}">`;
      if (sel) s += `<path d="${d}" class="wire-sel"/>`;
      s += `<path d="${d}" class="wire-hit"/><path d="${d}" class="wire-line" stroke="${col}"/>`;
      if (w.color === 'weiss') s += `<path d="${d}" class="wire-edge"/>`;
      s += `<circle cx="${a[0]}" cy="${a[1]}" r="2.6" fill="${col}" class="wire-end"/><circle cx="${b[0]}" cy="${b[1]}" r="2.6" fill="${col}" class="wire-end"/>`;
      if (sel) w.pts.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" class="wire-knot" data-knot="${i}"/>`; });
      if (sel) for (const [end, p] of [['a', a], ['b', b]]) s += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" class="wire-endh" data-end="${end}"><title>Ziehen, um das Kabel an einen anderen Anschluss zu stecken</title></circle>`;
      s += '</g>';
    }
    this.L.wire.innerHTML = s;
  }

  renderSelection() {
    this.L.sel.innerHTML = '';
    if (!this.sel || this.sel.kind !== 'comp') return;
    const c = this.comp(this.sel.id);
    if (!c) return;
    const [x0, y0, x1, y1] = c.def.bbox;
    this.L.sel.innerHTML = `<g transform="translate(${c.x} ${c.y}) rotate(${c.rot || 0})"><rect x="${x0 - 5}" y="${y0 - 5}" width="${x1 - x0 + 10}" height="${y1 - y0 + 10}" class="selbox" rx="4"/></g>`;
  }

  /* Löcher, in denen ein Bein steckt, grün markieren (wie in Tinkercad) */
  markInsertions() {
    this.svg.querySelectorAll('.hole.used, .pin.in').forEach(h => h.classList.remove('used', 'in'));
    const ins = computeInsertions(this.project);
    for (const [k, h] of ins) {
      const [cid, pid] = k.split(':');
      const legEl = this.svg.querySelector(`.comp[data-id="${cid}"] .pin[data-pin="${pid}"]`);
      if (legEl) legEl.classList.add('in');
      const el = this.svg.querySelector(`.comp[data-id="${h.comp.id}"] .hole[data-pin="${h.pin.id}"]`);
      if (el) el.classList.add('used');
    }
  }

  /* ---------- Eingaben ---------- */
  pt(evt) {
    const m = this.world.getScreenCTM().inverse();
    const p = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(m);
    return [p.x, p.y];
  }

  pinRef(el) {
    const g = el.closest('.comp');
    return g ? { c: g.dataset.id, p: el.dataset.pin } : null;
  }

  bindEvents() {
    const svg = this.svg;
    svg.addEventListener('contextmenu', e => { e.preventDefault(); if (this.wiring) this.cancelWire(); });
    svg.addEventListener('pointerdown', e => this.onDown(e));
    svg.addEventListener('pointermove', e => this.onMove(e));
    svg.addEventListener('pointerup', e => this.onUp(e));
    svg.addEventListener('pointerleave', () => { if (this.hoverGroup) this.hl(null); });
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f = Math.exp(-e.deltaY * 0.0015);
      const k = Math.max(0.3, Math.min(5, this.view.k * f));
      this.view.x = mx - (mx - this.view.x) * (k / this.view.k);
      this.view.y = my - (my - this.view.y) * (k / this.view.k);
      this.view.k = k;
      this.applyView();
    }, { passive: false });
    svg.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    svg.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (this.app.sim.running) { this.app.toast('Stoppe zuerst die Simulation.'); return; }
      const [x, y] = this.pt(e);
      if (type === 'template' || type === 'template-lcd') this.addTemplate(x, y, type === 'template-lcd');
      else if (COMPONENTS[type]) this.addComponent(type, x, y);
    });
    svg.addEventListener('pointerover', e => {
      const h = e.target.closest && e.target.closest('.hole');
      if (h && !this.drag) this.hl(h); else if (this.hoverGroup && !h) this.hl(null);
    });
  }

  hl(holeEl) {
    this.svg.querySelectorAll('.hole.grp').forEach(x => x.classList.remove('grp'));
    this.hoverGroup = null;
    if (!holeEl) return;
    const g = holeEl.closest('.comp');
    const grp = bbGroup(holeEl.dataset.pin);
    this.hoverGroup = grp;
    g.querySelectorAll('.hole').forEach(x => { if (bbGroup(x.dataset.pin) === grp) x.classList.add('grp'); });
  }

  onDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { this.startPan(e); return; }
    if (e.button !== 0) return;
    const t = e.target;
    const sim = this.app.sim.running;
    this.app.focusArea = 'circuit';
    const pinEl = t.closest('.pin');
    const knot = t.closest('.wire-knot');
    const wireEl = t.closest('.wire');
    const compEl = t.closest('.comp');

    // Jumper am Relais-Modul umstecken (auch während der Simulation)
    const jumper = t.closest('.jumper');
    if (jumper && compEl && !this.wiring) {
      const c = this.comp(compEl.dataset.id);
      if (c && c.type === 'relay') {
        this.app.pushUndo();
        c.props.trig = String(c.props.trig) === 'L' ? 'H' : 'L';
        this.renderComp(c);
        this.select({ kind: 'comp', id: c.id });
        if (sim) this.app.sim.update();
        this.app.changed();
        this.app.toast(c.props.trig === 'L' ? 'Jumper auf L: Das Relais schaltet bei NIEDRIG an IN.' : 'Jumper auf H: Das Relais schaltet bei HOCH an IN.');
        return;
      }
    }
    if (sim) {
      if (compEl) {
        const c = this.comp(compEl.dataset.id);
        const keyEl = t.closest('.key');
        if (c && keyEl && /^keypad/.test(c.type)) { this.pressedKey = c.id; this.app.sim.pressKey(c.id, keyEl.dataset.key); svg_capture(this.svg, e); return; }
        if (c && c.def.pressable) { this.pressedBtn = c.id; this.app.sim.pressButton(c.id, true); svg_capture(this.svg, e); return; }
        if (c) this.select({ kind: 'comp', id: c.id });
      }
      this.startPan(e);
      return;
    }

    if (this.wiring) {
      if (pinEl) { this.finishWire(this.pinRef(pinEl)); return; }
      const [x, y] = this.pt(e);
      this.wiring.pts.push([Math.round(x / 5) * 5, Math.round(y / 5) * 5]);
      this.drawTemp(e);
      return;
    }
    const endh = t.closest('.wire-endh');
    if (endh) {
      const w = this.project.wires.find(x => x.id === wireEl.dataset.id);
      this.drag = { kind: 'end', w, end: endh.dataset.end, pos: this.pinPos(w[endh.dataset.end]), snap: JSON.stringify(this.app.snapshotData()) };
      this.L.wire.style.pointerEvents = 'none'; // damit der Anschluss darunter gefunden wird
      svg_capture(this.svg, e);
      return;
    }
    if (knot) {
      const w = this.project.wires.find(x => x.id === wireEl.dataset.id), i = +knot.dataset.knot, now = Date.now();
      // Doppelklick auf einen Knickpunkt entfernt ihn
      const last = this.lastKnot;
      this.lastKnot = { w, i, t: now };
      if (last && last.w === w && last.i === i && now - last.t < 450) {
        this.lastKnot = null;
        w.pts.splice(i, 1);
        this.renderWires();
        this.app.changed();
        return;
      }
      this.app.pushUndo();
      this.drag = { kind: 'knot', w, i, moved: false };
      svg_capture(this.svg, e);
      return;
    }
    if (pinEl && !(pinEl.classList.contains('leg') && e.shiftKey)) {
      const ref = this.pinRef(pinEl);
      this.select(null);
      this.wiring = { start: ref, pts: [] };
      this.drawTemp(e);
      return;
    }
    if (wireEl) {
      // Klick wählt das Kabel aus; Ziehen an einer Stelle des Kabels setzt dort einen neuen Knickpunkt
      const w = this.project.wires.find(x => x.id === wireEl.dataset.id);
      this.select({ kind: 'wire', id: wireEl.dataset.id });
      if (w) { this.drag = { kind: 'bend', w, start: this.pt(e) }; svg_capture(this.svg, e); }
      return;
    }
    if (compEl) {
      const c = this.comp(compEl.dataset.id);
      this.select({ kind: 'comp', id: c.id });
      const [x, y] = this.pt(e);
      let carry = [];
      if (c.def.isBreadboard) {
        const ins = computeInsertions(this.project);
        const set = new Set();
        for (const [k, h] of ins) if (h.comp.id === c.id) set.add(k.split(':')[0]);
        carry = this.project.components.filter(o => set.has(o.id)).map(o => ({ o, x: o.x, y: o.y }));
      }
      const moving = new Set([c.id, ...carry.map(k => k.o.id)]);
      const wires = this.project.wires.filter(w => w.pts.length && moving.has(w.a.c) && moving.has(w.b.c)).map(w => ({ w, pts: w.pts.map(p => p.slice()) }));
      this.drag = { kind: 'comp', c, sx: x, sy: y, ox: c.x, oy: c.y, carry, wires, moved: false, snap: JSON.stringify(this.app.snapshotData()) };
      svg_capture(this.svg, e);
      return;
    }
    this.select(null);
    this.startPan(e);
  }

  startPan(e) {
    this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y };
    svg_capture(this.svg, e);
    this.svg.classList.add('panning');
  }

  onMove(e) {
    if (this.wiring) { this.drawTemp(e); }
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pan') {
      this.view.x = d.vx + (e.clientX - d.sx);
      this.view.y = d.vy + (e.clientY - d.sy);
      this.applyView();
    } else if (d.kind === 'comp') {
      const [x, y] = this.pt(e);
      const nx = Math.round((d.ox + x - d.sx) / 10) * 10, ny = Math.round((d.oy + y - d.sy) / 10) * 10;
      if (nx !== d.c.x || ny !== d.c.y) {
        const dx = nx - d.ox, dy = ny - d.oy;
        d.c.x = nx; d.c.y = ny; d.moved = true;
        for (const k of d.carry) { k.o.x = k.x + dx; k.o.y = k.y + dy; this.renderComp(k.o); }
        for (const k of d.wires) k.w.pts = k.pts.map(p => [p[0] + dx, p[1] + dy]);
        this.renderComp(d.c);
        this.renderWires();
        this.renderSelection();
      }
    } else if (d.kind === 'bend') {
      const [x, y] = this.pt(e);
      if (Math.hypot(x - d.start[0], y - d.start[1]) * this.view.k < 5) return; // erst ab kurzem Ziehen
      // Abschnitt finden, der dem Startpunkt am nächsten liegt, und dort einen Knickpunkt einfügen
      const a = this.pinPos(d.w.a), b = this.pinPos(d.w.b);
      if (!a || !b) return;
      const pts = [a, ...d.w.pts, b], [px, py] = d.start;
      let best = 0, bestD = Infinity;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
        const dist = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
        if (dist < bestD) { bestD = dist; best = i; }
      }
      this.app.pushUndo();
      d.w.pts.splice(best, 0, [Math.round(x / 5) * 5, Math.round(y / 5) * 5]);
      this.drag = { kind: 'knot', w: d.w, i: best, moved: true };
      this.renderWires();
    } else if (d.kind === 'end') {
      d.pos = this.pt(e);
      this.renderWires();
    } else if (d.kind === 'knot') {
      const [x, y] = this.pt(e);
      d.w.pts[d.i] = [Math.round(x / 5) * 5, Math.round(y / 5) * 5];
      d.moved = true;
      this.renderWires();
    }
  }

  onUp(e) {
    if (this.pressedBtn) { this.app.sim.pressButton(this.pressedBtn, false); this.pressedBtn = null; }
    if (this.pressedKey) { this.app.sim.pressKey(this.pressedKey, null); this.pressedKey = null; }
    const d = this.drag;
    this.drag = null;
    this.svg.classList.remove('panning');
    if (!d) return;
    if (d.kind === 'comp' && d.moved) {
      this.app.pushUndoRaw(d.snap);
      this.markInsertions();
      this.app.changed();
    }
    if (d.kind === 'knot' && d.moved) this.app.changed();
    if (d.kind === 'end') {
      // Kabelende auf einen anderen Anschluss umstecken
      const el = e && document.elementFromPoint(e.clientX, e.clientY);
      const pinEl = el && el.closest && el.closest('.pin');
      this.L.wire.style.pointerEvents = '';
      const ref = pinEl && this.pinRef(pinEl), other = d.w[d.end === 'a' ? 'b' : 'a'];
      if (ref && !(ref.c === other.c && ref.p === other.p) && !(ref.c === d.w[d.end].c && ref.p === d.w[d.end].p)) {
        this.app.pushUndoRaw(d.snap);
        // Farbe anpassen: Rot und Schwarz sind für Plus und GND reserviert.
        // Liegt das Kabel jetzt an Plus/GND → rot/schwarz; war es rot/schwarz und ist jetzt ein Signal → Signalfarbe.
        // Eine von Hand gewählte Signalfarbe bleibt bei Signal-Kabeln erhalten.
        const autoBefore = this.app.defaultWireColor(d.w.a, d.w.b);
        d.w[d.end] = ref;
        const autoNow = this.app.defaultWireColor(d.w.a, d.w.b), power = k => k === 'rot' || k === 'schwarz';
        if (power(autoNow) || power(d.w.color) || d.w.color === autoBefore) d.w.color = autoNow;
        this.app.changed();
      }
      this.renderWires();
    }
  }

  /* Ausgewähltes Bauteil verdoppeln (Strg+D) */
  duplicateSelection() {
    if (!this.sel || this.sel.kind !== 'comp') return;
    const c = this.comp(this.sel.id);
    if (!c) return;
    if (c.def.fixed) { this.app.toast('Mikrocontroller und Steckplatine lassen sich nicht verdoppeln.'); return; }
    this.app.pushUndo();
    const k = makeComp(c.type, c.x + 30, c.y + 30, c.rot, JSON.parse(JSON.stringify(c.props)), this.newId('c'));
    this.project.components.push(k);
    this.renderAll();
    this.select({ kind: 'comp', id: k.id });
    this.app.changed();
  }

  drawTemp(e) {
    if (!this.wiring) { this.L.tmp.innerHTML = ''; return; }
    const a = this.pinPos(this.wiring.start);
    const [x, y] = this.pt(e);
    const pts = [a, ...this.wiring.pts, [x, y]];
    this.L.tmp.innerHTML = `<path d="${this.wirePath(pts)}" class="wire-temp"/>`;
  }

  finishWire(ref) {
    const s = this.wiring.start;
    if (ref.c === s.c && ref.p === s.p) { this.cancelWire(); return; }
    this.app.pushUndo();
    const w = { id: this.newId('w'), a: s, b: ref, pts: this.wiring.pts, color: this.app.defaultWireColor(s, ref) };
    this.project.wires.push(w);
    this.wiring = null;
    this.L.tmp.innerHTML = '';
    this.select({ kind: 'wire', id: w.id });
    this.app.changed();
  }

  cancelWire() { this.wiring = null; this.L.tmp.innerHTML = ''; }

  fitView() {
    if (!this.project.components.length) { this.view = { x: 40, y: 40, k: 1.6 }; this.applyView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.project.components) {
      const [a, b, cc, d] = c.def.bbox;
      for (const [px, py] of [[a, b], [cc, d], [a, d], [cc, b]]) {
        const [rx, ry] = rotPoint(px, py, c.rot || 0);
        x0 = Math.min(x0, c.x + rx); y0 = Math.min(y0, c.y + ry); x1 = Math.max(x1, c.x + rx); y1 = Math.max(y1, c.y + ry);
      }
    }
    for (const w of this.project.wires) for (const p of w.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const r = this.svg.getBoundingClientRect();
    const pad = 40;
    // links Platz lassen, wenn dort die Aufgabenkarte steht (nur bei genug Breite)
    const tp = document.querySelector('#taskPanel');
    const left = tp && !tp.hidden && r.width > 900 ? tp.getBoundingClientRect().width + 12 : 0;
    const k = Math.max(0.3, Math.min(3, Math.min((r.width - left - 2 * pad) / (x1 - x0), (r.height - 2 * pad) / (y1 - y0))));
    this.view = { k, x: left + (r.width - left - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k };
    this.applyView();
  }
}

function svg_capture(svg, e) { try { svg.setPointerCapture(e.pointerId); } catch (err) { /* egal */ } }
