/* Blöcke und Werkzeugkasten (Code-Erzeugung: code_sim.js und code_cpp.js) */
'use strict';

const COL = {
  ctrl: '#ffab19', loop: '#e08e0b', logic: '#4aa7c2', math: '#59c059', vars: '#ff8c1a', func: '#d65cd6',
  out: '#4c97ff', inp: '#9966ff', show: '#0fa39a', neo: '#7a5cd6', kp: '#cf4f8f', mm: '#3a9a5b', mmi: '#6cc48a', mmc: '#c8742a', com: '#1e88a8', comu: '#6b7c8c', comw: '#3b6fb6', comf: '#c0563f', comb: '#2d5fa8', oled: '#3a64b0', list: '#e8603c', mot: '#5b7fa6',
};
/* Gewählter Mikrocontroller: 'uno' oder 'esp32' */
let BOARD = 'uno';
/* Bluetooth-Übertragung (nur ESP32): wird pro Projekt eingestellt */
let BT_OPT = { on: false, name: 'ESP-Werkstatt' };
const BT_UUID = { svc: '8e4f0001-6a1b-4c5e-9d2a-7765726b7374', ctrl: '8e4f0002-6a1b-4c5e-9d2a-7765726b7374', data: '8e4f0003-6a1b-4c5e-9d2a-7765726b7374' };
const btName = n => (String(n || '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)) || 'ESP-Werkstatt';


/* Anschlüsse */
const UNO_DIGITAL = Array.from({ length: 12 }, (_, i) => [`D${i + 2}`, String(i + 2)]); // ohne D0/D1 (USB-Verbindung)
const UNO_ANALOG = ['A0', 'A1', 'A2', 'A3'].map(p => [p, p]); // ohne A4/A5 (I²C)
/* ESP32: nur unkritische Pins. Weggelassen: Boot-Pins (0, 2, 5, 12, 15), TX0/RX0 (1, 3), Flash-Pins (6–11)
   und D21/D22 (I²C: SDA/SCL). 34, 35, 36 (VP), 39 (VN) gibt es nur als Eingang. Analog nur ADC1 (funktioniert auch mit WLAN). */
const ESP_SAFE = [4, 13, 14, 16, 17, 18, 19, 23, 25, 26, 27, 32, 33];
const espLab = n => 'D' + n + (n === 36 ? ' (VP)' : n === 39 ? ' (VN)' : '');
const PIN = {
  out: () => BOARD === 'esp32' ? ESP_SAFE.map(n => [espLab(n), String(n)]) : UNO_DIGITAL,
  inp: () => BOARD === 'esp32' ? ESP_SAFE.concat([34, 35, 36, 39]).sort((a, b) => a - b).map(n => [espLab(n), String(n)]) : UNO_DIGITAL,
  pwm: () => PIN.out(), // bewusst alle Anschlüsse: die Schüler sollen selbst einen PWM-Anschluss (~) wählen
  ana: () => BOARD === 'esp32' ? [32, 33, 34, 35, 36, 39].map(n => [espLab(n), 'D' + n]) : UNO_ANALOG,
};
/* Startwerte im Werkzeugkasten je nach Mikrocontroller */
const DEF = () => BOARD === 'esp32'
  ? { dw: '4', dr: '4', pwm: '4', servo: '13', tone: '4', ana: 'D32', trig: '18', echo: '19', neo: '4', mA: '25', mB: '26', car: ['25', '26', '27', '14'], dht: '4', st: ['25', '26', '27', '14'], max: 4095, kpR: ['13', '14', '27', '26'], kpC: ['25', '33', '32', '23'] }
  : { dw: '2', dr: '2', pwm: '3', servo: '3', tone: '8', ana: 'A0', trig: '7', echo: '8', neo: '6', mA: '5', mB: '6', car: ['5', '6', '3', '11'], dht: '2', st: ['8', '9', '10', '11'], max: 1023, kpR: ['9', '8', '7', '6'], kpC: ['5', '4', '3', '2'] };
const HIGHLOW = [['HOCH', 'HIGH'], ['NIEDRIG', 'LOW']];
const NOTES = [['C', '0'], ['D', '2'], ['E', '4'], ['F', '5'], ['G', '7'], ['A', '9'], ['H', '11']];
const ACCS = [['–', '0'], ['#', '1'], ['b', '-1']];
const OCTS = ['2', '3', '4', '5', '6', '7'].map(o => [o, o]);
const ADS_ADDR = [['0x48 (ADDR an GND)', '0x48'], ['0x49 (ADDR an VDD)', '0x49'], ['0x4A (ADDR an SDA)', '0x4A'], ['0x4B (ADDR an SCL)', '0x4B']];
const INA_ADDR = [['0x40 (Standard)', '0x40'], ['0x41', '0x41'], ['0x44', '0x44'], ['0x45', '0x45']];
const ADS_RANGE = { 6: 6.144, 4: 4.096, 2: 2.048, 1: 1.024 };

/* Zahlenliste aus einem Textfeld („262, 294, 330“ oder „1.5; 2“): Kommazahlen mit Punkt */
function parseListNumbers(text) {
  return String(text || '').split(/[\s,;]+/).filter(x => x !== '').map(Number).filter(x => isFinite(x)).slice(0, 100);
}

function noteFreq(semi, acc, oct) {
  const midi = 12 * (Number(oct) + 1) + Number(semi) + Number(acc);
  return Math.round(440 * Math.pow(2, (midi - 69) / 12));
}

const EXTENSIONS = {
  neopixel: { name: 'NeoPixel', desc: 'Farbige LED-Streifen und -Ringe (WS2812) ansteuern.' },
  keypad: { name: 'Tastenfeld', desc: 'Folientastatur 3 × 4 oder 4 × 4 abfragen.' },
  multimeter: { name: 'Multimeter', desc: 'Spannung (ADS1115) und Strom (INA219) über I²C messen.' },
  oled: { name: 'OLED-Anzeige', desc: 'Grafikdisplay SSD1306, 128 × 64 Pixel, I²C.' },
  motoren: { name: 'Motoren und Relais', desc: 'Motortreiber L9110S und L298N mit Getriebemotor, Fahrzeug mit zwei Motoren, Schrittmotor 28BYJ-48 mit Treiber ULN2003, Relais-Modul.' },
  comm: { name: 'Kommunikation', desc: 'USB (senden und empfangen), WLAN, eigene Webseite, Funk zwischen ESP32 und Bluetooth (Handy-App). Nur mit dem ESP32.', esp: true },
};

function setupBlocklyMessages() {
  Object.assign(Blockly.Msg, {
    LOGIC_HUE: COL.logic, LOOPS_HUE: COL.loop, MATH_HUE: COL.math, TEXTS_HUE: COL.show, VARIABLES_HUE: COL.vars, PROCEDURES_HUE: COL.func,
    CONTROLS_REPEAT_TITLE: '%1 Mal wiederholen',
    CONTROLS_REPEAT_INPUT_DO: '',
    CONTROLS_WHILEUNTIL_OPERATOR_WHILE: 'wiederholen solange',
    CONTROLS_WHILEUNTIL_OPERATOR_UNTIL: 'wiederholen bis',
    CONTROLS_WHILEUNTIL_INPUT_DO: '',
    CONTROLS_IF_MSG_IF: 'wenn',
    CONTROLS_IF_MSG_THEN: 'dann',
    CONTROLS_IF_MSG_ELSE: 'sonst',
    CONTROLS_IF_MSG_ELSEIF: 'sonst wenn',
    VARIABLES_SET: '%1 auf %2 setzen',
    MATH_CHANGE_TITLE: '%1 um %2 ändern',
    LOGIC_OPERATION_AND: 'und',
    LOGIC_OPERATION_OR: 'oder',
    LOGIC_NEGATE_TITLE: 'nicht %1',
    LOGIC_BOOLEAN_TRUE: 'wahr',
    LOGIC_BOOLEAN_FALSE: 'falsch',
    MATH_RANDOM_INT_TITLE: 'Zufallszahl von %1 bis %2',
    MATH_MODULO_TITLE: 'Rest von %1 ÷ %2',
    MATH_CONSTRAIN_TITLE: '%1 begrenzen auf %2 bis %3',
    NEW_VARIABLE: 'Variable erstellen …',
    NEW_VARIABLE_TITLE: 'Name der neuen Variable:',
    VARIABLE_ALREADY_EXISTS: 'Den Namen „%1“ gibt es schon.',
    VARIABLE_ALREADY_EXISTS_FOR_ANOTHER_TYPE: 'Den Namen „%1“ gibt es schon (als Variable oder Liste). Bitte einen anderen wählen.',
    DELETE_BLOCK: 'Block löschen',
    PROCEDURES_DEFNORETURN_TITLE: 'Funktion',
    PROCEDURES_DEFRETURN_TITLE: 'Funktion',
    PROCEDURES_DEFNORETURN_PROCEDURE: 'etwas_tun',
    PROCEDURES_DEFRETURN_PROCEDURE: 'berechne',
    PROCEDURES_DEFRETURN_RETURN: 'gib zurück',
    PROCEDURES_BEFORE_PARAMS: 'mit:',
    PROCEDURES_CALL_BEFORE_PARAMS: 'mit:',
    PROCEDURES_MUTATORCONTAINER_TITLE: 'Eingaben',
    PROCEDURES_MUTATORARG_TITLE: 'Name der Eingabe:',
    PROCEDURES_IFRETURN_TITLE: 'wenn',
    PROCEDURES_DEFNORETURN_COMMENT: 'Beschreibe diese Funktion …',
  });
}

/* Eigene Darstellung: Farbfelder (NeoPixel) als kleines Kästchen statt ganzer Blockfarbe */
function registerRenderer() {
  function Consts() { Blockly.zelos.ConstantProvider.call(this); this.FIELD_COLOUR_FULL_BLOCK = false; this.FIELD_COLOUR_DEFAULT_WIDTH = 26; this.FIELD_COLOUR_DEFAULT_HEIGHT = 20; }
  Blockly.utils.object.inherits(Consts, Blockly.zelos.ConstantProvider);
  function Rend(name) { Blockly.zelos.Renderer.call(this, name); }
  Blockly.utils.object.inherits(Rend, Blockly.zelos.Renderer);
  Rend.prototype.makeConstants_ = function () { return new Consts(); };
  Blockly.blockRendering.register('werkstatt', Rend);
}

/* Hinweis, an welchen Pins SDA und SCL liegen (wird beim Erzeugen des Blocks passend zum Mikrocontroller eingesetzt) */
const i2cText = () => BOARD === 'esp32' ? '(SDA an D21, SCL an D22)' : '(SDA an A4, SCL an A5)';
function defineBlocks() {
  setupBlocklyMessages();
  registerRenderer();
  if (!Blockly.Extensions.isRegistered || !Blockly.Extensions.isRegistered('i2c_hint')) {
    Blockly.Extensions.register('i2c_hint', function () { this.appendDummyInput('I2C').appendField(new Blockly.FieldLabel(i2cText(), 'i2c-hint')); });
  }
  const OCOL = { type: 'field_dropdown', name: 'C', options: [['weiß', '1'], ['schwarz', '0']] };
  const stmt = { previousStatement: null, nextStatement: null };
  const B = (o, colour) => Object.assign({ colour }, o.output !== undefined ? {} : stmt, o);
  Blockly.defineBlocksWithJsonArray([
    /* Steuerung */
    { type: 'ard_setup', message0: 'beim Start', message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], colour: COL.ctrl, tooltip: 'Wird einmal beim Start ausgeführt.' },
    { type: 'ard_loop', message0: 'für immer', message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], colour: COL.ctrl, tooltip: 'Wird immer wieder ausgeführt (Endlosschleife).' },
    B({ type: 'ard_wait_until', message0: 'warten bis %1', args0: [{ type: 'input_value', name: 'C', check: 'Boolean' }], inputsInline: true, tooltip: 'Das Programm wartet hier, bis die Bedingung erfüllt ist, z. B. bis ein Taster gedrückt ist.' }, COL.ctrl),
    { type: 'ard_millis', message0: 'Zeit seit Start in %1', args0: [{ type: 'field_dropdown', name: 'U', options: [['Millisekunden', 'MS'], ['Sekunden', 'S']] }], output: 'Number', colour: COL.ctrl, tooltip: 'Wie lange das Programm schon läuft. Damit kann man Zeiten messen, ohne mit „warten“ alles anzuhalten.' },
    B({ type: 'ard_wait', message0: '%1 %2 warten', args0: [{ type: 'input_value', name: 'N', check: 'Number' }, { type: 'field_dropdown', name: 'UNIT', options: [['Sekunden', 'S'], ['Millisekunden', 'MS']] }], inputsInline: true }, COL.ctrl),
    /* Schleifen */
    B({ type: 'ard_count', message0: 'zähle %1 von %2 bis %3 in Schritten von %4', args0: [
      { type: 'field_variable', name: 'VAR', variable: 'i' }, { type: 'input_value', name: 'FROM', check: 'Number' },
      { type: 'input_value', name: 'TO', check: 'Number' }, { type: 'input_value', name: 'STEP', check: 'Number' }],
    message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], inputsInline: true, tooltip: 'Zählt aufwärts oder abwärts (je nachdem, ob „bis“ größer oder kleiner als „von“ ist).' }, COL.loop),
    /* Ausgang */
    B({ type: 'ard_digital_write', message0: 'Anschluss %1 auf %2 einstellen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.out }, { type: 'field_dropdown', name: 'V', options: HIGHLOW }] }, COL.out),
    B({ type: 'ard_analog_write', message0: 'PWM-Ausgang %1 auf %2 einstellen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.pwm }, { type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, tooltip: 'Wert von 0 (aus) bis 255 (voll an). Beim Arduino Uno können das nur die Anschlüsse mit ~ (D3, D5, D6, D9, D10, D11), die anderen sind nur ganz an oder aus.' }, COL.out),
    B({ type: 'ard_builtin_led', message0: 'integrierte LED auf %1 einstellen', args0: [{ type: 'field_dropdown', name: 'V', options: HIGHLOW }], tooltip: 'Eingebaute Leuchte: „L“ am Arduino Uno (D13), blaue LED am ESP32 (D2).' }, COL.out),
    B({ type: 'ard_servo', message0: 'Servo an PWM-Ausgang %1 auf %2 Grad drehen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.pwm }, { type: 'input_value', name: 'DEG', check: 'Number' }], inputsInline: true }, COL.out),
    B({ type: 'ard_tone', message0: 'Auf Lautsprecher an Anschluss %1 Ton %2 %3 %4 für %5 Sekunden spielen', args0: [
      { type: 'field_dropdown', name: 'PIN', options: PIN.out }, { type: 'field_dropdown', name: 'NOTE', options: NOTES },
      { type: 'field_dropdown', name: 'ACC', options: ACCS }, { type: 'field_dropdown', name: 'OCT', options: OCTS }, { type: 'input_value', name: 'DUR', check: 'Number' }],
    inputsInline: true, tooltip: 'Note, Vorzeichen (# oder b) und Oktave. A 4 = Kammerton 440 Hz. Das Programm läuft währenddessen weiter.' }, COL.out),
    B({ type: 'ard_tone_freq', message0: 'Auf Lautsprecher an Anschluss %1 Ton mit %2 Hz für %3 Sekunden spielen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.out }, { type: 'input_value', name: 'FREQ', check: 'Number' }, { type: 'input_value', name: 'DUR', check: 'Number' }], inputsInline: true }, COL.out),
    B({ type: 'ard_motor', message0: 'Motor am Motortreiber %1 IA an %2 IB an %3 %4 mit %5 %% Geschwindigkeit', args0: [{ type: 'input_dummy' },
      { type: 'field_dropdown', name: 'IA', options: PIN.pwm }, { type: 'field_dropdown', name: 'IB', options: PIN.pwm },
      { type: 'field_dropdown', name: 'DIR', options: [['vorwärts', '1'], ['rückwärts', '-1'], ['anhalten', '0']] }, { type: 'input_value', name: 'SPEED', check: 'Number' }],
    inputsInline: true, tooltip: 'Für Motortreiber wie L9110S (A-IA/A-IB) oder L298N (IN1/IN2 bzw. IN3/IN4, Jumper auf ENA/ENB gesteckt): die beiden Steuereingänge eines Motors. Geschwindigkeit 0 bis 100 %.' }, COL.mot),
    B({ type: 'ard_stepper', message0: 'Schrittmotor IN1 %1 IN2 %2 IN3 %3 IN4 %4 %5 um %6 %7 %8 drehen mit %9 U/min', args0: [
      { type: 'field_dropdown', name: 'P1', options: PIN.out }, { type: 'field_dropdown', name: 'P2', options: PIN.out }, { type: 'field_dropdown', name: 'P3', options: PIN.out }, { type: 'field_dropdown', name: 'P4', options: PIN.out }, { type: 'input_dummy' },
      { type: 'input_value', name: 'N', check: 'Number' }, { type: 'field_dropdown', name: 'UNIT', options: [['Grad', 'DEG'], ['Umdrehungen', 'REV'], ['Schritte', 'STEP']] },
      { type: 'field_dropdown', name: 'DIR', options: [['im Uhrzeigersinn', 'CW'], ['gegen den Uhrzeigersinn', 'CCW']] }, { type: 'input_value', name: 'RPM', check: 'Number' }],
    inputsInline: true, tooltip: 'Für den Schrittmotor 28BYJ-48 mit Treiberplatine ULN2003 (2048 Schritte = 1 Umdrehung). Geschwindigkeit 1 bis 15 Umdrehungen pro Minute. Das Programm wartet, bis der Motor angekommen ist.' }, COL.mot),
    /* Fahrzeug mit zwei Motoren (Erweiterung „Motoren und Relais“) */
    B({ type: 'car_init', message0: 'Fahrzeug einrichten %1 linker Motor: IA %2 IB %3 %4 rechter Motor: IA %5 IB %6', args0: [{ type: 'input_dummy' },
      { type: 'field_dropdown', name: 'LA', options: PIN.pwm }, { type: 'field_dropdown', name: 'LB', options: PIN.pwm }, { type: 'input_dummy' },
      { type: 'field_dropdown', name: 'RA', options: PIN.pwm }, { type: 'field_dropdown', name: 'RB', options: PIN.pwm }],
    tooltip: 'Gehört in „beim Start“. Zwei Motoren am Motortreiber: L9110S (A-IA/A-IB und B-IA/B-IB) oder L298N (IN1/IN2 und IN3/IN4, Jumper auf ENA/ENB gesteckt). Dreht ein Rad falsch herum, die beiden Kabel dieses Motors am Treiber tauschen. Arduino Uno: nur Anschlüsse mit ~ regeln die Geschwindigkeit; mit einem Servo im Programm gehen D9/D10 nicht, mit Tönen gehen D3/D11 nicht.' }, COL.mot),
    B({ type: 'car_drive', message0: 'Fahrzeug %1 mit %2 %% Geschwindigkeit', args0: [
      { type: 'field_dropdown', name: 'DIR', options: [['vorwärts fahren', 'FWD'], ['rückwärts fahren', 'BWD'], ['Linkskurve fahren', 'CL'], ['Rechtskurve fahren', 'CR'], ['auf der Stelle nach links drehen', 'TL'], ['auf der Stelle nach rechts drehen', 'TR']] },
      { type: 'input_value', name: 'SPEED', check: 'Number' }],
    inputsInline: true, tooltip: 'Fährt, bis ein anderer Fahrzeug-Block kommt – mit „warten“ die Dauer festlegen. Kurve: das innere Rad läuft mit einem Drittel der Geschwindigkeit. Drehen auf der Stelle: die Räder laufen gegeneinander.' }, COL.mot),
    B({ type: 'car_stop', message0: 'Fahrzeug anhalten', args0: [], tooltip: 'Beide Motoren aus.' }, COL.mot),
    B({ type: 'car_motors', message0: 'Fahrzeug: linker Motor %1 %% rechter Motor %2 %%', args0: [{ type: 'input_value', name: 'L', check: 'Number' }, { type: 'input_value', name: 'R', check: 'Number' }],
    inputsInline: true, tooltip: 'Jeden Motor einzeln einstellen: −100 (voll rückwärts) bis 100 (voll vorwärts), 0 = aus. Gut für Linienfolger und feine Kurven.' }, COL.mot),
    B({ type: 'ard_notone', message0: 'Lautsprecher an Anschluss %1 ausschalten', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.out }] }, COL.out),
    /* Eingang */
    { type: 'ard_digital_read', message0: 'Digitalen Anschluss %1 lesen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.inp }], output: 'Number', colour: COL.inp },
    { type: 'ard_analog_read', message0: 'Analogen Anschluss %1 lesen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.ana }], output: 'Number', colour: COL.inp },
    { type: 'ard_tmp36', message0: 'Temperatursensor an Anschluss %1 in Einheiten %2 lesen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.ana }, { type: 'field_dropdown', name: 'UNIT', options: [['°C', 'C'], ['°F', 'F']] }], output: 'Number', colour: COL.inp, tooltip: 'Für den Temperatursensor TMP36.' },
    { type: 'ard_dht', message0: 'Sensor DHT%1 an Anschluss %2 %3 lesen', args0: [{ type: 'field_dropdown', name: 'MODEL', options: [['11', '11'], ['22', '22']] }, { type: 'field_dropdown', name: 'PIN', options: PIN.inp }, { type: 'field_dropdown', name: 'WHAT', options: [['Temperatur in °C', 'C'], ['Luftfeuchtigkeit in %', 'H'], ['Temperatur in °F', 'F']] }], output: 'Number', colour: COL.inp, tooltip: 'Für den Temperatur- und Feuchtesensor DHT11 (blau) oder DHT22 (weiß). Der Sensor liefert höchstens jede Sekunde (DHT22: alle 2 Sekunden) einen neuen Wert. Ungültige Messung: nan.' },
    { type: 'ard_ultrasonic', message0: 'Ultraschall-Abstandssensor an Trigger-Anschluss %1 Echo-Anschluss %2 in Einheiten %3', args0: [{ type: 'field_dropdown', name: 'TRIG', options: PIN.out }, { type: 'field_dropdown', name: 'ECHO', options: PIN.inp }, { type: 'field_dropdown', name: 'UNIT', options: [['cm', 'CM'], ['Zoll', 'IN']] }], output: 'Number', colour: COL.inp, tooltip: 'Für den Ultraschallsensor HC-SR04.' },
    /* Anzeige */
    B({ type: 'ard_lcd_init', message0: 'LCD einrichten', extensions: ['i2c_hint'], tooltip: 'Muss einmal in „beim Start“ stehen.' }, COL.show),
    B({ type: 'ard_lcd_backlight', message0: 'LCD-Hintergrundlicht %1', args0: [{ type: 'field_dropdown', name: 'ON', options: [['einschalten', '1'], ['ausschalten', '0']] }] }, COL.show),
    B({ type: 'ard_lcd_clear', message0: 'LCD-Bildschirm leeren' }, COL.show),
    B({ type: 'ard_lcd_print', message0: 'Drucken auf LCD %1', args0: [{ type: 'input_value', name: 'V' }], inputsInline: true }, COL.show),
    B({ type: 'ard_lcd_pos', message0: 'Position auf LCD auf Spalte %1 Zeile %2 einstellen', args0: [{ type: 'input_value', name: 'COL', check: 'Number' }, { type: 'input_value', name: 'ROW', check: 'Number' }], inputsInline: true, tooltip: 'Spalte 0 bis 15, Zeile 0 oder 1.' }, COL.show),
    B({ type: 'ard_serial', message0: 'auf seriellem Monitor %1 drucken %2', args0: [{ type: 'input_value', name: 'V' }, { type: 'field_dropdown', name: 'NL', options: [['mit Zeilenumbruch', 'Y'], ['ohne Zeilenumbruch', 'N']] }], inputsInline: true }, COL.show),
    { type: 'ard_join', message0: 'verbinde %1 %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], inputsInline: true, output: 'String', colour: COL.show, tooltip: 'Hängt zwei Texte oder Zahlen aneinander.' },
    /* Mathe */
    { type: 'ard_round', message0: '%1 %2', args0: [{ type: 'field_dropdown', name: 'OP', options: [['runde', 'ROUND'], ['runde auf', 'UP'], ['runde ab', 'DOWN']] }, { type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, output: 'Number', colour: COL.math, tooltip: 'Runden auf eine ganze Zahl: „runde“ kaufmännisch (2,5 → 3), „runde auf“ immer nach oben, „runde ab“ immer nach unten.' },
    { type: 'ard_math1', message0: '%1 von %2', args0: [{ type: 'field_dropdown', name: 'OP', options: [['Betrag', 'ABS'], ['Quadratwurzel', 'SQRT']] }, { type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, output: 'Number', colour: COL.math, tooltip: 'Betrag: Zahl ohne Vorzeichen (−3 → 3). Quadratwurzel: z. B. von 16 → 4.' },
    { type: 'ard_map', message0: '%1 von %2 … %3 auf %4 … %5 umrechnen', args0: [{ type: 'input_value', name: 'V', check: 'Number' }, { type: 'input_value', name: 'A', check: 'Number' }, { type: 'input_value', name: 'B', check: 'Number' }, { type: 'input_value', name: 'C', check: 'Number' }, { type: 'input_value', name: 'D', check: 'Number' }], inputsInline: true, output: 'Number', colour: COL.math, tooltip: 'Rechnet einen Wert von einem Bereich in einen anderen um, z. B. 0…1023 (Arduino) bzw. 0…4095 (ESP32) auf 0…255.' },

    /* Listen (feste Länge, Nummern ab 1) */
    B({ type: 'list_new', message0: 'Liste %1 mit %2 Einträgen anlegen (alle 0)', args0: [{ type: 'field_variable', name: 'L', variable: 'Messwerte', variableTypes: ['Liste'], defaultType: 'Liste' }, { type: 'field_number', name: 'N', value: 10, min: 1, max: 100, precision: 1 }], tooltip: 'Legt eine Liste mit fester Anzahl von Einträgen an (höchstens 100). Gehört meist in „beim Start“.' }, COL.list),
    B({ type: 'list_init', message0: 'Liste %1 aus den Zahlen %2 anlegen', args0: [{ type: 'field_variable', name: 'L', variable: 'Messwerte', variableTypes: ['Liste'], defaultType: 'Liste' }, { type: 'field_input', name: 'V', text: '262, 294, 330' }], tooltip: 'Legt eine Liste mit diesen Zahlen an, z. B. Tonhöhen, Anschlüsse oder Wartezeiten. Zahlen durch Komma trennen, Kommazahlen mit Punkt (2.5).' }, COL.list),
    { type: 'list_get', message0: 'Eintrag Nr. %1 der Liste %2', args0: [{ type: 'input_value', name: 'I', check: 'Number' }, { type: 'field_variable', name: 'L', variable: 'Messwerte', variableTypes: ['Liste'], defaultType: 'Liste' }], inputsInline: true, output: 'Number', colour: COL.list, tooltip: 'Liest einen Eintrag. Der erste Eintrag hat die Nummer 1.' },
    B({ type: 'list_set', message0: 'Eintrag Nr. %1 der Liste %2 auf %3 setzen', args0: [{ type: 'input_value', name: 'I', check: 'Number' }, { type: 'field_variable', name: 'L', variable: 'Messwerte', variableTypes: ['Liste'], defaultType: 'Liste' }, { type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, tooltip: 'Ändert einen Eintrag. Der erste Eintrag hat die Nummer 1.' }, COL.list),
    B({ type: 'list_push', message0: 'neuen Wert %1 hinten in Liste %2 nachschieben', args0: [{ type: 'input_value', name: 'V', check: 'Number' }, { type: 'field_variable', name: 'L', variable: 'Messwerte', variableTypes: ['Liste'], defaultType: 'Liste' }], inputsInline: true, tooltip: 'Alle Einträge rücken eins nach vorne, der älteste (Nr. 1) fällt weg, der neue Wert kommt ans Ende. Gut für Messreihen und gleitende Mittelwerte.' }, COL.list),
    { type: 'list_len', message0: 'Anzahl Einträge der Liste %1', args0: [{ type: 'field_variable', name: 'L', variable: 'Messwerte', variableTypes: ['Liste'], defaultType: 'Liste' }], output: 'Number', colour: COL.list },
    { type: 'list_stat', message0: '%1 der Liste %2', args0: [{ type: 'field_dropdown', name: 'OP', options: [['Mittelwert', 'AVG'], ['Summe', 'SUM'], ['kleinster Wert', 'MIN'], ['größter Wert', 'MAX']] }, { type: 'field_variable', name: 'L', variable: 'Messwerte', variableTypes: ['Liste'], defaultType: 'Liste' }], output: 'Number', colour: COL.list },

    /* Erweiterung NeoPixel */
    B({ type: 'neo_init', message0: 'NeoPixel an Anschluss %1 mit %2 LEDs einrichten', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.out }, { type: 'field_number', name: 'N', value: 8, min: 1, max: 300, precision: 1 }] }, COL.neo),
    B({ type: 'neo_set', message0: 'NeoPixel-LED Nr. %1 auf Farbe %2 setzen', args0: [{ type: 'input_value', name: 'I', check: 'Number' }, { type: 'field_colour', name: 'C', colour: '#ff0000' }], inputsInline: true, tooltip: 'Die LEDs werden ab 1 gezählt.' }, COL.neo),
    B({ type: 'neo_set_rgb', message0: 'NeoPixel-LED Nr. %1 auf Rot %2 Grün %3 Blau %4 setzen', args0: [{ type: 'input_value', name: 'I', check: 'Number' }, { type: 'input_value', name: 'R', check: 'Number' }, { type: 'input_value', name: 'G', check: 'Number' }, { type: 'input_value', name: 'B', check: 'Number' }], inputsInline: true, tooltip: 'Farbanteile von 0 bis 255.' }, COL.neo),
    B({ type: 'neo_fill', message0: 'alle NeoPixel auf Farbe %1 setzen', args0: [{ type: 'field_colour', name: 'C', colour: '#00ff00' }] }, COL.neo),
    B({ type: 'neo_brightness', message0: 'NeoPixel-Helligkeit auf %1 einstellen', args0: [{ type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, tooltip: '0 bis 255.' }, COL.neo),
    B({ type: 'neo_clear', message0: 'alle NeoPixel ausschalten' }, COL.neo),
    /* Erweiterung Tastenfeld */
    B({ type: 'kp_init3', message0: 'Tastenfeld 3 × 4 einrichten %1 Zeilen R1–R4 an %2 %3 %4 %5 %6 Spalten C1–C3 an %7 %8 %9', args0: [{ type: 'input_dummy' },
      ...['9', '8', '7', '6'].map((d, i) => ({ type: 'field_dropdown', name: 'R' + i, options: PIN.out })), { type: 'input_dummy' },
      ...['5', '4', '3'].map((d, i) => ({ type: 'field_dropdown', name: 'C' + i, options: PIN.out }))] }, COL.kp),
    B({ type: 'kp_init4', message0: 'Tastenfeld 4 × 4 einrichten %1 Zeilen R1–R4 an %2 %3 %4 %5 %6 Spalten C1–C4 an %7 %8 %9 %10', args0: [{ type: 'input_dummy' },
      ...['9', '8', '7', '6'].map((d, i) => ({ type: 'field_dropdown', name: 'R' + i, options: PIN.out })), { type: 'input_dummy' },
      ...['5', '4', '3', '2'].map((d, i) => ({ type: 'field_dropdown', name: 'C' + i, options: PIN.out }))] }, COL.kp),
    B({ type: 'kp_read', message0: 'Tastenfeld abfragen', tooltip: 'Liest, ob gerade eine Taste neu gedrückt wurde. Danach steht sie in „gedrückte Taste“.' }, COL.kp),
    { type: 'kp_key', message0: 'gedrückte Taste', output: 'String', colour: COL.kp, tooltip: 'Die beim letzten „Tastenfeld abfragen“ gedrückte Taste, z. B. "5". Leer, wenn keine Taste gedrückt wurde.' },
    /* Erweiterung Multimeter (umgeschrieben für Arduino Uno: SDA = A4, SCL = A5) */
    B({ type: 'init_voltmeter_i2c', message0: 'Spannungsmesser ADS1115 mit Adresse %1 und Messbereich %2 einrichten', args0: [{ type: 'field_dropdown', name: 'ADDRESS', options: ADS_ADDR },
      { type: 'field_dropdown', name: 'RANGE', options: [['±6,144 V (für 5 V)', '6'], ['±4,096 V (für 3,3 V)', '4'], ['±2,048 V (genauer)', '2'], ['±1,024 V (Brennstoffzelle)', '1']] }], extensions: ['i2c_hint'], tooltip: 'Richtet den Analog-Digital-Wandler ADS1115 ein. Muss einmal in „beim Start“ stehen.' }, COL.mm),
    { type: 'read_voltmeter_differential', message0: 'Spannung am ADS1115 %1 zwischen %2 in Volt', args0: [{ type: 'field_dropdown', name: 'ADDRESS', options: ADS_ADDR }, { type: 'field_dropdown', name: 'KANAL', options: [['A0 und A1', '0'], ['A2 und A3', '3']] }], output: 'Number', colour: COL.mm, tooltip: 'Spannung zwischen zwei Eingängen, unabhängig von GND (z. B. Brennstoffzelle: Kathode an A0, Anode an A1).' },
    { type: 'read_voltmeter_channel', message0: 'Spannung am ADS1115 %1 an %2 gegen GND in Volt', args0: [{ type: 'field_dropdown', name: 'ADDRESS', options: ADS_ADDR }, { type: 'field_dropdown', name: 'KANAL', options: [['A0', '0'], ['A1', '1'], ['A2', '2'], ['A3', '3']] }], output: 'Number', colour: COL.mm, tooltip: 'Spannung an einem Eingang gegenüber GND.' },
    { type: 'calculate_pmfc_power', message0: '%3 aus Spannung %1 V bei Lastwiderstand %2 Ω', args0: [{ type: 'input_value', name: 'VOLTAGE', check: 'Number' }, { type: 'field_number', name: 'RESISTOR', value: 1000, min: 1, max: 100000 },
      { type: 'field_dropdown', name: 'OUTPUT_TYPE', options: [['Leistung in µW', 'UW'], ['Stromstärke in mA', 'MA'], ['Leistung in mW', 'MW']] }], inputsInline: true, output: 'Number', colour: COL.mmc, tooltip: 'Berechnet mit dem ohmschen Gesetz Strom (I = U / R) oder Leistung (P = U² / R).' },
    B({ type: 'init_ina219_i2c', message0: 'Strommesser INA219 mit Adresse %1 und Messbereich %2 einrichten', args0: [{ type: 'field_dropdown', name: 'ADDRESS', options: INA_ADDR },
      { type: 'field_dropdown', name: 'CALIBRATION', options: [['16 V / 400 mA (genau, Brennstoffzelle)', '16V_400mA'], ['32 V / 1 A', '32V_1A'], ['32 V / 2 A', '32V_2A']] }], extensions: ['i2c_hint'], tooltip: 'Richtet das Strom- und Spannungsmodul INA219 ein. Muss einmal in „beim Start“ stehen.' }, COL.mmi),
    { type: 'read_ina219_value', message0: '%2 am INA219 %1', args0: [{ type: 'field_dropdown', name: 'ADDRESS', options: INA_ADDR }, { type: 'field_dropdown', name: 'MEASURE_MODE', options: [['Stromstärke in mA', 'CURRENT'], ['Busspannung in V', 'BUS_VOLT'], ['Shuntspannung in mV', 'SHUNT_VOLT']] }], output: 'Number', colour: COL.mmi, tooltip: 'Liest den gewählten Messwert des INA219.' },
    /* Erweiterung Kommunikation (nur ESP32) */
    { type: 'com_usb_avail', message0: 'über USB etwas empfangen?', output: 'Boolean', colour: COL.comu, tooltip: 'Prüft, ob über USB (serieller Monitor) eine neue Zeile angekommen ist. Danach steht sie in „über USB empfangener Text“.' },
    { type: 'com_usb_text', message0: 'über USB empfangener Text', output: 'String', colour: COL.comu, tooltip: 'Die zuletzt über USB empfangene Zeile.' },
    { type: 'com_usb_num', message0: 'über USB empfangene Zahl', output: 'Number', colour: COL.comu, tooltip: 'Die zuletzt über USB empfangene Zeile als Zahl (z. B. 42 oder 3.5).' },
    B({ type: 'com_wifi_connect', message0: 'mit WLAN %1 und Passwort %2 verbinden', args0: [{ type: 'input_value', name: 'SSID' }, { type: 'input_value', name: 'PW' }], inputsInline: true, tooltip: 'Verbindet den ESP32 mit einem vorhandenen WLAN (wartet bis zu 15 Sekunden).' }, COL.com),
    B({ type: 'com_wifi_ap', message0: 'eigenes WLAN %1 mit Passwort %2 öffnen', args0: [{ type: 'input_value', name: 'SSID' }, { type: 'input_value', name: 'PW' }], inputsInline: true, tooltip: 'Der ESP32 spannt ein eigenes WLAN auf (Passwort mindestens 8 Zeichen, sonst ohne Passwort). Seine Adresse ist dann 192.168.4.1.' }, COL.com),
    { type: 'com_wifi_ok', message0: 'WLAN verbunden?', output: 'Boolean', colour: COL.com, tooltip: 'Wahr, wenn der ESP32 mit einem WLAN verbunden ist oder sein eigenes WLAN geöffnet hat.' },
    { type: 'com_wifi_ip', message0: 'eigene IP-Adresse', output: 'String', colour: COL.com, tooltip: 'Unter dieser Adresse ist die Webseite des ESP32 im Browser erreichbar.' },
    B({ type: 'com_web_start', message0: 'Webseite mit Titel %1 starten', args0: [{ type: 'input_value', name: 'T' }], inputsInline: true, tooltip: 'Startet eine eigene Webseite auf dem ESP32. Vorher mit einem WLAN verbinden oder ein eigenes WLAN öffnen. Im Browser die IP-Adresse eingeben.' }, COL.comw),
    B({ type: 'com_web_show', message0: 'auf der Webseite %1 anzeigen: %2', args0: [{ type: 'field_input', name: 'N', text: 'Temperatur' }, { type: 'input_value', name: 'V' }], inputsInline: true, tooltip: 'Zeigt einen Wert mit Beschriftung auf der Webseite an (wird jede Sekunde aktualisiert).' }, COL.comw),
    { type: 'com_web_button', message0: 'Knopf %1 auf der Webseite gedrückt?', args0: [{ type: 'field_input', name: 'N', text: 'Licht an' }], output: 'Boolean', colour: COL.comw, tooltip: 'Zeigt einen Knopf auf der Webseite. Wahr (einmal), wenn er seit der letzten Abfrage gedrückt wurde.' },
    { type: 'com_web_slider', message0: 'Schieberegler %1 auf der Webseite (0 bis 100)', args0: [{ type: 'field_input', name: 'N', text: 'Helligkeit' }], output: 'Number', colour: COL.comw, tooltip: 'Zeigt einen Schieberegler auf der Webseite und liefert seinen Wert von 0 bis 100.' },
    B({ type: 'com_radio_init', message0: 'Funk für Gruppe %1 einrichten', args0: [{ type: 'field_number', name: 'G', value: 1, min: 1, max: 18, precision: 1 }], tooltip: 'Funk zwischen ESP32 ohne WLAN-Router (ESP-NOW). Alle ESP32 mit derselben Gruppe empfangen die Nachrichten der anderen. Muss einmal in „beim Start“ stehen. Am zuverlässigsten ohne WLAN-Verbindung – sonst müssen alle ESP32 im selben WLAN sein.' }, COL.comf),
    B({ type: 'com_radio_send', message0: 'Funk-Nachricht %1 senden', args0: [{ type: 'input_value', name: 'V' }], inputsInline: true, tooltip: 'Sendet einen Text oder eine Zahl an alle ESP32 derselben Gruppe.' }, COL.comf),
    { type: 'com_radio_avail', message0: 'Funk-Nachricht empfangen?', output: 'Boolean', colour: COL.comf, tooltip: 'Prüft, ob eine neue Funk-Nachricht angekommen ist. Danach steht sie in „empfangene Funk-Nachricht“.' },
    { type: 'com_radio_text', message0: 'empfangene Funk-Nachricht', output: 'String', colour: COL.comf, tooltip: 'Die zuletzt empfangene Funk-Nachricht als Text.' },
    { type: 'com_radio_num', message0: 'empfangene Funk-Nachricht als Zahl', output: 'Number', colour: COL.comf, tooltip: 'Die zuletzt empfangene Funk-Nachricht als Zahl.' },
    B({ type: 'com_bt_init', message0: 'Bluetooth mit Namen %1 einrichten', args0: [{ type: 'input_value', name: 'N' }], inputsInline: true, tooltip: 'Der ESP32 wird zu einem Bluetooth-Gerät, mit dem eine Handy-App (z. B. „Serial Bluetooth Terminal“ oder „Bluefruit Connect“) oder der serielle Monitor der Werkstatt Nachrichten austauschen kann. Muss einmal in „beim Start“ stehen. Ist die Bluetooth-Übertragung eingeschaltet, gilt deren Name.' }, COL.comb),
    B({ type: 'com_bt_send', message0: 'über Bluetooth senden %1', args0: [{ type: 'input_value', name: 'V' }], inputsInline: true, tooltip: 'Sendet einen Text oder eine Zahl (mit Zeilenumbruch) an das verbundene Gerät.' }, COL.comb),
    { type: 'com_bt_conn', message0: 'Bluetooth verbunden?', output: 'Boolean', colour: COL.comb, tooltip: 'Wahr, wenn gerade ein Handy oder der serielle Monitor verbunden ist.' },
    { type: 'com_bt_avail', message0: 'über Bluetooth etwas empfangen?', output: 'Boolean', colour: COL.comb, tooltip: 'Prüft, ob eine neue Nachricht angekommen ist. Danach steht sie in „über Bluetooth empfangener Text“.' },
    { type: 'com_bt_text', message0: 'über Bluetooth empfangener Text', output: 'String', colour: COL.comb, tooltip: 'Die zuletzt über Bluetooth empfangene Nachricht.' },
    { type: 'com_bt_num', message0: 'über Bluetooth empfangene Zahl', output: 'Number', colour: COL.comb, tooltip: 'Die zuletzt über Bluetooth empfangene Nachricht als Zahl.' },
    /* Erweiterung OLED (SSD1306, 128 × 64, I²C-Adresse 0x3C) */
    B({ type: 'oled_init', message0: 'OLED einrichten', extensions: ['i2c_hint'], tooltip: 'Muss einmal in „beim Start“ stehen.' }, COL.oled),
    B({ type: 'oled_clear', message0: 'OLED leeren' }, COL.oled),
    B({ type: 'oled_show', message0: 'OLED anzeigen', tooltip: 'Erst mit diesem Block erscheint das Gezeichnete auf dem Display.' }, COL.oled),
    B({ type: 'oled_cursor', message0: 'OLED-Position auf x %1 y %2 einstellen', args0: [{ type: 'input_value', name: 'X', check: 'Number' }, { type: 'input_value', name: 'Y', check: 'Number' }], inputsInline: true, tooltip: 'x von 0 bis 127, y von 0 bis 63.' }, COL.oled),
    B({ type: 'oled_size', message0: 'OLED-Textgröße %1', args0: [{ type: 'field_dropdown', name: 'N', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] }] }, COL.oled),
    B({ type: 'oled_print', message0: 'Drucken auf OLED %1', args0: [{ type: 'input_value', name: 'V' }], inputsInline: true }, COL.oled),
    B({ type: 'oled_pixel', message0: 'OLED-Pixel x %1 y %2 %3', args0: [{ type: 'input_value', name: 'X', check: 'Number' }, { type: 'input_value', name: 'Y', check: 'Number' }, OCOL], inputsInline: true }, COL.oled),
    B({ type: 'oled_line', message0: 'OLED-Linie von x %1 y %2 bis x %3 y %4 %5', args0: [{ type: 'input_value', name: 'X0', check: 'Number' }, { type: 'input_value', name: 'Y0', check: 'Number' }, { type: 'input_value', name: 'X1', check: 'Number' }, { type: 'input_value', name: 'Y1', check: 'Number' }, OCOL], inputsInline: true }, COL.oled),
    B({ type: 'oled_rect', message0: 'OLED-Rechteck %1 x %2 y %3 Breite %4 Höhe %5 %6', args0: [{ type: 'field_dropdown', name: 'F', options: [['Rahmen', '0'], ['gefüllt', '1']] }, { type: 'input_value', name: 'X', check: 'Number' }, { type: 'input_value', name: 'Y', check: 'Number' }, { type: 'input_value', name: 'W', check: 'Number' }, { type: 'input_value', name: 'H', check: 'Number' }, OCOL], inputsInline: true }, COL.oled),
    B({ type: 'oled_bitmap', message0: 'OLED-Bild %1 bei x %2 y %3 zeichnen %4', args0: [{ type: 'field_bitmap', name: 'BMP' }, { type: 'input_value', name: 'X', check: 'Number' }, { type: 'input_value', name: 'Y', check: 'Number' }, OCOL], inputsInline: true, tooltip: 'Klicke auf das Bild, um es im Grafikeditor zu bearbeiten.' }, COL.oled),
    B({ type: 'oled_circle', message0: 'OLED-Kreis %1 Mitte x %2 y %3 Radius %4 %5', args0: [{ type: 'field_dropdown', name: 'F', options: [['Rahmen', '0'], ['gefüllt', '1']] }, { type: 'input_value', name: 'X', check: 'Number' }, { type: 'input_value', name: 'Y', check: 'Number' }, { type: 'input_value', name: 'R', check: 'Number' }, OCOL], inputsInline: true }, COL.oled),
  ]);
}

/* Startwerte der Tastenfeld-Anschlüsse setzen */
function initKeypadDefaults(block) {
  const r = DEF().kpR, c = DEF().kpC;
  r.forEach((v, i) => block.getField('R' + i) && block.setFieldValue(v, 'R' + i));
  c.forEach((v, i) => block.getField('C' + i) && block.setFieldValue(v, 'C' + i));
}

const num = v => `<shadow type="math_number"><field name="NUM">${v}</field></shadow>`;
const txt = v => `<shadow type="text"><field name="TEXT">${v}</field></shadow>`;
const kpXml = (t, cols) => `<block type="${t}">${DEF().kpR.map((v, i) => `<field name="R${i}">${v}</field>`).join('')}${DEF().kpC.slice(0, cols).map((v, i) => `<field name="C${i}">${v}</field>`).join('')}</block>`;

function buildToolbox(ext) {
  ext = ext || [];
  const D = DEF();
  let x = `<xml>
  <category name="Ausgang" colour="${COL.out}">
    <block type="ard_digital_write"><field name="PIN">${D.dw}</field></block>
    <block type="ard_analog_write"><field name="PIN">${D.pwm}</field><value name="V">${num(0)}</value></block>
    <block type="ard_builtin_led"></block>
    <block type="ard_servo"><field name="PIN">${D.servo}</field><value name="DEG">${num(90)}</value></block>
    <block type="ard_tone"><field name="PIN">${D.tone}</field><field name="NOTE">9</field><field name="OCT">4</field><value name="DUR">${num(1)}</value></block>
    <block type="ard_tone_freq"><field name="PIN">${D.tone}</field><value name="FREQ">${num(440)}</value><value name="DUR">${num(1)}</value></block>
    <block type="ard_notone"><field name="PIN">${D.tone}</field></block>
  </category>
  <category name="Eingang" colour="${COL.inp}">
    <block type="ard_digital_read"><field name="PIN">${D.dr}</field></block>
    <block type="ard_analog_read"><field name="PIN">${D.ana}</field></block>
    <block type="ard_tmp36"><field name="PIN">${D.ana}</field></block>
    <block type="ard_ultrasonic"><field name="TRIG">${D.trig}</field><field name="ECHO">${D.echo}</field></block>
    <block type="ard_dht"><field name="PIN">${D.dht}</field></block>
  </category>
  <category name="Anzeige" colour="${COL.show}">
    <block type="ard_lcd_init"></block>
    <block type="ard_lcd_backlight"></block>
    <block type="ard_lcd_clear"></block>
    <block type="ard_lcd_print"><value name="V">${txt('Hallo')}</value></block>
    <block type="ard_lcd_pos"><value name="COL">${num(0)}</value><value name="ROW">${num(0)}</value></block>
    <sep gap="24"></sep>
    <block type="ard_serial"><value name="V">${txt('Hallo Welt')}</value></block>
    <sep gap="24"></sep>
    <block type="text"><field name="TEXT">Text</field></block>
    <block type="ard_join"><value name="A">${txt('Wert: ')}</value><value name="B">${num(0)}</value></block>
  </category>
  <category name="Steuerung" colour="${COL.ctrl}">
    <block type="ard_setup"></block>
    <block type="ard_loop"></block>
    <block type="ard_wait"><value name="N">${num(1)}</value></block>
    <block type="ard_wait_until"><value name="C"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="ard_digital_read"><field name="PIN">${D.dr}</field></block></value><value name="B">${num(1)}</value></block></value></block>
    <block type="ard_millis"></block>
  </category>
  <category name="Logik" colour="${COL.logic}">
    <block type="controls_if"></block>
    <block type="controls_if"><mutation else="1"></mutation></block>
    <block type="logic_compare"><value name="B">${num(1)}</value></block>
    <block type="logic_operation"></block>
    <block type="logic_negate"></block>
    <block type="logic_boolean"></block>
  </category>
  <category name="Schleifen" colour="${COL.loop}">
    <block type="controls_repeat_ext"><value name="TIMES">${num(10)}</value></block>
    <block type="controls_whileUntil"></block>
    <block type="ard_count"><value name="FROM">${num(1)}</value><value name="TO">${num(10)}</value><value name="STEP">${num(1)}</value></block>
  </category>
  <category name="Mathe" colour="${COL.math}">
    <block type="math_number"><field name="NUM">0</field></block>
    <block type="math_arithmetic"><value name="A">${num(1)}</value><value name="B">${num(1)}</value></block>
    <block type="math_modulo"><value name="DIVIDEND">${num(10)}</value><value name="DIVISOR">${num(3)}</value></block>
    <block type="math_random_int"><value name="FROM">${num(1)}</value><value name="TO">${num(6)}</value></block>
    <block type="ard_round"><value name="V">${num(2.5)}</value></block>
    <block type="ard_math1"><value name="V">${num(16)}</value></block>
    <block type="ard_map"><value name="A">${num(0)}</value><value name="B">${num(D.max)}</value><value name="C">${num(0)}</value><value name="D">${num(255)}</value></block>
    <block type="math_constrain"><value name="LOW">${num(0)}</value><value name="HIGH">${num(100)}</value></block>
  </category>
  <category name="Variablen" colour="${COL.vars}" custom="VARIABLE"></category>
  <category name="Listen" colour="${COL.list}" custom="LISTE"></category>
  <category name="Funktionen" colour="${COL.func}" custom="PROCEDURE"></category>`;
  if (ext.length) x += `<sep></sep>`;
  if (ext.includes('motoren')) x += `
  <category name="Motoren" colour="${COL.mot}">
    <block type="ard_motor"><field name="IA">${D.mA}</field><field name="IB">${D.mB}</field><value name="SPEED">${num(100)}</value></block>
    <sep gap="24"></sep>
    <block type="car_init">${['LA', 'LB', 'RA', 'RB'].map((f, i) => `<field name="${f}">${D.car[i]}</field>`).join('')}</block>
    <block type="car_drive"><value name="SPEED">${num(80)}</value></block>
    <block type="car_stop"></block>
    <block type="car_motors"><value name="L">${num(50)}</value><value name="R">${num(50)}</value></block>
    <sep gap="24"></sep>
    <block type="ard_stepper">${D.st.map((p, i) => `<field name="P${i + 1}">${p}</field>`).join('')}<value name="N">${num(90)}</value><value name="RPM">${num(10)}</value></block>
  </category>`;
  if (ext.includes('neopixel')) x += `
  <category name="NeoPixel" colour="${COL.neo}">
    <block type="neo_init"><field name="PIN">${D.neo}</field></block>
    <block type="neo_set"><value name="I">${num(1)}</value></block>
    <block type="neo_set_rgb"><value name="I">${num(1)}</value><value name="R">${num(255)}</value><value name="G">${num(0)}</value><value name="B">${num(0)}</value></block>
    <block type="neo_fill"></block>
    <block type="neo_brightness"><value name="V">${num(50)}</value></block>
    <block type="neo_clear"></block>
  </category>`;
  if (ext.includes('keypad')) x += `
  <category name="Tastenfeld" colour="${COL.kp}">
    ${kpXml('kp_init3', 3)}
    ${kpXml('kp_init4', 4)}
    <block type="kp_read"></block>
    <block type="kp_key"></block>
  </category>`;
  if (ext.includes('multimeter')) x += `
  <category name="Multimeter" colour="${COL.mm}">
    <block type="init_voltmeter_i2c"></block>
    <block type="read_voltmeter_differential"></block>
    <block type="read_voltmeter_channel"></block>
    <block type="calculate_pmfc_power"></block>
    <block type="init_ina219_i2c"></block>
    <block type="read_ina219_value"></block>
  </category>`;
  if (ext.includes('oled')) x += `
  <category name="OLED" colour="${COL.oled}">
    <block type="oled_init"></block>
    <block type="oled_clear"></block>
    <block type="oled_show"></block>
    <block type="oled_cursor"><value name="X">${num(0)}</value><value name="Y">${num(0)}</value></block>
    <block type="oled_size"></block>
    <block type="oled_print"><value name="V">${txt('Hallo')}</value></block>
    <block type="oled_pixel"><value name="X">${num(64)}</value><value name="Y">${num(32)}</value></block>
    <block type="oled_line"><value name="X0">${num(0)}</value><value name="Y0">${num(0)}</value><value name="X1">${num(127)}</value><value name="Y1">${num(63)}</value></block>
    <block type="oled_rect"><value name="X">${num(10)}</value><value name="Y">${num(10)}</value><value name="W">${num(40)}</value><value name="H">${num(20)}</value></block>
    <block type="oled_bitmap"><value name="X">${num(0)}</value><value name="Y">${num(0)}</value></block>
    <block type="oled_circle"><value name="X">${num(64)}</value><value name="Y">${num(32)}</value><value name="R">${num(10)}</value></block>
  </category>`;
  if (ext.includes('comm') && BOARD === 'esp32') {
    const g = Math.min(18, Math.max(1, parseInt((document.querySelector('#projName') || {}).value, 10) || 1));
    x += `
  <category name="Kommunikation" colour="${COL.com}">
    <label text="USB (serieller Monitor)"></label>
    <block type="ard_serial"><value name="V">${txt('Hallo')}</value></block>
    <block type="com_usb_avail"></block>
    <block type="com_usb_text"></block>
    <block type="com_usb_num"></block>
    <label text="WLAN"></label>
    <block type="com_wifi_connect"><value name="SSID">${txt('Schul-WLAN')}</value><value name="PW">${txt('Passwort')}</value></block>
    <block type="com_wifi_ap"><value name="SSID">${txt('ESP-Tisch-' + String(g).padStart(2, '0'))}</value><value name="PW">${txt('werkstatt')}</value></block>
    <block type="com_wifi_ok"></block>
    <block type="com_wifi_ip"></block>
    <label text="Eigene Webseite"></label>
    <block type="com_web_start"><value name="T">${txt('Mein ESP32')}</value></block>
    <block type="com_web_show"><value name="V">${num(0)}</value></block>
    <block type="com_web_button"></block>
    <block type="com_web_slider"></block>
    <label text="Funk zwischen ESP32"></label>
    <block type="com_radio_init"><field name="G">${g}</field></block>
    <block type="com_radio_send"><value name="V">${txt('Hallo')}</value></block>
    <block type="com_radio_avail"></block>
    <block type="com_radio_text"></block>
    <block type="com_radio_num"></block>
    <label text="Bluetooth (Handy-App oder serieller Monitor)"></label>
    <block type="com_bt_init"><value name="N">${txt('ESP-' + String(g).padStart(2, '0'))}</value></block>
    <block type="com_bt_send"><value name="V">${txt('Hallo')}</value></block>
    <block type="com_bt_conn"></block>
    <block type="com_bt_avail"></block>
    <block type="com_bt_text"></block>
    <block type="com_bt_num"></block>
  </category>`;
  }
  return x + '</xml>';
}

/* Werkzeugkasten „Listen“: Knopf zum Anlegen und Blöcke für die zuletzt angelegte Liste */
function listFlyout(ws) {
  const out = [];
  const btn = document.createElement('button');
  btn.setAttribute('text', 'Liste erstellen …'); btn.setAttribute('callbackKey', 'NEUE_LISTE');
  out.push(btn);
  const lists = ws.getVariablesOfType('Liste');
  if (!lists.length) {
    const l = document.createElement('label'); l.setAttribute('text', 'Eine Liste speichert viele Zahlen unter einem Namen.'); out.push(l);
    return out;
  }
  const last = lists[lists.length - 1];
  const f = `<field name="L" id="${last.getId()}" variabletype="Liste">${esc(last.name)}</field>`;
  const xml = [
    `<block type="list_new">${f}</block>`,
    `<block type="list_init">${f}</block>`,
    `<block type="list_get"><value name="I">${num(1)}</value>${f}</block>`,
    `<block type="list_set"><value name="I">${num(1)}</value>${f}<value name="V">${num(0)}</value></block>`,
    `<block type="list_push"><value name="V">${num(0)}</value>${f}</block>`,
    `<block type="list_len">${f}</block>`,
    `<block type="list_stat">${f}</block>`,
  ];
  for (const x of xml) out.push(Blockly.Xml.textToDom(x));
  return out;
}
function registerListCategory(ws) {
  ws.registerToolboxCategoryCallback('LISTE', listFlyout);
  ws.registerButtonCallback('NEUE_LISTE', () => {
    const t = Blockly.Msg.NEW_VARIABLE_TITLE;
    Blockly.Msg.NEW_VARIABLE_TITLE = 'Name der neuen Liste:';
    try { Blockly.Variables.createVariableButtonHandler(ws, null, 'Liste'); } finally { Blockly.Msg.NEW_VARIABLE_TITLE = t; }
  });
}

const DEFAULT_BLOCKS_XML = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="30" y="30"></block><block type="ard_loop" x="30" y="150"></block></xml>`;
