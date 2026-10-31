/* Blöcke, Werkzeugkasten und Code-Erzeugung (Simulation + Arduino-C++) */
'use strict';

const COL = {
  ctrl: '#ffab19', loop: '#e08e0b', logic: '#4aa7c2', math: '#59c059', vars: '#ff8c1a', func: '#d65cd6',
  out: '#4c97ff', inp: '#9966ff', show: '#0fa39a', neo: '#7a5cd6', kp: '#cf4f8f', mm: '#3a9a5b', mmi: '#6cc48a', mmc: '#c8742a', com: '#1e88a8', comu: '#6b7c8c', comw: '#3b6fb6', comf: '#c0563f', oled: '#3a64b0',
};
/* Gewählter Mikrocontroller: 'uno' oder 'esp32' */
let BOARD = 'uno';
/* Bluetooth-Übertragung (nur ESP32): wird pro Projekt eingestellt */
let BT_OPT = { on: false, name: 'ESP-Werkstatt' };
const BT_UUID = { svc: '8e4f0001-6a1b-4c5e-9d2a-7765726b7374', ctrl: '8e4f0002-6a1b-4c5e-9d2a-7765726b7374', data: '8e4f0003-6a1b-4c5e-9d2a-7765726b7374' };
const btName = n => (String(n || '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)) || 'ESP-Werkstatt';

/* Empfänger für die Übertragung per Bluetooth. Wird automatisch eingefügt, nicht in den Blöcken sichtbar. */
function btReceiverCode(name) {
  return `// ===== Bluetooth-Übertragung (von der Arduino-Werkstatt eingefügt) =====
// Damit kann ein neues Programm per Bluetooth auf diesen ESP32 übertragen werden.
#define WS_DIENST   "${BT_UUID.svc}"
#define WS_STEUERN  "${BT_UUID.ctrl}"
#define WS_DATEN    "${BT_UUID.data}"
static volatile bool wsNeustart = false;

class WsSteuernCb : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo &info) override {
    String befehl(c->getValue().c_str());
    if (befehl.startsWith("START ")) {
      // "START <Groesse> <MD5-Pruefsumme>"
      int leer = befehl.indexOf(' ', 6);
      size_t groesse = befehl.substring(6, leer > 0 ? leer : befehl.length()).toInt();
      if (Update.isRunning()) Update.abort();
      bool ok = Update.begin(groesse);
      if (ok && leer > 0) Update.setMD5(befehl.substring(leer + 1).c_str());
      c->setValue(ok ? "OK" : "FEHLER Speicher");
    } else if (befehl == "ENDE") {
      // Nur übernehmen, wenn alles angekommen ist und die Prüfsumme stimmt
      if (Update.end(false)) { c->setValue("FERTIG"); wsNeustart = true; }
      else c->setValue("FEHLER Pruefung");
    } else if (befehl == "ABBRUCH") {
      if (Update.isRunning()) Update.abort();
      c->setValue("ABGEBROCHEN");
    }
  }
};

class WsDatenCb : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo &info) override {
    NimBLEAttValue v = c->getValue();
    if (v.size() > 0 && Update.isRunning()) Update.write((uint8_t *)v.data(), v.size());
  }
};

class WsServerCb : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *s, NimBLEConnInfo &info) override {
    // Kürzeres Funkintervall (7,5–15 ms) und größere Datenpakete: schnellere Übertragung
    s->updateConnParams(info.getConnHandle(), 6, 12, 0, 400);
    s->setDataLen(info.getConnHandle(), 251);
  }
};

void werkstattBluetooth()
{
  NimBLEDevice::init("${name}");
  NimBLEDevice::setMTU(517);
  NimBLEServer *server = NimBLEDevice::createServer();
  server->advertiseOnDisconnect(true);
  server->setCallbacks(new WsServerCb());
  NimBLEService *dienst = server->createService(WS_DIENST);
  NimBLECharacteristic *steuern = dienst->createCharacteristic(WS_STEUERN, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE);
  steuern->setCallbacks(new WsSteuernCb());
  steuern->setValue("BEREIT");
  NimBLECharacteristic *daten = dienst->createCharacteristic(WS_DATEN, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  daten->setCallbacks(new WsDatenCb());
  dienst->start();
  NimBLEAdvertising *werbung = NimBLEDevice::getAdvertising();
  werbung->addServiceUUID(WS_DIENST);
  werbung->enableScanResponse(true);
  werbung->setName("${name}");
  werbung->start();
  // Nach erfolgreicher Übertragung neu starten (unabhängig vom eigenen Programm)
  xTaskCreate([](void *) {
    for (;;) {
      if (wsNeustart) { vTaskDelay(800 / portTICK_PERIOD_MS); ESP.restart(); }
      vTaskDelay(100 / portTICK_PERIOD_MS);
    }
  }, "werkstatt", 2048, nullptr, 1, nullptr);
}
// ===== Ende Bluetooth-Übertragung =====`;
}
const UNO_DIGITAL = Array.from({ length: 12 }, (_, i) => [`D${i + 2}`, String(i + 2)]); // ohne D0/D1 (USB-Verbindung)
const UNO_PWM = ['3', '5', '6', '9', '10', '11'].map(p => ['D' + p, p]);
const UNO_ANALOG = ['A0', 'A1', 'A2', 'A3'].map(p => [p, p]); // ohne A4/A5 (I²C)
/* ESP32: nur unkritische Pins. Weggelassen: Boot-Pins (0, 2, 5, 12, 15), TX0/RX0 (1, 3), Flash-Pins (6–11)
   und D21/D22 (I²C: SDA/SCL). 34, 35, 36 (VP), 39 (VN) gibt es nur als Eingang. Analog nur ADC1 (funktioniert auch mit WLAN). */
const ESP_SAFE = [4, 13, 14, 16, 17, 18, 19, 23, 25, 26, 27, 32, 33];
const espLab = n => 'D' + n + (n === 36 ? ' (VP)' : n === 39 ? ' (VN)' : '');
const PIN = {
  out: () => BOARD === 'esp32' ? ESP_SAFE.map(n => [espLab(n), String(n)]) : UNO_DIGITAL,
  inp: () => BOARD === 'esp32' ? ESP_SAFE.concat([34, 35, 36, 39]).sort((a, b) => a - b).map(n => [espLab(n), String(n)]) : UNO_DIGITAL,
  pwm: () => BOARD === 'esp32' ? PIN.out() : UNO_PWM,
  ana: () => BOARD === 'esp32' ? [32, 33, 34, 35, 36, 39].map(n => [espLab(n), 'D' + n]) : UNO_ANALOG,
};
/* Startwerte im Werkzeugkasten je nach Mikrocontroller */
const DEF = () => BOARD === 'esp32'
  ? { dw: '4', dr: '4', pwm: '4', servo: '13', tone: '4', ana: 'D32', trig: '18', echo: '19', neo: '4', mA: '25', mB: '26', max: 4095, kpR: ['13', '14', '27', '26'], kpC: ['25', '33', '32', '23'] }
  : { dw: '2', dr: '2', pwm: '3', servo: '3', tone: '8', ana: 'A0', trig: '7', echo: '8', neo: '6', mA: '5', mB: '6', max: 1023, kpR: ['9', '8', '7', '6'], kpC: ['5', '4', '3', '2'] };
const HIGHLOW = [['HOCH', 'HIGH'], ['NIEDRIG', 'LOW']];
const NOTES = [['C', '0'], ['D', '2'], ['E', '4'], ['F', '5'], ['G', '7'], ['A', '9'], ['H', '11']];
const ACCS = [['–', '0'], ['#', '1'], ['b', '-1']];
const OCTS = ['2', '3', '4', '5', '6', '7'].map(o => [o, o]);
const ADS_ADDR = [['0x48 (ADDR an GND)', '0x48'], ['0x49 (ADDR an VDD)', '0x49'], ['0x4A (ADDR an SDA)', '0x4A'], ['0x4B (ADDR an SCL)', '0x4B']];
const INA_ADDR = [['0x40 (Standard)', '0x40'], ['0x41', '0x41'], ['0x44', '0x44'], ['0x45', '0x45']];
const ADS_RANGE = { 6: 6.144, 4: 4.096, 2: 2.048, 1: 1.024 };

function noteFreq(semi, acc, oct) {
  const midi = 12 * (Number(oct) + 1) + Number(semi) + Number(acc);
  return Math.round(440 * Math.pow(2, (midi - 69) / 12));
}

const EXTENSIONS = {
  neopixel: { name: 'NeoPixel', desc: 'Farbige LED-Streifen und -Ringe (WS2812) ansteuern.' },
  keypad: { name: 'Tastenfeld', desc: 'Folientastatur 3 × 4 oder 4 × 4 abfragen.' },
  multimeter: { name: 'Multimeter', desc: 'Spannung (ADS1115) und Strom (INA219) über I²C messen.' },
  oled: { name: 'OLED-Anzeige', desc: 'Grafikdisplay SSD1306, 128 × 64 Pixel, I²C.' },
  comm: { name: 'Kommunikation', desc: 'USB (senden und empfangen), WLAN, eigene Webseite und Funk zwischen ESP32. Nur mit dem ESP32.', esp: true },
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
    B({ type: 'ard_wait', message0: '%1 %2 warten', args0: [{ type: 'input_value', name: 'N', check: 'Number' }, { type: 'field_dropdown', name: 'UNIT', options: [['Sekunden', 'S'], ['Millisekunden', 'MS']] }], inputsInline: true }, COL.ctrl),
    /* Schleifen */
    B({ type: 'ard_count', message0: 'zähle %1 von %2 bis %3 in Schritten von %4', args0: [
      { type: 'field_variable', name: 'VAR', variable: 'i' }, { type: 'input_value', name: 'FROM', check: 'Number' },
      { type: 'input_value', name: 'TO', check: 'Number' }, { type: 'input_value', name: 'STEP', check: 'Number' }],
    message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], inputsInline: true, tooltip: 'Zählt aufwärts oder abwärts (je nachdem, ob „bis“ größer oder kleiner als „von“ ist).' }, COL.loop),
    /* Ausgang */
    B({ type: 'ard_digital_write', message0: 'Anschluss %1 auf %2 einstellen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.out }, { type: 'field_dropdown', name: 'V', options: HIGHLOW }] }, COL.out),
    B({ type: 'ard_analog_write', message0: 'PWM-Ausgang %1 auf %2 einstellen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.pwm }, { type: 'input_value', name: 'V', check: 'Number' }], inputsInline: true, tooltip: 'Wert von 0 (aus) bis 255 (voll an).' }, COL.out),
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
    inputsInline: true, tooltip: 'Für Motortreiber wie L9110S (A-IA/A-IB) oder L298N (IN1/IN2 bzw. IN3/IN4, Jumper auf ENA/ENB gesteckt): die beiden Steuereingänge eines Motors. Geschwindigkeit 0 bis 100 %.' }, COL.out),
    B({ type: 'ard_notone', message0: 'Lautsprecher an Anschluss %1 ausschalten', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.out }] }, COL.out),
    /* Eingang */
    { type: 'ard_digital_read', message0: 'Digitalen Anschluss %1 lesen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.inp }], output: 'Number', colour: COL.inp },
    { type: 'ard_analog_read', message0: 'Analogen Anschluss %1 lesen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.ana }], output: 'Number', colour: COL.inp },
    { type: 'ard_tmp36', message0: 'Temperatursensor an Anschluss %1 in Einheiten %2 lesen', args0: [{ type: 'field_dropdown', name: 'PIN', options: PIN.ana }, { type: 'field_dropdown', name: 'UNIT', options: [['°C', 'C'], ['°F', 'F']] }], output: 'Number', colour: COL.inp, tooltip: 'Für den Temperatursensor TMP36.' },
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
    B({ type: 'com_radio_init', message0: 'Funk für Gruppe %1 einrichten', args0: [{ type: 'field_number', name: 'G', value: 1, min: 1, max: 19, precision: 1 }], tooltip: 'Funk zwischen ESP32 ohne WLAN-Router (ESP-NOW). Alle ESP32 mit derselben Gruppe empfangen die Nachrichten der anderen. Muss einmal in „beim Start“ stehen. Am zuverlässigsten ohne WLAN-Verbindung – sonst müssen alle ESP32 im selben WLAN sein.' }, COL.comf),
    B({ type: 'com_radio_send', message0: 'Funk-Nachricht %1 senden', args0: [{ type: 'input_value', name: 'V' }], inputsInline: true, tooltip: 'Sendet einen Text oder eine Zahl an alle ESP32 derselben Gruppe.' }, COL.comf),
    { type: 'com_radio_avail', message0: 'Funk-Nachricht empfangen?', output: 'Boolean', colour: COL.comf, tooltip: 'Prüft, ob eine neue Funk-Nachricht angekommen ist. Danach steht sie in „empfangene Funk-Nachricht“.' },
    { type: 'com_radio_text', message0: 'empfangene Funk-Nachricht', output: 'String', colour: COL.comf, tooltip: 'Die zuletzt empfangene Funk-Nachricht als Text.' },
    { type: 'com_radio_num', message0: 'empfangene Funk-Nachricht als Zahl', output: 'Number', colour: COL.comf, tooltip: 'Die zuletzt empfangene Funk-Nachricht als Zahl.' },
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
    <block type="ard_motor"><field name="IA">${D.mA}</field><field name="IB">${D.mB}</field><value name="SPEED">${num(100)}</value></block>
  </category>
  <category name="Eingang" colour="${COL.inp}">
    <block type="ard_digital_read"><field name="PIN">${D.dr}</field></block>
    <block type="ard_analog_read"><field name="PIN">${D.ana}</field></block>
    <block type="ard_tmp36"><field name="PIN">${D.ana}</field></block>
    <block type="ard_ultrasonic"><field name="TRIG">${D.trig}</field><field name="ECHO">${D.echo}</field></block>
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
  <category name="Funktionen" colour="${COL.func}" custom="PROCEDURE"></category>`;
  if (ext.length) x += `<sep></sep>`;
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
    const g = Math.min(19, Math.max(1, parseInt((document.querySelector('#projName') || {}).value, 10) || 1));
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
  </category>`;
  }
  return x + '</xml>';
}

const DEFAULT_BLOCKS_XML = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="30" y="30"></block><block type="ard_loop" x="30" y="150"></block></xml>`;

/* ---------------- Code für die Simulation (JavaScript) ---------------- */
function setupSimGenerator() {
  const J = Blockly.JavaScript;
  J.STATEMENT_PREFIX = 'await api.hl(%1);\n';
  J.INFINITE_LOOP_TRAP = 'await api.tick();\n';
  const v = (b, n, ord, def) => J.valueToCode(b, n, ord || J.ORDER_NONE) || def || '0';
  const pin = (b, f) => `'D${b.getFieldValue(f || 'PIN')}'`;
  const vname = id => J.nameDB_.getName(id, Blockly.VARIABLE_CATEGORY_NAME);
  const col = h => `[${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}]`;
  J['ard_setup'] = b => 'async function __setup() {\n' + J.statementToCode(b, 'DO') + '}\n';
  J['ard_loop'] = b => 'async function __loop() {\n' + J.statementToCode(b, 'DO') + '}\n';
  J['ard_wait'] = b => `await api.wait((${v(b, 'N')}) * ${b.getFieldValue('UNIT') === 'S' ? 1000 : 1});\n`;
  J['ard_count'] = b => {
    const n = vname(b.getFieldValue('VAR'));
    const t = J.nameDB_.getDistinctName('__ziel', Blockly.VARIABLE_CATEGORY_NAME);
    const st = J.nameDB_.getDistinctName('__schritt', Blockly.VARIABLE_CATEGORY_NAME);
    const branch = J.addLoopTrap(J.statementToCode(b, 'DO'), b);
    return `{ let ${t} = ${v(b, 'TO')}; ${n} = ${v(b, 'FROM')}; let ${st} = Math.abs(${v(b, 'STEP', J.ORDER_NONE, '1')}) || 1; if (${n} > ${t}) ${st} = -${st};\n` +
      `for (; ${st} > 0 ? ${n} <= ${t} : ${n} >= ${t}; ${n} += ${st}) {\n${branch}} }\n`;
  };
  J['ard_builtin_led'] = b => `await api.builtinLed(${b.getFieldValue('V') === 'HIGH' ? 1 : 0});\n`;
  J['ard_digital_write'] = b => `await api.digitalWrite(${pin(b)}, ${b.getFieldValue('V') === 'HIGH' ? 1 : 0});\n`;
  J['ard_analog_write'] = b => `await api.analogWrite(${pin(b)}, ${v(b, 'V')});\n`;
  J['ard_servo'] = b => `await api.servo(${pin(b)}, ${v(b, 'DEG')});\n`;
  J['ard_tone'] = b => `await api.tone(${pin(b)}, ${noteFreq(b.getFieldValue('NOTE'), b.getFieldValue('ACC'), b.getFieldValue('OCT'))}, ${v(b, 'DUR')});\n`;
  J['ard_tone_freq'] = b => `await api.tone(${pin(b)}, ${v(b, 'FREQ')}, ${v(b, 'DUR')});\n`;
  J['ard_motor'] = b => `await api.motor(${pin(b, 'IA')}, ${pin(b, 'IB')}, ${b.getFieldValue('DIR')}, ${v(b, 'SPEED')});\n`;
  J['ard_round'] = b => [`Math.${{ ROUND: 'round', UP: 'ceil', DOWN: 'floor' }[b.getFieldValue('OP')]}(${v(b, 'V')})`, J.ORDER_FUNCTION_CALL];
  J['ard_math1'] = b => [`Math.${b.getFieldValue('OP') === 'ABS' ? 'abs' : 'sqrt'}(${v(b, 'V')})`, J.ORDER_FUNCTION_CALL];
  J['ard_notone'] = b => `await api.noTone(${pin(b)});\n`;
  J['ard_serial'] = b => `await api.serial(${v(b, 'V', J.ORDER_NONE, "''")}, ${b.getFieldValue('NL') === 'Y'});\n`;
  J['ard_lcd_init'] = () => 'await api.lcdInit();\n';
  J['ard_lcd_backlight'] = b => `await api.lcdBacklight(${b.getFieldValue('ON') === '1'});\n`;
  J['ard_lcd_clear'] = () => 'await api.lcdClear();\n';
  J['ard_lcd_print'] = b => `await api.lcdPrint(${v(b, 'V', J.ORDER_NONE, "''")});\n`;
  J['ard_lcd_pos'] = b => `await api.lcdSetCursor(${v(b, 'COL')}, ${v(b, 'ROW')});\n`;
  J['ard_join'] = b => [`(api.fmt(${v(b, 'A', J.ORDER_NONE, "''")}) + api.fmt(${v(b, 'B', J.ORDER_NONE, "''")}))`, J.ORDER_ATOMIC];
  J['ard_digital_read'] = b => [`(await api.digitalRead(${pin(b)}))`, J.ORDER_ATOMIC];
  J['ard_analog_read'] = b => [`(await api.analogRead('${b.getFieldValue('PIN')}'))`, J.ORDER_ATOMIC];
  J['ard_tmp36'] = b => [`(await api.tmp36('${b.getFieldValue('PIN')}', '${b.getFieldValue('UNIT')}'))`, J.ORDER_ATOMIC];
  J['ard_ultrasonic'] = b => [`(await api.ultrasonic(${pin(b, 'TRIG')}, ${pin(b, 'ECHO')}, '${b.getFieldValue('UNIT')}'))`, J.ORDER_ATOMIC];
  J['ard_map'] = b => [`Math.trunc(((${v(b, 'V')}) - (${v(b, 'A')})) * ((${v(b, 'D')}) - (${v(b, 'C')})) / (((${v(b, 'B')}) - (${v(b, 'A')})) || 1) + (${v(b, 'C')}))`, J.ORDER_ATOMIC];
  J['neo_init'] = b => `await api.neoInit(${pin(b)}, ${Number(b.getFieldValue('N')) || 1});\n`;
  J['neo_set'] = b => `await api.neoSet(${v(b, 'I')}, ${col(b.getFieldValue('C'))});\n`;
  J['neo_set_rgb'] = b => `await api.neoSet(${v(b, 'I')}, [${v(b, 'R')}, ${v(b, 'G')}, ${v(b, 'B')}]);\n`;
  J['neo_fill'] = b => `await api.neoFill(${col(b.getFieldValue('C'))});\n`;
  J['neo_brightness'] = b => `await api.neoBrightness(${v(b, 'V')});\n`;
  J['neo_clear'] = () => 'await api.neoFill([0, 0, 0]);\n';
  const kp = (b, cols) => `await api.kpInit(${cols}, [${[0, 1, 2, 3].map(i => `'D${b.getFieldValue('R' + i)}'`)}], [${Array.from({ length: cols }, (_, i) => `'D${b.getFieldValue('C' + i)}'`)}]);\n`;
  J['kp_init3'] = b => kp(b, 3);
  J['kp_init4'] = b => kp(b, 4);
  J['kp_read'] = () => 'await api.kpRead();\n';
  J['kp_key'] = () => ['api.kpKey()', J.ORDER_ATOMIC];
  J['oled_init'] = () => 'await api.oledInit();\n';
  J['oled_clear'] = () => 'await api.oledClear();\n';
  J['oled_show'] = () => 'await api.oledShow();\n';
  J['oled_cursor'] = b => `await api.oledCursor(${v(b, 'X')}, ${v(b, 'Y')});\n`;
  J['oled_size'] = b => `await api.oledSize(${b.getFieldValue('N')});\n`;
  J['oled_print'] = b => `await api.oledPrint(${v(b, 'V', J.ORDER_NONE, "''")});\n`;
  J['oled_pixel'] = b => `await api.oledPixel(${v(b, 'X')}, ${v(b, 'Y')}, ${b.getFieldValue('C')});\n`;
  J['oled_line'] = b => `await api.oledLine(${v(b, 'X0')}, ${v(b, 'Y0')}, ${v(b, 'X1')}, ${v(b, 'Y1')}, ${b.getFieldValue('C')});\n`;
  J['oled_rect'] = b => `await api.oledRect(${v(b, 'X')}, ${v(b, 'Y')}, ${v(b, 'W')}, ${v(b, 'H')}, ${b.getFieldValue('F') === '1'}, ${b.getFieldValue('C')});\n`;
  J['oled_circle'] = b => `await api.oledCircle(${v(b, 'X')}, ${v(b, 'Y')}, ${v(b, 'R')}, ${b.getFieldValue('F') === '1'}, ${b.getFieldValue('C')});\n`;
  J['oled_bitmap'] = b => { const o = Bitmap.parse(b.getFieldValue('BMP')); return `await api.oledBitmap(${v(b, 'X')}, ${v(b, 'Y')}, ${o.w}, ${o.h}, '${o.d}', ${b.getFieldValue('C')});\n`; };
  J['init_voltmeter_i2c'] = b => `await api.adsInit('${b.getFieldValue('ADDRESS')}', ${ADS_RANGE[b.getFieldValue('RANGE')]});\n`;
  J['read_voltmeter_differential'] = b => [`(await api.adsRead('${b.getFieldValue('ADDRESS')}', 'diff', ${b.getFieldValue('KANAL')}))`, J.ORDER_ATOMIC];
  J['read_voltmeter_channel'] = b => [`(await api.adsRead('${b.getFieldValue('ADDRESS')}', 'single', ${b.getFieldValue('KANAL')}))`, J.ORDER_ATOMIC];
  J['calculate_pmfc_power'] = b => {
    const u = v(b, 'VOLTAGE', J.ORDER_NONE), r = Number(b.getFieldValue('RESISTOR')) || 1, t = b.getFieldValue('OUTPUT_TYPE');
    return [t === 'MA' ? `((${u}) / ${r} * 1000)` : `(Math.pow(${u}, 2) / ${r} * ${t === 'UW' ? 1000000 : 1000})`, J.ORDER_ATOMIC];
  };
  J['init_ina219_i2c'] = b => `await api.inaInit('${b.getFieldValue('ADDRESS')}', '${b.getFieldValue('CALIBRATION')}');\n`;
  J['read_ina219_value'] = b => [`(await api.inaRead('${b.getFieldValue('ADDRESS')}', '${b.getFieldValue('MEASURE_MODE')}'))`, J.ORDER_ATOMIC];

  const t = (b, n) => v(b, n, J.ORDER_NONE, "''");
  J['com_usb_avail'] = () => ['(await api.usbAvail())', J.ORDER_ATOMIC];
  J['com_usb_text'] = () => ['api.usbText()', J.ORDER_ATOMIC];
  J['com_usb_num'] = () => ['api.usbNum()', J.ORDER_ATOMIC];
  J['com_wifi_connect'] = b => `await api.wifiConnect(${t(b, 'SSID')}, ${t(b, 'PW')});\n`;
  J['com_wifi_ap'] = b => `await api.wifiAp(${t(b, 'SSID')}, ${t(b, 'PW')});\n`;
  J['com_wifi_ok'] = () => ['api.wifiOk()', J.ORDER_ATOMIC];
  J['com_wifi_ip'] = () => ['api.wifiIp()', J.ORDER_ATOMIC];
  J['com_web_start'] = b => `await api.webStart(${t(b, 'T')});\n`;
  J['com_web_show'] = b => `await api.webShow(${JSON.stringify(b.getFieldValue('N'))}, ${t(b, 'V')});\n`;
  J['com_web_button'] = b => [`(await api.webButton(${JSON.stringify(b.getFieldValue('N'))}))`, J.ORDER_ATOMIC];
  J['com_web_slider'] = b => [`(await api.webSlider(${JSON.stringify(b.getFieldValue('N'))}))`, J.ORDER_ATOMIC];
  J['com_radio_init'] = b => `await api.radioInit(${Number(b.getFieldValue('G')) || 1});\n`;
  J['com_radio_send'] = b => `await api.radioSend(${t(b, 'V')});\n`;
  J['com_radio_avail'] = () => ['(await api.radioAvail())', J.ORDER_ATOMIC];
  J['com_radio_text'] = () => ['api.radioText()', J.ORDER_ATOMIC];
  J['com_radio_num'] = () => ['api.radioNum()', J.ORDER_ATOMIC];

  /* Funktionen: in der Simulation asynchron, damit „warten“ darin funktioniert */
  const procName = b => J.nameDB_.getName(b.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
  J['procedures_defnoreturn'] = J['procedures_defreturn'] = function (b) {
    const name = procName(b);
    const args = (b.argumentVarModels_ || []).map(m => vname(m.getId()));
    const branch = J.statementToCode(b, 'STACK');
    const ret = b.getInput('RETURN') ? J.valueToCode(b, 'RETURN', J.ORDER_NONE) : '';
    J.definitions_['%' + name] = `async function ${name}(${args.join(', ')}) {\n${branch}${ret ? '  return ' + ret + ';\n' : ''}}`;
    return null;
  };
  const callArgs = b => (b.arguments_ || []).map((_, i) => J.valueToCode(b, 'ARG' + i, J.ORDER_NONE) || '0').join(', ');
  J['procedures_callnoreturn'] = b => `await ${procName(b)}(${callArgs(b)});\n`;
  J['procedures_callreturn'] = b => [`(await ${procName(b)}(${callArgs(b)}))`, J.ORDER_ATOMIC];
  J['procedures_ifreturn'] = b => {
    let code = `if (${J.valueToCode(b, 'CONDITION', J.ORDER_NONE) || 'false'}) {\n`;
    code += b.hasReturnValue_ ? `  return ${J.valueToCode(b, 'VALUE', J.ORDER_NONE) || '0'};\n` : '  return;\n';
    return code + '}\n';
  };
}

function generateSimCode(ws) {
  let code = Blockly.JavaScript.workspaceToCode(ws);
  // Startwerte wie im C++-Code: Text-Variablen leer, alle anderen 0
  const types = inferVarTypes(ws), textNames = new Set();
  for (const m of ws.getAllVariables()) if (types[m.getId()] === 'String') textNames.add(Blockly.JavaScript.nameDB_.getName(m.getId(), Blockly.VARIABLE_CATEGORY_NAME));
  code = code.replace(/^var (.+);$/m, (m, names) => 'var ' + names.split(', ').map(n => n + (textNames.has(n) ? " = ''" : ' = 0')).join(', ') + ';');
  return code + '\nreturn { setup: typeof __setup === "function" ? __setup : null, loop: typeof __loop === "function" ? __loop : null };';
}

/* ---------------- Arduino-C++ ---------------- */
const FLOAT_BLOCKS = new Set(['com_usb_num', 'com_radio_num', 'ard_tmp36', 'ard_ultrasonic', 'read_voltmeter_differential', 'read_voltmeter_channel', 'calculate_pmfc_power', 'read_ina219_value']);
const STRING_BLOCKS = new Set(['text', 'ard_join', 'kp_key', 'com_usb_text', 'com_wifi_ip', 'com_radio_text']);
function valueType(b) {
  if (!b) return 'int';
  if (STRING_BLOCKS.has(b.type)) return 'String';
  if (FLOAT_BLOCKS.has(b.type)) return 'float';
  if (b.type === 'math_number') return Number.isInteger(Number(b.getFieldValue('NUM'))) ? 'int' : 'float';
  if (b.type === 'math_arithmetic') {
    if (b.getFieldValue('OP') === 'DIVIDE' || b.getFieldValue('OP') === 'POWER') return 'float';
    const t = [valueType(b.getInputTargetBlock('A')), valueType(b.getInputTargetBlock('B'))];
    return t.includes('float') ? 'float' : 'int';
  }
  if (b.type === 'variables_get') return (Arduino.varTypes_ && Arduino.varTypes_[b.getFieldValue('VAR')]) || 'int';
  if (b.type === 'ard_math1') return b.getFieldValue('OP') === 'SQRT' ? 'float' : valueType(b.getInputTargetBlock('V'));
  if (b.type === 'math_constrain') return widest(['VALUE', 'LOW', 'HIGH'].map(n => valueType(b.getInputTargetBlock(n))));
  if (b.type === 'procedures_callreturn') {
    const def = Blockly.Procedures.getDefinition(b.getProcedureCall(), b.workspace);
    return def && def.getInput('RETURN') ? valueType(def.getInputTargetBlock('RETURN')) : 'int';
  }
  return 'int';
}
const TYPE_RANK = { int: 0, float: 1, String: 2 };
const widest = ts => ts.reduce((a, t) => (TYPE_RANK[t] > TYPE_RANK[a] ? t : a), 'int');
function inferVarTypes(ws) {
  const types = {};
  const add = (id, t) => { if (!types[id] || TYPE_RANK[t] > TYPE_RANK[types[id]]) types[id] = t; };
  for (let pass = 0; pass < 3; pass++) {
    Arduino.varTypes_ = types;
    for (const b of ws.getAllBlocks(false)) {
      if (b.type === 'variables_set') add(b.getFieldValue('VAR'), valueType(b.getInputTargetBlock('VALUE')));
      else if (b.type === 'ard_count') add(b.getFieldValue('VAR'), widest(['FROM', 'TO', 'STEP'].map(n => valueType(b.getInputTargetBlock(n)))));
      else if (/^procedures_call/.test(b.type)) {
        // Typ der Funktions-Eingaben aus den Werten beim Aufruf ableiten (z. B. Kommazahl → float)
        const def = Blockly.Procedures.getDefinition(b.getProcedureCall(), ws);
        (def && def.argumentVarModels_ || []).forEach((m, i) => add(m.getId(), valueType(b.getInputTargetBlock('ARG' + i))));
      }
    }
  }
  return types;
}

(function () {
  const orig = Blockly.Names.prototype.safeName_;
  const map = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue', 'ß': 'ss' };
  Blockly.Names.prototype.safeName_ = function (name) {
    return orig.call(this, name ? String(name).replace(/[äöüÄÖÜß]/g, c => map[c]).normalize('NFD').replace(/[\u0300-\u036f]/g, '') : name);
  };
})();

const Arduino = new Blockly.Generator('Arduino');
Arduino.ORDER_ATOMIC = 0; Arduino.ORDER_UNARY = 3; Arduino.ORDER_MULT = 5; Arduino.ORDER_ADD = 6;
Arduino.ORDER_REL = 8; Arduino.ORDER_EQ = 9; Arduino.ORDER_AND = 13; Arduino.ORDER_OR = 14; Arduino.ORDER_NONE = 99;
Arduino.INDENT = '  ';
Arduino.addReservedWords('setup,loop,if,else,for,while,do,int,float,long,char,byte,void,return,break,continue,true,false,HIGH,LOW,INPUT,OUTPUT,String,Serial,delay,lcd,oled,pixels,tastenfeld,taste,millis,random,tone,noTone,pinMode,digitalWrite,digitalRead,analogWrite,analogRead,map,constrain,pow,min,max,abs');
Arduino.init = function (ws) {
  this.includes_ = {}; this.globals_ = {}; this.setupPre_ = {}; this.helpers_ = {}; this.functions_ = {};
  this.setupBody_ = ''; this.loopBody_ = ''; this.params_ = new Set(); this.bitmaps_ = {};
  if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_);
  else this.nameDB_.reset();
  this.nameDB_.setVariableMap(ws.getVariableMap());
  this.varTypes_ = inferVarTypes(ws);
  for (const b of ws.getAllBlocks(false)) if (/^procedures_def/.test(b.type)) (b.argumentVarModels_ || []).forEach(m => this.params_.add(m.getId()));
};
Arduino.finish = function () {
  const ws = this.workspace_ || Blockly.getMainWorkspace();
  const vars = Blockly.Variables.allUsedVarModels(ws).filter(v => !this.params_.has(v.getId()))
    .map(v => { const t = this.varTypes_[v.getId()] || 'int'; return `${t} ${this.nameDB_.getName(v.getId(), Blockly.VARIABLE_CATEGORY_NAME)} = ${t === 'String' ? '""' : '0'};`; });
  let out = '';
  const bt = BOARD === 'esp32' && BT_OPT.on;
  if (bt) {
    this.includes_.bt = '#include <NimBLEDevice.h>\n#include <Update.h>';
    this.helpers_ = Object.assign({ bt: btReceiverCode(btName(BT_OPT.name)) }, this.helpers_);
    this.setupPre_ = Object.assign({ bt: 'werkstattBluetooth(); // Bluetooth-Übertragung' }, this.setupPre_);
  }
  if (this.helpers_.web) {
    // Solange die Webseite läuft, beim Warten weiter Anfragen beantworten
    const w = t => t.replace(/\bdelay\(/g, 'werkstattWarten(');
    this.setupBody_ = w(this.setupBody_); this.loopBody_ = w(this.loopBody_);
    for (const k in this.functions_) this.functions_[k] = w(this.functions_[k]);
  }
  const inc = [...new Set(Object.values(this.includes_).join('\n').split('\n'))]; if (inc.length && inc[0]) out += inc.join('\n') + '\n\n';
  const glob = Object.values(this.globals_).concat(vars); if (glob.length) out += glob.join('\n') + '\n\n';
  const help = Object.values(this.helpers_); if (help.length) out += help.join('\n\n') + '\n\n';
  const fn = Object.values(this.functions_); if (fn.length) out += fn.join('\n\n') + '\n\n';
  out += 'void setup()\n{\n' + Object.values(this.setupPre_).map(l => '  ' + l + '\n').join('') + this.setupBody_ + '}\n\n';
  out += 'void loop()\n{\n' + this.loopBody_ + (this.helpers_.web ? '  werkstattWarten(10); // kurze Pause, Webseite bedienen\n}\n' : '  delay(10); // kurze Pause für stabilen Ablauf\n}\n');
  this.nameDB_.reset();
  return out;
};
Arduino.scrubNakedValue = line => line + ';\n';
Arduino.quote_ = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
Arduino.scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection && block.nextConnection.targetBlock();
  return code + (thisOnly ? '' : this.blockToCode(next));
};
(function () {
  const A = Arduino;
  const v = (b, n, ord, def) => A.valueToCode(b, n, ord || A.ORDER_NONE) || def || '0';
  const pinNum = (b, f) => b.getFieldValue(f || 'PIN');
  const mode = (p, m) => { A.setupPre_['pm' + p] = `pinMode(${p}, ${m});`; };
  const varName = id => A.nameDB_.getName(id, Blockly.VARIABLE_CATEGORY_NAME);
  const isNum = s => /^-?[\d.]+$/.test(s);
  const lcd = () => {
    A.includes_.lcd = '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>';
    A.globals_.lcd = 'LiquidCrystal_I2C lcd(0x27, 16, 2); // unser 1602-Display, Adresse 0x27';
  };
  const ms = (b, n) => { const d = v(b, n, A.ORDER_MULT); return isNum(d) ? String(Math.round(Number(d) * 1000)) : `1000 * ${d}`; };
  const rgb = h => `pixels.Color(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  const neo = () => { A.includes_.neo = '#include <Adafruit_NeoPixel.h>'; if (!A.globals_.neo) A.globals_.neo = 'Adafruit_NeoPixel pixels(8, 6, NEO_GRB + NEO_KHZ800);'; };

  A['ard_setup'] = b => { A.workspace_ = b.workspace; A.setupBody_ += A.statementToCode(b, 'DO'); return ''; };
  A['ard_loop'] = b => { A.workspace_ = b.workspace; A.loopBody_ += A.statementToCode(b, 'DO'); return ''; };
  A['ard_wait'] = b => `delay(${b.getFieldValue('UNIT') === 'S' ? ms(b, 'N') : v(b, 'N')}); // Wartezeit\n`;
  A['ard_count'] = b => {
    const n = varName(b.getFieldValue('VAR'));
    const from = v(b, 'FROM'), to = v(b, 'TO'), step = v(b, 'STEP', A.ORDER_NONE, '1');
    if (isNum(from) && isNum(to) && isNum(step)) {
      const up = Number(to) >= Number(from), s = Math.abs(Number(step)) || 1;
      return `for (${n} = ${from}; ${n} ${up ? '<=' : '>='} ${to}; ${n} ${up ? '+=' : '-='} ${s}) {\n${A.statementToCode(b, 'DO')}}\n`;
    }
    // Grenzen nur einmal auswerten (z. B. Sensorwert oder Zufallszahl als Grenze)
    const t = A.varTypes_[b.getFieldValue('VAR')] || 'int';
    const bis = A.nameDB_.getDistinctName(n + '_bis', Blockly.VARIABLE_CATEGORY_NAME), sw = A.nameDB_.getDistinctName(n + '_schritt', Blockly.VARIABLE_CATEGORY_NAME);
    return `{\n  ${t} ${bis} = ${to};\n  ${t} ${sw} = abs(${step});\n  if (${sw} == 0) ${sw} = 1;\n  ${n} = ${from};\n  if (${n} > ${bis}) ${sw} = -${sw};\n  for (; ${sw} > 0 ? ${n} <= ${bis} : ${n} >= ${bis}; ${n} += ${sw}) {\n${(c => c ? A.prefixLines(c, A.INDENT) : '')(A.statementToCode(b, 'DO'))}  }\n}\n`;
  };
  A['ard_builtin_led'] = b => {
    if (BOARD === 'esp32') { mode('2', 'OUTPUT'); return `digitalWrite(2, ${b.getFieldValue('V')}); // eingebaute blaue LED\n`; }
    mode('LED_BUILTIN', 'OUTPUT'); return `digitalWrite(LED_BUILTIN, ${b.getFieldValue('V')});\n`;
  };
  A['ard_digital_write'] = b => { mode(pinNum(b), 'OUTPUT'); return `digitalWrite(${pinNum(b)}, ${b.getFieldValue('V')});\n`; };
  A['ard_analog_write'] = b => { mode(pinNum(b), 'OUTPUT'); return `analogWrite(${pinNum(b)}, ${v(b, 'V')});\n`; };
  A['ard_servo'] = b => {
    const p = pinNum(b);
    A.includes_.servo = BOARD === 'esp32' ? '#include <ESP32Servo.h>' : '#include <Servo.h>';
    A.globals_['servo' + p] = `Servo servo_${p};`;
    A.setupPre_['servo' + p] = `servo_${p}.attach(${p}, 500, 2500);`;
    return `servo_${p}.write(${v(b, 'DEG')});\n`;
  };
  A['ard_tone'] = b => {
    const n = NOTES.find(x => x[1] === b.getFieldValue('NOTE'))[0] + { 0: '', 1: '#', '-1': 'b' }[b.getFieldValue('ACC')] + b.getFieldValue('OCT');
    return `tone(${pinNum(b)}, ${noteFreq(b.getFieldValue('NOTE'), b.getFieldValue('ACC'), b.getFieldValue('OCT'))}, ${ms(b, 'DUR')}); // Ton ${n}\n`;
  };
  A['ard_tone_freq'] = b => `tone(${pinNum(b)}, ${v(b, 'FREQ')}, ${ms(b, 'DUR')});\n`;
  A['ard_motor'] = b => {
    const ia = pinNum(b, 'IA'), ib = pinNum(b, 'IB');
    mode(ia, 'OUTPUT'); mode(ib, 'OUTPUT');
    A.helpers_.motor = '// Motortreiber (z. B. L9110S): richtung 1 = vorwärts, -1 = rückwärts, 0 = anhalten\nvoid motor(int ia, int ib, int richtung, int prozent)\n{\n  int pwm = constrain(prozent, 0, 100) * 255 / 100;\n  analogWrite(ia, richtung > 0 ? pwm : 0);\n  analogWrite(ib, richtung < 0 ? pwm : 0);\n}';
    return `motor(${ia}, ${ib}, ${b.getFieldValue('DIR')}, ${v(b, 'SPEED')});\n`;
  };
  A['ard_round'] = b => [`(long)${{ ROUND: 'round', UP: 'ceil', DOWN: 'floor' }[b.getFieldValue('OP')]}(${v(b, 'V')})`, A.ORDER_UNARY];
  A['ard_math1'] = b => [b.getFieldValue('OP') === 'ABS' ? `fabs(${v(b, 'V')})` : `sqrt(${v(b, 'V')})`, A.ORDER_ATOMIC];
  A['ard_notone'] = b => `noTone(${pinNum(b)});\n`;
  A['ard_serial'] = b => { A.setupPre_.serial = BOARD === 'esp32' ? 'Serial.begin(115200);' : 'Serial.begin(9600);'; return `Serial.${b.getFieldValue('NL') === 'Y' ? 'println' : 'print'}(${v(b, 'V', A.ORDER_NONE, '""')});\n`; };
  A['ard_lcd_init'] = () => { lcd(); return 'lcd.init();\n'; };
  A['ard_lcd_backlight'] = b => { lcd(); return b.getFieldValue('ON') === '1' ? 'lcd.backlight();\n' : 'lcd.noBacklight();\n'; };
  A['ard_lcd_clear'] = () => { lcd(); return 'lcd.clear();\n'; };
  A['ard_lcd_print'] = b => { lcd(); return `lcd.print(${A.charmap_(v(b, 'V', A.ORDER_NONE, '""'), A.lcdChars_)});\n`; };
  A['ard_lcd_pos'] = b => { lcd(); return `lcd.setCursor(${v(b, 'COL')}, ${v(b, 'ROW')});\n`; };
  A['ard_join'] = b => [`String(${v(b, 'A', A.ORDER_NONE, '""')}) + String(${v(b, 'B', A.ORDER_NONE, '""')})`, A.ORDER_ADD];
  A['ard_digital_read'] = b => { mode(pinNum(b), 'INPUT'); return [`digitalRead(${pinNum(b)})`, A.ORDER_ATOMIC]; };
  const apin = b => b.getFieldValue('PIN').replace(/^D/, '');
  A['ard_analog_read'] = b => [`analogRead(${apin(b)})`, A.ORDER_ATOMIC];
  A['ard_tmp36'] = b => {
    const c = BOARD === 'esp32' ? `((analogReadMilliVolts(${apin(b)}) / 1000.0 - 0.5) * 100.0)` : `((analogRead(${apin(b)}) * 5.0 / 1023.0 - 0.5) * 100.0)`;
    return [b.getFieldValue('UNIT') === 'C' ? c : `(${c} * 9.0 / 5.0 + 32.0)`, A.ORDER_ATOMIC];
  };
  A['ard_ultrasonic'] = b => {
    A.helpers_.us = 'long ultraschallLaufzeit(int trigger, int echo)\n{\n  pinMode(trigger, OUTPUT);\n  digitalWrite(trigger, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trigger, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigger, LOW);\n  pinMode(echo, INPUT);\n  return pulseIn(echo, HIGH);\n}';
    return [`(${b.getFieldValue('UNIT') === 'CM' ? '0.01723' : '0.00675'} * ultraschallLaufzeit(${pinNum(b, 'TRIG')}, ${pinNum(b, 'ECHO')}))`, A.ORDER_ATOMIC];
  };
  A['ard_map'] = b => [`map(${v(b, 'V')}, ${v(b, 'A')}, ${v(b, 'B')}, ${v(b, 'C')}, ${v(b, 'D')})`, A.ORDER_ATOMIC];

  A['neo_init'] = b => {
    neo();
    A.globals_.neo = `Adafruit_NeoPixel pixels(${Number(b.getFieldValue('N')) || 1}, ${pinNum(b)}, NEO_GRB + NEO_KHZ800);`;
    return 'pixels.begin();\npixels.clear();\npixels.show();\n';
  };
  A['neo_set'] = b => { neo(); return `pixels.setPixelColor(${v(b, 'I', A.ORDER_ADD)} - 1, ${rgb(b.getFieldValue('C'))});\npixels.show();\n`; };
  A['neo_set_rgb'] = b => { neo(); return `pixels.setPixelColor(${v(b, 'I', A.ORDER_ADD)} - 1, pixels.Color(${v(b, 'R')}, ${v(b, 'G')}, ${v(b, 'B')}));\npixels.show();\n`; };
  A['neo_fill'] = b => { neo(); return `pixels.fill(${rgb(b.getFieldValue('C'))});\npixels.show();\n`; };
  A['neo_brightness'] = b => { neo(); return `pixels.setBrightness(${v(b, 'V')});\npixels.show();\n`; };
  A['neo_clear'] = () => { neo(); return 'pixels.clear();\npixels.show();\n'; };

  const kp = (b, cols) => {
    const keys = KEYMAP[cols].map(r => '{' + r.map(k => `'${k}'`).join(', ') + '}').join(', ');
    const rows = [0, 1, 2, 3].map(i => b.getFieldValue('R' + i)).join(', ');
    const cps = Array.from({ length: cols }, (_, i) => b.getFieldValue('C' + i)).join(', ');
    A.includes_.kp = '#include <Keypad.h>';
    A.globals_.kp = `char tf_tasten[4][${cols}] = {${keys}};\nbyte tf_zeilen[4] = {${rows}};\nbyte tf_spalten[${cols}] = {${cps}};\nKeypad tastenfeld = Keypad(makeKeymap(tf_tasten), tf_zeilen, tf_spalten, 4, ${cols});\nString taste = "";`;
    return '';
  };
  A['kp_init3'] = b => kp(b, 3);
  A['kp_init4'] = b => kp(b, 4);
  A['kp_read'] = () => '{\n  char k = tastenfeld.getKey();\n  taste = k ? String(k) : String("");\n}\n';
  A['kp_key'] = () => ['taste', A.ORDER_ATOMIC];

  const oled = () => {
    A.includes_.oled = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>';
    A.globals_.oled = 'Adafruit_SSD1306 oled(128, 64, &Wire, -1); // OLED 128 x 64, I2C-Adresse 0x3C';
  };
  const oc = b => b.getFieldValue('C') === '1' ? 'SSD1306_WHITE' : 'SSD1306_BLACK';
  A['oled_init'] = () => { oled(); return 'oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);\noled.cp437(true); // Umlaute\noled.clearDisplay();\noled.setTextColor(SSD1306_WHITE);\noled.display();\n'; };
  A['oled_clear'] = () => { oled(); return 'oled.clearDisplay();\n'; };
  A['oled_show'] = () => { oled(); return 'oled.display();\n'; };
  A['oled_cursor'] = b => { oled(); return `oled.setCursor(${v(b, 'X')}, ${v(b, 'Y')});\n`; };
  A['oled_size'] = b => { oled(); return `oled.setTextSize(${b.getFieldValue('N')});\n`; };
  A['oled_print'] = b => { oled(); return `oled.print(${A.charmap_(v(b, 'V', A.ORDER_NONE, '""'), A.oledChars_)});\n`; };
  A['oled_pixel'] = b => { oled(); return `oled.drawPixel(${v(b, 'X')}, ${v(b, 'Y')}, ${oc(b)});\n`; };
  A['oled_line'] = b => { oled(); return `oled.drawLine(${v(b, 'X0')}, ${v(b, 'Y0')}, ${v(b, 'X1')}, ${v(b, 'Y1')}, ${oc(b)});\n`; };
  A['oled_rect'] = b => { oled(); return `oled.${b.getFieldValue('F') === '1' ? 'fillRect' : 'drawRect'}(${v(b, 'X')}, ${v(b, 'Y')}, ${v(b, 'W')}, ${v(b, 'H')}, ${oc(b)});\n`; };
  A['oled_circle'] = b => { oled(); return `oled.${b.getFieldValue('F') === '1' ? 'fillCircle' : 'drawCircle'}(${v(b, 'X')}, ${v(b, 'Y')}, ${v(b, 'R')}, ${oc(b)});\n`; };
  A['oled_bitmap'] = b => {
    oled();
    const o = Bitmap.parse(b.getFieldValue('BMP'));
    A.bitmaps_ = A.bitmaps_ || {};
    let name = A.bitmaps_[o.d];
    if (!name) {
      name = 'bild_' + (Object.keys(A.bitmaps_).length + 1);
      A.bitmaps_[o.d] = name;
      const bytes = o.d.match(/../g).map(h => '0x' + h);
      const rows = []; const rb = Math.ceil(o.w / 8);
      for (let i = 0; i < bytes.length; i += rb * Math.max(1, Math.floor(16 / rb))) rows.push('  ' + bytes.slice(i, i + rb * Math.max(1, Math.floor(16 / rb))).join(', '));
      A.globals_['bmp' + name] = `// Bild ${o.w} x ${o.h} Pixel (Grafikeditor)\nconst unsigned char ${name}[] PROGMEM = {\n${rows.join(',\n')}\n};`;
    }
    return `oled.drawBitmap(${v(b, 'X')}, ${v(b, 'Y')}, ${name}, ${o.w}, ${o.h}, ${oc(b)});\n`;
  };
  const ads = addr => 'ads_' + addr.slice(2);
  // Umlaute und ° für die Zeichensätze der Displays umsetzen (als Oktal-Escape im C++-Text)
  const charmap = (code, map) => code.replace(/[äöüÄÖÜß°]/g, ch => map[ch] ? '\\' + map[ch].toString(8) : ch);
  A.oledChars_ = { 'ä': 0x84, 'ö': 0x94, 'ü': 0x81, 'Ä': 0x8E, 'Ö': 0x99, 'Ü': 0x9A, 'ß': 0xE1, '°': 0xF8 };
  A.lcdChars_ = { 'ä': 0xE1, 'ö': 0xEF, 'ü': 0xF5, 'ß': 0xE2, '°': 0xDF };
  A.charmap_ = charmap;
  A['init_voltmeter_i2c'] = b => {
    const a = b.getFieldValue('ADDRESS');
    A.includes_.ads = '#include <Adafruit_ADS1X15.h>';
    A.globals_['ads' + a] = `Adafruit_ADS1115 ${ads(a)};`;
    const gain = { 6: 'GAIN_TWOTHIRDS', 4: 'GAIN_ONE', 2: 'GAIN_TWO', 1: 'GAIN_FOUR' }[b.getFieldValue('RANGE')];
    return `${ads(a)}.begin(${a});\n${ads(a)}.setGain(${gain});\n`;
  };
  A['read_voltmeter_differential'] = b => {
    const a = ads(b.getFieldValue('ADDRESS'));
    return [`${a}.computeVolts(${a}.readADC_Differential_${b.getFieldValue('KANAL') === '0' ? '0_1' : '2_3'}())`, A.ORDER_ATOMIC];
  };
  A['read_voltmeter_channel'] = b => { const a = ads(b.getFieldValue('ADDRESS')); return [`${a}.computeVolts(${a}.readADC_SingleEnded(${b.getFieldValue('KANAL')}))`, A.ORDER_ATOMIC]; };
  A['calculate_pmfc_power'] = b => {
    const u = v(b, 'VOLTAGE', A.ORDER_NONE), r = b.getFieldValue('RESISTOR'), t = b.getFieldValue('OUTPUT_TYPE');
    return [t === 'MA' ? `((${u}) / ${r}.0 * 1000.0)` : `(pow(${u}, 2) / ${r}.0 * ${t === 'UW' ? '1000000.0' : '1000.0'})`, A.ORDER_ATOMIC];
  };
  const ina = addr => 'ina_' + addr.slice(2);
  A['init_ina219_i2c'] = b => {
    const a = b.getFieldValue('ADDRESS');
    A.includes_.ina = '#include <Adafruit_INA219.h>';
    A.globals_['ina' + a] = `Adafruit_INA219 ${ina(a)}(${a});`;
    return `${ina(a)}.begin();\n${ina(a)}.setCalibration_${b.getFieldValue('CALIBRATION')}();\n`;
  };
  A['read_ina219_value'] = b => {
    const i = ina(b.getFieldValue('ADDRESS'));
    return [{ CURRENT: `${i}.getCurrent_mA()`, BUS_VOLT: `${i}.getBusVoltage_V()`, SHUNT_VOLT: `${i}.getShuntVoltage_mV()` }[b.getFieldValue('MEASURE_MODE')], A.ORDER_ATOMIC];
  };

  /* ---------- Kommunikation (ESP32) ---------- */
  const COM_USB = String.raw`// Über USB empfangen (serieller Monitor)
String usbText = "";
bool usbEmpfangen()
{
  if (Serial.available() > 0) {
    usbText = Serial.readStringUntil('\n');
    usbText.trim();
    return true;
  }
  return false;
}`;
  const COM_WIFI = String.raw`// WLAN
void wlanVerbinden(String name, String passwort)
{
  WiFi.mode(WIFI_STA);
  WiFi.begin(name.c_str(), passwort.c_str());
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) delay(200);
}

void wlanOeffnen(String name, String passwort)
{
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(name.c_str(), passwort.length() >= 8 ? passwort.c_str() : NULL);
}

bool wlanVerbunden()
{
  return WiFi.status() == WL_CONNECTED || (WiFi.getMode() & WIFI_AP);
}

String eigeneIP()
{
  if (WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
  if (WiFi.getMode() & WIFI_AP) return WiFi.softAPIP().toString();
  return "0.0.0.0";
}`;
  const COM_WEB = String.raw`// Eigene Webseite: Werte anzeigen, Knöpfe und Schieberegler
WebServer webServer(80);
String webTitel = "ESP32";
const int WEB_MAX = 12;
String webWertName[WEB_MAX], webWert[WEB_MAX], webKnopfName[WEB_MAX], webReglerName[WEB_MAX];
bool webKnopfDruck[WEB_MAX];
int webReglerWert[WEB_MAX];
int webWerte = 0, webKnoepfe = 0, webRegler = 0;

int webPlatz(String *namen, int &anzahl, const String &name)
{
  for (int i = 0; i < anzahl; i++) if (namen[i] == name) return i;
  if (anzahl >= WEB_MAX) return -1;
  namen[anzahl] = name;
  return anzahl++;
}

void webAnzeigen(const String &name, const String &wert)
{
  int i = webPlatz(webWertName, webWerte, name);
  if (i >= 0) webWert[i] = wert;
}

bool webKnopf(const String &name)
{
  int i = webPlatz(webKnopfName, webKnoepfe, name);
  if (i < 0 || !webKnopfDruck[i]) return false;
  webKnopfDruck[i] = false;
  return true;
}

int webSchieberegler(const String &name)
{
  int i = webPlatz(webReglerName, webRegler, name);
  return i < 0 ? 0 : webReglerWert[i];
}

String webJson(const String &s)
{
  String r = "\"";
  for (unsigned int i = 0; i < s.length(); i++) {
    char c = s[i];
    if ((unsigned char)c < 32) continue;
    if (c == '"' || c == '\\') r += '\\';
    r += c;
  }
  return r + "\"";
}

void webDaten()
{
  String j = "{\"titel\":" + webJson(webTitel) + ",\"werte\":[";
  for (int i = 0; i < webWerte; i++) j += String(i ? "," : "") + "[" + webJson(webWertName[i]) + "," + webJson(webWert[i]) + "]";
  j += "],\"knoepfe\":[";
  for (int i = 0; i < webKnoepfe; i++) j += String(i ? "," : "") + webJson(webKnopfName[i]);
  j += "],\"regler\":[";
  for (int i = 0; i < webRegler; i++) j += String(i ? "," : "") + "[" + webJson(webReglerName[i]) + "," + String(webReglerWert[i]) + "]";
  j += "]}";
  webServer.send(200, "application/json", j);
}

const char WEB_SEITE[] PROGMEM = R"seite(<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>ESP32</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f3f5f2;color:#222}h1{margin:0;padding:16px;background:#137a7f;color:#fff;font-size:22px}
main{padding:12px;max-width:520px;margin:auto}.k{background:#fff;border-radius:10px;padding:12px 14px;margin:10px 0;box-shadow:0 1px 3px #0002;display:flex;justify-content:space-between;align-items:center;gap:10px}
.k b{font-size:20px}button{font:inherit;font-size:18px;padding:12px;border:0;border-radius:10px;background:#137a7f;color:#fff;width:100%;margin:6px 0}input{width:100%}</style></head>
<body><h1 id="t">ESP32</h1><main><div id="w"></div><div id="s"></div></main><script>
var bau = '';
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function lade() {
  fetch('/daten').then(function (r) { return r.json(); }).then(function (d) {
    document.getElementById('t').textContent = d.titel; document.title = d.titel;
    var w = document.getElementById('w'); w.innerHTML = '';
    d.werte.forEach(function (p) { var k = el('div', 'k'); k.appendChild(el('span', '', p[0])); k.appendChild(el('b', '', p[1])); w.appendChild(k); });
    var neu = JSON.stringify([d.knoepfe, d.regler.map(function (r) { return r[0]; })]);
    if (neu === bau) return;
    bau = neu; var s = document.getElementById('s'); s.innerHTML = '';
    d.knoepfe.forEach(function (n, i) { var b = el('button', '', n); b.onclick = function () { fetch('/knopf?i=' + i); }; s.appendChild(b); });
    d.regler.forEach(function (r, i) {
      var k = el('div', 'k'), v = el('b', '', r[1]), e = el('input');
      k.appendChild(el('span', '', r[0])); k.appendChild(v);
      e.type = 'range'; e.min = 0; e.max = 100; e.value = r[1];
      e.oninput = function () { v.textContent = e.value; };
      e.onchange = function () { fetch('/regler?i=' + i + '&w=' + e.value); };
      s.appendChild(k); s.appendChild(e);
    });
  }).catch(function () {});
}
lade(); setInterval(lade, 1000);
</script></body></html>)seite";

void webStarten(const String &titel)
{
  webTitel = titel;
  webServer.on("/", []() { webServer.send_P(200, "text/html", WEB_SEITE); });
  webServer.on("/daten", webDaten);
  webServer.on("/knopf", []() {
    int i = webServer.arg("i").toInt();
    if (i >= 0 && i < webKnoepfe) webKnopfDruck[i] = true;
    webServer.send(200, "text/plain", "ok");
  });
  webServer.on("/regler", []() {
    int i = webServer.arg("i").toInt();
    if (i >= 0 && i < webRegler) webReglerWert[i] = constrain(webServer.arg("w").toInt(), 0, 100);
    webServer.send(200, "text/plain", "ok");
  });
  webServer.begin();
}

// Warten, währenddessen die Webseite weiter beantworten
void werkstattWarten(unsigned long ms)
{
  unsigned long start = millis();
  do {
    webServer.handleClient();
    delay(1);
  } while (millis() - start < ms);
}`;
  const COM_RADIO = String.raw`// Funk zwischen ESP32 (ESP-NOW, ohne WLAN-Router)
uint8_t funkGruppe = 1;
volatile bool funkNeu = false;
char funkPuffer[201];
String funkText = "";

#if ESP_ARDUINO_VERSION_MAJOR >= 3
void funkEmpfang(const esp_now_recv_info_t *info, const uint8_t *daten, int n)
#else
void funkEmpfang(const uint8_t *mac, const uint8_t *daten, int n)
#endif
{
  if (n < 1 || daten[0] != funkGruppe || funkNeu) return;
  n = n - 1;
  if (n > 200) n = 200;
  memcpy(funkPuffer, daten + 1, n);
  funkPuffer[n] = 0;
  funkNeu = true;
}

void funkEinrichten(int gruppe)
{
  funkGruppe = gruppe;
  if (WiFi.getMode() == WIFI_MODE_NULL) WiFi.mode(WIFI_STA);
  esp_now_init();
  esp_now_register_recv_cb(funkEmpfang);
  esp_now_peer_info_t partner = {};
  memset(partner.peer_addr, 0xFF, 6);
  partner.channel = 0;
  partner.encrypt = false;
  esp_now_add_peer(&partner);
}

void funkSenden(const String &text)
{
  uint8_t puffer[201];
  int n = text.length();
  if (n > 199) n = 199;
  puffer[0] = funkGruppe;
  memcpy(puffer + 1, text.c_str(), n);
  uint8_t alle[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  esp_now_send(alle, puffer, n + 1);
}

bool funkEmpfangen()
{
  if (!funkNeu) return false;
  funkText = String(funkPuffer);
  funkNeu = false;
  return true;
}`;
  const usb = () => { A.setupPre_.serial = 'Serial.begin(115200);'; A.helpers_.usb = COM_USB; };
  const wifi = () => { A.includes_.wifi = '#include <WiFi.h>'; A.helpers_.wifi = COM_WIFI; };
  const web = () => { A.includes_.wifi = '#include <WiFi.h>'; A.includes_.web = '#include <WebServer.h>'; A.helpers_.web = COM_WEB; };
  const radio = () => { A.includes_.wifi = '#include <WiFi.h>'; A.includes_.radio = '#include <esp_now.h>'; A.helpers_.radio = COM_RADIO; };
  const str = (b, n) => `String(${v(b, n, A.ORDER_NONE, '""')})`;
  A['com_usb_avail'] = () => { usb(); return ['usbEmpfangen()', A.ORDER_ATOMIC]; };
  A['com_usb_text'] = () => { usb(); return ['usbText', A.ORDER_ATOMIC]; };
  A['com_usb_num'] = () => { usb(); return ['usbText.toFloat()', A.ORDER_ATOMIC]; };
  A['com_wifi_connect'] = b => { wifi(); return `wlanVerbinden(${str(b, 'SSID')}, ${str(b, 'PW')});\n`; };
  A['com_wifi_ap'] = b => { wifi(); return `wlanOeffnen(${str(b, 'SSID')}, ${str(b, 'PW')});\n`; };
  A['com_wifi_ok'] = () => { wifi(); return ['wlanVerbunden()', A.ORDER_ATOMIC]; };
  A['com_wifi_ip'] = () => { wifi(); return ['eigeneIP()', A.ORDER_ATOMIC]; };
  A['com_web_start'] = b => { web(); return `webStarten(${str(b, 'T')});\n`; };
  A['com_web_show'] = b => { web(); return `webAnzeigen(${A.quote_(b.getFieldValue('N'))}, ${str(b, 'V')});\n`; };
  A['com_web_button'] = b => { web(); return [`webKnopf(${A.quote_(b.getFieldValue('N'))})`, A.ORDER_ATOMIC]; };
  A['com_web_slider'] = b => { web(); return [`webSchieberegler(${A.quote_(b.getFieldValue('N'))})`, A.ORDER_ATOMIC]; };
  A['com_radio_init'] = b => { radio(); return `funkEinrichten(${Number(b.getFieldValue('G')) || 1});\n`; };
  A['com_radio_send'] = b => { radio(); return `funkSenden(${str(b, 'V')});\n`; };
  A['com_radio_avail'] = () => { radio(); return ['funkEmpfangen()', A.ORDER_ATOMIC]; };
  A['com_radio_text'] = () => { radio(); return ['funkText', A.ORDER_ATOMIC]; };
  A['com_radio_num'] = () => { radio(); return ['funkText.toFloat()', A.ORDER_ATOMIC]; };
  // Kommunikationsblöcke gibt es nur für den ESP32: beim Arduino Uno nichts erzeugen (sonst Übersetzungsfehler)
  for (const k of Object.keys(A).filter(k => /^com_/.test(k))) {
    const gen = A[k];
    A[k] = b => {
      if (BOARD === 'esp32') return gen(b);
      return b.outputConnection ? ['0', A.ORDER_ATOMIC] : '// (Block nur mit dem ESP32 möglich)\n';
    };
  }

  A['controls_if'] = b => {
    let code = '', n = 0;
    do {
      code += (n ? ' else ' : '') + `if (${v(b, 'IF' + n, A.ORDER_NONE, 'false')}) {\n${A.statementToCode(b, 'DO' + n)}}`;
      n++;
    } while (b.getInput('IF' + n));
    if (b.getInput('ELSE')) code += ` else {\n${A.statementToCode(b, 'ELSE')}}`;
    return code + '\n';
  };
  A['controls_repeat_ext'] = b => {
    const c = A.nameDB_.getDistinctName('zaehler', Blockly.VARIABLE_CATEGORY_NAME);
    const n = v(b, 'TIMES', A.ORDER_REL);
    if (isNum(n)) return `for (int ${c} = 0; ${c} < ${n}; ${c}++) {\n${A.statementToCode(b, 'DO')}}\n`;
    // Anzahl nur einmal auswerten (z. B. Zufallszahl)
    return `for (int ${c} = 0, ${c}_ende = ${v(b, 'TIMES', A.ORDER_NONE)}; ${c} < ${c}_ende; ${c}++) {\n${A.statementToCode(b, 'DO')}}\n`;
  };
  A['controls_whileUntil'] = b => {
    let cond = v(b, 'BOOL', A.ORDER_NONE, 'false');
    if (b.getFieldValue('MODE') === 'UNTIL') cond = `!(${cond})`;
    return `while (${cond}) {\n${A.statementToCode(b, 'DO')}}\n`;
  };
  A['logic_compare'] = b => {
    const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')];
    const ord = (op === '==' || op === '!=') ? A.ORDER_EQ : A.ORDER_REL;
    // Text mit Zahl vergleichen (z. B. gedrückte Taste = 5): Zahl als Text vergleichen, sonst Übersetzungsfehler
    const ta = valueType(b.getInputTargetBlock('A')), tb = valueType(b.getInputTargetBlock('B'));
    if ((ta === 'String') !== (tb === 'String')) {
      const s = n => (valueType(b.getInputTargetBlock(n)) === 'String' ? v(b, n, ord) : `String(${v(b, n, A.ORDER_NONE)})`);
      return [`${s('A')} ${op} ${s('B')}`, ord];
    }
    return [`${v(b, 'A', ord)} ${op} ${v(b, 'B', ord)}`, ord];
  };
  A['logic_operation'] = b => {
    const and = b.getFieldValue('OP') === 'AND'; const ord = and ? A.ORDER_AND : A.ORDER_OR;
    return [`${v(b, 'A', ord, 'false')} ${and ? '&&' : '||'} ${v(b, 'B', ord, 'false')}`, ord];
  };
  A['logic_negate'] = b => [`!${v(b, 'BOOL', A.ORDER_UNARY, 'true')}`, A.ORDER_UNARY];
  A['logic_boolean'] = b => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', A.ORDER_ATOMIC];
  A['math_number'] = b => [String(b.getFieldValue('NUM')), A.ORDER_ATOMIC];
  A['math_arithmetic'] = b => {
    const t = { ADD: ['+', A.ORDER_ADD], MINUS: ['-', A.ORDER_ADD], MULTIPLY: ['*', A.ORDER_MULT], DIVIDE: ['/', A.ORDER_MULT], POWER: [null, A.ORDER_NONE] }[b.getFieldValue('OP')];
    if (!t[0]) return [`pow(${v(b, 'A')}, ${v(b, 'B')})`, A.ORDER_ATOMIC];
    if (t[0] === '/') { const a = v(b, 'A', t[1]); return [`${isNum(a) && !a.includes('.') ? a + '.0' : '(float)' + a} / ${v(b, 'B', t[1] - 0.5)}`, t[1]]; }
    return [`${v(b, 'A', t[1])} ${t[0]} ${v(b, 'B', t[1] - 0.5)}`, t[1]];
  };
  A['math_modulo'] = b => [`(int)(${v(b, 'DIVIDEND')}) % (int)(${v(b, 'DIVISOR')})`, A.ORDER_MULT];
  A['math_constrain'] = b => [`constrain(${v(b, 'VALUE')}, ${v(b, 'LOW')}, ${v(b, 'HIGH')})`, A.ORDER_ATOMIC];
  A['math_random_int'] = b => [`random(${v(b, 'FROM')}, ${v(b, 'TO', A.ORDER_ADD)} + 1)`, A.ORDER_ATOMIC];
  A['text'] = b => [A.quote_(b.getFieldValue('TEXT')), A.ORDER_ATOMIC];
  A['variables_get'] = b => [varName(b.getFieldValue('VAR')), A.ORDER_ATOMIC];
  A['variables_set'] = b => {
    const val = v(b, 'VALUE', A.ORDER_NONE, '0');
    // Text-Variable bekommt eine Zahl: in Text umwandeln
    const wrap = A.varTypes_[b.getFieldValue('VAR')] === 'String' && valueType(b.getInputTargetBlock('VALUE')) !== 'String';
    return `${varName(b.getFieldValue('VAR'))} = ${wrap ? `String(${val})` : val};\n`;
  };
  A['math_change'] = b => `${varName(b.getFieldValue('VAR'))} += ${v(b, 'DELTA')};\n`;

  const procName = b => A.nameDB_.getName(b.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
  A['procedures_defnoreturn'] = A['procedures_defreturn'] = b => {
    const name = procName(b);
    const params = (b.argumentVarModels_ || []).map(m => `${A.varTypes_[m.getId()] || 'int'} ${varName(m.getId())}`);
    const hasRet = !!b.getInput('RETURN');
    const retBlock = hasRet ? b.getInputTargetBlock('RETURN') : null;
    const type = hasRet ? valueType(retBlock) : 'void';
    const branch = A.statementToCode(b, 'STACK');
    const ret = hasRet ? `  return ${v(b, 'RETURN', A.ORDER_NONE, '0')};\n` : '';
    A.functions_[name] = `${type} ${name}(${params.join(', ')})\n{\n${branch}${ret}}`;
    return null;
  };
  const callArgs = b => (b.arguments_ || []).map((_, i) => v(b, 'ARG' + i)).join(', ');
  A['procedures_callnoreturn'] = b => `${procName(b)}(${callArgs(b)});\n`;
  A['procedures_callreturn'] = b => [`${procName(b)}(${callArgs(b)})`, A.ORDER_ATOMIC];
  A['procedures_ifreturn'] = b => `if (${v(b, 'CONDITION', A.ORDER_NONE, 'false')}) {\n  return${b.hasReturnValue_ ? ' ' + v(b, 'VALUE') : ''};\n}\n`;
})();

function generateArduinoCode(ws) {
  Arduino.workspace_ = ws;
  return Arduino.workspaceToCode(ws);
}
