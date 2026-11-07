/* Bauteil-Definitionen: Geometrie, Anschlüsse, Darstellung (eigene Zeichnungen, frei nutzbar).
   Raster: 10 Einheiten = 2,54 mm (Rastermaß einer Steckplatine). */
'use strict';

const LED_COLORS = {
  rot:   { fill: '#e53935', dim: '#9c3a36', glow: '#ff5a4f', vf: 1.8 },
  gelb:  { fill: '#ffd31a', dim: '#a8923a', glow: '#ffe866', vf: 2.0 },
  gruen: { fill: '#2fd35a', dim: '#3e7a4c', glow: '#6dff8f', vf: 2.1 },
  blau:  { fill: '#3f86ff', dim: '#3b5487', glow: '#7fb0ff', vf: 3.0 },
  weiss: { fill: '#ffffff', dim: '#c9cfd3', glow: '#ffffff', vf: 3.0 },
};
const LED_COLOR_NAMES = { rot: 'Rot', gelb: 'Gelb', gruen: 'Grün', blau: 'Blau', weiss: 'Weiß' };

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* Farbringe eines Widerstands (4-Ring-Code) */
const BAND_COLORS = ['#111', '#7a4a1e', '#d32f2f', '#f57c00', '#fdd835', '#2e7d32', '#1565c0', '#7b1fa2', '#9e9e9e', '#fafafa'];
function resistorBands(ohm) {
  if (!(ohm > 0)) ohm = 1000;
  let exp = Math.floor(Math.log10(ohm)) - 1;
  let digits = Math.round(ohm / Math.pow(10, exp));
  if (digits >= 100) { digits = Math.round(digits / 10); exp += 1; }
  const d1 = Math.floor(digits / 10), d2 = digits % 10;
  const mult = exp < 0 ? (exp === -1 ? '#c9a227' : '#c0c0c0') : BAND_COLORS[Math.min(exp, 9)];
  return [BAND_COLORS[d1], BAND_COLORS[d2], mult, '#c9a227'];
}
function formatOhm(ohm) {
  if (ohm >= 1e6) return (ohm / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' MΩ';
  if (ohm >= 1e3) return (ohm / 1e3).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' kΩ';
  return ohm.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Ω';
}

function pinRect(p) {
  const k = p.kind === 'socket' ? 'pin socket' : 'pin leg';
  return `<rect class="${k}" data-pin="${p.id}" x="${p.x - 3.5}" y="${p.y - 3.5}" width="7" height="7" rx="1"><title>${esc(p.label || p.id)}</title></rect>`;
}
const pinsOf = comp => comp.def.pins.map(pinRect).join('');
const leg = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#a7adb2" stroke-width="1.7" stroke-linecap="round" fill="none"/>`;
const hdr = (x, y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#1b1b1b"/>`;

/* ---------- Steckplatine ---------- */
const BB_COLS = 30;
const BB_ROWS_TOP = ['a', 'b', 'c', 'd', 'e'];
const BB_ROWS_BOT = ['f', 'g', 'h', 'i', 'j'];
const BB_ROW_Y = { a: 40, b: 50, c: 60, d: 70, e: 80, f: 110, g: 120, h: 130, i: 140, j: 150 };
const bbPins = (() => {
  const pins = [];
  for (let c = 0; c < BB_COLS; c++) {
    const x = 20 + c * 10;
    for (const r of [...BB_ROWS_TOP, ...BB_ROWS_BOT]) pins.push({ id: `${c + 1}${r}`, x, y: BB_ROW_Y[r], kind: 'hole', label: `${r}${c + 1}` });
    if (c % 6 !== 5) {
      pins.push({ id: `tm-${c + 1}`, x, y: 10, kind: 'hole', label: 'Minus (oben)' });
      pins.push({ id: `tp-${c + 1}`, x, y: 20, kind: 'hole', label: 'Plus (oben)' });
      pins.push({ id: `bm-${c + 1}`, x, y: 180, kind: 'hole', label: 'Minus (unten)' });
      pins.push({ id: `bp-${c + 1}`, x, y: 190, kind: 'hole', label: 'Plus (unten)' });
    }
  }
  return pins;
})();

function bbGroup(pinId) {
  const m = /^(tm|tp|bm|bp)-/.exec(pinId);
  if (m) return m[1];
  const mm = /^(\d+)([a-j])$/.exec(pinId);
  if (!mm) return pinId;
  return mm[1] + (BB_ROWS_TOP.includes(mm[2]) ? 'top' : 'bot');
}

function renderBreadboard() {
  let s = `<rect class="body" x="0" y="0" width="330" height="200" rx="6" fill="#efeee8" stroke="#cfcdc3"/>`;
  s += `<rect class="body" x="4" y="93" width="322" height="9" rx="2" fill="#e0ded6"/>`;
  s += `<line x1="12" y1="3.5" x2="318" y2="3.5" stroke="#2f6fe0" stroke-width="1.6"/><line x1="12" y1="26.5" x2="318" y2="26.5" stroke="#e53935" stroke-width="1.6"/>`;
  s += `<line x1="12" y1="173.5" x2="318" y2="173.5" stroke="#2f6fe0" stroke-width="1.6"/><line x1="12" y1="196.5" x2="318" y2="196.5" stroke="#e53935" stroke-width="1.6"/>`;
  s += `<text x="6" y="12.5" class="bbl" fill="#2f6fe0">–</text><text x="5" y="22.5" class="bbl" fill="#e53935">+</text>`;
  s += `<text x="6" y="182.5" class="bbl" fill="#2f6fe0">–</text><text x="5" y="192.5" class="bbl" fill="#e53935">+</text>`;
  for (const r in BB_ROW_Y) s += `<text x="8" y="${BB_ROW_Y[r] + 2.5}" class="bbs">${r}</text><text x="317" y="${BB_ROW_Y[r] + 2.5}" class="bbs">${r}</text>`;
  for (let c = 1; c <= BB_COLS; c++) {
    if (c === 1 || c % 5 === 0) {
      const x = 20 + (c - 1) * 10;
      s += `<text x="${x}" y="33.5" class="bbs" text-anchor="middle">${c}</text><text x="${x}" y="161" class="bbs" text-anchor="middle">${c}</text>`;
    }
  }
  for (const p of bbPins) s += `<rect class="pin hole" data-pin="${p.id}" x="${p.x - 2.5}" y="${p.y - 2.5}" width="5" height="5" rx="0.8"><title>${esc(p.label)}</title></rect>`;
  return s;
}

/* ---------- Arduino Uno (Nachbau-Variante mit SMD-Chip, wie in der Schülerunterlage) ---------- */
const UNO_PINS = (() => {
  const pins = [];
  const top = [['SCL', 100], ['SDA', 110], ['AREF', 120], ['GND_T', 130, 'GND'],
    ['D13', 140, '13'], ['D12', 150, '12'], ['D11', 160, '~11'], ['D10', 170, '~10'], ['D9', 180, '~9'], ['D8', 190, '8'],
    ['D7', 210, '7'], ['D6', 220, '~6'], ['D5', 230, '~5'], ['D4', 240, '4'], ['D3', 250, '~3'], ['D2', 260, '2'], ['D1', 270, 'TX→1'], ['D0', 280, 'RX←0']];
  for (const [id, x, lab] of top) pins.push({ id, x, y: 10, kind: 'socket', label: /^D\d/.test(id) ? id : (lab || id), short: lab || id });
  const bot = [['IOREF', 130], ['RESET', 140], ['3V3', 150, '3.3V'], ['5V', 160], ['GND_1', 170, 'GND'], ['GND_2', 180, 'GND'], ['VIN', 190, 'Vin'],
    ['A0', 210], ['A1', 220], ['A2', 230], ['A3', 240], ['A4', 250], ['A5', 260]];
  for (const [id, x, lab] of bot) pins.push({ id, x, y: 200, kind: 'socket', label: lab || id, short: lab || id });
  return pins;
})();

function renderUno(comp, st) {
  const ledL = st && st.pin13 ? '#ffb300' : '#8a7a4a';
  const on = st && st.running ? '#46ff7a' : '#2f6b3d';
  const W = '#eef4ff';
  let s = '';
  s += `<rect class="body" x="0" y="0" width="300" height="210" rx="7" fill="#2350c8" stroke="#163a99" stroke-width="1.2"/>`;
  s += `<rect x="3" y="3" width="294" height="204" rx="5" fill="none" stroke="#3a68dd" stroke-width="1"/>`;
  for (const [x, y] of [[64, 9], [291, 66], [61, 201], [291, 178]]) s += `<circle cx="${x}" cy="${y}" r="5.2" fill="#f4f5f3" stroke="#c9ced2" stroke-width="1.6"/>`;
  // Reset-Taster oben links
  s += `<rect x="10" y="5" width="20" height="18" rx="2" fill="#d9dde1" stroke="#8b9399"/><circle cx="20" cy="14" r="5.5" fill="#e0453a" stroke="#9a2b22"/>`;
  // USB-B-Buchse
  s += `<rect x="-18" y="30" width="58" height="50" rx="2" fill="#c8cdd1" stroke="#8b9399"/><rect x="-18" y="36" width="10" height="38" fill="#aab1b7"/><rect x="-14" y="44" width="20" height="22" rx="1" fill="#5f666c"/><path d="M8 34 H40 M8 76 H40" stroke="#eceef0" stroke-width="1.2"/>`;
  // Hohlbuchse unten links
  s += `<rect x="-12" y="158" width="50" height="40" rx="3" fill="#1e1e1e" stroke="#000"/><rect x="-12" y="164" width="10" height="28" fill="#2b2b2b"/><circle cx="12" cy="178" r="9" fill="#3b3b3b"/><circle cx="12" cy="178" r="3" fill="#b9b9b9"/>`;
  // Quarz, CH340, Spannungsregler, Elkos
  s += `<rect x="50" y="32" width="38" height="12" rx="6" fill="#d6dade" stroke="#8f979d"/><text x="69" y="40.5" class="chip2" text-anchor="middle">12.000</text>`;
  s += `<rect x="48" y="56" width="38" height="17" rx="1.5" fill="#1d1d1f"/><g stroke="#c9ccd0" stroke-width="1">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<path d="M${51 + i * 4.5} 53 v3 M${51 + i * 4.5} 73 v3"/>`).join('')}</g><text x="67" y="67" class="chip" text-anchor="middle">CH340</text>`;
  s += `<rect x="10" y="112" width="22" height="16" rx="1" fill="#1d1d1f"/><rect x="13" y="104" width="16" height="8" fill="#b8bec4"/><path d="M14 128v4M21 128v4M28 128v4" stroke="#b8bec4" stroke-width="1.6"/>`;
  for (const x of [58, 84]) s += `<circle cx="${x}" cy="172" r="11" fill="#2a2a2c" stroke="#111"/><circle cx="${x}" cy="172" r="8.5" fill="#cfd5da"/><path d="M${x - 5} 172 h10 M${x} 167 v10" stroke="#9aa1a7" stroke-width="1"/><path d="M${x - 11} 172 a11 11 0 0 1 4 -8.5" stroke="#f2f2f2" stroke-width="2" fill="none"/>`;
  // kleine SMD-Bauteile
  for (const [x, y] of [[44, 82], [52, 82], [60, 82], [44, 96], [70, 96], [78, 96], [42, 140], [52, 140], [62, 140], [92, 48], [92, 60], [222, 84], [222, 116], [236, 100]]) s += `<rect x="${x}" y="${y}" width="5" height="3" fill="#c9a66b" stroke="#7a6640" stroke-width=".3"/>`;
  s += `<rect x="64" y="114" width="20" height="16" fill="#1d1d1f"/><text x="74" y="124" class="chip2" text-anchor="middle" fill="#888">U5</text>`;
  // Leuchtdioden-Reihe mit Beschriftung
  const leds = [['ON', on], ['TX', '#8a7a4a'], ['RX', '#8a7a4a'], ['L', ledL]];
  leds.forEach(([t, c], i) => { const y = 44 + i * 9; s += `<rect x="104" y="${y}" width="9" height="5" rx="1" fill="${c}" stroke="#555" stroke-width=".3"/><text x="117" y="${y + 4.5}" class="silk">${t}</text>`; });
  for (let i = 0; i < 5; i++) s += `<rect x="104" y="${84 + i * 8}" width="9" height="4" fill="#c9a66b" stroke="#7a6640" stroke-width=".3"/>`;
  // Mikrocontroller ATmega328P (SMD, gerade)
  s += `<rect x="158" y="96" width="38" height="38" rx="1.5" fill="#1b1b1d" stroke="#000"/>`;
  for (let i = 0; i < 8; i++) { const o = 99.5 + i * 4.4; s += `<path d="M${o + 61} 93 v3 M${o + 61} 134 v3 M155 ${o} h3 M196 ${o} h3" stroke="#c8ccd0" stroke-width="1.5"/>`; }
  s += `<circle cx="163" cy="101" r="1.5" fill="#555"/><text x="177" y="114" class="chip" text-anchor="middle">ATMEGA</text><text x="177" y="121" class="chip" text-anchor="middle">328P</text>`;
  // ICSP und Zusatz-Stiftleiste
  s += `<text x="281" y="78" class="silk" text-anchor="middle">ICSP</text><rect x="270" y="82" width="22" height="32" rx="1" fill="#151515"/>${[0, 1, 2].map(r => [0, 1].map(c => `<rect x="${273 + c * 10}" y="${85 + r * 10}" width="5" height="5" fill="#d7b43d"/>`).join('')).join('')}`;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s += `<circle cx="${254 + c * 11.5}" cy="${130 + r * 12}" r="4" fill="#e8c86a" stroke="#a88a2c"/><circle cx="${254 + c * 11.5}" cy="${130 + r * 12}" r="1.8" fill="#2350c8"/>`;
  s += `<text x="247" y="132" class="silksm" text-anchor="end">RX TX 5V GND</text><text x="247" y="144" class="silksm" text-anchor="end">SCL SDA 5V GND</text><text x="247" y="156" class="silksm" text-anchor="end">3.3V 3.3V GND GND</text>`;
  // Beschriftung
  s += `<text x="200" y="80" class="silkbig" text-anchor="middle">UNO</text>`;
  s += `<text x="195" y="46" class="silk" text-anchor="middle">DIGITAL PWM(~)</text><text x="160" y="172" class="silk" text-anchor="middle">POWER</text><text x="235" y="172" class="silk" text-anchor="middle">ANALOG IN</text>`;
  s += `<path d="M126 176 H196 M204 176 H266" stroke="${W}" stroke-width=".8"/>`;
  // Stiftleisten
  s += `<rect x="94" y="3" width="102" height="14" rx="1" fill="#141414"/><rect x="204" y="3" width="82" height="14" rx="1" fill="#141414"/>`;
  s += `<rect x="124" y="193" width="72" height="14" rx="1" fill="#141414"/><rect x="204" y="193" width="62" height="14" rx="1" fill="#141414"/>`;
  for (const p of UNO_PINS) {
    const ty = p.y < 100 ? 20 : 190;
    s += `<text x="${p.x}" y="${ty}" class="silkpin" text-anchor="${p.y < 100 ? 'end' : 'start'}" transform="rotate(-90 ${p.x} ${ty})" dy="2">${esc(p.short)}</text>`;
    s += pinRect(p);
  }
  return s;
}

/* ---------- Grundbauteile ---------- */
function ledDome(cx, base, fill, opacity, flat) {
  // Gehäuse mit Rand; flat=true: abgeflachte Seite rechts (Kathode)
  const r = 7, top = base - 9;
  const fx = flat ? r - 1.4 : r;
  const fy = flat ? top - Math.sqrt(r * r - fx * fx) : top;
  const d = `M${cx - r} ${base - 3} V${top} A${r} ${r} 0 0 1 ${cx + fx} ${fy.toFixed(2)} V${base - 3} Z`;
  return `<path class="body" d="${d}" fill="${fill}" fill-opacity="${opacity}" stroke="rgba(0,0,0,.35)" stroke-width=".7"/>` +
    `<path d="M${cx - r - 1.3} ${base - 3} H${cx + (flat ? fx : r + 1.3)} V${base} H${cx - r - 1.3} Z" fill="${fill}" fill-opacity="${opacity}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`;
}

function renderLED(comp, st) {
  const c = LED_COLORS[comp.props.color] || LED_COLORS.rot;
  const b = st ? Math.max(0, Math.min(1, st.brightness || 0)) : 0;
  const broken = st && st.broken;
  const lit = b > 0.01 && !broken;
  const base = -14;
  let s = '';
  // Anode (links) ist länger: geknickt dargestellt
  s += `<path d="M0 0 V-5 L-3 -8 L0 -11 V${base}" stroke="#a7adb2" stroke-width="1.7" fill="none" stroke-linejoin="round"/>` + leg(10, 0, 10, base);
  if (lit) s += `<circle cx="5" cy="${base - 12}" r="${9 + 9 * b}" fill="${c.glow}" opacity="${0.12 + 0.5 * b}"/>`;
  const fill = lit ? mix(c.dim, c.fill, Math.pow(b, 0.6)) : c.dim;
  s += ledDome(5, base, fill, lit ? 0.95 : 0.78, true);
  if (lit) s += `<ellipse cx="2.4" cy="${base - 14}" rx="1.6" ry="3" fill="#fff" opacity="${0.35 + 0.4 * b}"/>`;
  if (broken) s += `<path d="M1 ${base - 18} L4 ${base - 12} L2 ${base - 10} L7 ${base - 4}" stroke="#111" stroke-width="1.2" fill="none"/><path d="M-6 ${base - 20} q3 -6 0 -10 M16 ${base - 20} q-3 -6 0 -10" stroke="#777" stroke-width="1" fill="none" opacity=".7"/>`;
  return s + pinsOf(comp);
}

function renderRGB(comp, st) {
  const lv = st && st.rgb ? st.rgb : [0, 0, 0];
  const broken = st && st.broken;
  const base = -16;
  let s = leg(0, 0, 0, base) + `<path d="M10 0 V-5 L7 -8 L10 -11 V${base}" stroke="#a7adb2" stroke-width="1.7" fill="none"/>` + leg(20, 0, 20, base) + leg(30, 0, 30, base);
  const r = Math.round(255 * Math.min(1, lv[0])), g = Math.round(255 * Math.min(1, lv[1])), bl = Math.round(255 * Math.min(1, lv[2]));
  const mx = Math.max(r, g, bl) / 255;
  const lit = mx > 0.01 && !broken;
  const col = lit ? `rgb(${Math.round(r / mx)}, ${Math.round(g / mx)}, ${Math.round(bl / mx)})` : '#e8ecee';
  if (lit) s += `<circle cx="15" cy="${base - 14}" r="${12 + 10 * mx}" fill="${col}" opacity="${0.15 + 0.45 * mx}"/>`;
  s += `<path class="body" d="M5 ${base - 3} V${base - 12} A10 10 0 0 1 25 ${base - 12} V${base - 3} Z" fill="${lit ? col : '#e3e8ea'}" fill-opacity="${lit ? 0.6 + 0.4 * mx : 0.85}" stroke="rgba(0,0,0,.3)" stroke-width=".7"/>`;
  s += `<rect x="3.5" y="${base - 3}" width="22" height="3" fill="#e3e8ea" stroke="rgba(0,0,0,.3)" stroke-width=".6"/>`;
  s += `<rect x="12" y="${base - 15}" width="6" height="5" fill="#9aa1a7" opacity=".7"/>`;
  if (broken) s += `<path d="M10 ${base - 22} L14 ${base - 14} L12 ${base - 12} L18 ${base - 4}" stroke="#111" stroke-width="1.2" fill="none"/>`;
  s += `<text x="0" y="8" class="leglab" text-anchor="middle">R</text><text x="10" y="8" class="leglab" text-anchor="middle">–</text><text x="20" y="8" class="leglab" text-anchor="middle">G</text><text x="30" y="8" class="leglab" text-anchor="middle">B</text>`;
  return s + pinsOf(comp);
}

function renderResistor(comp) {
  const bands = resistorBands(comp.props.ohm);
  let s = leg(0, 0, 8, 0) + leg(32, 0, 40, 0);
  s += `<path class="body" d="M7 -4 Q7 -5 9 -5 H13 Q14 -3.6 16 -3.6 H24 Q26 -3.6 27 -5 H31 Q33 -5 33 -4 V4 Q33 5 31 5 H27 Q26 3.6 24 3.6 H16 Q14 3.6 13 5 H9 Q7 5 7 4 Z" fill="#e8cf9e" stroke="#b39360" stroke-width=".7"/>`;
  [10, 15.5, 21, 28].forEach((x, i) => { s += `<rect x="${x}" y="-4.6" width="2.6" height="9.2" fill="${bands[i]}"/>`; });
  s += `<path d="M9 -3.2 H31" stroke="#fff" stroke-width="1" opacity=".45"/>`;
  return s + pinsOf(comp);
}

function tactBody(pressed) {
  let s = `<rect class="body" x="-3" y="4" width="26" height="22" rx="1.5" fill="#2d2d2f" stroke="#111"/>`;
  s += `<rect x="-1" y="6" width="22" height="18" rx="1" fill="none" stroke="#bfc5ca" stroke-width="1"/>`;
  for (const [x, y] of [[0, 8], [20, 8], [0, 22], [20, 22]]) s += `<circle cx="${x}" cy="${y}" r="1.1" fill="#bfc5ca"/>`;
  s += `<circle cx="10" cy="15" r="${pressed ? 5.6 : 6.4}" fill="${pressed ? '#3a3a3c' : '#4a4a4d'}" stroke="#151515"/><circle cx="10" cy="15" r="${pressed ? 3.5 : 4.2}" fill="none" stroke="#5f5f63" stroke-width=".8"/>`;
  return s;
}
function renderButton(comp, st) {
  // Beine treten oben und unten aus dem Gehäuse aus. Gegenüberliegende Beine (oben/unten) sind fest verbunden.
  let s = '';
  for (const x of [0, 20]) s += `<path d="M${x} 0 V30" stroke="#b7bdc2" stroke-width="2.4"/>`;
  s += tactBody(st && st.pressed);
  return s + pinsOf(comp);
}
function renderButton2(comp, st) {
  let s = `<path d="M10 0 V5 M10 25 V30" stroke="#b7bdc2" stroke-width="2.4"/>`;
  s += tactBody(st && st.pressed);
  return s + pinsOf(comp);
}
function renderPushbutton(comp, st) {
  const p = st && st.pressed;
  let s = `<rect x="-2" y="-6" width="4" height="7" fill="#d8b24a" stroke="#9c7d23" stroke-width=".5"/><rect x="8" y="-6" width="4" height="7" fill="#d8b24a" stroke="#9c7d23" stroke-width=".5"/>`;
  s += `<rect class="body" x="-7" y="-24" width="24" height="18" rx="2" fill="#1f1f1f" stroke="#000"/>`;
  s += `<path class="body" d="M-10 -32 H20 L22 -28 L20 -24 H-10 L-12 -28 Z" fill="#d7dbde" stroke="#8b9399" stroke-width=".7"/>`;
  s += `<rect class="body" x="-5" y="-46" width="20" height="14" fill="#c4c9cd" stroke="#8b9399" stroke-width=".7"/>`;
  for (let y = -44; y < -32; y += 3) s += `<path d="M-5 ${y} L15 ${y + 1.5}" stroke="#9aa1a7" stroke-width=".7"/>`;
  s += `<rect class="body" x="-3" y="${p ? -53 : -58}" width="16" height="${p ? 7 : 12}" rx="4" fill="#d6304a" stroke="#93182b"/>`;
  s += `<ellipse cx="2" cy="${p ? -51 : -55}" rx="3" ry="1.4" fill="#fff" opacity=".35"/>`;
  return s + pinsOf(comp);
}

function renderLDR(comp) {
  let s = leg(0, 0, 0, -10) + leg(10, 0, 10, -10);
  s += `<circle class="body" cx="5" cy="-19" r="9.5" fill="#f0e2c4" stroke="#b8935a"/>`;
  s += `<path d="M-1 -25 H11 V-22.6 H-1 V-20.2 H11 V-17.8 H-1 V-15.4 H11 V-13" fill="none" stroke="#c0491c" stroke-width="1.3" stroke-linejoin="round"/>`;
  s += `<circle cx="5" cy="-19" r="9.5" fill="#fff" opacity=".15"/>`;
  return s + pinsOf(comp);
}

function renderNTC(comp) {
  let s = `<path d="M0 0 V-8 Q0 -12 3 -14 M10 0 V-8 Q10 -12 7 -14" stroke="#a7adb2" stroke-width="1.5" fill="none"/>`;
  s += `<path class="body" d="M5 -26 C12 -26 13 -18 10 -14 Q5 -10 0 -14 C-3 -18 -2 -26 5 -26 Z" fill="#2e2e2e" stroke="#111"/>`;
  s += `<path d="M2 -22 Q5 -24 8 -22" stroke="#666" stroke-width="1" fill="none"/><text x="5" y="-16" class="tiny" text-anchor="middle" fill="#ddd">103</text>`;
  return s + pinsOf(comp);
}

function renderPoti(comp) {
  const a = -135 + 270 * (comp.props.position / 100);
  let s = leg(0, 0, 0, -6) + leg(10, 0, 10, -6) + leg(20, 0, 20, -6);
  s += `<rect class="body" x="-5" y="-30" width="30" height="25" rx="2" fill="#3170d8" stroke="#1d4fa8"/>`;
  s += `<circle cx="10" cy="-18" r="10" fill="#2a2a2c" stroke="#111"/>`;
  s += `<g transform="rotate(${a} 10 -18)"><circle cx="10" cy="-18" r="7.5" fill="#3d3d40"/><path d="M10 -25 V-19" stroke="#f2f2f2" stroke-width="2" stroke-linecap="round"/></g>`;
  for (let i = 0; i < 12; i++) s += `<path d="M10 -28 v1.5" stroke="#555" stroke-width=".8" transform="rotate(${i * 30} 10 -18)"/>`;
  return s + pinsOf(comp);
}

/* ---------- Aktoren ---------- */
function renderPiezo(comp, st) {
  const on = st && st.sounding;
  let s = leg(0, 0, 0, -8) + leg(20, 0, 20, -8);
  s += `<circle class="body" cx="10" cy="-25" r="17" fill="#1f1f1f" stroke="#000"/><circle cx="10" cy="-25" r="13" fill="none" stroke="#333"/><circle cx="10" cy="-25" r="3" fill="#0d0d0d" stroke="#444"/>`;
  s += `<text x="-1" y="-30" class="silk" fill="#ddd">+</text>`;
  if (on) s += `<path d="M31 -36 q6 10 0 22 M36 -40 q9 15 0 30" stroke="#f9a825" stroke-width="1.6" fill="none"/>`;
  return s + pinsOf(comp);
}

function renderServo(comp, st) {
  const ang = st && typeof st.angle === 'number' ? st.angle : 0;
  let s = `<path d="M0 0 C0 -16 28 -14 38 -26" stroke="#6d4320" stroke-width="2.4" fill="none"/><path d="M10 0 C10 -14 32 -18 42 -28" stroke="#d32f2f" stroke-width="2.4" fill="none"/><path d="M20 0 C20 -12 36 -22 46 -30" stroke="#f08a16" stroke-width="2.4" fill="none"/>`;
  s += `<rect x="-4.5" y="-5" width="29" height="10" rx="1" fill="#1b1b1b"/>`;
  s += `<rect class="body" x="30" y="-58" width="10" height="10" rx="1" fill="#2c64c9" stroke="#1d4fa8"/><rect class="body" x="114" y="-58" width="10" height="10" rx="1" fill="#2c64c9" stroke="#1d4fa8"/>`;
  s += `<circle cx="35" cy="-53" r="2" fill="#fafafa"/><circle cx="119" cy="-53" r="2" fill="#fafafa"/>`;
  s += `<rect class="body" x="38" y="-66" width="78" height="44" rx="3" fill="#3474dd" fill-opacity=".92" stroke="#1d4fa8"/>`;
  s += `<rect x="44" y="-60" width="40" height="30" rx="2" fill="#5a8fe6" opacity=".5"/><text x="64" y="-40" class="silk" text-anchor="middle">SG90</text>`;
  s += `<circle cx="98" cy="-44" r="12" fill="#4a84e3" stroke="#1d4fa8"/><circle cx="98" cy="-44" r="5" fill="#eee" stroke="#aaa"/>`;
  s += `<g transform="rotate(${-ang} 98 -44)"><path d="M98 -49 L130 -46.5 Q133 -44 130 -41.5 L98 -39 Z" fill="#fbfbfb" stroke="#a9a9a9"/>${[106, 113, 120, 127].map(x => `<circle cx="${x}" cy="-44" r="1" fill="#bbb"/>`).join('')}<circle cx="98" cy="-44" r="3" fill="#ddd" stroke="#999"/></g>`;
  s += `<text x="0" y="11" class="leglab" text-anchor="middle">GND</text><text x="10" y="17" class="leglab" text-anchor="middle">5V</text><text x="20" y="11" class="leglab" text-anchor="middle">S</text>`;
  return s + pinsOf(comp);
}

const spinStyle = (st, ox, oy) => `transform-origin:${ox}px ${oy}px;animation-duration:${(0.35 / Math.max(0.15, (st && st.speed) || 1)).toFixed(2)}s;animation-direction:${st && st.dir < 0 ? 'reverse' : 'normal'}`;
function renderMotor(comp, st) {
  const run = st && st.running;
  let s = `<path d="M0 0 C0 -12 14 -12 18 -20" stroke="#d32f2f" stroke-width="2.2" fill="none"/><path d="M10 0 C10 -10 22 -14 26 -20" stroke="#222" stroke-width="2.2" fill="none"/>`;
  s += `<rect x="-4" y="-4" width="18" height="8" rx="1" fill="#1b1b1b"/>`;
  s += `<rect class="body" x="0" y="-80" width="60" height="60" rx="6" fill="#262626" stroke="#000"/>`;
  for (const [x, y] of [[6, -74], [54, -74], [6, -26], [54, -26]]) s += `<circle cx="${x}" cy="${y}" r="2.6" fill="#0e0e0e" stroke="#444"/>`;
  s += `<circle cx="30" cy="-50" r="26" fill="#111"/>`;
  s += `<g class="${run ? 'spin' : ''}" style="${spinStyle(st, 30, -50)}">`;
  for (let i = 0; i < 7; i++) s += `<path d="M30 -50 C36 -58 40 -70 34 -75 C26 -72 26 -60 30 -50 Z" fill="#555a5f" stroke="#2b2b2b" stroke-width=".5" transform="rotate(${i * 51.4} 30 -50)"/>`;
  s += `<circle cx="30" cy="-50" r="9" fill="#3a3a3a" stroke="#222"/><circle cx="30" cy="-50" r="6" fill="#c9302c"/></g>`;
  s += `<text x="0" y="12" class="leglab" text-anchor="middle">+</text><text x="10" y="12" class="leglab" text-anchor="middle">–</text>`;
  return s + pinsOf(comp);
}

function renderLCD(comp, st) {
  const lit = st && st.backlight;
  let s = `<rect class="body" x="8" y="-34" width="200" height="82" rx="3" fill="#1f7a3a" stroke="#155a2a"/>`;
  for (const [x, y] of [[14, -28], [202, -28], [14, 42], [202, 42]]) s += `<circle cx="${x}" cy="${y}" r="3.2" fill="#e8e8e8" stroke="#a7a7a7"/>`;
  s += `<g>${Array.from({ length: 16 }, (_, i) => `<rect x="${40 + i * 6}" y="-31" width="3.6" height="3.6" rx=".6" fill="#d6b23f"/>`).join('')}</g>`;
  s += `<rect x="20" y="-22" width="176" height="58" rx="2" fill="#141414"/>`;
  s += `<rect x="26" y="-15" width="164" height="44" fill="${lit ? '#a9e86a' : '#557a33'}"/>`;
  const lines = st && st.lines ? st.lines : ['', ''];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 16; c++) {
      const x = 28 + c * 10, y = -13 + r * 21;
      s += `<rect x="${x}" y="${y}" width="8.6" height="18" fill="${lit ? 'rgba(20,70,0,.07)' : 'rgba(0,0,0,.07)'}"/>`;
      const ch = (lines[r] || '')[c];
      if (ch && ch !== ' ') s += `<text x="${x + 4.3}" y="${y + 14}" class="lcdch" text-anchor="middle" fill="${lit ? '#163f06' : '#1d2a10'}">${esc(ch)}</text>`;
    }
  }
  s += `<rect x="-5" y="-5" width="14" height="40" fill="#151515"/>`;
  const labs = ['GND', 'VCC', 'SDA', 'SCL'];
  comp.def.pins.forEach((p, i) => { s += `<text x="-8" y="${p.y + 2.5}" class="leglab" text-anchor="end">${labs[i]}</text>`; });
  return s + pinsOf(comp);
}

function renderGearMotor(comp, st) {
  const run = st && st.running;
  let s = `<path d="M0 0 C0 -14 92 -8 96 -30" stroke="#d32f2f" stroke-width="2.2" fill="none"/><path d="M10 0 C10 -10 100 -4 104 -30" stroke="#222" stroke-width="2.2" fill="none"/>`;
  s += `<rect x="-4" y="-4" width="18" height="8" rx="1" fill="#1b1b1b"/>`;
  // Doppelwelle: tritt oben und unten seitlich aus dem Getriebe aus
  s += `<rect x="1" y="-86" width="9" height="14" rx="1.5" fill="#f5f2e8" stroke="#bdb8a8"/><rect x="1" y="-36" width="9" height="14" rx="1.5" fill="#f5f2e8" stroke="#bdb8a8"/>`;
  s += `<rect class="body" x="-12" y="-74" width="86" height="40" rx="4" fill="#ffd21f" stroke="#c9a200"/>`;
  s += `<rect x="-6" y="-70" width="74" height="10" rx="2" fill="#ffe25c" opacity=".7"/><circle cx="6" cy="-46" r="2.6" fill="#c9a200"/><circle cx="6" cy="-62" r="2.6" fill="#c9a200"/>`;
  s += `<rect class="body" x="72" y="-70" width="40" height="32" rx="7" fill="#c9cdd1" stroke="#8b9399"/><path d="M76 -66 H108" stroke="#eef0f2" stroke-width="2"/>`;
  s += `<rect x="72" y="-72" width="44" height="36" rx="8" fill="#ffffff" fill-opacity=".25" stroke="#d9dde0"/>`;
  s += `<rect x="112" y="-64" width="6" height="20" rx="1.5" fill="#2b2b2b"/><rect x="94" y="-36" width="4" height="7" fill="#d8b24a"/><rect x="102" y="-36" width="4" height="7" fill="#d8b24a"/>`;
  if (run) s += `<g class="spin" style="${spinStyle(st, 5.5, -79)}"><path d="M5.5 -91 A12 12 0 0 1 17.5 -79" stroke="#ef6c00" stroke-width="1.8" fill="none"/><path d="M5.5 -67 A12 12 0 0 1 -6.5 -79" stroke="#ef6c00" stroke-width="1.8" fill="none"/></g>`;
  s += `<text x="0" y="12" class="leglab" text-anchor="middle">+</text><text x="10" y="12" class="leglab" text-anchor="middle">–</text>`;
  return s + pinsOf(comp);
}

/* Getriebemotor mit Rad, von oben gesehen wie im Fahrzeug (vorne = oben, die Anschlüsse zeigen nach vorne).
   Links: Rad links. Rechts: derselbe Motor um 180° um die Längsachse gedreht (Rad rechts) – darum schiebt er bei
   gleicher Polung rückwärts. Der grüne Pfeil zeigt, wohin das Rad das Fahrzeug schiebt. */
function renderWheelMotor(comp, st) {
  const right = comp.def.wheel === 'R';
  const run = st && st.running;
  // Zeichnung für den linken Motor (Plus bei x = 0, Minus bei x = 10), unten Getriebe und Rad;
  // der rechte wird um x = 5 gespiegelt, dadurch liegen Plus/Minus und die Kabelfarben dort richtig
  let b = `<path d="M0 0 V14" stroke="#d32f2f" stroke-width="2.2"/><path d="M10 0 V14" stroke="#222" stroke-width="2.2"/>`;
  b += `<rect class="body" x="-4" y="14" width="26" height="36" rx="7" fill="#c9cdd1" stroke="#8b9399"/><path d="M0 18 V46" stroke="#eef0f2" stroke-width="2"/>`;
  b += `<rect x="-1" y="13" width="4" height="5" fill="#d8b24a"/><rect x="7" y="13" width="4" height="5" fill="#d8b24a"/>`;
  b += `<rect class="body" x="-8" y="48" width="34" height="64" rx="4" fill="#ffd21f" stroke="#c9a200"/><rect x="-4" y="52" width="10" height="56" rx="2" fill="#ffe25c" opacity=".7"/>`;
  b += `<circle cx="18" cy="60" r="2.4" fill="#c9a200"/><circle cx="18" cy="104" r="2.4" fill="#c9a200"/>`;
  b += `<rect x="26" y="91" width="7" height="8" rx="1.5" fill="#f5f2e8" stroke="#bdb8a8"/><rect x="-16" y="91" width="8" height="8" rx="1.5" fill="#f5f2e8" stroke="#bdb8a8"/>`;
  // Rad (Reifen mit Profil, Felge)
  b += `<rect class="body" x="-42" y="64" width="26" height="62" rx="6" fill="#2b2b2b" stroke="#111"/>`;
  for (let y = 70; y <= 118; y += 8) b += `<path d="M-40 ${y} H-18" stroke="#444" stroke-width="2"/>`;
  b += `<rect x="-35" y="86" width="12" height="18" rx="2" fill="#ffd21f" stroke="#c9a200"/>`;
  let s = right ? `<g transform="matrix(-1 0 0 1 10 0)">${b}</g>` : b;
  if (run) {
    const fwd = (st.dir < 0) !== right, x = right ? 39 : -29, y0 = fwd ? 114 : 76, y1 = fwd ? 76 : 114, h = fwd ? -8 : 8;
    s += `<path d="M${x} ${y0} V${y1}" stroke="#4cd964" stroke-width="3" stroke-linecap="round"/><path d="M${x - 6} ${y1 - h} L${x} ${y1} L${x + 6} ${y1 - h}" stroke="#4cd964" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  s += right ? `<text x="0" y="-6" class="leglab" text-anchor="middle">–</text><text x="10" y="-6" class="leglab" text-anchor="middle">+</text>`
    : `<text x="0" y="-6" class="leglab" text-anchor="middle">+</text><text x="10" y="-6" class="leglab" text-anchor="middle">–</text>`;
  return s + pinsOf(comp);
}

/* NeoPixel */
function pixelSvg(x, y, col, size) {
  const on = col && (col[0] + col[1] + col[2]) > 3;
  const c = on ? `rgb(${col.map(v => Math.min(255, Math.round(v))).join(',')})` : '#f1f1ee';
  let s = `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="1" fill="#fafaf8" stroke="#bbb" stroke-width=".5"/>`;
  if (on) s += `<circle cx="${x}" cy="${y}" r="${size * 0.85}" fill="${c}" opacity=".35"/>`;
  s += `<circle cx="${x}" cy="${y}" r="${size * 0.33}" fill="${on ? c : '#ddd'}" stroke="#999" stroke-width=".4"/>`;
  return s;
}
function renderStrip(comp, st) {
  const px = st && st.pixels;
  let s = leg(0, 0, 0, -6) + leg(10, 0, 10, -6) + leg(20, 0, 20, -6);
  s += `<rect class="body" x="-8" y="-30" width="122" height="24" rx="2" fill="#1b1b1b" stroke="#000"/>`;
  for (let i = 0; i < 8; i++) s += pixelSvg(6 + i * 14, -18, px && px[i], 10);
  s += `<text x="0" y="9" class="leglab" text-anchor="middle">5V</text><text x="10" y="13" class="leglab" text-anchor="middle">DIN</text><text x="20" y="9" class="leglab" text-anchor="middle">GND</text>`;
  return s + pinsOf(comp);
}
function renderRing(comp, st) {
  const px = st && st.pixels;
  let s = leg(0, 0, 0, -10) + leg(10, 0, 10, -10) + leg(20, 0, 20, -10);
  s += `<circle class="body" cx="10" cy="-50" r="40" fill="#1b1b1b" stroke="#000"/><circle cx="10" cy="-50" r="25" fill="#fbfbfa" stroke="#ccc"/>`;
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 6;
    s += pixelSvg(10 + 32.5 * Math.cos(a), -50 + 32.5 * Math.sin(a), px && px[i], 9);
  }
  s += `<text x="0" y="9" class="leglab" text-anchor="middle">5V</text><text x="10" y="13" class="leglab" text-anchor="middle">DIN</text><text x="20" y="9" class="leglab" text-anchor="middle">GND</text>`;
  return s + pinsOf(comp);
}

/* ---------- Sensormodule ---------- */
function headerLegs(comp, labels, y0) {
  let s = '';
  comp.def.pins.forEach((p, i) => {
    s += `<rect x="${p.x - 1}" y="${y0}" width="2" height="${-y0}" fill="#c9a43a"/>` + hdr(p.x, y0 - 2);
    if (labels) { const ty = y0 - 8; s += `<text x="${p.x}" y="${ty}" class="tiny" text-anchor="start" fill="#f4f4f4" transform="rotate(-90 ${p.x} ${ty})" dy="1.6">${labels[i]}</text>`; }
  });
  return s;
}
function renderTouch(comp, st) {
  const t = st && st.active;
  let s = `<rect class="body" x="-10" y="-46" width="40" height="40" rx="3" fill="#1d5fb8" stroke="#123f7a"/>`;
  s += `<circle cx="10" cy="-30" r="12" fill="${t ? '#e8c35d' : '#d4b04a'}" stroke="#9c7d23"/>`;
  for (let r = 3; r < 12; r += 3) s += `<circle cx="10" cy="-30" r="${r}" fill="none" stroke="#a8862a" stroke-width=".6"/>`;
  s += `<rect x="24" y="-44" width="4" height="3" fill="${t ? '#ff3b30' : '#6b2a2a'}"/>`;
  s += headerLegs(comp, ['GND', 'VCC', 'SIG'], -6);
  return s + pinsOf(comp);
}
function renderPIR(comp, st) {
  const t = st && st.active;
  let s = `<rect class="body" x="-15" y="-60" width="50" height="54" rx="3" fill="#1f7a3a" stroke="#155a2a"/>`;
  s += `<circle cx="10" cy="-42" r="16.5" fill="#f4f4f1" stroke="#c9c9c3"/>`;
  for (let i = -2; i <= 2; i++) s += `<path d="M${10 + i * 6} -57 Q${10 + i * 7} -42 ${10 + i * 6} -27" stroke="#dcdcd5" stroke-width=".8" fill="none"/>`;
  s += `<path d="M-6 -42 H26 M-3 -52 H23 M-3 -32 H23" stroke="#dcdcd5" stroke-width=".8"/>`;
  s += `<circle cx="-9" cy="-54" r="3.4" fill="#f08a16" stroke="#a65a0c"/><circle cx="29" cy="-54" r="3.4" fill="#f08a16" stroke="#a65a0c"/>`;
  if (t) s += `<path d="M38 -46 q6 10 0 22 M43 -50 q9 15 0 30" stroke="#ef5350" stroke-width="1.4" fill="none"/>`;
  s += headerLegs(comp, ['VCC', 'OUT', 'GND'], -6);
  return s + pinsOf(comp);
}
function renderTMP36(comp) {
  let s = leg(0, 0, 0, -10) + leg(10, 0, 10, -10) + leg(20, 0, 20, -10);
  s += `<path class="body" d="M-2 -10 V-26 Q10 -32 22 -26 V-10 Z" fill="#232323" stroke="#000"/>`;
  s += `<text x="10" y="-18" class="tiny" text-anchor="middle" fill="#cfcfcf">TMP36</text>`;
  s += `<text x="0" y="9" class="leglab" text-anchor="middle">+</text><text x="10" y="9" class="leglab" text-anchor="middle">Out</text><text x="20" y="9" class="leglab" text-anchor="middle">–</text>`;
  return s + pinsOf(comp);
}
function renderMoisture(comp) {
  let s = `<path class="body" d="M-8 -6 V-92 L10 -106 L28 -92 V-6 Z" fill="#1a1a1a" stroke="#000"/>`;
  s += `<path d="M-2 -64 V-90 L10 -99 L22 -90 V-64" fill="none" stroke="#e6e6e6" stroke-width=".8"/>`;
  s += `<rect x="-4" y="-58" width="28" height="22" rx="1" fill="#2a2a2a" stroke="#555" stroke-width=".5"/><rect x="2" y="-53" width="10" height="8" fill="#111"/>`;
  s += `<text x="10" y="-62" class="tiny" text-anchor="middle" fill="#ccc">Sensor</text>`;
  s += headerLegs(comp, ['GND', 'VCC', 'AOUT'], -6);
  return s + pinsOf(comp);
}
function renderUltrasonic(comp) {
  let s = `<rect class="body" x="-35" y="-54" width="100" height="48" rx="3" fill="#1d5fb8" stroke="#123f7a"/>`;
  for (const cx of [-12, 42]) {
    s += `<circle cx="${cx}" cy="-34" r="16" fill="#cfd4d8" stroke="#8b9399"/><circle cx="${cx}" cy="-34" r="11.5" fill="#2b2b2b"/>`;
    for (let r = 3; r < 11.5; r += 3) s += `<circle cx="${cx}" cy="-34" r="${r}" fill="none" stroke="#3c3c3c" stroke-width=".7"/>`;
  }
  s += `<rect x="9" y="-50" width="12" height="7" fill="#d4d8dc" stroke="#8b9399" stroke-width=".5"/><text x="15" y="-36" class="tiny" text-anchor="middle" fill="#fff">HC-SR04</text>`;
  s += headerLegs(comp, ['VCC', 'Trig', 'Echo', 'GND'], -6);
  return s + pinsOf(comp);
}

/* Temperatur- und Luftfeuchtesensor DHT11 (blau) / DHT22 (weiß) auf kleiner Platine */
function renderDHT(comp) {
  const d22 = String(comp.props.model) === '22';
  const body = d22 ? '#f4f4f1' : '#3f86d8', edge = d22 ? '#b9bab3' : '#235fa8', slot = d22 ? '#c9cac3' : '#2a64a8';
  let s = `<rect class="body" x="-8" y="-24" width="36" height="18" rx="2" fill="#1f5fae" stroke="#123f7a"/>`;
  s += `<rect class="body" x="-3" y="-${d22 ? 74 : 64}" width="26" height="${d22 ? 52 : 42}" rx="2" fill="${body}" stroke="${edge}"/>`;
  const rows = d22 ? 6 : 4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) s += `<rect x="${1 + c * 7}" y="${-(d22 ? 62 : 52) + r * 6.4}" width="4.6" height="3.6" rx=".6" fill="${slot}"/>`;
  s += `<text x="10" y="-${d22 ? 66 : 56}" class="tiny" text-anchor="middle" fill="${d22 ? '#555' : '#fff'}">DHT${d22 ? '22' : '11'}</text>`;
  s += headerLegs(comp, ['+', 'out', '–'], -6);
  return s + pinsOf(comp);
}

/* Relais-Modul (1 Kanal), hochkant: unten an der schmalen Seite die Stiftleiste VCC, GND, IN (steckbar), daneben
   rote LED (Versorgung) und grüne LED (Relais angezogen); in der Mitte das Relais; oben die Schraubklemme NC, COM, NO */
function renderRelay(comp, st) {
  // 1-Kanal-Relaismodul mit Optokoppler und Jumper für High/Low-Level-Trigger (rote Platine):
  // links Schraubklemme NO/COM/NC, rechts Schraubklemme IN/DC−/DC+
  const on = st && st.on, run = !!st, low = String(comp.props.trig) === 'L';
  let s = `<rect class="body" x="-88" y="-96" width="176" height="96" rx="5" fill="#d3261c" stroke="#8e1a12"/>`;
  for (const [x, y] of [[-79, -87], [79, -87], [-79, -9], [79, -9]]) s += `<circle cx="${x}" cy="${y}" r="6" fill="#f3f1ec" stroke="#b9b2a6" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="3.4" fill="#fafaf7"/>`;
  // Schraubklemmen (blau) mit Beschriftung außen
  for (const x of [-66, 66]) s += `<rect class="body" x="${x - 10}" y="-76" width="20" height="60" rx="2" fill="#2b78d6" stroke="#174f99"/><rect x="${x + (x < 0 ? 6 : -10)}" y="-76" width="4" height="60" fill="#1f63b8"/>`;
  for (const p of comp.def.pins) {
    s += `<circle cx="${p.x}" cy="${p.y}" r="6.5" fill="#c9ced2" stroke="#7d868c"/><path d="M${p.x - 4} ${p.y - 4}L${p.x + 4} ${p.y + 4}M${p.x + 4} ${p.y - 4}L${p.x - 4} ${p.y + 4}" stroke="#7d868c" stroke-width="1.2"/>`;
    const t = p.id === 'VCC' ? 'DC+' : p.id === 'GND' ? 'DC−' : p.id, lx = p.x < 0 ? p.x - 16 : p.x + 16;
    s += `<text x="${lx}" y="${p.y}" class="tiny" text-anchor="middle" fill="#fff" transform="rotate(${p.x < 0 ? -90 : 90} ${lx} ${p.y})" dy="2">${t}</text>`;
  }
  // Schaltzustand: COM ist mit NO (angezogen) oder NC (abgefallen) verbunden
  const com = comp.def.pins.find(p => p.id === 'COM'), to = comp.def.pins.find(p => p.id === (on ? 'NO' : 'NC'));
  s += `<path d="M${com.x + 13} ${com.y} L${to.x + 13} ${to.y + (on ? 5 : -5)}" stroke="#f2c200" stroke-width="2" stroke-linecap="round"/><circle cx="${com.x + 13}" cy="${com.y}" r="1.8" fill="#f2c200"/>`;
  // Relais (blauer Würfel)
  s += `<rect class="body" x="-50" y="-78" width="62" height="58" rx="2" fill="#2f6fd6" stroke="#173f9a"/>`;
  s += `<text x="-19" y="-64" class="tiny" text-anchor="middle" fill="#fff" font-style="italic">SONGLE</text>`;
  s += `<text x="-19" y="-52" class="tiny" text-anchor="middle" fill="#e3ebff">10A 250VAC</text><text x="-19" y="-44" class="tiny" text-anchor="middle" fill="#e3ebff">10A 30VDC</text>`;
  s += `<text x="-19" y="-28" class="tiny" text-anchor="middle" fill="#fff">SRD-5VDC-SL-C</text>`;
  // SMD-Bauteile: Transistor, Diode, Widerstände, Optokoppler
  const res = (x, y, t, v) => `<rect x="${x}" y="${y}" width="${v ? 5 : 9}" height="${v ? 9 : 5}" rx=".6" fill="#2a2a2a"/>` + (t ? `<text x="${x + (v ? 2.5 : 4.5)}" y="${y + (v ? 5.5 : 3.6)}" font-size="2.6" text-anchor="middle" fill="#ddd">${t}</text>` : '');
  s += `<rect x="18" y="-72" width="9" height="6" rx=".6" fill="#222"/><rect x="20" y="-74" width="1.4" height="2" fill="#bbb"/><rect x="24" y="-74" width="1.4" height="2" fill="#bbb"/><rect x="22" y="-66" width="1.4" height="2" fill="#bbb"/>`;
  s += `<rect x="31" y="-72" width="6" height="11" rx=".6" fill="#ddd"/><rect x="31" y="-63" width="6" height="2" fill="#7a1c1c"/>`;
  s += res(29, -82, '222') + res(42, -66, '222', true) + res(18, -46, '102', true) + res(27, -46, '103', true) + res(47, -16, '102', true);
  s += `<rect class="body" x="20" y="-31" width="16" height="13" rx="1" fill="#1b1b1b"/>` + [[18, -29], [18, -22], [36, -29], [36, -22]].map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="3" fill="#bbb"/>`).join('');
  // SMD-LEDs: PWR (Versorgung) oben, LED1 (Relais angezogen) in der Mitte
  s += `<rect x="44" y="-82" width="7" height="4" rx=".8" fill="${run ? '#ff3b30' : '#e9e4dc'}" stroke="#9b938a" stroke-width=".4"/><text x="47.5" y="-73" font-size="3.4" text-anchor="middle" fill="#fff">PWR</text>`;
  if (run) s += `<circle cx="47.5" cy="-80" r="6" fill="#ff3b30" opacity=".35"/>`;
  s += `<rect x="40" y="-45" width="4" height="7" rx=".8" fill="${on ? '#ff3b30' : '#e9e4dc'}" stroke="#9b938a" stroke-width=".4"/><text x="49" y="-40" font-size="3.4" fill="#fff">LED1</text>`;
  if (on) s += `<circle cx="42" cy="-41.5" r="6" fill="#ff3b30" opacity=".35"/>`;
  // Jumper L/H (zeigt die Einstellung „Schaltet bei“)
  s += `<g class="jumper" style="cursor:pointer"><title>Jumper umstecken (L = schaltet bei NIEDRIG, H = schaltet bei HOCH)</title><rect x="11" y="-18" width="35" height="14" fill="transparent"/>`;
  s += `<rect x="20" y="-13" width="18" height="6" fill="#1b1b1b"/>` + [23, 29, 35].map(x => `<rect x="${x - 1}" y="-11" width="2" height="2" fill="#d4af37"/>`).join('');
  s += `<rect x="${low ? 19.5 : 25.5}" y="-14" width="13" height="8" rx="1" fill="#2a2a2a" stroke="#555" stroke-width=".5"/>`;
  s += `<text x="16" y="-8" font-size="4" text-anchor="middle" fill="#fff">L</text><text x="41" y="-8" font-size="4" text-anchor="middle" fill="#fff">H</text></g>`;
  s += `<text x="-50" y="-11" font-size="5" fill="#fff">1 Relay Module</text><text x="-50" y="-4" font-size="5" fill="#fff">high/low level trigger</text>`;
  return s + pinsOf(comp);
}

/* Schrittmotor 28BYJ-48 mit Treiberplatine ULN2003: IN1–IN4, Versorgung – und + */
function renderStepper(comp, st) {
  const ang = st && typeof st.angle === 'number' ? st.angle : 0;
  const coil = st && st.coils ? st.coils : [0, 0, 0, 0];
  let s = '';
  // Motor oben
  s += `<path d="M30 -96 C30 -88 40 -88 40 -80" stroke="#e53935" stroke-width="2" fill="none"/><path d="M26 -96 C26 -86 34 -86 34 -80" stroke="#f2c200" stroke-width="2" fill="none"/><path d="M22 -96 C22 -86 28 -86 28 -80" stroke="#ef6c00" stroke-width="2" fill="none"/><path d="M18 -96 C18 -86 22 -86 22 -80" stroke="#e91e63" stroke-width="2" fill="none"/><path d="M14 -96 C14 -86 16 -86 16 -80" stroke="#1e63c5" stroke-width="2" fill="none"/>`;
  s += `<rect class="body" x="-30" y="-130" width="12" height="8" rx="2" fill="#c9cdd1" stroke="#8b9399"/><rect class="body" x="72" y="-130" width="12" height="8" rx="2" fill="#c9cdd1" stroke="#8b9399"/>`;
  s += `<circle class="body" cx="27" cy="-126" r="40" fill="#c9cdd1" stroke="#8b9399"/><circle cx="27" cy="-126" r="34" fill="#d9dde0"/>`;
  s += `<rect class="body" x="8" y="-100" width="38" height="10" rx="2" fill="#1e63c5" stroke="#0f3f85"/>`;
  s += `<circle cx="27" cy="-140" r="10" fill="#b5bbc0" stroke="#8b9399"/>`;
  s += `<g transform="rotate(${ang.toFixed(1)} 27 -140)"><rect x="24.5" y="-152" width="5" height="24" rx="2" fill="#e8b23a" stroke="#9c7d23"/><circle cx="27" cy="-148" r="1.6" fill="#7a5c12"/></g>`;
  s += `<text x="27" y="-112" class="tiny" text-anchor="middle" fill="#555">28BYJ-48</text>`;
  // Treiberplatine
  s += `<rect class="body" x="-10" y="-80" width="84" height="74" rx="3" fill="#1f7a3a" stroke="#155a2a"/>`;
  s += `<rect x="6" y="-76" width="42" height="12" rx="1" fill="#f5f2e8" stroke="#bdb8a8"/>`;
  s += `<rect x="-2" y="-58" width="24" height="34" rx="1" fill="#1b1b1b"/><text x="10" y="-38" class="tiny" text-anchor="middle" fill="#ccc" transform="rotate(-90 10 -40)">ULN2003</text>`;
  ['A', 'B', 'C', 'D'].forEach((t, i) => {
    const y = -58 + i * 9, lit = coil[i];
    s += `<rect x="34" y="${y}" width="7" height="5" rx="1" fill="${lit ? '#ff3b30' : '#6b2a2a'}"/><text x="46" y="${y + 4.5}" class="tiny" fill="#fff">${t}</text>`;
    if (lit) s += `<circle cx="37.5" cy="${y + 2.5}" r="5.5" fill="#ff3b30" opacity=".35"/>`;
  });
  s += `<text x="55" y="-12" class="tiny" text-anchor="middle" fill="#fff">5–12V</text>`;
  s += headerLegs(comp, ['IN1', 'IN2', 'IN3', 'IN4', '–', '+'], -6);
  return s + pinsOf(comp);
}

function renderSoil(comp) {
  const wet = Math.max(0, Math.min(100, Number(comp.props.wet) || 0)) / 100;
  const sponge = mix('#f2d36b', '#c79a2a', wet);
  let s = `<path d="M0 0 C0 -10 -4 -14 -2 -22 M10 0 C10 -10 14 -14 12 -22" stroke="#8d9296" stroke-width="2.2" fill="none"/>`;
  s += `<rect class="body" x="-16" y="-58" width="42" height="28" rx="5" fill="${sponge}" stroke="#a8862a"/>`;
  for (const [x, y, r] of [[-9, -50, 2], [0, -40, 1.6], [12, -52, 1.8], [18, -38, 2.2], [-11, -36, 1.4], [6, -47, 1.2]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#000" opacity=".15"/>`;
  [0.05, 0.4, 0.75].forEach((t, i) => { if (wet > t) s += `<path d="M-12 ${-33 - i * 6} q4 3 8 0 q4 -3 8 0 q4 3 8 0 q4 -3 8 0" stroke="#3f86d8" stroke-width="1.4" fill="none" opacity=".85"/>`; });
  s += `<path d="M-2 -22 V-44 M12 -22 V-44" stroke="#c9ced2" stroke-width="2.4" stroke-linecap="round"/>`;
  s += `<rect x="-5" y="-26" width="6" height="5" rx="1" fill="#6d7276"/><rect x="9" y="-26" width="6" height="5" rx="1" fill="#6d7276"/>`;
  return s + pinsOf(comp);
}

function renderOLED(comp, st) {
  let s = `<rect class="body" x="-35" y="4" width="100" height="92" rx="4" fill="#1d4f9c" stroke="#123a75"/>`;
  for (const [x, y] of [[-29, 10], [59, 10], [-29, 90], [59, 90]]) s += `<circle cx="${x}" cy="${y}" r="3" fill="#e8e8e8" stroke="#a7a7a7"/>`;
  s += `<rect x="-31" y="24" width="92" height="56" rx="2" fill="#0b0b0b" stroke="#333"/>`;
  s += `<rect x="-27" y="28" width="84" height="42" fill="#050505"/>`;
  if (st && st.img) s += `<image href="${st.img}" x="-27" y="28" width="84" height="42" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
  s += `<rect x="-5" y="80" width="40" height="6" fill="#d9d9d9" opacity=".25"/>`;
  comp.def.pins.forEach((p, i) => {
    s += `<rect x="${p.x - 1}" y="0" width="2" height="8" fill="#c9a43a"/>` + hdr(p.x, 8);
    s += `<text x="${p.x}" y="15" class="tiny" text-anchor="start" fill="#f4f4f4" transform="rotate(90 ${p.x} 15)" dy="1.6">${['GND', 'VCC', 'SCL', 'SDA'][i]}</text>`;
  });
  return s + pinsOf(comp);
}

/* ---------- Tastenfeld (Folientastatur) ---------- */
const KEYMAP = {
  3: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']],
  4: [['1', '2', '3', 'A'], ['4', '5', '6', 'B'], ['7', '8', '9', 'C'], ['*', '0', '#', 'D']],
};
function renderKeypad(comp, st) {
  const cols = comp.def.cols;
  const n = comp.def.pins.length;
  const mid = (n - 1) * 5;
  const K = 26, G = 6, P = 12;
  const w = cols * K + (cols - 1) * G + 2 * P, h = 4 * K + 3 * G + 2 * P;
  const x0 = mid - w / 2, y0 = -46 - h;
  const pressed = st && st.key;
  let s = `<rect x="${mid - n * 5 + 2}" y="-46" width="${n * 10 - 4}" height="40" fill="#e9eef0" stroke="#c4cbcf"/>`;
  comp.def.pins.forEach(p => { s += `<path d="M${p.x} -46 V-6" stroke="#c39a3a" stroke-width="1.2"/>`; });
  s += `<rect x="${mid - n * 5 - 2}" y="-8" width="${n * 10 + 4}" height="12" fill="#1b1b1b"/>`;
  s += `<rect class="body" x="${x0}" y="${y0}" width="${w}" height="${h}" rx="10" fill="#2f2f31" stroke="#111"/><rect x="${x0 + 4}" y="${y0 + 4}" width="${w - 8}" height="${h - 8}" rx="8" fill="none" stroke="#666" stroke-width=".8"/>`;
  KEYMAP[cols].forEach((row, r) => row.forEach((k, c) => {
    const x = x0 + P + c * (K + G), y = y0 + P + r * (K + G);
    const red = /[*#A-D]/.test(k);
    const on = pressed === k;
    s += `<g class="key" data-key="${esc(k)}"><rect x="${x}" y="${y}" width="${K}" height="${K}" rx="5" fill="${on ? (red ? '#a32d2d' : '#1f7fa6') : (red ? '#d2453f' : '#39a9d1')}" stroke="${on ? '#fff' : 'rgba(0,0,0,.25)'}"/><text x="${x + K / 2}" y="${y + K / 2 + 6}" class="keych" text-anchor="middle">${esc(k)}</text></g>`;
  }));
  comp.def.pins.forEach(p => { s += `<text x="${p.x}" y="13" class="leglab" text-anchor="middle">${p.id}</text>`; });
  return s + pinsOf(comp);
}

/* ---------- Messmodule (Multimeter-Erweiterung) ---------- */
function renderADS(comp) {
  const labs = ['VDD', 'GND', 'SCL', 'SDA', 'ADDR', 'ALRT', 'A0', 'A1', 'A2', 'A3'];
  let s = `<rect class="body" x="-8" y="-52" width="106" height="46" rx="3" fill="#5b2c8f" stroke="#3d1d63"/>`;
  s += `<rect x="62" y="-48" width="14" height="10" rx="1" fill="#1b1b1b"/><text x="69" y="-31" class="tiny" text-anchor="middle" fill="#fff">ADS1115</text>`;
  s += `<circle cx="-2" cy="-46" r="2.6" fill="#ddd"/><circle cx="92" cy="-46" r="2.6" fill="#ddd"/>`;
  s += headerLegs(comp, labs, -6);
  return s + pinsOf(comp);
}
function renderINA(comp) {
  const labs = ['VCC', 'GND', 'SCL', 'SDA', 'VIN–', 'VIN+'];
  let s = `<rect class="body" x="-8" y="-62" width="66" height="56" rx="3" fill="#5b2c8f" stroke="#3d1d63"/>`;
  s += `<rect x="6" y="-58" width="38" height="14" rx="1" fill="#1f8a4c" stroke="#145c32"/><circle cx="16" cy="-51" r="4" fill="#ccc"/><circle cx="34" cy="-51" r="4" fill="#ccc"/>`;
  s += `<rect x="40" y="-40" width="12" height="6" fill="#222"/><text x="46" y="-28" class="tiny" text-anchor="middle" fill="#fff">INA219</text>`;
  s += headerLegs(comp, labs, -6);
  return s + pinsOf(comp);
}
/* Motortreiber L9110S: 2 Motoren, Steuerleiste B-IA, B-IB, GND, VCC, A-IA, A-IB */
function renderDriver(comp) {
  const labs = ['B-IA', 'B-IB', 'GND', 'VCC', 'A-IA', 'A-IB'];
  let s = `<rect class="body" x="-12" y="-66" width="74" height="60" rx="3" fill="#c62828" stroke="#8e1b1b"/>`;
  s += `<rect x="4" y="-50" width="14" height="10" rx="1" fill="#222"/><rect x="32" y="-50" width="14" height="10" rx="1" fill="#222"/>`;
  s += `<text x="25" y="-56" class="tiny" text-anchor="middle" fill="#fff">L9110S</text>`;
  // Schraubklemmen für die Motoren
  for (const [x, t] of [[-26, 'Motor A'], [64, 'Motor B']]) {
    s += `<rect x="${x}" y="-60" width="14" height="28" rx="1.5" fill="#1e63c5" stroke="#0f3f85"/>`;
    s += `<circle cx="${x + 7}" cy="-53" r="3.2" fill="#c9ced2" stroke="#7d868c"/><circle cx="${x + 7}" cy="-39" r="3.2" fill="#c9ced2" stroke="#7d868c"/>`;
    s += `<text x="${x + 7}" y="-64" class="tiny" text-anchor="middle">${t}</text>`;
  }
  s += headerLegs({ def: { pins: comp.def.pins.slice(0, 6) } }, labs, -8);
  return s + pinsOf(comp);
}

/* Motortreiber L298N: Steuerleiste ENA, IN1–IN4, ENB; Schraubklemmen +12V, GND, +5V; Motor A (OUT1/2), Motor B (OUT3/4) */
/* Motortreiber L298N, von oben (quadratische Platine, Stiftleiste unten): oben Kühlkörper mit dem L298N,
   links Klemme OUT1/OUT2, rechts OUT4/OUT3 (jeweils unten, nahe den anderen Anschlüssen), unten links die Stromklemme
   12V/GND/5V, daneben die Stiftleiste ENA, IN1–IN4, ENB. Dazu Dioden, Spannungsregler 78M05 und zwei Kondensatoren. */
function renderL298(comp) {
  const p = comp.props;
  let s = `<rect class="body" x="-75" y="-158" width="170" height="170" rx="5" fill="#d32f2f" stroke="#8e1b1b"/>`;
  for (const [x, y] of [[-63, -146], [83, -146], [-63, 0], [83, 0]]) s += `<circle cx="${x}" cy="${y}" r="6.5" fill="#f2efe6" stroke="#b8a98a" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="3.5" fill="#fafaf7"/>`;
  // Kühlkörper mit Rippen (ragt oben etwas über die Platine) und Treiberbaustein
  s += `<rect x="-46" y="-130" width="92" height="20" rx="2" fill="#1b1b1b"/>`;
  for (let k = 0; k < 7; k++) s += `<rect x="${-44 + k * 14.3}" y="-166" width="5" height="40" rx="1" fill="#262626"/>`;
  s += `<rect x="-30" y="-128" width="60" height="16" rx="1.5" fill="#d9dcdf" stroke="#9aa0a5"/><text x="0" y="-117" class="tiny" text-anchor="middle" fill="#333">L298N</text>`;
  for (let k = 0; k < 15; k++) { const x = -35 + k * 5; s += `<path d="M${x} -110 V${k % 2 ? -98 : -102}" stroke="#b8bcc0" stroke-width="1.6"/><circle cx="${x}" cy="${k % 2 ? -97 : -101}" r="1.4" fill="#c9ced2"/>`; }
  // je vier SMD-Widerstände links und rechts (schwarzer Körper, Metallkappen, Aufdruck)
  const smd = (x, y) => `<rect x="${x}" y="${y}" width="15" height="7" rx=".8" fill="#1d1d1d"/><rect x="${x}" y="${y}" width="3" height="7" fill="#c9ced2"/><rect x="${x + 12}" y="${y}" width="3" height="7" fill="#c9ced2"/><text x="${x + 7.5}" y="${y + 5.2}" font-size="4" text-anchor="middle" fill="#ddd">103</text>`;
  for (let k = 0; k < 4; k++) s += smd(-70, -108 + k * 11) + smd(75, -108 + k * 11);
  // Spannungsregler 78M05 und zwei Kondensatoren (220 µF, 35 V)
  s += `<rect x="-24" y="-90" width="22" height="7" fill="#9aa0a5"/><rect x="-26" y="-84" width="26" height="18" rx="1.5" fill="#1d1d1d"/><text x="-13" y="-72" class="tiny" text-anchor="middle" fill="#ccc">78M05</text>`;
  const cap = (x, y) => `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" rx="2" fill="#1d1d1d"/><circle cx="${x}" cy="${y}" r="11.5" fill="#d6d9dc" stroke="#9aa0a5"/><text x="${x}" y="${y - 1}" class="tiny" text-anchor="middle" fill="#444">220</text><text x="${x}" y="${y + 6}" class="tiny" text-anchor="middle" fill="#444">35V</text>`;
  s += cap(22, -80) + cap(-6, -46);
  // kleine Bauteile: LED (Versorgung), Widerstand, Jumper für den 5-V-Regler
  s += `<rect x="20" y="-56" width="8" height="5" rx="1" fill="#f3f3f3" stroke="#bbb" stroke-width=".5"/><rect x="20" y="-46" width="9" height="5" rx=".5" fill="#1d1d1d"/>`;
  s += `<rect x="20" y="-36" width="8" height="16" rx="1" fill="#1d1d1d"/><rect x="21" y="-35" width="6" height="8" rx="1" fill="#2b2b2b" stroke="#555" stroke-width=".5"/>`;
  // Schraubklemmen
  const clamp = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#1e63c5" stroke="#0f3f85"/>`;
  s += clamp(-73, -66, 21, 42) + clamp(72, -66, 21, 42) + clamp(-48, -14, 36, 18);
  for (const pin of comp.def.pins) if (/^(OUT|VS|GND|V5)/.test(pin.id)) s += `<circle cx="${pin.x}" cy="${pin.y}" r="${/^OUT/.test(pin.id) ? 5.5 : 4.4}" fill="#c9ced2" stroke="#7d868c"/>`;
  const rot = (x, y, t, a) => `<text x="${x}" y="${y}" class="tiny" text-anchor="${a || 'middle'}" fill="#fff" transform="rotate(-90 ${x} ${y})" dy="1.6">${t}</text>`;
  s += rot(-46, -55, 'OUT1') + rot(-46, -35, 'OUT2') + rot(66, -55, 'OUT4') + rot(66, -35, 'OUT3');
  s += rot(-40, -17, '+12V', 'start') + rot(-30, -17, 'GND', 'start') + rot(-20, -17, '+5V', 'start');
  // Steuerleiste mit Jumpern auf ENA/ENB
  const labs = ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'];
  labs.forEach((l, i) => { s += hdr(i * 10, 0) + rot(i * 10, -8, l, 'start'); });
  if (String(p.ena) !== '0') s += `<rect x="-4" y="-5" width="8" height="12" rx="1" fill="#1b1b1b"/>`;
  if (String(p.enb) !== '0') s += `<rect x="46" y="-5" width="8" height="12" rx="1" fill="#1b1b1b"/>`;
  return s + pinsOf(comp);
}

function renderSource(comp) {
  const v = Number(comp.props.volt) || 0;
  let s = leg(0, 0, 0, -8) + leg(20, 0, 20, -8);
  s += `<rect class="body" x="-8" y="-46" width="36" height="38" rx="4" fill="#efefe9" stroke="#9a9a92"/>`;
  s += `<rect x="-4" y="-42" width="28" height="13" rx="1" fill="#1d2b1d"/><text x="10" y="-32.5" class="tiny" text-anchor="middle" fill="#7dff7d">${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} V</text>`;
  s += `<text x="0" y="-13" class="silk" fill="#c62828" text-anchor="middle">+</text><text x="20" y="-13" class="silk" fill="#1565c0" text-anchor="middle">–</text>`;
  return s + pinsOf(comp);
}


/* ---------- ESP32 DevKit 38 Pin (CP2102, USB-C) ---------- */
/* Waagrecht gezeichnet: Antenne links, USB rechts. Pin-IDs „D<GPIO>“ wie beim Arduino. */
const ESP_HINT = {
  D0: 'Boot-Pin – beim Start nicht auf NIEDRIG', D2: 'Boot-Pin, eingebaute blaue LED', D5: 'Boot-Pin', D12: 'Boot-Pin – beim Start nicht auf HOCH', D15: 'Boot-Pin',
  D1: 'TX0 – USB-Verbindung', D3: 'RX0 – USB-Verbindung', D34: 'nur Eingang', D35: 'nur Eingang', D36: 'VP – nur Eingang', D39: 'VN – nur Eingang',
  SD0: 'Flash-Speicher – nicht benutzen', SD1: 'Flash-Speicher – nicht benutzen', SD2: 'Flash-Speicher – nicht benutzen', SD3: 'Flash-Speicher – nicht benutzen',
  CMD: 'Flash-Speicher – nicht benutzen', CLK: 'Flash-Speicher – nicht benutzen', EN: 'Neustart (Reset)', D21: 'SDA (I²C)', D22: 'SCL (I²C)',
};
const ESP_TOP = [['GND2', 'GND'], ['D23', 'D23'], ['D22', 'D22'], ['D1', 'TX0'], ['D3', 'RX0'], ['D21', 'D21'], ['GND3', 'GND'], ['D19', 'D19'], ['D18', 'D18'], ['D5', 'D5'],
  ['D17', 'TX2'], ['D16', 'RX2'], ['D4', 'D4'], ['D0', 'D0'], ['D2', 'D2'], ['D15', 'D15'], ['SD1', 'SD1'], ['SD0', 'SD0'], ['CLK', 'CLK']];
const ESP_BOT = [['3V3', '3V3'], ['EN', 'EN'], ['D36', 'VP'], ['D39', 'VN'], ['D34', 'D34'], ['D35', 'D35'], ['D32', 'D32'], ['D33', 'D33'], ['D25', 'D25'], ['D26', 'D26'],
  ['D27', 'D27'], ['D14', 'D14'], ['D12', 'D12'], ['GND1', 'GND'], ['D13', 'D13'], ['SD2', 'SD2'], ['SD3', 'SD3'], ['CMD', 'CMD'], ['5V', '5V']];
function espPinLabel(id, short) {
  const base = /^D\d+$/.test(id) ? `${id} (GPIO ${id.slice(1)})` : short;
  return ESP_HINT[id] ? `${base} – ${ESP_HINT[id]}` : base;
}
const ESP_PINS = (kind, dy) => ESP_TOP.map(([id, sh], i) => ({ id, x: i * 10, y: 0, kind, label: espPinLabel(id, sh), short: sh }))
  .concat(ESP_BOT.map(([id, sh], i) => ({ id, x: i * 10, y: 100, kind, label: espPinLabel(id, sh), short: sh })));
const ESP_MCU = { kind: 'esp32', chip: 'esp32', gnd: 'GND1', v5: '5V', v33: '3V3', sda: 'D21', scl: 'D22', logic: 3.3, adcMax: 4095, vref: 3.3, led: 'D2', pwm: null };
const UNO_MCU = { kind: 'uno', gnd: 'GND_T', v5: '5V', v33: '3V3', sda: 'SDA', scl: 'SCL', logic: 5, adcMax: 1023, vref: 5, led: 'D13', pwm: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'] };

/* Das Modul selbst (ohne Anschlüsse), damit es auch auf dem Expansion Board verwendet werden kann */
function espModuleSvg(st, withHeaders) {
  const led = st && st.led ? '#4aa3ff' : '#2a3b57';
  const pwr = st && st.running ? '#ff4a3d' : '#5a2a28';
  let s = `<rect class="body" x="-30" y="-4" width="222" height="108" rx="4" fill="#202226" stroke="#0d0d0f"/>`;
  if (withHeaders) { s += `<rect x="-5" y="-4" width="190" height="9" fill="#111"/><rect x="-5" y="95" width="190" height="9" fill="#111"/>`; }
  // Antenne und Metallgehäuse des Funkmoduls
  s += `<rect x="-26" y="29" width="138" height="42" rx="2" fill="#1d1d1f" stroke="#3a3a3a"/>`;
  s += `<path d="M-22 34 h12 v6 h-8 v6 h8 v6 h-8 v6 h8 v6 h-12" fill="none" stroke="#c9a43a" stroke-width="1.8"/>`;
  s += `<rect x="4" y="31" width="104" height="38" rx="2" fill="#c9cdd1" stroke="#8b9399"/><rect x="8" y="34" width="96" height="32" rx="1" fill="#d6dade"/>`;
  s += `<text x="56" y="49" class="chip2" text-anchor="middle" style="font-size:7px;fill:#555">ESP-WROOM-32</text><text x="56" y="59" class="chip2" text-anchor="middle" style="font-size:5px;fill:#777">WiFi + Bluetooth</text>`;
  // USB-Seriell-Wandler, Regler, Tasten, LEDs, USB-C
  s += `<rect x="120" y="38" width="22" height="22" rx="1" fill="#141414"/><text x="131" y="51" class="chip2" text-anchor="middle" style="fill:#999">CP2102</text>`;
  s += `<rect x="120" y="62" width="12" height="7" fill="#141414"/>`;
  for (const [x, y, t] of [[164, 30, 'EN'], [164, 58, 'BOOT']]) s += `<rect x="${x}" y="${y}" width="15" height="12" rx="1" fill="#d9dde0" stroke="#8b9399"/><rect x="${x + 4}" y="${y + 3}" width="7" height="6" rx="1" fill="#2b2b2b"/><text x="${x - 2}" y="${y + 8}" class="silkpin" text-anchor="end">${t}</text>`;
  s += `<rect x="152" y="45" width="6" height="4" rx="1" fill="${pwr}"/><rect x="152" y="52" width="6" height="4" rx="1" fill="${led}"/>`;
  if (st && st.led) s += `<circle cx="155" cy="54" r="7" fill="#4aa3ff" opacity=".35"/>`;
  s += `<rect x="182" y="36" width="20" height="28" rx="4" fill="#c8cdd1" stroke="#8b9399"/><rect x="194" y="42" width="6" height="16" rx="2" fill="#5f666c"/>`;
  return s;
}
function renderESP32(comp, st) {
  let s = espModuleSvg(st, true);
  for (const p of comp.def.pins) {
    const ty = p.y < 50 ? 12 : 88;
    s += `<text x="${p.x}" y="${ty}" class="silkpin" text-anchor="${p.y < 50 ? 'end' : 'start'}" transform="rotate(-90 ${p.x} ${ty})" dy="2">${esc(p.short)}</text>`;
    s += pinRect(p);
  }
  return s;
}

/* ---------- ESP32 auf dem 38-Pin-Expansion-Board ---------- */
/* Zu jedem Modulanschluss eine 3er-Leiste: G (GND, innen), V (Versorgung je nach Jumper), S (Signal, außen) */
const EXP_PINS = (() => {
  const pins = [];
  ESP_TOP.forEach(([id, sh], i) => {
    pins.push({ id, x: i * 10, y: -40, kind: 'socket', label: espPinLabel(id, sh), short: sh });
    pins.push({ id: 'V' + i, x: i * 10, y: -30, kind: 'socket', label: 'V (3,3 V oder 5 V, siehe Jumper)' });
    pins.push({ id: 'G' + i, x: i * 10, y: -20, kind: 'socket', label: 'G (GND)' });
  });
  ESP_BOT.forEach(([id, sh], i) => {
    pins.push({ id, x: i * 10, y: 140, kind: 'socket', label: espPinLabel(id, sh), short: sh });
    pins.push({ id: 'V' + (i + 19), x: i * 10, y: 130, kind: 'socket', label: 'V (3,3 V oder 5 V, siehe Jumper)' });
    pins.push({ id: 'G' + (i + 19), x: i * 10, y: 120, kind: 'socket', label: 'G (GND)' });
  });
  for (const [id, y, l] of [['P3V3a', 10, '3,3 V'], ['P3V3b', 20, '3,3 V'], ['P5Va', 40, '5 V'], ['P5Vb', 50, '5 V'], ['PGa', 70, 'GND'], ['PGb', 80, 'GND']]) pins.push({ id, x: 230, y, kind: 'socket', label: l + ' (Stromleiste)' });
  return pins;
})();
function expInternal(comp) {
  const g = ['GND1', 'GND2', 'GND3', 'PGa', 'PGb'], v = [];
  for (let i = 0; i < 38; i++) { g.push('G' + i); v.push('V' + i); }
  v.push(String(comp.props.jump) === '5' ? '5V' : '3V3');
  return [g, v, ['3V3', 'P3V3a', 'P3V3b'], ['5V', 'P5Va', 'P5Vb']];
}
function renderESP32Exp(comp, st) {
  const five = String(comp.props.jump) === '5';
  let s = `<rect class="body" x="-62" y="-74" width="312" height="248" rx="6" fill="#5e2d91" stroke="#3d1d63"/>`;
  s += `<rect x="-58" y="-70" width="304" height="240" rx="4" fill="none" stroke="#7a49ad" stroke-width="1"/>`;
  for (const [x, y] of [[-50, -62], [238, -62], [-50, 162], [238, 162]]) s += `<circle cx="${x}" cy="${y}" r="6" fill="#e8e8e8" stroke="#c9b6e0"/><circle cx="${x}" cy="${y}" r="3" fill="#5e2d91"/>`;
  // Farbige Stiftleisten: innen G schwarz, dann V rot, außen S gelb
  const HC = { G: '#1a1a1a', V: '#d32f2f', S: '#f2c200' };
  for (const [y, k] of [[-20, 'G'], [-30, 'V'], [-40, 'S'], [120, 'G'], [130, 'V'], [140, 'S']]) s += `<rect x="-5" y="${y - 4.5}" width="190" height="9" rx="1" fill="${HC[k]}"/>`;
  // Stromversorgung links: Hohlbuchse, USB-C, Micro-USB
  s += `<rect x="-70" y="-6" width="34" height="30" rx="2" fill="#111" stroke="#000"/><circle cx="-56" cy="9" r="7" fill="#333"/><circle cx="-56" cy="9" r="2.4" fill="#aaa"/>`;
  s += `<rect x="-68" y="38" width="16" height="24" rx="4" fill="#c8cdd1" stroke="#8b9399"/><rect x="-66" y="44" width="10" height="12" rx="2" fill="#5f666c"/>`;
  s += `<rect x="-68" y="76" width="14" height="20" rx="2" fill="#c8cdd1" stroke="#8b9399"/><rect x="-66" y="80" width="8" height="12" fill="#5f666c"/>`;
  s += `<rect x="-36" y="104" width="10" height="6" rx="1" fill="${st && st.running ? '#ff4a3d' : '#5a2a28'}"/><text x="-31" y="118" class="silkpin" text-anchor="middle">PWR</text>`;
  // Jumper 3,3 V / 5 V
  s += `<text x="215" y="-50" class="silkpin" text-anchor="middle">JUMP</text>`;
  for (const [x, t] of [[205, '3.3V'], [215, ''], [225, '5V']]) s += `<rect x="${x - 3}" y="-40" width="6" height="6" fill="#d7b43d"/>${t ? `<text x="${x}" y="-26" class="silkpin" text-anchor="middle">${t}</text>` : ''}`;
  s += `<rect x="${five ? 210 : 200}" y="-42" width="20" height="10" rx="1.5" fill="#1565c0" stroke="#0b3d7a"/>`;
  // Stromleiste rechts
  s += `<rect x="224" y="4" width="12" height="82" rx="1" fill="#141414"/>`;
  for (const [y, t] of [[15, '3V3'], [45, '5V'], [75, 'GND']]) s += `<text x="220" y="${y + 2}" class="silkpin" text-anchor="end">${t}</text>`;
  // Leistenbeschriftung S/V/G
  for (const [y, t] of [[-20, 'G'], [-30, 'V'], [-40, 'S'], [120, 'G'], [130, 'V'], [140, 'S']]) s += `<text x="-14" y="${y + 2}" class="silkpin" text-anchor="middle" style="font-weight:700">${t}</text><text x="194" y="${y + 2}" class="silkpin" text-anchor="middle" style="font-weight:700">${t}</text>`;
  for (const p of comp.def.pins) {
    if (/^[VG]\d+$/.test(p.id) || /^P/.test(p.id)) { s += pinRect(p); continue; }
    s += pinRect(p);
    const ty = p.y < 50 ? -46 : 146;
    s += `<text x="${p.x}" y="${ty}" class="silkpin" text-anchor="${p.y < 50 ? 'start' : 'end'}" transform="rotate(-90 ${p.x} ${ty})" dy="2">${esc(p.short)}</text>`;
  }
  // Modul in der Mitte (gesteckt)
  s += `<rect x="-5" y="-6" width="190" height="10" fill="#0d0d0d"/><rect x="-5" y="96" width="190" height="10" fill="#0d0d0d"/>`;
  s += `<g transform="translate(0 0)">${espModuleSvg(st, false)}</g>`;
  return s;
}

/* ---------- ESP32-C5 (Espressif ESP32-C5-DevKitC-1 und Waveshare ESP32-C5-WIFI6-KIT, je 2 × 16 Pins) ---------- */
/* Waagrecht gezeichnet wie der ESP32: Antenne links, USB rechts. Oben die Leiste J3, unten J1 (Pinbelegung ab Board-Version 1.2). */
const C5_HINT = {
  D0: 'SDA (I²C)', D1: 'SCL (I²C), analog', D2: 'analog', D3: 'analog', D4: 'analog', D5: 'analog', D6: 'analog',
  D7: 'Boot-Pin – besser nicht benutzen', D25: 'Boot-Pin – besser nicht benutzen', D26: 'Boot-Pin – besser nicht benutzen', D28: 'Boot-Pin – nicht benutzen',
  D27: 'eingebaute RGB-LED, Boot-Pin – nicht benutzen', D11: 'TX – USB-Verbindung', D12: 'RX – USB-Verbindung',
  D13: 'USB direkt (D–) – nicht benutzen', D14: 'USB direkt (D+) – nicht benutzen', NC2: 'GPIO15 – bei Modulen mit PSRAM belegt', RST: 'Neustart (Reset)',
};
const C5_TOP = [['GND1', 'G'], ['D11', 'TX'], ['D12', 'RX'], ['D24', '24'], ['D23', '23'], ['NC2', 'NC'], ['D27', '27'], ['D4', '4'], ['D5', '5'], ['NC3', 'NC'],
  ['D28', '28'], ['GND2', 'G'], ['D14', '14'], ['D13', '13'], ['GND3', 'G'], ['NC4', 'NC']];
const C5_BOT = [['3V3', '3V3'], ['RST', 'RST'], ['D2', '2'], ['D3', '3'], ['D0', '0'], ['D1', '1'], ['D6', '6'], ['D7', '7'], ['D8', '8'], ['D9', '9'],
  ['D10', '10'], ['D26', '26'], ['D25', '25'], ['5V', '5V'], ['GND4', 'G'], ['NC1', 'NC']];
function c5PinLabel(id, short) {
  const base = /^D\d+$/.test(id) ? `${id} (GPIO ${id.slice(1)})` : /^GND/.test(id) ? 'GND' : /^NC/.test(id) ? 'nicht verbunden' : short;
  return C5_HINT[id] ? `${base} – ${C5_HINT[id]}` : base;
}
const C5_PINS = C5_TOP.map(([id, sh], i) => ({ id, x: i * 10, y: 0, kind: 'leg', label: c5PinLabel(id, sh), short: sh }))
  .concat(C5_BOT.map(([id, sh], i) => ({ id, x: i * 10, y: 100, kind: 'leg', label: c5PinLabel(id, sh), short: sh })));
const C5_MCU = { kind: 'esp32', chip: 'c5', gnd: 'GND4', v5: '5V', v33: '3V3', sda: 'D0', scl: 'D1', logic: 3.3, adcMax: 4095, vref: 3.3, led: 'D27', pwm: null };
function renderESP32C5(comp, st) {
  const on = st && st.led, run = st && st.running;
  let s = `<rect class="body" x="-30" y="-4" width="222" height="108" rx="4" fill="#1f2a3a" stroke="#0d121a"/>`;
  s += `<rect x="-5" y="-4" width="160" height="9" fill="#111"/><rect x="-5" y="95" width="160" height="9" fill="#111"/>`;
  // Funkmodul mit Antenne
  s += `<rect x="-26" y="26" width="128" height="48" rx="2" fill="#1d1d1f" stroke="#3a3a3a"/>`;
  s += `<path d="M-22 32 h12 v6 h-8 v6 h8 v6 h-8 v6 h8 v6 h-8 v6 h12" fill="none" stroke="#c9a43a" stroke-width="1.8"/>`;
  s += `<rect x="4" y="29" width="94" height="42" rx="2" fill="#c9cdd1" stroke="#8b9399"/><rect x="8" y="32" width="86" height="36" rx="1" fill="#d6dade"/>`;
  s += `<text x="51" y="48" class="chip2" text-anchor="middle" style="font-size:6.5px;fill:#555">ESP32-C5-WROOM-1</text><text x="51" y="58" class="chip2" text-anchor="middle" style="font-size:5px;fill:#777">WiFi 6 (2,4 + 5 GHz) · BLE</text>`;
  // USB-Seriell-Wandler, Tasten, RGB-LED, zwei USB-C-Buchsen
  s += `<rect x="112" y="40" width="18" height="18" rx="1" fill="#141414"/>`;
  for (const [x, y, t] of [[138, 18, 'RST'], [138, 70, 'BOOT']]) s += `<rect x="${x}" y="${y}" width="14" height="11" rx="1" fill="#d9dde0" stroke="#8b9399"/><rect x="${x + 4}" y="${y + 3}" width="6" height="5" rx="1" fill="#2b2b2b"/><text x="${x + 7}" y="${y + (y < 50 ? -2 : 18)}" class="silkpin" text-anchor="middle">${t}</text>`;
  s += `<rect x="140" y="45" width="9" height="9" rx="1.5" fill="${on ? '#fff' : '#e8e8e8'}" stroke="#999"/><circle cx="144.5" cy="49.5" r="2.6" fill="${on ? '#fffbe0' : '#bbb'}"/>`;
  if (on) s += `<circle cx="144.5" cy="49.5" r="9" fill="#fff6c8" opacity=".55"/>`;
  s += `<rect x="128" y="62" width="5" height="4" rx="1" fill="${run ? '#ff4a3d' : '#5a2a28'}"/>`;
  s += `<rect x="168" y="14" width="26" height="22" rx="5" fill="#c8cdd1" stroke="#8b9399"/><rect x="180" y="19" width="10" height="12" rx="3" fill="#5f666c"/><text x="164" y="27" class="silkpin" text-anchor="end">USB</text>`;
  s += `<rect x="168" y="64" width="26" height="22" rx="5" fill="#c8cdd1" stroke="#8b9399"/><rect x="180" y="69" width="10" height="12" rx="3" fill="#5f666c"/><text x="164" y="77" class="silkpin" text-anchor="end">UART</text>`;
  for (const p of comp.def.pins) {
    const ty = p.y < 50 ? 12 : 88;
    s += `<text x="${p.x}" y="${ty}" class="silkpin" text-anchor="${p.y < 50 ? 'end' : 'start'}" transform="rotate(-90 ${p.x} ${ty})" dy="2">${esc(p.short)}</text>`;
    s += pinRect(p);
  }
  return s;
}

/* ---------- ESP8266 NodeMCU (Version 3 „LoLin“ mit CH340, passt auch für Version 2 mit CP2102) ---------- */
/* Waagrecht gezeichnet: Antenne links, USB rechts. Pin-IDs wie die Beschriftung auf dem Board (D0 … D8, A0). */
const N_HINT = {
  D0: 'GPIO16 – kein PWM', D1: 'GPIO5 – SCL (I²C)', D2: 'GPIO4 – SDA (I²C)', D3: 'GPIO0 – Boot-Pin (FLASH-Taste) – besser nicht benutzen',
  D4: 'GPIO2 – eingebaute blaue LED, Boot-Pin – besser nicht benutzen', D5: 'GPIO14', D6: 'GPIO12', D7: 'GPIO13', D8: 'GPIO15 – Boot-Pin: beim Start NIEDRIG (nur als Ausgang)',
  RX: 'GPIO3 – USB-Verbindung', TX: 'GPIO1 – USB-Verbindung', A0: 'einziger analoger Eingang (0 – 3,3 V)', '5V': 'VU – 5 V vom USB-Anschluss', VIN: 'Eingang 5 – 9 V',
  SD3: 'Flash-Speicher – nicht benutzen', SD2: 'Flash-Speicher – nicht benutzen', SD1: 'Flash-Speicher – nicht benutzen', SD0: 'Flash-Speicher – nicht benutzen',
  CMD: 'Flash-Speicher – nicht benutzen', CLK: 'Flash-Speicher – nicht benutzen', EN: 'Freigabe (EN)', RST: 'Neustart (Reset)',
};
const N_TOP = [['D0', 'D0'], ['D1', 'D1'], ['D2', 'D2'], ['D3', 'D3'], ['D4', 'D4'], ['3V3', '3V'], ['GND1', 'G'], ['D5', 'D5'], ['D6', 'D6'], ['D7', 'D7'], ['D8', 'D8'],
  ['RX', 'RX'], ['TX', 'TX'], ['GND2', 'G'], ['3V3b', '3V']];
const N_BOT = [['A0', 'A0'], ['GND3', 'G'], ['5V', 'VU'], ['SD3', 'S3'], ['SD2', 'S2'], ['SD1', 'S1'], ['CMD', 'SC'], ['SD0', 'S0'], ['CLK', 'SK'], ['GND4', 'G'], ['3V3c', '3V'],
  ['EN', 'EN'], ['RST', 'RST'], ['GND5', 'G'], ['VIN', 'VIN']];
function nPinLabel(id, short) {
  const base = /^GND/.test(id) ? 'GND' : /^3V3/.test(id) ? '3,3 V' : id;
  return N_HINT[id] ? `${base} – ${N_HINT[id]}` : base;
}
const N_PINS = N_TOP.map(([id, sh], i) => ({ id, x: i * 10, y: 0, kind: 'leg', label: nPinLabel(id, sh), short: sh }))
  .concat(N_BOT.map(([id, sh], i) => ({ id, x: i * 10, y: 100, kind: 'leg', label: nPinLabel(id, sh), short: sh })));
const N_MCU = { kind: 'esp32', chip: '8266', gnd: 'GND1', v5: '5V', v33: '3V3', sda: 'D2', scl: 'D1', logic: 3.3, adcMax: 1023, vref: 3.3, led: 'D4', ledInv: true,
  pwm: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] };
function renderNodeMCU(comp, st) {
  const on = st && st.led;
  let s = `<rect class="body" x="-34" y="-4" width="226" height="108" rx="5" fill="#1b1b1d" stroke="#000"/>`;
  for (const [x, y] of [[-27, 3], [-27, 97], [185, 3], [185, 97]]) s += `<circle cx="${x}" cy="${y}" r="4" fill="#efe9d8" stroke="#888"/><circle cx="${x}" cy="${y}" r="2" fill="#1b1b1d"/>`;
  s += `<rect x="-5" y="-4" width="150" height="9" fill="#111"/><rect x="-5" y="95" width="150" height="9" fill="#111"/>`;
  // ESP-12E: Antenne (Leiterbahn) links, Metallgehäuse, blaue LED
  s += `<rect x="-30" y="22" width="112" height="56" rx="2" fill="#151515" stroke="#333"/>`;
  s += `<path d="M-26 28 h10 v8 h-6 v8 h6 v8 h-6 v8 h6 v8 h-10" fill="none" stroke="#c9a43a" stroke-width="1.8"/>`;
  s += `<rect x="-6" y="25" width="84" height="50" rx="2" fill="#c9cdd1" stroke="#8b9399"/><rect x="-2" y="28" width="76" height="44" rx="1" fill="#d6dade"/>`;
  s += `<text x="36" y="47" class="chip2" text-anchor="middle" style="font-size:7px;fill:#555">ESP8266MOD</text><text x="36" y="57" class="chip2" text-anchor="middle" style="font-size:5px;fill:#777">WiFi 2,4 GHz</text>`;
  s += `<rect x="-14" y="66" width="5" height="4" rx="1" fill="${on ? '#4aa3ff' : '#2a3b57'}"/>`;
  if (on) s += `<circle cx="-11.5" cy="68" r="7" fill="#4aa3ff" opacity=".35"/>`;
  // Spannungsregler, USB-Seriell-Wandler, Tasten, Micro-USB
  s += `<rect x="92" y="26" width="16" height="20" rx="1" fill="#141414"/><rect x="94" y="22" width="12" height="4" fill="#9aa0a5"/>`;
  s += `<rect x="114" y="38" width="30" height="24" rx="1" fill="#141414"/><text x="129" y="52" class="chip2" text-anchor="middle" style="fill:#999">CH340</text>`;
  for (const [x, y, t] of [[160, 12, 'RST'], [160, 74, 'FLASH']]) s += `<rect x="${x}" y="${y}" width="14" height="12" rx="1" fill="#d9dde0" stroke="#8b9399"/><rect x="${x + 4}" y="${y + 3}" width="6" height="6" rx="1" fill="#2b2b2b"/><text x="${x + 7}" y="${y + (y < 50 ? -2 : 19)}" class="silkpin" text-anchor="middle">${t}</text>`;
  s += `<rect x="176" y="38" width="20" height="24" rx="2" fill="#c8cdd1" stroke="#8b9399"/><rect x="186" y="43" width="7" height="14" rx="1" fill="#5f666c"/>`;
  for (const p of comp.def.pins) {
    const ty = p.y < 50 ? 12 : 88;
    s += `<text x="${p.x}" y="${ty}" class="silkpin" text-anchor="${p.y < 50 ? 'end' : 'start'}" transform="rotate(-90 ${p.x} ${ty})" dy="2">${esc(p.short)}</text>`;
    s += pinRect(p);
  }
  return s;
}

/* ---------- Katalog ---------- */
const L = (id, x, label) => ({ id, x, y: 0, kind: 'leg', label: label || id });
const S = (id, x, y, label) => ({ id, x, y, kind: 'socket', label: label || id });
const COMPONENTS = {
  uno: { name: 'Arduino Uno', category: 'Grundlagen', pins: UNO_PINS, render: renderUno, bbox: [-18, 0, 300, 210], props: {},
    internal: [['GND_T', 'GND_1', 'GND_2'], ['SDA', 'A4'], ['SCL', 'A5']], fixed: true, mcu: UNO_MCU },
  esp32: { name: 'ESP32 (38 Pin)', category: 'Grundlagen', pins: ESP_PINS('leg'), render: renderESP32, bbox: [-30, -4, 202, 104], props: {},
    internal: [['GND1', 'GND2', 'GND3']], fixed: true, mcu: ESP_MCU },
  esp32exp: { name: 'ESP32 auf Expansion Board', category: 'Grundlagen', pins: EXP_PINS, render: renderESP32Exp, bbox: [-70, -74, 250, 174], props: { jump: '3.3' },
    internal: expInternal, fixed: true, mcu: ESP_MCU },
  esp32c5: { name: 'ESP32-C5', category: 'Grundlagen', pins: C5_PINS, render: renderESP32C5, bbox: [-30, -4, 194, 104], props: {},
    internal: [['GND1', 'GND2', 'GND3', 'GND4']], fixed: true, mcu: C5_MCU },
  nodemcu: { name: 'ESP8266 NodeMCU', category: 'Grundlagen', pins: N_PINS, render: renderNodeMCU, bbox: [-34, -4, 196, 104], props: {},
    internal: [['GND1', 'GND2', 'GND3', 'GND4', 'GND5'], ['3V3', '3V3b', '3V3c']], fixed: true, mcu: N_MCU },
  breadboard: { name: 'Steckplatine', category: 'Grundlagen', pins: bbPins, render: renderBreadboard, bbox: [0, 0, 330, 200], props: {}, isBreadboard: true, fixed: true },
  resistor: { name: 'Widerstand', category: 'Grundlagen', render: renderResistor, bbox: [0, -6, 40, 6],
    pins: [L('1', 0, 'Anschluss 1'), L('2', 40, 'Anschluss 2')], props: { ohm: 1000 } },
  led: { name: 'LED', category: 'Grundlagen', render: renderLED, bbox: [-4, -36, 14, 4],
    pins: [L('A', 0, 'Anode (+)'), L('K', 10, 'Kathode (–)')], props: { color: 'rot' } },
  rgbled: { name: 'RGB-LED', category: 'Grundlagen', render: renderRGB, bbox: [-3, -40, 33, 10],
    pins: [L('R', 0, 'Rot'), L('K', 10, 'Minus (gemeinsam)'), L('G', 20, 'Grün'), L('B', 30, 'Blau')], props: {} },
  source: { name: 'Spannungsquelle',  category: 'Grundlagen', render: renderSource, bbox: [-8, -46, 28, 4],
    pins: [L('P', 0, 'Plus (+)'), L('N', 20, 'Minus (–)')], props: { volt: 0.7, ri: 1 } },

  button: { name: 'Mikrotaster', category: 'Taster', render: renderButton, bbox: [-3, 0, 23, 30],
    pins: [{ id: 'A1', x: 0, y: 0, kind: 'leg', label: 'Anschluss 1 (oben)' }, { id: 'A2', x: 0, y: 30, kind: 'leg', label: 'Anschluss 1 (unten)' },
      { id: 'B1', x: 20, y: 0, kind: 'leg', label: 'Anschluss 2 (oben)' }, { id: 'B2', x: 20, y: 30, kind: 'leg', label: 'Anschluss 2 (unten)' }],
    props: {}, internal: [['A1', 'A2'], ['B1', 'B2']], pressable: true, sw: ['A1', 'B1'] },
  button2: { name: 'Mikrotaster (2 Beine)',  category: 'Taster', render: renderButton2, bbox: [-3, 0, 23, 30],
    pins: [{ id: 'P1', x: 10, y: 0, kind: 'leg', label: 'Anschluss 1' }, { id: 'P2', x: 10, y: 30, kind: 'leg', label: 'Anschluss 2' }],
    props: {}, pressable: true, sw: ['P1', 'P2'] },
  pushbutton: { name: 'Minitaster', category: 'Taster', render: renderPushbutton, bbox: [-12, -58, 22, 2],
    pins: [S('1', 0, 0, 'Lötfahne 1'), S('2', 10, 0, 'Lötfahne 2')], props: {}, pressable: true, sw: ['1', '2'] },
  touch: { name: 'Sensortaste', category: 'Taster', render: renderTouch, bbox: [-10, -46, 30, 4],
    pins: [L('GND', 0), L('VCC', 10), L('SIG', 20)], props: {}, pressable: true },

  ldr: { name: 'Fotowiderstand (LDR)',  category: 'Sensoren', render: renderLDR, bbox: [-5, -29, 15, 4],
    pins: [L('1', 0, 'Anschluss 1'), L('2', 10, 'Anschluss 2')], props: { light: 50 } },
  ntc: { name: 'Heißleiter (NTC)',  category: 'Sensoren', render: renderNTC, bbox: [-3, -27, 13, 4],
    pins: [L('1', 0, 'Anschluss 1'), L('2', 10, 'Anschluss 2')], props: { temp: 20 } },
  poti: { name: 'Potentiometer',  category: 'Sensoren', render: renderPoti, bbox: [-5, -30, 25, 4],
    pins: [L('1', 0, 'Anschluss 1'), L('W', 10, 'Schleifer (Mitte)'), L('2', 20, 'Anschluss 2')], props: { position: 50, ohm: 10000 } },
  tmp36: { name: 'Temperatursensor TMP36', label: 'Temperatur\u00adsensor TMP36',  category: 'Sensoren', render: renderTMP36, bbox: [-3, -30, 23, 12],
    pins: [L('VCC', 0, '+Vs'), L('OUT', 10, 'Vout'), L('GND', 20)], props: { temp: 20 } },
  moisture: { name: 'Kapazitiver Feuchtesensor', label: 'Kapazitiver Feuchtesensor', category: 'Sensoren', render: renderMoisture, bbox: [-8, -106, 28, 4],
    pins: [L('GND', 0), L('VCC', 10), L('OUT', 20, 'AOUT')], props: { wet: 30 } },
  soil: { name: 'Feuchtefühler', label: 'Feuchtefühler (2 Drähte)', category: 'Sensoren', render: renderSoil, bbox: [-16, -58, 26, 4],
    pins: [L('1', 0, 'Draht 1'), L('2', 10, 'Draht 2')], props: { wet: 30 } },
  pir: { name: 'Bewegungsmelder (PIR)',  category: 'Sensoren', render: renderPIR, bbox: [-15, -60, 35, 4],
    pins: [L('VCC', 0), L('OUT', 10), L('GND', 20)], props: {}, pressable: true },
  ultrasonic: { name: 'Ultraschallsensor', label: 'Ultraschall\u00adsensor',  category: 'Sensoren', render: renderUltrasonic, bbox: [-35, -54, 65, 4],
    pins: [L('VCC', 0), L('TRIG', 10, 'Trig'), L('ECHO', 20, 'Echo'), L('GND', 30)], props: { dist: 50 } },
  dht: { name: 'Temperatur- und Feuchtesensor DHT', label: 'Temperatur- und Feuchte­sensor DHT', category: 'Sensoren', render: renderDHT, bbox: [-8, -76, 28, 4],
    pins: [L('VCC', 0, '+ (VCC)'), L('DATA', 10, 'out (Daten)'), L('GND', 20, '– (GND)')], props: { model: '11', temp: 22, hum: 45 } },

  piezo: { name: 'Piezo-Summer', category: 'Aktoren', render: renderPiezo, bbox: [-7, -42, 27, 4],
    pins: [L('P', 0, 'Plus (+)'), L('N', 20, 'Minus (–)')], props: {} },
  servo: { name: 'Servo SG90', category: 'Aktoren', render: renderServo, bbox: [-5, -66, 124, 18],
    pins: [S('GND', 0, 0, 'GND (braun)'), S('VCC', 10, 0, '5V (rot)'), S('SIG', 20, 0, 'Signal (orange)')], props: {} },
  motor: { name: 'Lüfter', category: 'Aktoren', render: renderMotor, bbox: [-4, -80, 60, 12],
    pins: [S('P', 0, 0, 'Plus (rot)'), S('N', 10, 0, 'Minus (schwarz)')], props: {} },
  gearmotor: { name: 'Getriebemotor', ext: 'motoren', category: 'Aktoren', render: renderGearMotor, bbox: [-30, -74, 118, 12],
    pins: [S('P', 0, 0, 'Plus (rot)'), S('N', 10, 0, 'Minus (schwarz)')], props: {} },
  wheelL: { name: 'Getriebemotor mit Rad links', label: 'Getriebe\u00admotor mit Rad links', ext: 'motoren', category: 'Aktoren', render: renderWheelMotor, wheel: 'L', bbox: [-42, -12, 33, 126],
    pins: [S('P', 0, 0, 'Plus (rot)'), S('N', 10, 0, 'Minus (schwarz)')], props: {} },
  wheelR: { name: 'Getriebemotor mit Rad rechts', label: 'Getriebe\u00admotor mit Rad rechts', ext: 'motoren', category: 'Aktoren', render: renderWheelMotor, wheel: 'R', bbox: [-23, -12, 52, 126],
    pins: [S('N', 0, 0, 'Minus (schwarz)'), S('P', 10, 0, 'Plus (rot)')], props: {} },
  stepper: { name: 'Schrittmotor 28BYJ-48 mit ULN2003', label: 'Schrittmotor 28BYJ-48 mit Treiber ULN2003', ext: 'motoren', category: 'Aktoren', render: renderStepper, bbox: [-30, -166, 84, 4],
    pins: [L('IN1', 0), L('IN2', 10), L('IN3', 20), L('IN4', 30), L('GND', 50, '– (GND)'), L('VCC', 60, '+ (5 V)')], props: {} },
  strip: { name: 'NeoPixel-Streifen (8)', ext: 'neopixel',  category: 'Aktoren', render: renderStrip, bbox: [-8, -30, 114, 13], count: 8,
    pins: [L('VCC', 0, '5V'), L('DIN', 10, 'DIN'), L('GND', 20)], props: {} },
  ring: { name: 'NeoPixel-Ring (12)', ext: 'neopixel',  category: 'Aktoren', render: renderRing, bbox: [-30, -90, 50, 13], count: 12,
    pins: [L('VCC', 0, '5V'), L('DIN', 10, 'DIN'), L('GND', 20)], props: {} },

  oled: { name: 'OLED 128 × 64 (I²C)', category: 'Anzeige', ext: 'oled', render: renderOLED, bbox: [-35, 0, 65, 96],
    pins: [L('GND', 0), L('VCC', 10), L('SCL', 20), L('SDA', 30)], props: {} },
  lcd: { name: 'LCD 16 × 2 (I²C)', category: 'Anzeige', render: renderLCD, bbox: [-5, -34, 208, 48],
    pins: [S('GND', 0, 0), S('VCC', 0, 10, 'VCC (5V)'), S('SDA', 0, 20), S('SCL', 0, 30)], props: {} },

  keypad3: { name: 'Tastenfeld 3 × 4', ext: 'keypad',  category: 'Module', render: renderKeypad, bbox: [-27, -192, 87, 13], cols: 3,
    pins: ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3'].map((id, i) => S(id, i * 10, 0)), props: {} },
  keypad4: { name: 'Tastenfeld 4 × 4', ext: 'keypad',  category: 'Module', render: renderKeypad, bbox: [-26, -192, 96, 13], cols: 4,
    pins: ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'].map((id, i) => S(id, i * 10, 0)), props: {} },
  ads1115: { name: 'Spannungsmesser ADS1115', ext: 'multimeter',  category: 'Module', render: renderADS, bbox: [-8, -52, 98, 4],
    pins: ['VDD', 'GND', 'SCL', 'SDA', 'ADDR', 'ALRT', 'A0', 'A1', 'A2', 'A3'].map((id, i) => L(id, i * 10)), props: {} },
  mdriver: { name: 'Motortreiber L9110S', label: 'Motor\u00adtreiber L9110S', ext: 'motoren', hidden: true, category: 'Module', render: renderDriver, bbox: [-28, -70, 80, 4],
    pins: [L('BIA', 0, 'B-IA (Motor B)'), L('BIB', 10, 'B-IB (Motor B)'), L('GND', 20), L('VCC', 30, 'VCC (Motorspannung)'), L('AIA', 40, 'A-IA (Motor A)'), L('AIB', 50, 'A-IB (Motor A)'),
      S('MA1', -19, -53, 'Motor A Anschluss 1'), S('MA2', -19, -39, 'Motor A Anschluss 2'), S('MB1', 71, -53, 'Motor B Anschluss 1'), S('MB2', 71, -39, 'Motor B Anschluss 2')], props: {} },
  l298n: { name: 'Motortreiber L298N', label: 'Motor\u00adtreiber L298N', ext: 'motoren', category: 'Module', render: renderL298, bbox: [-75, -166, 95, 12],
    pins: [S('ENA', 0, 0, 'ENA (Freigabe Motor A)'), S('IN1', 10, 0, 'IN1 (Motor A)'), S('IN2', 20, 0, 'IN2 (Motor A)'), S('IN3', 30, 0, 'IN3 (Motor B)'), S('IN4', 40, 0, 'IN4 (Motor B)'), S('ENB', 50, 0, 'ENB (Freigabe Motor B)'),
      S('VS', -40, -5, '+12V (Motorspannung, z. B. Batterie)'), S('GND', -30, -5, 'GND'), S('V5', -20, -5, '+5V'),
      S('OUT1', -62, -55, 'OUT1 (Motor A)'), S('OUT2', -62, -35, 'OUT2 (Motor A)'), S('OUT3', 82, -35, 'OUT3 (Motor B)'), S('OUT4', 82, -55, 'OUT4 (Motor B)')],
    props: { ena: '1', enb: '1' } },
  relay: { name: 'Relais-Modul', ext: 'motoren', category: 'Module', render: renderRelay, bbox: [-88, -96, 88, 0],
    pins: [S('NO', -66, -66, 'NO (Schließer: verbunden, wenn das Relais angezogen ist)'), S('COM', -66, -46, 'COM (gemeinsamer Anschluss)'), S('NC', -66, -26, 'NC (Öffner: verbunden, wenn das Relais abgefallen ist)'),
      S('IN', 66, -66, 'IN (Steuereingang)'), S('GND', 66, -46, 'DC− (GND)'), S('VCC', 66, -26, 'DC+ (5V)')],
    props: { trig: 'H', bauform: 2 } },
  ina219: { name: 'Strommesser INA219', ext: 'multimeter',  category: 'Module', render: renderINA, bbox: [-8, -62, 58, 4],
    pins: [L('VCC', 0), L('GND', 10), L('SCL', 20), L('SDA', 30), L('VINM', 40, 'VIN–'), L('VINP', 50, 'VIN+')], props: { address: 64 } },
};
const CATEGORY_ORDER = ['Grundlagen', 'Taster', 'Sensoren', 'Aktoren', 'Anzeige', 'Module'];
const NBSP_NAMES = s => s.replace(/ ([×\d])/g, '\u00a0$1');

/* Kleine Symbole für die Werkzeugleiste */
function componentIcon(type, extraStyle) {
  const d = COMPONENTS[type];
  const fake = { def: d, props: Object.assign({}, d.props) };
  const [x0, y0, x1, y1] = d.bbox;
  const pad = 6;
  return `<svg viewBox="${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}" class="icon-svg"${extraStyle ? ` style="${extraStyle}"` : ''}>${d.render(fake, null)}</svg>`;
}
