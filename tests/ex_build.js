// Baut die Beispielprojekte in der laufenden Werkstatt auf (wird von ex_build.py ausgeführt).
// Leitungen verlaufen nur waagrecht und senkrecht und nicht über Bauteile.
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
      up(pin, col, y, color) { const a = k.pos(k.M(pin)), h = k.hole(col, 'j'); k.wire(k.M(pin), k.H(col, 'j'), color || 'gruen', [[a[0], y], [h.x, y]]); },
      // Vom Loch (Zeile j) senkrecht hinunter auf die Stromschiene (bm = Minus, bp = Plus)
      down(col, kind) { k.wire(k.H(col, 'j'), k.rail(kind, col), kind === 'bm' ? 'schwarz' : 'rot'); },
      // Vom Loch nach unten, links um den Arduino herum zu A0 (unten)
      toA0(col) {
        const h = k.hole(col, 'j'), a = k.pos(k.M('A0'));
        k.wire(k.H(col, 'j'), k.M('A0'), 'gruen', [[h.x, bb.y + 215], [bb.x - 40, bb.y + 215], [bb.x - 40, mcu.y + 255], [a[0], mcu.y + 255]]);
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
  const ex = [];

  /* 1 Blinken */
  { const k = base('uno'); ex.push({ id: 'blinken', title: 'Blinken', board: 'uno', desc: 'Die eingebaute LED „L“ blinkt im Sekundentakt.', circuit: k.done(),
    blocks: prog([], [led('HIGH'), wait(1), led('LOW'), wait(1)]) }); }

  /* 2 Ampel: D12 → rot, D11 → gelb, D10 → grün */
  { const k = base('uno');
    ledR(k, 3, 'rot'); ledR(k, 11, 'gelb'); ledR(k, 20, 'gruen');
    k.up('D12', 3, k.bb.y + 245); k.up('D11', 11, k.bb.y + 230); k.up('D10', 20, k.bb.y + 225);
    ex.push({ id: 'ampel', title: 'Ampelschaltung', board: 'uno', desc: 'Drei LEDs mit Vorwiderstand schalten wie eine Verkehrsampel.', circuit: k.done(),
      blocks: prog([], [dw(12, 'HIGH'), wait(3), dw(11, 'HIGH'), wait(1), dw(12, 'LOW'), dw(11, 'LOW'), dw(10, 'HIGH'), wait(3), dw(10, 'LOW'), dw(11, 'HIGH'), wait(1), dw(11, 'LOW')]) }); }

  /* 3 Taster: über die Mittelrinne gesteckt, 5 V oben, D2 und 10 kΩ nach GND unten */
  { const k = base('uno');
    k.add('button', 8, 'e');
    k.wire(k.H(8, 'a'), k.rail('tp', 8), 'rot');
    k.add('resistor', 10, 'h', { ohm: 10000 });
    k.down(14, 'bm');
    k.up('D2', 10, k.bb.y + 230);
    const cond = `<block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="ard_digital_read"><field name="PIN">2</field></block></value><value name="B">${N(1)}</value></block>`;
    ex.push({ id: 'taster', title: 'Taster schaltet LED', board: 'uno', desc: 'Solange der Taster gedrückt ist, leuchtet die eingebaute LED. Der 10-kΩ-Widerstand zieht den Eingang sonst auf 0.', circuit: k.done(),
      blocks: prog([], [`<block type="controls_if"><mutation else="1"></mutation><value name="IF0">${cond}</value><statement name="DO0">${led('HIGH')}</statement><statement name="ELSE">${led('LOW')}</statement></block>`]) }); }

  /* 4 Dimmer: Poti an A0, LED an D9 */
  { const k = base('uno');
    poti(k, 3);
    ledR(k, 14, 'rot');
    k.up('D9', 14, k.bb.y + 230);
    ex.push({ id: 'dimmer', title: 'Dimmer mit Potentiometer', board: 'uno', desc: 'Das Potentiometer stellt über PWM die Helligkeit einer LED ein.', circuit: k.done(),
      blocks: prog([], [`<block type="ard_analog_write"><field name="PIN">9</field><value name="V">${mapA0(255)}</value></block>`]) }); }

  /* 5 Thermometer mit LCD */
  { const k = base('uno', true);
    const lcd = App.circuit.project.components.find(c => c.type === 'lcd');
    const sda = k.pos({ c: lcd.id, p: 'SDA' }), scl = k.pos({ c: lcd.id, p: 'SCL' }), mSda = k.pos(k.M('SDA')), mScl = k.pos(k.M('SCL'));
    // links an der Steckplatine vorbei nach unten zum Arduino
    k.wire({ c: lcd.id, p: 'SDA' }, k.M('SDA'), 'gruen', [[k.bb.x - 60, sda[1]], [k.bb.x - 60, k.bb.y + 245], [mSda[0], k.bb.y + 245]]);
    k.wire({ c: lcd.id, p: 'SCL' }, k.M('SCL'), 'gelb', [[k.bb.x - 50, scl[1]], [k.bb.x - 50, k.bb.y + 235], [mScl[0], k.bb.y + 235]]);
    k.add('tmp36', 20, 'h');
    k.down(20, 'bp'); k.down(22, 'bm'); k.toA0(21);
    const temp = `<block type="ard_round"><field name="OP">ROUND</field><value name="V"><block type="ard_tmp36"><field name="PIN">A0</field><field name="UNIT">C</field></block></value></block>`;
    ex.push({ id: 'thermometer', title: 'Thermometer mit LCD', board: 'uno', desc: 'Der Temperatursensor TMP36 misst, das LCD zeigt die Temperatur an.', circuit: k.done(),
      blocks: prog([`<block type="ard_lcd_init"></block>`, `<block type="ard_lcd_backlight"><field name="ON">1</field></block>`],
        [`<block type="ard_lcd_clear"></block>`, `<block type="ard_lcd_print"><value name="V"><block type="ard_join"><value name="A">${T('Temp: ')}</value><value name="B">${temp}</value></block></value></block>`,
          `<block type="ard_lcd_print"><value name="V">${T(' °C')}</value></block>`, wait(1)]) }); }

  /* 6 Servo mit Poti */
  { const k = base('uno');
    poti(k, 3);
    const sv = k.addAt('servo', k.bb.x + 380, k.bb.y + 90);
    const g = k.pos({ c: sv.id, p: 'GND' }), v = k.pos({ c: sv.id, p: 'VCC' }), s = k.pos({ c: sv.id, p: 'SIG' }), d3 = k.pos(k.M('D3'));
    const hg = k.hole(26, 'j'), hv = k.hole(27, 'j');
    k.wire({ c: sv.id, p: 'GND' }, k.rail('bm', 26), 'schwarz', [[g[0], k.bb.y + 215], [hg.x, k.bb.y + 215]]);
    k.wire({ c: sv.id, p: 'VCC' }, k.rail('bp', 27), 'rot', [[v[0], k.bb.y + 222], [hv.x, k.bb.y + 222]]);
    k.wire({ c: sv.id, p: 'SIG' }, k.M('D3'), 'gruen', [[s[0], k.bb.y + 245], [d3[0], k.bb.y + 245]]);
    ex.push({ id: 'servo', title: 'Servo mit Potentiometer', board: 'uno', desc: 'Der Servo folgt der Stellung des Potentiometers (0 bis 180 Grad).', circuit: k.done(),
      blocks: prog([], [`<block type="ard_servo"><field name="PIN">3</field><value name="DEG">${mapA0(180)}</value></block>`, `<block type="ard_wait"><field name="UNIT">MS</field><value name="N">${N(50)}</value></block>`]) }); }

  /* 7 Motor mit Motortreiber L9110S */
  { const k = base('uno');
    poti(k, 3);
    const d = k.add('mdriver', 14, 'h');
    k.down(16, 'bm'); k.down(17, 'bp');
    k.up('D6', 18, k.bb.y + 240); k.up('D5', 19, k.bb.y + 230);
    const m = k.addAt('gearmotor', k.bb.x - 90, k.bb.y - 40);
    const ma1 = k.pos({ c: d.id, p: 'MA1' }), ma2 = k.pos({ c: d.id, p: 'MA2' }), mp = k.pos({ c: m.id, p: 'P' }), mn = k.pos({ c: m.id, p: 'N' });
    // über der Steckplatine entlang, dann links neben dem Treiber hinunter zu den Klemmen
    k.wire({ c: m.id, p: 'N' }, { c: d.id, p: 'MA1' }, 'schwarz', [[mn[0], k.bb.y - 15], [ma1[0] - 16, k.bb.y - 15], [ma1[0] - 16, ma1[1]]]);
    k.wire({ c: m.id, p: 'P' }, { c: d.id, p: 'MA2' }, 'rot', [[mp[0], k.bb.y - 5], [ma2[0] - 26, k.bb.y - 5], [ma2[0] - 26, ma2[1]]]);
    ex.push({ id: 'motor', title: 'Motor mit Motortreiber', board: 'uno', desc: 'Ein Getriebemotor am Motortreiber L9110S (A-IA an D6, A-IB an D5). Das Potentiometer stellt die Geschwindigkeit ein.', circuit: k.done(),
      blocks: prog([], [`<block type="ard_motor"><field name="IA">6</field><field name="IB">5</field><field name="DIR">1</field><value name="SPEED">${mapA0(100)}</value></block>`]) }); }

  /* 8 Webseite schaltet LED (ESP32, LED an D4) */
  { const k = base('esp32');
    ledR(k, 5, 'gruen');
    k.up('D4', 5, k.bb.y + 212);
    const btn = n => `<block type="com_web_button"><field name="N">${n}</field></block>`;
    ex.push({ id: 'webseite', title: 'Webseite schaltet LED', board: 'esp32', ext: ['comm'], desc: 'Der ESP32 öffnet ein eigenes WLAN mit einer Webseite. Mit dem Handy verbinden, 192.168.4.1 aufrufen und die LED schalten.', circuit: k.done(),
      blocks: prog([`<block type="com_wifi_ap"><value name="SSID">${T('ESP-Werkstatt')}</value><value name="PW">${T('werkstatt')}</value></block>`, `<block type="com_web_start"><value name="T">${T('Meine LED')}</value></block>`],
        [`<block type="controls_if"><value name="IF0">${btn('LED an')}</value><statement name="DO0">${dw(4, 'HIGH')}</statement></block>`,
          `<block type="controls_if"><value name="IF0">${btn('LED aus')}</value><statement name="DO0">${dw(4, 'LOW')}</statement></block>`,
          `<block type="com_web_show"><field name="N">LED</field><value name="V"><block type="ard_digital_read"><field name="PIN">4</field></block></value></block>`]) }); }

  /* 9 Funk-Klingel (ESP32, Taster an D19) */
  { const k = base('esp32');
    k.add('button', 8, 'e');
    k.wire(k.H(8, 'a'), k.rail('tp', 8), 'rot');
    k.add('resistor', 10, 'h', { ohm: 10000 });
    k.down(14, 'bm');
    k.up('D19', 10, k.bb.y + 212);
    const pressed = `<block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="ard_digital_read"><field name="PIN">19</field></block></value><value name="B">${N(1)}</value></block>`;
    ex.push({ id: 'funk', title: 'Funk-Klingel', board: 'esp32', ext: ['comm'], desc: 'Zwei ESP32 derselben Gruppe: Drückt man den Taster, leuchtet beim anderen die blaue LED und der serielle Monitor zeigt die Nachricht.', circuit: k.done(),
      blocks: prog([`<block type="com_radio_init"><field name="G">1</field></block>`],
        [`<block type="controls_if"><value name="IF0">${pressed}</value><statement name="DO0">${chain([`<block type="com_radio_send"><value name="V">${T('Ding-Dong!')}</value></block>`, wait(0.5)])}</statement></block>`,
          `<block type="controls_if"><value name="IF0"><block type="com_radio_avail"></block></value><statement name="DO0">${chain([`<block type="ard_serial"><field name="NL">Y</field><value name="V"><block type="com_radio_text"></block></value></block>`, led('HIGH'), wait(1), led('LOW')])}</statement></block>`]) }); }

  BOARD = 'uno';
  return ex;
})();
