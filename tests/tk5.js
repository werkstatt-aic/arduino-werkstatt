(() => {
  const ROWY = { a: 40, b: 50, c: 60, d: 70, e: 80, f: 110, g: 120, h: 130, i: 140, j: 150 };
  const T = s => `<shadow type="text"><field name="TEXT">${s}</field></shadow>`;
  const N = s => `<shadow type="math_number"><field name="NUM">${s}</field></shadow>`;
  const chain = list => {
    let out = '';
    for (let i = list.length - 1; i >= 0; i--) out = out ? list[i].replace(/<\/block>$/, `<next>${out}</next></block>`) : list[i];
    return out;
  };
  const prog = (setup, loop) => `<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="30" y="30"><statement name="DO">${chain(setup)}</statement></block><block type="ard_loop" x="30" y="${120 + setup.length * 50}"><statement name="DO">${chain(loop)}</statement></block></xml>`;
  const dw = (p, v) => `<block type="ard_digital_write"><field name="PIN">${p}</field><field name="V">${v}</field></block>`;
  const wait = s => `<block type="ard_wait"><field name="UNIT">S</field><value name="N">${N(s)}</value></block>`;
  const led = v => `<block type="ard_builtin_led"><field name="V">${v}</field></block>`;
  const mapA0 = to => `<block type="ard_map"><value name="V"><block type="ard_analog_read"><field name="PIN">A0</field></block></value><value name="A">${N(0)}</value><value name="B">${N(1023)}</value><value name="C">${N(0)}</value><value name="D">${N(to)}</value></block>`;

  function base(board, withLcd) {
    BOARD = board;
    App.circuit.load({ components: [], wires: [] });
    App.circuit.addTemplate(365, withLcd ? 380 : 430, withLcd);
    const C = App.circuit, P = C.project;
    const bb = P.components.find(c => c.type === 'breadboard'), mcu = P.components.find(c => c.def.mcu);
    const k = {
      bb, mcu,
      hole: (c, r) => ({ x: bb.x + 20 + (c - 1) * 10, y: bb.y + ROWY[r] }),
      add(type, c, r, props, rot) { const h = k.hole(c, r); const x = makeComp(type, h.x, h.y, rot || 0, props, C.newId('c')); P.components.push(x); return x; },
      addAt(type, x, y, props) { const o = makeComp(type, x, y, 0, props, C.newId('c')); P.components.push(o); return o; },
      pos(ref) { const c = C.comp(ref.c); return worldPin(c, c.def.pins.find(p => p.id === ref.p)); },
      wire(a, b, color, pts) { P.wires.push({ id: C.newId('w'), a, b, color, pts: pts || [] }); },
      H: (c, r) => ({ c: bb.id, p: `${c}${r}` }),
      M: p => ({ c: mcu.id, p }),
      rail: (kind, c) => ({ c: bb.id, p: `${kind}-${c}` }),
      // Vom Anschluss oben am Mikrocontroller senkrecht hoch, waagrecht im Kanal y, senkrecht in das Loch (Zeile j)
      up(pin, col, y, color) { const a = k.pos(k.M(pin)), h = k.hole(col, 'j'); k.wire(k.M(pin), k.H(col, 'j'), color || 'blau', [[a[0], y], [h.x, y]]); },
      // Vom Loch (Zeile j) senkrecht hinunter auf die Stromschiene (bm = Minus, bp = Plus)
      down(col, kind) { k.wire(k.H(col, 'j'), k.rail(kind, col), kind === 'bm' ? 'schwarz' : 'rot'); },
      // Vom Loch nach unten, links um den Arduino herum zu A0 (unten)
      toA0(col) {
        const h = k.hole(col, 'j'), a = k.pos(k.M('A0'));
        k.wire(k.H(col, 'j'), k.M('A0'), 'orange', [[h.x, bb.y + 215], [bb.x - 40, bb.y + 215], [bb.x - 40, mcu.y + 255], [a[0], mcu.y + 255]]);
      },
      done() { C.renderAll(); return C.toJSON(); },
    };
    return k;
  }
  // LED (Zeile f) mit Vorwiderstand (Zeile h, 4 Spalten nach rechts) und Leitung zur Minusschiene
  function ledR(k, c, color, ohm) {
    k.add('led', c, 'f', { color });
    k.add('resistor', c + 1, 'h', { ohm: ohm || 220 });
    k.down(c + 5, 'bm');
  }
  // Potentiometer (Zeile h): links 5 V, rechts GND, Schleifer zu A0
  function poti(k, c) { k.add('poti', c, 'h'); k.down(c, 'bp'); k.down(c + 2, 'bm'); k.toA0(c + 1); }

  const ex = {};
  const sol = (id, board, k, blocks, ext) => { ex[id] = { board, ext: ext || [], circuit: k.done(), blocks }; };
  const T2 = T, cmp = (op, a, b) => `<block type="logic_compare"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
  const ifelse = (c, a, b) => `<block type="controls_if"><mutation else="1"></mutation><value name="IF0">${c}</value><statement name="DO0">${a}</statement><statement name="ELSE">${b}</statement></block>`;
  const iff = (c, a) => `<block type="controls_if"><value name="IF0">${c}</value><statement name="DO0">${a}</statement></block>`;
  const ar = p => `<block type="ard_analog_read"><field name="PIN">${p}</field></block>`;
  const dr = p => `<block type="ard_digital_read"><field name="PIN">${p}</field></block>`;
  const ser = v => `<block type="ard_serial"><field name="NL">Y</field><value name="V">${v}</value></block>`;
  const join = (a, b) => `<block type="ard_join"><value name="A">${a}</value><value name="B">${b}</value></block>`;
  const waitS = s => wait(s);
  const button = (k, pin) => { k.add('button', 8, 'e'); k.wire(k.H(8, 'a'), k.rail('tp', 8), 'rot'); k.add('resistor', 10, 'h', { ohm: 10000 }); k.down(14, 'bm'); k.up(pin, 10, k.bb.y + 230); };
  const ldr = (k, c) => { k.add('ldr', c, 'h'); k.down(c, 'bp'); k.add('resistor', c + 1, 'h', { ohm: 10000 }); k.down(c + 5, 'bm'); };
  const LV = `<variables><variable type="Liste" id="L1">Messwerte</variable></variables>`;
  const lf = `<field name="L" id="L1" variabletype="Liste">Messwerte</field>`;

  { const k = base('uno'); ledR(k, 3, 'rot'); k.up('D12', 3, k.bb.y + 245); sol('g1', 'uno', k, prog([dw(12, 'HIGH')], [])); }
  { const k = base('uno'); ledR(k, 3, 'rot'); k.up('D12', 3, k.bb.y + 245); sol('g2', 'uno', k, prog([], [dw(12, 'HIGH'), waitS(1), dw(12, 'LOW'), waitS(1)])); }
  { const k = base('uno'); button(k, 'D2'); ledR(k, 20, 'rot'); k.up('D12', 20, k.bb.y + 245);
    sol('g4', 'uno', k, prog([], [ifelse(cmp('EQ', dr(2), N(1)), dw(12, 'HIGH'), dw(12, 'LOW'))])); }
  { const k = base('uno'); [3, 9, 15, 21].forEach((c, i) => { ledR(k, c, 'rot'); k.up('D' + (12 - i), c, k.bb.y + 245 - i * 6); });
    sol('g5', 'uno', k, prog([], [12, 11, 10, 9].flatMap(p => [dw(p, 'HIGH'), waitS(0.3), dw(p, 'LOW')]))); }
  { const k = base('uno'); ldr(k, 3); k.toA0(4); ledR(k, 12, 'gelb'); k.up('D12', 12, k.bb.y + 245);
    sol('s1', 'uno', k, prog([], [ifelse(cmp('LT', ar('A0'), N(500)), dw(12, 'HIGH'), dw(12, 'LOW'))])); }
  { const k = base('uno'); k.add('dht', 3, 'h'); k.down(3, 'bp'); k.down(5, 'bm'); k.up('D2', 4, k.bb.y + 245);
    sol('s2', 'uno', k, prog([], [ser(join(T2('Temperatur: '), `<block type="ard_dht"><field name="MODEL">11</field><field name="PIN">2</field><field name="WHAT">C</field></block>`)), waitS(1)])); }
  { const k = base('uno'); k.add('ultrasonic', 3, 'h'); k.down(3, 'bp'); k.wire(k.H(6, 'j'), k.rail('bm', 7), 'schwarz'); k.up('D7', 4, k.bb.y + 245); k.up('D8', 5, k.bb.y + 238); ledR(k, 12, 'rot'); k.up('D12', 12, k.bb.y + 230);
    const us = `<block type="ard_ultrasonic"><field name="TRIG">7</field><field name="ECHO">8</field><field name="UNIT">CM</field></block>`;
    sol('s3', 'uno', k, prog([], [ifelse(cmp('LT', us, N(20)), dw(12, 'HIGH'), dw(12, 'LOW')), waitS(0.1)])); }
  { const k = base('uno'); ldr(k, 3); k.toA0(4);
    sol('s4', 'uno', k, prog([`<block type="list_new">${lf}<field name="N">10</field></block>`],
      [`<block type="list_push"><value name="V">${ar('A0')}</value>${lf}</block>`, ser(join(T2('Mittel: '), `<block type="list_stat"><field name="OP">AVG</field>${lf}</block>`)), waitS(0.5)]).replace('<xml xmlns="https://developers.google.com/blockly/xml">', '<xml xmlns="https://developers.google.com/blockly/xml">' + LV)); }
  { const k = base('uno'); button(k, 'D2'); const s = k.addAt('servo', k.bb.x + 260, k.bb.y - 60);
    k.wire({ c: s.id, p: 'GND' }, k.rail('tm', 26), 'schwarz'); k.wire({ c: s.id, p: 'VCC' }, k.rail('tp', 27), 'rot'); k.wire({ c: s.id, p: 'SIG' }, k.M('D9'), 'orange');
    const sv = d => `<block type="ard_servo"><field name="PIN">9</field><value name="DEG">${N(d)}</value></block>`;
    sol('m1', 'uno', k, prog([sv(0)], [iff(cmp('EQ', dr(2), N(1)), chain([sv(90), waitS(3), sv(0)]))])); }
  { const k = base('uno'); const st = k.add('stepper', 3, 'h'); k.down(8, 'bm'); k.down(9, 'bp'); ['D8', 'D9', 'D10', 'D11'].forEach((p, i) => k.up(p, 3 + i, k.bb.y + 245 - i * 6));
    const sm = dir => `<block type="ard_stepper"><field name="P1">8</field><field name="P2">9</field><field name="P3">10</field><field name="P4">11</field><field name="DIR">${dir}</field><field name="UNIT">DEG</field><value name="N">${N(90)}</value><value name="RPM">${N(15)}</value></block>`;
    sol('m3', 'uno', k, prog([], [sm('CW'), waitS(1), sm('CCW'), waitS(1)])); }
  { const k = base('uno'); k.add('moisture', 3, 'h'); k.down(3, 'bm'); k.down(4, 'bp'); k.toA0(5); k.add('relay', 20, 'h'); k.down(20, 'bp'); k.down(21, 'bm'); k.up('D7', 22, k.bb.y + 245);
    sol('m4', 'uno', k, prog([], [ifelse(cmp('LT', ar('A0'), N(400)), dw(7, 'HIGH'), dw(7, 'LOW'))])); }
  { const k = base('esp32'); ledR(k, 5, 'rot'); k.up('D4', 5, k.bb.y + 212);
    const is = w => cmp('EQ', `<block type="com_usb_text"></block>`, T2(w));
    sol('k2', 'esp32', k, prog([], [iff(`<block type="com_usb_avail"></block>`, chain([iff(is('an'), chain([dw(4, 'HIGH'), ser(T2('LED ist an'))])), iff(is('aus'), chain([dw(4, 'LOW'), ser(T2('LED ist aus'))]))]))]), ['comm']); }
  { const k = base('esp32'); ldr(k, 3); k.up('D32', 4, k.bb.y + 212);
    sol('k3', 'esp32', k, prog([`<block type="com_wifi_ap"><value name="SSID">${T2('ESP')}</value><value name="PW">${T2('werkstatt')}</value></block>`, `<block type="com_web_start"><value name="T">${T2('Licht')}</value></block>`],
      [`<block type="com_web_show"><field name="N">Helligkeit</field><value name="V">${ar('D32')}</value></block>`, waitS(0.5)]), ['comm']); }
  BOARD = 'uno';
  return ex;
})();