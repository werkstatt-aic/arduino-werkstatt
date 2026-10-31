// Baut die Beispielprojekte in der laufenden Werkstatt auf (wird von ex_build.py ausgeführt).
(() => {
  const ROWY = { a: 40, b: 50, c: 60, d: 70, e: 80, f: 110, g: 120, h: 130, i: 140, j: 150 };
  const T = s => `<shadow type="text"><field name="TEXT">${s}</field></shadow>`;
  const N = s => `<shadow type="math_number"><field name="NUM">${s}</field></shadow>`;
  const chain = list => {
    // verkettet Anweisungsblöcke: jedes Element ist '<block ...>…</block>' ohne <next>
    let out = '';
    for (let i = list.length - 1; i >= 0; i--) out = out ? list[i].replace(/<\/block>$/, `<next>${out}</next></block>`) : list[i];
    return out;
  };
  const prog = (setup, loop, extra) => `<xml xmlns="https://developers.google.com/blockly/xml">${extra || ''}<block type="ard_setup" x="30" y="30"><statement name="DO">${chain(setup)}</statement></block><block type="ard_loop" x="30" y="${120 + setup.length * 50}"><statement name="DO">${chain(loop)}</statement></block></xml>`;
  const dw = (p, v) => `<block type="ard_digital_write"><field name="PIN">${p}</field><field name="V">${v}</field></block>`;
  const wait = s => `<block type="ard_wait"><field name="UNIT">S</field><value name="N">${N(s)}</value></block>`;
  const led = v => `<block type="ard_builtin_led"><field name="V">${v}</field></block>`;

  function base(board, withLcd) {
    BOARD = board;
    App.circuit.load({ components: [], wires: [] });
    App.circuit.addTemplate(365, withLcd ? 380 : 430, withLcd);
    const C = App.circuit, P = C.project;
    const bb = P.components.find(c => c.type === 'breadboard'), mcu = P.components.find(c => c.def.mcu);
    const api = {
      bb, mcu,
      hole: (c, r) => ({ x: bb.x + 20 + (c - 1) * 10, y: bb.y + ROWY[r] }),
      add(type, c, r, props, rot) { const h = api.hole(c, r); const k = makeComp(type, h.x, h.y, rot || 0, props, C.newId('c')); P.components.push(k); return k; },
      addAt(type, x, y, props) { const k = makeComp(type, x, y, 0, props, C.newId('c')); P.components.push(k); return k; },
      wire(a, b, color, pts) { P.wires.push({ id: C.newId('w'), a, b, color: color || 'gruen', pts: pts || [] }); },
      H: (c, r) => ({ c: bb.id, p: `${c}${r}` }),
      M: p => ({ c: mcu.id, p }),
      done() { C.renderAll(); return C.toJSON(); },
    };
    return api;
  }
  // LED mit Vorwiderstand: Anode in Spalte c, Kathode in c+1, Widerstand senkrecht über die Mitte, unten zur Minusleiste
  function ledR(k, c, color, sig, ohm) {
    k.add('led', c, 'c', { color });
    k.add('resistor', c + 1, 'e', { ohm: ohm || 220 }, 90);
    k.wire(k.H(c + 1, 'j'), { c: k.bb.id, p: `bm-${c + 1}` }, 'schwarz');
    k.wire(sig, k.H(c, 'a'), 'gruen');
  }
  const ex = [];

  /* 1 Blinken */
  { const k = base('uno'); ex.push({ id: 'blinken', title: 'Blinken', board: 'uno', desc: 'Die eingebaute LED „L“ blinkt im Sekundentakt.', circuit: k.done(),
    blocks: prog([], [led('HIGH'), wait(1), led('LOW'), wait(1)]) }); }

  /* 2 Ampel */
  { const k = base('uno');
    ledR(k, 4, 'rot', k.M('D12')); ledR(k, 10, 'gelb', k.M('D11')); ledR(k, 16, 'gruen', k.M('D10'));
    ex.push({ id: 'ampel', title: 'Ampelschaltung', board: 'uno', desc: 'Drei LEDs mit Vorwiderstand schalten wie eine Verkehrsampel.', circuit: k.done(),
      blocks: prog([], [dw(12, 'HIGH'), wait(3), dw(11, 'HIGH'), wait(1), dw(12, 'LOW'), dw(11, 'LOW'), dw(10, 'HIGH'), wait(3), dw(10, 'LOW'), dw(11, 'HIGH'), wait(1), dw(11, 'LOW')]) }); }

  /* 3 Taster */
  { const k = base('uno');
    k.add('button', 8, 'e');
    k.wire({ c: k.bb.id, p: 'tp-8' }, k.H(8, 'a'), 'rot');
    k.wire(k.M('D2'), k.H(10, 'a'), 'gruen');
    k.add('resistor', 10, 'h', { ohm: 10000 });
    k.wire(k.H(14, 'j'), { c: k.bb.id, p: 'bm-14' }, 'schwarz');
    const cond = `<block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="ard_digital_read"><field name="PIN">2</field></block></value><value name="B">${N(1)}</value></block>`;
    ex.push({ id: 'taster', title: 'Taster schaltet LED', board: 'uno', desc: 'Solange der Taster gedrückt ist, leuchtet die eingebaute LED. Der 10-kΩ-Widerstand zieht den Eingang sonst auf 0.', circuit: k.done(),
      blocks: prog([], [`<block type="controls_if"><mutation else="1"></mutation><value name="IF0">${cond}</value><statement name="DO0">${led('HIGH')}</statement><statement name="ELSE">${led('LOW')}</statement></block>`]) }); }

  /* 4 Dimmer */
  { const k = base('uno');
    k.add('poti', 4, 'c');
    k.wire({ c: k.bb.id, p: 'tp-4' }, k.H(4, 'a'), 'rot'); k.wire({ c: k.bb.id, p: 'tm-7' }, k.H(6, 'a'), 'schwarz', [[k.hole(6, 'a').x, k.bb.y + 25], [k.hole(7, 'a').x, k.bb.y + 25]]);
    k.wire(k.M('A0'), k.H(5, 'b'), 'gelb');
    ledR(k, 14, 'rot', k.M('D9'));
    const map = `<block type="ard_map"><value name="V"><block type="ard_analog_read"><field name="PIN">A0</field></block></value><value name="A">${N(0)}</value><value name="B">${N(1023)}</value><value name="C">${N(0)}</value><value name="D">${N(255)}</value></block>`;
    ex.push({ id: 'dimmer', title: 'Dimmer mit Potentiometer', board: 'uno', desc: 'Das Potentiometer stellt über PWM die Helligkeit einer LED ein.', circuit: k.done(),
      blocks: prog([], [`<block type="ard_analog_write"><field name="PIN">9</field><value name="V">${map}</value></block>`]) }); }

  /* 5 Thermometer mit LCD */
  { const k = base('uno', true);
    const lcd = k.done() && App.circuit.project.components.find(c => c.type === 'lcd');
    k.wire({ c: lcd.id, p: 'SDA' }, k.M('SDA'), 'blau'); k.wire({ c: lcd.id, p: 'SCL' }, k.M('SCL'), 'gelb');
    k.add('tmp36', 20, 'c');
    k.wire({ c: k.bb.id, p: 'tp-20' }, k.H(20, 'a'), 'rot'); k.wire({ c: k.bb.id, p: 'tm-22' }, k.H(22, 'a'), 'schwarz');
    k.wire(k.M('A0'), k.H(21, 'b'), 'gelb');
    const temp = `<block type="ard_round"><field name="OP">ROUND</field><value name="V"><block type="ard_tmp36"><field name="PIN">A0</field><field name="UNIT">C</field></block></value></block>`;
    ex.push({ id: 'thermometer', title: 'Thermometer mit LCD', board: 'uno', desc: 'Der Temperatursensor TMP36 misst, das LCD zeigt die Temperatur an.', circuit: k.done(),
      blocks: prog([`<block type="ard_lcd_init"></block>`, `<block type="ard_lcd_backlight"><field name="ON">1</field></block>`],
        [`<block type="ard_lcd_clear"></block>`, `<block type="ard_lcd_print"><value name="V"><block type="ard_join"><value name="A">${T('Temp: ')}</value><value name="B">${temp}</value></block></value></block>`,
          `<block type="ard_lcd_print"><value name="V">${T(' °C')}</value></block>`, wait(1)]) }); }

  /* 6 Servo mit Poti */
  { const k = base('uno');
    k.add('poti', 4, 'c');
    k.wire({ c: k.bb.id, p: 'tp-4' }, k.H(4, 'a'), 'rot'); k.wire({ c: k.bb.id, p: 'tm-7' }, k.H(6, 'a'), 'schwarz', [[k.hole(6, 'a').x, k.bb.y + 25], [k.hole(7, 'a').x, k.bb.y + 25]]);
    k.wire(k.M('A0'), k.H(5, 'b'), 'gelb');
    const sv = k.addAt('servo', k.bb.x + 380, k.bb.y + 90);
    k.wire({ c: sv.id, p: 'GND' }, { c: k.bb.id, p: 'tm-26' }, 'schwarz'); k.wire({ c: sv.id, p: 'VCC' }, { c: k.bb.id, p: 'tp-27' }, 'rot'); k.wire({ c: sv.id, p: 'SIG' }, k.M('D3'), 'gelb');
    const map = `<block type="ard_map"><value name="V"><block type="ard_analog_read"><field name="PIN">A0</field></block></value><value name="A">${N(0)}</value><value name="B">${N(1023)}</value><value name="C">${N(0)}</value><value name="D">${N(180)}</value></block>`;
    ex.push({ id: 'servo', title: 'Servo mit Potentiometer', board: 'uno', desc: 'Der Servo folgt der Stellung des Potentiometers (0 bis 180 Grad).', circuit: k.done(),
      blocks: prog([], [`<block type="ard_servo"><field name="PIN">3</field><value name="DEG">${map}</value></block>`, `<block type="ard_wait"><field name="UNIT">MS</field><value name="N">${N(50)}</value></block>`]) }); }

  /* 7 Motor mit Motortreiber */
  { const k = base('uno');
    k.add('poti', 3, 'c');
    k.wire({ c: k.bb.id, p: 'tp-3' }, k.H(3, 'a'), 'rot'); k.wire({ c: k.bb.id, p: 'tm-5' }, k.H(5, 'a'), 'schwarz');
    k.wire(k.M('A0'), k.H(4, 'b'), 'gelb');
    const d = k.add('mdriver', 14, 'h');
    k.wire({ c: k.bb.id, p: 'bm-16' }, k.H(16, 'j'), 'schwarz'); k.wire({ c: k.bb.id, p: 'bp-17' }, k.H(17, 'j'), 'rot');
    k.wire(k.M('D5'), k.H(18, 'j'), 'gelb', [[k.hole(18, 'j').x, k.bb.y + 170]]); k.wire(k.M('D6'), k.H(19, 'j'), 'blau', [[k.hole(19, 'j').x, k.bb.y + 166]]);
    const m = k.addAt('gearmotor', k.bb.x - 90, k.bb.y + 20);
    k.wire({ c: m.id, p: 'P' }, { c: d.id, p: 'MA1' }, 'rot'); k.wire({ c: m.id, p: 'N' }, { c: d.id, p: 'MA2' }, 'schwarz');
    const map = `<block type="ard_map"><value name="V"><block type="ard_analog_read"><field name="PIN">A0</field></block></value><value name="A">${N(0)}</value><value name="B">${N(1023)}</value><value name="C">${N(0)}</value><value name="D">${N(100)}</value></block>`;
    ex.push({ id: 'motor', title: 'Motor mit Motortreiber', board: 'uno', desc: 'Ein Getriebemotor am Motortreiber L9110S. Das Potentiometer stellt die Geschwindigkeit ein.', circuit: k.done(),
      blocks: prog([], [`<block type="ard_motor"><field name="IA">5</field><field name="IB">6</field><field name="DIR">1</field><value name="SPEED">${map}</value></block>`]) }); }

  /* 8 Webseite schaltet LED (ESP32) */
  { const k = base('esp32');
    ledR(k, 6, 'gruen', k.M('D4'));
    const btn = n => `<block type="com_web_button"><field name="N">${n}</field></block>`;
    ex.push({ id: 'webseite', title: 'Webseite schaltet LED', board: 'esp32', ext: ['comm'], desc: 'Der ESP32 öffnet ein eigenes WLAN mit einer Webseite. Mit dem Handy verbinden, 192.168.4.1 aufrufen und die LED schalten.', circuit: k.done(),
      blocks: prog([`<block type="com_wifi_ap"><value name="SSID">${T('ESP-Werkstatt')}</value><value name="PW">${T('werkstatt')}</value></block>`, `<block type="com_web_start"><value name="T">${T('Meine LED')}</value></block>`],
        [`<block type="controls_if"><value name="IF0">${btn('LED an')}</value><statement name="DO0">${dw(4, 'HIGH')}</statement></block>`,
          `<block type="controls_if"><value name="IF0">${btn('LED aus')}</value><statement name="DO0">${dw(4, 'LOW')}</statement></block>`,
          `<block type="com_web_show"><field name="N">LED</field><value name="V"><block type="ard_digital_read"><field name="PIN">4</field></block></value></block>`]) }); }

  /* 9 Funk-Klingel (ESP32) */
  { const k = base('esp32');
    k.add('button', 8, 'e');
    k.wire({ c: k.bb.id, p: 'tp-8' }, k.H(8, 'a'), 'rot');
    k.wire(k.M('D13'), k.H(10, 'a'), 'gruen');
    k.add('resistor', 10, 'h', { ohm: 10000 });
    k.wire(k.H(14, 'j'), { c: k.bb.id, p: 'bm-14' }, 'schwarz');
    const pressed = `<block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="ard_digital_read"><field name="PIN">13</field></block></value><value name="B">${N(1)}</value></block>`;
    ex.push({ id: 'funk', title: 'Funk-Klingel', board: 'esp32', ext: ['comm'], desc: 'Zwei ESP32 derselben Gruppe: Drückt man den Taster, leuchtet beim anderen die blaue LED und der serielle Monitor zeigt die Nachricht.', circuit: k.done(),
      blocks: prog([`<block type="com_radio_init"><field name="G">1</field></block>`],
        [`<block type="controls_if"><value name="IF0">${pressed}</value><statement name="DO0">${chain([`<block type="com_radio_send"><value name="V">${T('Ding-Dong!')}</value></block>`, wait(0.5)])}</statement></block>`,
          `<block type="controls_if"><value name="IF0"><block type="com_radio_avail"></block></value><statement name="DO0">${chain([`<block type="ard_serial"><field name="NL">Y</field><value name="V"><block type="com_radio_text"></block></value></block>`, led('HIGH'), wait(1), led('LOW')])}</statement></block>`]) }); }

  BOARD = 'uno';
  return ex;
})();
