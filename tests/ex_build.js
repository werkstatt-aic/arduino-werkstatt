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
    k.wire({ c: sv.id, p: 'SIG' }, k.M('D3'), 'orange', [[s[0], k.bb.y + 245], [d3[0], k.bb.y + 245]]);
    ex.push({ id: 'servo', title: 'Servo mit Potentiometer', board: 'uno', desc: 'Der Servo folgt der Stellung des Potentiometers (0 bis 180 Grad).', circuit: k.done(),
      blocks: prog([], [`<block type="ard_servo"><field name="PIN">3</field><value name="DEG">${mapA0(180)}</value></block>`, `<block type="ard_wait"><field name="UNIT">MS</field><value name="N">${N(50)}</value></block>`]) }); }

  /* 7 Motor mit Motortreiber L298N (IN1 an D6, IN2 an D5), Motorspannung aus einer Batterie */
  { const k = base('uno');
    poti(k, 3);
    const bb = k.bb, dx = bb.x + 470, dy = bb.y - 20;
    const d = k.addAt('l298n', dx, dy, { ena: '1', enb: '1' });
    const m = k.addAt('gearmotor', dx - 100, dy - 140);
    const D = p => ({ c: d.id, p });
    k.wire({ c: m.id, p: 'P' }, D('OUT1'), 'rot', [[dx - 100, dy - 81]]);
    k.wire({ c: m.id, p: 'N' }, D('OUT2'), 'schwarz', [[dx - 90, dy - 67]]);
    [['GND_T', 'GND', -30], ['D6', 'IN1', 10], ['D5', 'IN2', 20]].forEach(([mp, dp, ox], i) => {
      const a = k.pos(k.M(mp)), yc = bb.y + 222 + 8 * i, xv = dx + 60 + 8 * i, yb = dy + 34 - 7 * i;
      k.wire(k.M(mp), D(dp), i ? 'blau' : 'schwarz', [[a[0], yc], [xv, yc], [xv, yb], [dx + ox, yb]]);
    });
    const sx = dx - 120, sy = dy + 110, bat = k.addAt('source', sx, sy, { volt: 9, ri: 1 });
    k.wire({ c: bat.id, p: 'P' }, D('VS'), 'rot', [[sx, sy + 12], [sx - 20, sy + 12], [sx - 20, dy + 20], [dx - 40, dy + 20]]);
    k.wire({ c: bat.id, p: 'N' }, D('GND'), 'schwarz', [[sx + 20, sy + 24], [dx - 30, sy + 24]]);
    ex.push({ id: 'motor', title: 'Motor mit Motortreiber', board: 'uno', ext: ['motoren'], desc: 'Ein Getriebemotor am Motortreiber L298N (IN1 an D6, IN2 an D5, Jumper auf ENA gesteckt), Motorspannung aus einer 9-V-Batterie. Das Potentiometer stellt die Geschwindigkeit ein.', circuit: k.done(),
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

  /* 10 Bluetooth: Handy schaltet LED (ESP32, LED an D4) */
  { const k = base('esp32');
    ledR(k, 5, 'rot');
    k.up('D4', 5, k.bb.y + 212);
    const is = w => `<block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="com_bt_text"></block></value><value name="B">${T(w)}</value></block>`;
    const send = t => `<block type="com_bt_send"><value name="V">${T(t)}</value></block>`;
    ex.push({ id: 'bluetooth', title: 'Handy schaltet LED (Bluetooth)', board: 'esp32', ext: ['comm'], desc: 'Mit einer Bluetooth-App (z. B. „Serial Bluetooth Terminal“) „an“ oder „aus“ senden – der ESP32 schaltet die LED und antwortet.', circuit: k.done(),
      blocks: prog([`<block type="com_bt_init"><value name="N">${T('ESP-Werkstatt')}</value></block>`],
        [`<block type="controls_if"><value name="IF0"><block type="com_bt_avail"></block></value><statement name="DO0">${chain([
          `<block type="controls_if"><value name="IF0">${is('an')}</value><statement name="DO0">${chain([dw(4, 'HIGH'), send('LED ist an')])}</statement></block>`,
          `<block type="controls_if"><value name="IF0">${is('aus')}</value><statement name="DO0">${chain([dw(4, 'LOW'), send('LED ist aus')])}</statement></block>`])}</statement></block>`]) }); }

  /* 11 Fahrzeug: zwei Getriebemotoren am L298N, eigene Batterie für die Motoren */
  { const k = base('uno');
    const bb = k.bb, dx = bb.x + 520, dy = bb.y - 20;
    const d = k.addAt('l298n', dx, dy, { ena: '1', enb: '1' });
    // wie im Fahrzeug von oben: links der Motor mit Rad links, rechts derselbe Motor um 180° gedreht (Rad rechts)
    const mL = k.addAt('wheelL', dx - 128, dy - 150), mR = k.addAt('wheelR', dx + 128, dy - 150);
    const D = p => ({ c: d.id, p });
    // Anschlüsse der Motoren zeigen nach vorne (oben); beide gleich gepolt: Plus an OUT1 bzw. OUT3
    k.wire({ c: mL.id, p: 'P' }, D('OUT1'), 'rot', [[dx - 128, dy - 170], [dx - 74, dy - 170], [dx - 74, dy - 81]]);
    k.wire({ c: mL.id, p: 'N' }, D('OUT2'), 'schwarz', [[dx - 118, dy - 162], [dx - 80, dy - 162], [dx - 80, dy - 67]]);
    k.wire({ c: mR.id, p: 'P' }, D('OUT3'), 'rot', [[dx + 138, dy - 170], [dx + 94, dy - 170], [dx + 94, dy - 81]]);
    k.wire({ c: mR.id, p: 'N' }, D('OUT4'), 'schwarz', [[dx + 128, dy - 162], [dx + 100, dy - 162], [dx + 100, dy - 67]]);
    // Steuerleitungen: hoch in den Kanal, rechts an der Steckplatine vorbei, von unten an die Stiftleiste
    [['GND_T', 'GND', -30], ['D11', 'IN1', 10], ['D6', 'IN2', 20], ['D5', 'IN3', 30], ['D3', 'IN4', 40]].forEach(([mp, dp, ox], i) => {
      const a = k.pos(k.M(mp)), yc = bb.y + 212 + 8 * i, xv = dx + 60 + 8 * i, yb = dy + 48 - 7 * i;
      k.wire(k.M(mp), D(dp), i ? 'blau' : 'schwarz', [[a[0], yc], [xv, yc], [xv, yb], [dx + ox, yb]]);
    });
    // Batterie 9 V für die Motoren (Plus an 12V, Minus an GND)
    const sx = dx - 120, sy = dy + 110, bat = k.addAt('source', sx, sy, { volt: 9, ri: 1 });
    k.wire({ c: bat.id, p: 'P' }, D('VS'), 'rot', [[sx, sy + 12], [sx - 20, sy + 12], [sx - 20, dy + 30], [dx - 40, dy + 30]]);
    k.wire({ c: bat.id, p: 'N' }, D('GND'), 'schwarz', [[sx + 20, sy + 24], [dx - 30, sy + 24]]);
    const drive = (dir, s) => `<block type="car_drive"><field name="DIR">${dir}</field><value name="SPEED">${N(s)}</value></block>`;
    ex.push({ id: 'fahrzeug', title: 'Fahrzeug fährt ein Quadrat', board: 'uno', ext: ['motoren'], desc: 'Zwei Getriebemotoren mit Rad am Motortreiber L298N (IN1 D11, IN2 D6, IN3 D5, IN4 D3) mit eigener Batterie. Das Fahrzeug fährt 2 s geradeaus und dreht sich dann nach rechts. Wie im echten Fahrzeug ist der rechte Motor um 180° gedreht eingebaut; beide sind gleich gepolt angeschlossen, die Fahrzeug-Blöcke drehen den rechten Motor selbst um.', circuit: k.done(),
      blocks: prog([`<block type="car_init"><field name="LA">11</field><field name="LB">6</field><field name="RA">5</field><field name="RB">3</field></block>`],
        [drive('FWD', 80), wait(2), drive('TR', 80), wait(0.6)]) }); }

  BOARD = 'uno';
  return ex;
})();
