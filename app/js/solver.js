/* Netzliste und Knotenpotential-Verfahren (vereinfachte Elektrik-Simulation) */
'use strict';

function rotPoint(x, y, rot) {
  switch (((rot % 360) + 360) % 360) {
    case 90: return [-y, x];
    case 180: return [-x, -y];
    case 270: return [y, -x];
    default: return [x, y];
  }
}
function worldPin(comp, pin) {
  const [rx, ry] = rotPoint(pin.x, pin.y, comp.rot || 0);
  return [comp.x + rx, comp.y + ry];
}

class UnionFind {
  constructor() { this.p = new Map(); }
  find(a) {
    if (!this.p.has(a)) this.p.set(a, a);
    let r = a;
    while (this.p.get(r) !== r) r = this.p.get(r);
    let c = a;
    while (this.p.get(c) !== r) { const n = this.p.get(c); this.p.set(c, r); c = n; }
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

/* Welche Bauteilbeine stecken in welchem Loch? */
function computeInsertions(project) {
  const holes = new Map();
  for (const c of project.components) {
    if (!c.def.isBreadboard) continue;
    for (const p of c.def.pins) {
      const [x, y] = worldPin(c, p);
      holes.set(x + ',' + y, { comp: c, pin: p });
    }
  }
  const ins = new Map();
  for (const c of project.components) {
    if (c.def.isBreadboard) continue;
    for (const p of c.def.pins) {
      if (p.kind !== 'leg') continue;
      const [x, y] = worldPin(c, p);
      const h = holes.get(x + ',' + y);
      if (h) ins.set(c.id + ':' + p.id, h);
    }
  }
  return ins;
}

function buildNetlist(project) {
  const uf = new UnionFind();
  for (const c of project.components) {
    for (const p of c.def.pins) uf.find(c.id + ':' + p.id);
    const groups = typeof c.def.internal === 'function' ? c.def.internal(c) : c.def.internal;
    if (groups) for (const grp of groups) for (let i = 1; i < grp.length; i++) uf.union(c.id + ':' + grp[0], c.id + ':' + grp[i]);
    if (c.def.isBreadboard) for (const p of c.def.pins) uf.union(c.id + ':' + p.id, c.id + ':#' + bbGroup(p.id));
  }
  const ins = computeInsertions(project);
  for (const [k, h] of ins) uf.union(k, h.comp.id + ':' + h.pin.id);
  for (const w of project.wires) uf.union(w.a.c + ':' + w.a.p, w.b.c + ':' + w.b.p);
  const idx = new Map();
  const netOf = new Map();
  const members = [];
  const breadboards = new Set(project.components.filter(c => c.def.isBreadboard).map(c => c.id));
  for (const k of uf.p.keys()) {
    const r = uf.find(k);
    if (!idx.has(r)) { idx.set(r, idx.size); members.push([]); }
    const n = idx.get(r);
    netOf.set(k, n);
    const [cid, pid] = k.split(':');
    if (!breadboards.has(cid) && pid[0] !== '#') members[n].push(k);
  }
  return { netOf, count: idx.size, insertions: ins, members, net: (c, p) => netOf.get(c + ':' + p) };
}

function ldrResistance(light) { return 20000 * Math.pow(500 / 20000, Math.max(0, Math.min(100, light)) / 100); }
function ntcResistance(t) { return 10000 * Math.exp(3950 * (1 / (273.15 + Number(t)) - 1 / 298.15)); }

/* Ist ein Modul mit 5V/3,3V und GND des Arduino verbunden? Liefert die Versorgungsspannung oder 0. */
function moduleSupply(nl, c, vccPin, gndPin, n5, n33, g) {
  if (nl.net(c.id, gndPin || 'GND') !== g) return 0;
  const v = nl.net(c.id, vccPin || 'VCC');
  if (v === n5) return 5;
  if (v === n33) return 3.3;
  return 0;
}

/* Löst die Schaltung für den aktuellen Zustand.
   io: { outputs: {D3:{v:5}}, pressed:Set(compId), keys: Map(compId->key), broken:Set(key) } */
function solveCircuit(project, nl, io) {
  const uno = project.components.find(c => c.def.mcu);
  const res = { V: new Array(nl.count).fill(NaN), floating: new Set(), led: {}, pinI: {}, ground: -1, v5: -1, short: false, ok: !!uno, shuntI: {} };
  if (!uno) return res;
  const M = uno.def.mcu;
  const g = nl.net(uno.id, M.gnd);
  const n5 = nl.net(uno.id, M.v5);
  const n33 = nl.net(uno.id, M.v33);
  res.ground = g; res.v5 = n5;
  if (n5 === g || n33 === g) res.short = true;

  const edges = [];
  const lin = [];
  const sources = []; // gegen GND: {n,G,V,id}
  const floatSrc = []; // zwischen zwei Knoten: {a,b,G,V}
  const leds = [];
  const R = (a, b, ohm) => { lin.push({ a, b, G: 1 / Math.max(ohm, 1e-3) }); edges.push([a, b]); };
  const pressed = io.pressed || new Set();
  const broken = io.broken || new Set();

  if (!res.short) {
    sources.push({ n: n5, G: 10, V: 5, id: '5V' });
    sources.push({ n: n33, G: 10, V: 3.3, id: '3V3' });
  }
  const outByNet = new Map();
  for (const pin in io.outputs) {
    const o = io.outputs[pin];
    if (o) { sources.push({ n: nl.net(uno.id, pin), G: 1 / 25, V: o.v, id: pin }); outByNet.set(nl.net(uno.id, pin), o); }
  }
  // Versorgungsspannung an einem Netz: 5 V / 3,3 V des Mikrocontrollers oder eine Spannungsquelle gegen GND
  const supplyAt = net => {
    if (net === n5) return 5;
    if (net === n33) return 3.3;
    const s = project.components.find(x => x.type === 'source' && nl.net(x.id, 'P') === net && nl.net(x.id, 'N') === g);
    return s ? Number(s.props.volt) || 0 : 0;
  };
  // Pegel an einem Eingang (0 … 1, bei PWM der Tastgrad)
  const level = net => { const o = outByNet.get(net); return o && o.v > M.logic / 2 ? (o.duty == null ? 1 : o.duty) : 0; };

  for (const c of project.components) {
    const n = p => nl.net(c.id, p);
    const sup = (v, gd) => moduleSupply(nl, c, v, gd, n5, n33, g);
    switch (c.type) {
      case 'resistor': R(n('1'), n('2'), c.props.ohm); break;
      case 'ldr': R(n('1'), n('2'), ldrResistance(c.props.light)); break;
      case 'ntc': R(n('1'), n('2'), ntcResistance(c.props.temp)); break;
      case 'poti': {
        const pos = Math.max(0, Math.min(100, c.props.position)) / 100;
        R(n('1'), n('W'), Math.max(1, c.props.ohm * pos));
        R(n('W'), n('2'), Math.max(1, c.props.ohm * (1 - pos)));
        break;
      }
      case 'motor': case 'gearmotor': R(n('P'), n('N'), 200); break;
      case 'soil': R(n('1'), n('2'), 1e6 * Math.pow(1e-3, Math.max(0, Math.min(100, Number(c.props.wet))) / 100)); break;
      case 'oled': break;
      case 'piezo': R(n('P'), n('N'), 1e5); break;
      case 'button': case 'button2': case 'pushbutton':
        if (pressed.has(c.id)) R(n(c.def.sw[0]), n(c.def.sw[1]), 0.05);
        break;
      case 'keypad3': case 'keypad4': {
        const k = io.keys && io.keys.get(c.id);
        if (k) KEYMAP[c.def.cols].forEach((row, r) => row.forEach((kk, col) => { if (kk === k) R(n('R' + (r + 1)), n('C' + (col + 1)), 0.05); }));
        break;
      }
      case 'led': {
        if (broken.has(c.id)) break;
        const col = LED_COLORS[c.props.color] || LED_COLORS.rot;
        leds.push({ key: c.id, a: n('A'), k: n('K'), vf: col.vf, on: false });
        break;
      }
      case 'rgbled':
        for (const [p, vf] of [['R', 1.9], ['G', 2.9], ['B', 3.0]]) if (!broken.has(c.id + ':' + p)) leds.push({ key: c.id + ':' + p, a: n(p), k: n('K'), vf, on: false });
        break;
      case 'source': floatSrc.push({ a: n('P'), b: n('N'), G: 1 / Math.max(0.01, Number(c.props.ri) || 1), V: Number(c.props.volt) || 0 }); edges.push([n('P'), n('N')]); break;
      case 'touch': { const v = sup(); if (v) sources.push({ n: n('SIG'), G: 1 / 100, V: pressed.has(c.id) ? v : 0, id: c.id }); break; }
      case 'pir': { const v = sup(); if (v) sources.push({ n: n('OUT'), G: 1 / 100, V: pressed.has(c.id) ? 3.3 : 0, id: c.id }); break; }
      case 'tmp36': { const v = sup(); if (v) sources.push({ n: n('OUT'), G: 1 / 100, V: Math.max(0, Math.min(v, 0.5 + 0.01 * Number(c.props.temp))), id: c.id }); break; }
      case 'moisture': { const v = sup(); if (v) sources.push({ n: n('OUT'), G: 1 / 1000, V: v / 5 * (3.0 - 1.6 * Math.max(0, Math.min(100, Number(c.props.wet))) / 100), id: c.id }); break; }
      case 'strip': case 'ring': if (sup()) R(n('VCC'), n('GND'), 1000); break;
      case 'ads1115': for (const p of ['A0', 'A1', 'A2', 'A3']) R(n(p), g, 3e6); break;
      case 'ina219': R(n('VINP'), n('VINM'), 0.1); res.shuntI[c.id] = [n('VINP'), n('VINM')]; break;
      case 'l298n': {
        // L298N: OUT1/OUT2 folgen IN1/IN2, wenn ENA freigibt (Jumper oder Pegel). Etwa 2 V Spannungsverlust.
        if (n('GND') !== g) break;
        const vs = supplyAt(n('VS'));
        if (!vs) break;
        const vout = Math.max(0, vs - 2);
        for (const [en, a, b, o1, o2, jp] of [['ENA', 'IN1', 'IN2', 'OUT1', 'OUT2', c.props.ena], ['ENB', 'IN3', 'IN4', 'OUT3', 'OUT4', c.props.enb]]) {
          const e = String(jp) !== '0' ? 1 : level(n(en));
          sources.push({ n: n(o1), G: 1 / 2, V: vout * e * level(n(a)), id: c.id + ':' + o1 });
          sources.push({ n: n(o2), G: 1 / 2, V: vout * e * level(n(b)), id: c.id + ':' + o2 });
        }
        break;
      }
      case 'mdriver': {
        // L9110S: Ausgang 1 folgt IA, Ausgang 2 folgt IB (mittlere Spannung bei PWM)
        const v = sup();
        if (!v) break;
        for (const ch of ['A', 'B']) {
          sources.push({ n: n('M' + ch + '1'), G: 1 / 2, V: v * level(n(ch + 'IA')), id: c.id + ':' + ch + '1' });
          sources.push({ n: n('M' + ch + '2'), G: 1 / 2, V: v * level(n(ch + 'IB')), id: c.id + ':' + ch + '2' });
        }
        break;
      }
    }
  }

  const used = new Set();
  lin.forEach(e => { used.add(e.a); used.add(e.b); });
  sources.forEach(s => used.add(s.n));
  floatSrc.forEach(s => { used.add(s.a); used.add(s.b); });
  leds.forEach(l => { used.add(l.a); used.add(l.k); });
  used.delete(g);
  const nodes = [...used];
  const row = new Map(nodes.map((nn, i) => [nn, i]));
  const N = nodes.length;
  const RS = 15;

  let V = new Array(nl.count).fill(0);
  for (let iter = 0; iter < 40; iter++) {
    const A = Array.from({ length: N }, () => new Float64Array(N));
    const b = new Float64Array(N);
    const stampG = (a, bb, G) => {
      const ia = row.get(a), ib = row.get(bb);
      if (ia !== undefined) A[ia][ia] += G;
      if (ib !== undefined) A[ib][ib] += G;
      if (ia !== undefined && ib !== undefined) { A[ia][ib] -= G; A[ib][ia] -= G; }
    };
    const inj = (a, I) => { const ia = row.get(a); if (ia !== undefined) b[ia] += I; };
    for (let i = 0; i < N; i++) A[i][i] += 1e-10;
    lin.forEach(e => stampG(e.a, e.b, e.G));
    sources.forEach(s => { stampG(s.n, g, s.G); inj(s.n, s.G * s.V); });
    floatSrc.forEach(s => { stampG(s.a, s.b, s.G); inj(s.a, s.G * s.V); inj(s.b, -s.G * s.V); });
    leds.forEach(l => {
      if (l.on) { const G = 1 / RS; stampG(l.a, l.k, G); inj(l.a, G * l.vf); inj(l.k, -G * l.vf); }
      else stampG(l.a, l.k, 1e-10);
    });
    const x = gauss(A, b);
    V = new Array(nl.count).fill(0);
    nodes.forEach((nn, i) => { V[nn] = x[i]; });
    let changed = false;
    leds.forEach(l => {
      const vak = V[l.a] - V[l.k];
      if (!l.on && vak > l.vf + 1e-6) { l.on = true; changed = true; }
      else if (l.on && (vak - l.vf) / RS < -1e-6) { l.on = false; changed = true; }
    });
    if (!changed) break;
  }

  leds.forEach(l => { if (l.on) edges.push([l.a, l.k]); });
  const adj = new Map();
  edges.forEach(([a, bb]) => {
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(bb)) adj.set(bb, []);
    adj.get(a).push(bb); adj.get(bb).push(a);
  });
  const seen = new Set([g]);
  const stack = [g];
  sources.forEach(s => { if (!seen.has(s.n)) { seen.add(s.n); stack.push(s.n); } });
  while (stack.length) { const nn = stack.pop(); for (const m of adj.get(nn) || []) if (!seen.has(m)) { seen.add(m); stack.push(m); } }
  for (let nn = 0; nn < nl.count; nn++) {
    if (!seen.has(nn)) { res.floating.add(nn); res.V[nn] = NaN; } else res.V[nn] = nn === g ? 0 : V[nn];
  }
  leds.forEach(l => { res.led[l.key] = { I: l.on ? Math.max(0, (V[l.a] - V[l.k] - l.vf) / RS) : 0 }; });
  sources.forEach(s => { res.pinI[s.id] = s.G * (s.V - (s.n === g ? 0 : V[s.n])); });
  for (const id in res.shuntI) { const [a, b] = res.shuntI[id]; res.shuntI[id] = { I: ((a === g ? 0 : V[a]) - (b === g ? 0 : V[b])) / 0.1, Vbus: b === g ? 0 : V[b], Vsh: (a === g ? 0 : V[a]) - (b === g ? 0 : V[b]) }; }
  return res;
}

function gauss(A, b) {
  const n = b.length;
  const M = A.map((r, i) => { const a = Array.from(r); a.push(b[i]); return a; });
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-15) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => (Math.abs(r[i]) < 1e-15 ? 0 : r[n] / r[i]));
}
