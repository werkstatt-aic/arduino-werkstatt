/* Code für den echten Arduino/ESP32 (C++): Typen, Codeerzeugung, Bluetooth-Empfänger, Kommunikation */
'use strict';

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

/* ---------------- Arduino-C++ ---------------- */
const FLOAT_BLOCKS = new Set(['ard_dht', 'com_usb_num', 'com_radio_num', 'com_bt_num', 'ard_tmp36', 'ard_ultrasonic', 'read_voltmeter_differential', 'read_voltmeter_channel', 'calculate_pmfc_power', 'read_ina219_value']);
const STRING_BLOCKS = new Set(['text', 'ard_join', 'kp_key', 'com_usb_text', 'com_wifi_ip', 'com_radio_text', 'com_bt_text']);
function valueType(b) {
  if (!b) return 'int';
  if (STRING_BLOCKS.has(b.type)) return 'String';
  if (FLOAT_BLOCKS.has(b.type)) return 'float';
  if (b.type === 'math_number') return Number.isInteger(Number(b.getFieldValue('NUM'))) ? 'int' : 'float';
  if (b.type === 'math_arithmetic') {
    if (b.getFieldValue('OP') === 'DIVIDE' || b.getFieldValue('OP') === 'POWER') return 'float';
    const w = widest([valueType(b.getInputTargetBlock('A')), valueType(b.getInputTargetBlock('B'))]);
    return w === 'String' ? 'float' : w;
  }
  if (b.type === 'variables_get') return (Arduino.varTypes_ && Arduino.varTypes_[b.getFieldValue('VAR')]) || 'int';
  if (b.type === 'ard_millis') return b.getFieldValue('U') === 'S' ? 'float' : 'long';
  if (b.type === 'ard_math1') return b.getFieldValue('OP') === 'SQRT' ? 'float' : valueType(b.getInputTargetBlock('V'));
  if (b.type === 'math_constrain') return widest(['VALUE', 'LOW', 'HIGH'].map(n => valueType(b.getInputTargetBlock(n))));
  if (b.type === 'list_get') return listType(b.getFieldValue('L'));
  if (b.type === 'list_stat') {
    const t = listType(b.getFieldValue('L')), op = b.getFieldValue('OP');
    return op === 'AVG' ? 'float' : op === 'SUM' && t === 'int' ? 'long' : t;
  }
  if (b.type === 'procedures_callreturn') {
    const def = Blockly.Procedures.getDefinition(b.getProcedureCall(), b.workspace);
    return def && def.getInput('RETURN') ? valueType(def.getInputTargetBlock('RETURN')) : 'int';
  }
  return 'int';
}
const TYPE_RANK = { int: 0, long: 1, float: 2, String: 3 };
/* Listen enthalten nur Zahlen: int, long oder float */
const listType = id => { const t = (Arduino.listTypes_ || {})[id] || 'int'; return t === 'String' ? 'float' : t; };
const widest = ts => ts.reduce((a, t) => (TYPE_RANK[t] > TYPE_RANK[a] ? t : a), 'int');
function inferVarTypes(ws) {
  const types = {};
  const add = (id, t) => { if (!types[id] || TYPE_RANK[t] > TYPE_RANK[types[id]]) types[id] = t; };
  const lists = {};
  const addL = (id, t) => { if (t === 'String') t = 'float'; if (!lists[id] || TYPE_RANK[t] > TYPE_RANK[lists[id]]) lists[id] = t; };
  Arduino.listTypes_ = lists;
  for (let pass = 0; pass < 3; pass++) {
    Arduino.varTypes_ = types;
    for (const b of ws.getAllBlocks(false)) {
      if (b.type === 'list_set' || b.type === 'list_push') addL(b.getFieldValue('L'), valueType(b.getInputTargetBlock('V')));
      else if (b.type === 'list_init') addL(b.getFieldValue('L'), parseListNumbers(b.getFieldValue('V')).every(Number.isInteger) ? 'int' : 'float');
      else if (b.type === 'list_new' || b.type === 'list_clear') addL(b.getFieldValue('L'), 'int');
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
Arduino.addReservedWords('setup,loop,if,else,for,while,do,int,float,long,char,byte,void,return,break,continue,true,false,HIGH,LOW,INPUT,OUTPUT,String,Serial,delay,lcd,oled,pixels,tastenfeld,taste,millis,random,tone,noTone,pinMode,digitalWrite,digitalRead,analogWrite,analogRead,map,constrain,pow,min,max,abs,motor,ultraschallLaufzeit,schrittmotor,fahrzeug,fahrzeugPins,fahrzeugEinrichten,fahrzeugFahre,schrittPhase,listenStelle,listeMittelwert,listeSumme,listeMinimum,listeMaximum,lround,labs');
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
  const used = Blockly.Variables.allUsedVarModels(ws).filter(v => !this.params_.has(v.getId()));
  const vars = used.filter(v => v.type !== 'Liste')
    .map(v => { const t = this.varTypes_[v.getId()] || 'int'; return `${t} ${this.nameDB_.getName(v.getId(), Blockly.VARIABLE_CATEGORY_NAME)} = ${t === 'String' ? '""' : '0'};`; });
  // Listen: feste Größe (größte Anlege-Anweisung), die Anzahl kann beim Anlegen kleiner sein
  for (const v of used.filter(m => m.type === 'Liste')) {
    let size = 0;
    for (const b of ws.getAllBlocks(false)) {
      if (b.getFieldValue('L') !== v.getId()) continue;
      if (b.type === 'list_new') size = Math.max(size, Number(b.getFieldValue('N')) || 1);
      if (b.type === 'list_init') size = Math.max(size, parseListNumbers(b.getFieldValue('V')).length);
    }
    size = Math.max(1, Math.min(100, size || 10));
    const n = this.nameDB_.getName(v.getId(), Blockly.VARIABLE_CATEGORY_NAME);
    vars.push(`${listType(v.getId())} ${n}[${size}] = {0}; // Liste „${v.name}“\nint ${n}_anzahl = ${size};`);
  }
  let out = '';
  const bt = hasBT() && BT_OPT.on;
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
  // Wird ein Anschluss geschaltet und auch gelesen (z. B. Zustand der LED anzeigen), bleibt er ein Ausgang:
  // digitalRead liefert dann den eingestellten Zustand. Ein bloßes INPUT überschreibt nie einen anderen Modus.
  const mode = (p, m) => { const k = 'pm' + p; if (m === 'INPUT' && A.setupPre_[k]) return; A.setupPre_[k] = `pinMode(${p}, ${m});`; };
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
  A['ard_wait_until'] = b => `while (!(${v(b, 'C', A.ORDER_NONE, 'true')})) {\n  delay(10); // warten, bis die Bedingung erfüllt ist\n}\n`;
  A['ard_millis'] = b => [b.getFieldValue('U') === 'S' ? '(millis() / 1000.0)' : 'millis()', A.ORDER_ATOMIC];
  A['ard_builtin_led'] = b => {
    if (is8266()) { mode('LED_BUILTIN', 'OUTPUT'); return `digitalWrite(LED_BUILTIN, ${b.getFieldValue('V') === 'HIGH' ? 'LOW' : 'HIGH'}); // eingebaute blaue LED (leuchtet bei NIEDRIG)\n`; }
    if (isC5()) { mode('LED_BUILTIN', 'OUTPUT'); return `digitalWrite(LED_BUILTIN, ${b.getFieldValue('V')}); // eingebaute RGB-LED (leuchtet weiß)\n`; }
    if (BOARD === 'esp32') { mode('2', 'OUTPUT'); return `digitalWrite(2, ${b.getFieldValue('V')}); // eingebaute blaue LED\n`; }
    mode('LED_BUILTIN', 'OUTPUT'); return `digitalWrite(LED_BUILTIN, ${b.getFieldValue('V')});\n`;
  };
  A['ard_digital_write'] = b => { mode(pinNum(b), 'OUTPUT'); return `digitalWrite(${pinNum(b)}, ${b.getFieldValue('V')});\n`; };
  A['ard_analog_write'] = b => { mode(pinNum(b), 'OUTPUT'); return `analogWrite(${pinNum(b)}, ${v(b, 'V')});\n`; };
  A['ard_servo'] = b => {
    const p = pinNum(b);
    A.includes_.servo = BOARD === 'esp32' && !is8266() ? '#include <ESP32Servo.h>' : '#include <Servo.h>';
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
    A.helpers_.motor = '// Motortreiber L298N (IN1/IN2 bzw. IN3/IN4): richtung 1 = vorwärts, -1 = rückwärts, 0 = anhalten\nvoid motor(int ia, int ib, int richtung, int prozent)\n{\n  int pwm = constrain(prozent, 0, 100) * 255 / 100;\n  analogWrite(ia, richtung < 0 ? pwm : 0); // rückwärts: IN1 (bzw. IN3)\n  analogWrite(ib, richtung > 0 ? pwm : 0); // vorwärts: IN2 (bzw. IN4)\n}';
    return `motor(${ia}, ${ib}, ${b.getFieldValue('DIR')}, ${v(b, 'SPEED')});\n`;
  };
  // Fahrzeug mit zwei Motoren am Motortreiber
  const carHelper = () => {
    A.helpers_.motor = '// Motortreiber L298N (IN1/IN2 bzw. IN3/IN4): richtung 1 = vorwärts, -1 = rückwärts, 0 = anhalten\nvoid motor(int ia, int ib, int richtung, int prozent)\n{\n  int pwm = constrain(prozent, 0, 100) * 255 / 100;\n  analogWrite(ia, richtung < 0 ? pwm : 0); // rückwärts: IN1 (bzw. IN3)\n  analogWrite(ib, richtung > 0 ? pwm : 0); // vorwärts: IN2 (bzw. IN4)\n}';
    A.helpers_.zcar = `// Fahrzeug mit zwei Motoren: je Seite -100 (voll rückwärts) bis 100 (voll vorwärts)
int fahrzeugPins[4] = {-1, -1, -1, -1};
void fahrzeugEinrichten(int la, int lb, int ra, int rb)
{
  fahrzeugPins[0] = la; fahrzeugPins[1] = lb; fahrzeugPins[2] = ra; fahrzeugPins[3] = rb;
  for (int i = 0; i < 4; i++) pinMode(fahrzeugPins[i], OUTPUT);
}
void fahrzeug(int links, int rechts)
{
  if (fahrzeugPins[0] < 0) return; // „Fahrzeug einrichten“ fehlt
  links = constrain(links, -100, 100); rechts = constrain(rechts, -100, 100);
  motor(fahrzeugPins[0], fahrzeugPins[1], links > 0 ? 1 : (links < 0 ? -1 : 0), abs(links));
  // der rechte Motor ist um 180° gedreht eingebaut: vorwärts heißt für ihn rückwärts
  motor(fahrzeugPins[2], fahrzeugPins[3], rechts > 0 ? -1 : (rechts < 0 ? 1 : 0), abs(rechts));
}
// art: 0 vorwärts, 1 rückwärts, 2 Linkskurve, 3 Rechtskurve, 4 links drehen, 5 rechts drehen
void fahrzeugFahre(int art, int tempo)
{
  tempo = constrain(tempo, 0, 100);
  int k = (tempo + 1) / 3; // inneres Rad in der Kurve
  switch (art) {
    case 0: fahrzeug(tempo, tempo); break;
    case 1: fahrzeug(-tempo, -tempo); break;
    case 2: fahrzeug(k, tempo); break;
    case 3: fahrzeug(tempo, k); break;
    case 4: fahrzeug(-tempo, tempo); break;
    case 5: fahrzeug(tempo, -tempo); break;
  }
}`;
  };
  A['car_init'] = b => { carHelper(); return `fahrzeugEinrichten(${['LA', 'LB', 'RA', 'RB'].map(f => pinNum(b, f)).join(', ')});\n`; };
  A['car_drive'] = b => { carHelper(); const art = { FWD: 0, BWD: 1, CL: 2, CR: 3, TL: 4, TR: 5 }[b.getFieldValue('DIR')]; return `fahrzeugFahre(${art}, ${v(b, 'SPEED')}); // ${b.getField('DIR').getText()}\n`; };
  A['car_stop'] = () => { carHelper(); return 'fahrzeug(0, 0); // anhalten\n'; };
  A['car_motors'] = b => { carHelper(); return `fahrzeug(${v(b, 'L')}, ${v(b, 'R')});\n`; };
  A['ard_stepper'] = b => {
    A.helpers_.stepper = `// Schrittmotor 28BYJ-48 mit Treiber ULN2003: 2048 Schritte = 1 Umdrehung, höchstens 15 U/min
int schrittPhase[40];
void schrittmotor(int in1, int in2, int in3, int in4, long schritte, float upm)
{
  const byte spulen[4][4] = {{1, 1, 0, 0}, {0, 1, 1, 0}, {0, 0, 1, 1}, {1, 0, 0, 1}};
  int pins[4] = {in1, in2, in3, in4};
  for (int i = 0; i < 4; i++) pinMode(pins[i], OUTPUT);
  upm = constrain(upm, 1, 15);
  unsigned long pause = (unsigned long)(60000000.0 / (2048.0 * upm)); // Mikrosekunden je Schritt
  int richtung = schritte < 0 ? -1 : 1;
  int &phase = schrittPhase[in1 % 40];
  for (long s = 0; s < labs(schritte); s++) {
    phase = (phase + richtung + 4) % 4;
    for (int i = 0; i < 4; i++) digitalWrite(pins[i], spulen[phase][i]);
    delayMicroseconds(pause % 1000);
    delay(pause / 1000);
  }
  for (int i = 0; i < 4; i++) digitalWrite(pins[i], LOW); // Spulen aus, damit nichts warm wird
}`;
    const ps = [1, 2, 3, 4].map(i => pinNum(b, 'P' + i)).join(', ');
    const n = v(b, 'N', A.ORDER_MULT), u = b.getFieldValue('UNIT');
    let steps = u === 'STEP' ? n : u === 'REV' ? `${n} * 2048` : `${n} * 2048.0 / 360.0`;
    if (isNum(n)) steps = String(Math.round(Number(n) * (u === 'STEP' ? 1 : u === 'REV' ? 2048 : 2048 / 360)));
    else steps = `lround(${steps})`;
    if (b.getFieldValue('DIR') === 'CCW') steps = isNum(steps) ? '-' + steps : `-(${steps})`;
    return `schrittmotor(${ps}, ${steps}, ${v(b, 'RPM', A.ORDER_NONE, '10')}); // ${{ DEG: 'Grad', REV: 'Umdrehungen', STEP: 'Schritte' }[u]}, ${b.getFieldValue('DIR') === 'CCW' ? 'gegen den Uhrzeigersinn' : 'im Uhrzeigersinn'}\n`;
  };
  A['ard_dht'] = b => {
    const p = pinNum(b), m = b.getFieldValue('MODEL');
    A.includes_.dht = '#include <DHT.h>';
    A.globals_['dht' + p] = `DHT dht_${p}(${p}, DHT${m}); // Temperatur- und Feuchtesensor DHT${m}`;
    A.setupPre_['dht' + p] = `dht_${p}.begin();`;
    const w = b.getFieldValue('WHAT');
    return [w === 'H' ? `dht_${p}.readHumidity()` : `dht_${p}.readTemperature(${w === 'F' ? 'true' : ''})`, A.ORDER_ATOMIC];
  };
  /* Listen */
  const lst = b => varName(b.getFieldValue('L'));
  const listPos = () => { A.helpers_.listPos = '// Listen: Nummer 1 … Anzahl in die Stelle 0 … Anzahl-1 umrechnen (außerhalb: erster bzw. letzter Eintrag)\nint listenStelle(long nummer, int anzahl)\n{\n  if (nummer < 1 || anzahl < 1) return 0;\n  if (nummer > anzahl) return anzahl - 1;\n  return nummer - 1;\n}'; };
  A['list_new'] = b => { const l = lst(b), n = Math.max(1, Math.min(100, Number(b.getFieldValue('N')) || 1)); return `${l}_anzahl = ${n};\nfor (int i = 0; i < ${n}; i++) ${l}[i] = 0;\n`; };
  A['list_init'] = b => { const l = lst(b), z = parseListNumbers(b.getFieldValue('V')); return `${l}_anzahl = ${z.length};\n` + z.map((x, i) => `${l}[${i}] = ${x};`).join(' ') + (z.length ? '\n' : ''); };
  A['list_get'] = b => { listPos(); const l = lst(b); return [`${l}[listenStelle(${v(b, 'I', A.ORDER_NONE, '1')}, ${l}_anzahl)]`, A.ORDER_ATOMIC]; };
  A['list_set'] = b => { listPos(); const l = lst(b); return `${l}[listenStelle(${v(b, 'I', A.ORDER_NONE, '1')}, ${l}_anzahl)] = ${v(b, 'V')};\n`; };
  A['list_push'] = b => { const l = lst(b); return `for (int i = 0; i + 1 < ${l}_anzahl; i++) ${l}[i] = ${l}[i + 1]; // alle eins nach vorne\nif (${l}_anzahl > 0) ${l}[${l}_anzahl - 1] = ${v(b, 'V')};\n`; };
  A['list_clear'] = b => { const l = lst(b); return `for (int i = 0; i < ${l}_anzahl; i++) ${l}[i] = 0; // Liste leeren\n`; };
  A['list_len'] = b => [`${lst(b)}_anzahl`, A.ORDER_ATOMIC];
  A['list_stat'] = b => {
    const t = listType(b.getFieldValue('L')), op = b.getFieldValue('OP');
    const sumT = t === 'int' ? 'long' : t;
    const H = {
      AVG: `float listeMittelwert(const ${t} *liste, int anzahl)\n{\n  float summe = 0;\n  for (int i = 0; i < anzahl; i++) summe += liste[i];\n  return anzahl > 0 ? summe / anzahl : 0;\n}`,
      SUM: `${sumT} listeSumme(const ${t} *liste, int anzahl)\n{\n  ${sumT} summe = 0;\n  for (int i = 0; i < anzahl; i++) summe += liste[i];\n  return summe;\n}`,
      MIN: `${t} listeMinimum(const ${t} *liste, int anzahl)\n{\n  ${t} m = liste[0];\n  for (int i = 1; i < anzahl; i++) if (liste[i] < m) m = liste[i];\n  return m;\n}`,
      MAX: `${t} listeMaximum(const ${t} *liste, int anzahl)\n{\n  ${t} m = liste[0];\n  for (int i = 1; i < anzahl; i++) if (liste[i] > m) m = liste[i];\n  return m;\n}`,
    };
    A.helpers_['list' + op + t] = H[op];
    const fn = { AVG: 'listeMittelwert', SUM: 'listeSumme', MIN: 'listeMinimum', MAX: 'listeMaximum' }[op];
    return [`${fn}(${lst(b)}, ${lst(b)}_anzahl)`, A.ORDER_ATOMIC];
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
    const c = is8266() ? `((analogRead(A0) * 3.3 / 1023.0 - 0.5) * 100.0)` : BOARD === 'esp32' ? `((analogReadMilliVolts(${apin(b)}) / 1000.0 - 0.5) * 100.0)` : `((analogRead(${apin(b)}) * 5.0 / 1023.0 - 0.5) * 100.0)`;
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
  webServer.sendHeader("Cache-Control", "no-store");
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
  fetch('/daten', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
    document.getElementById('t').textContent = d.titel; document.title = d.titel;
    var w = document.getElementById('w'); w.innerHTML = '';
    d.werte.forEach(function (p) { var k = el('div', 'k'); k.appendChild(el('span', '', p[0])); k.appendChild(el('b', '', p[1])); w.appendChild(k); });
    var neu = JSON.stringify([d.knoepfe, d.regler.map(function (r) { return r[0]; })]);
    if (neu === bau) return;
    bau = neu; var s = document.getElementById('s'); s.innerHTML = '';
    d.knoepfe.forEach(function (n, i) { var b = el('button', '', n); b.onclick = function () { fetch('/knopf?i=' + i + '&t=' + Date.now(), { cache: 'no-store' }); }; s.appendChild(b); });
    d.regler.forEach(function (r, i) {
      var k = el('div', 'k'), v = el('b', '', r[1]), e = el('input');
      k.appendChild(el('span', '', r[0])); k.appendChild(v);
      e.type = 'range'; e.min = 0; e.max = 100; e.value = r[1];
      e.oninput = function () { v.textContent = e.value; };
      e.onchange = function () { fetch('/regler?i=' + i + '&w=' + e.value + '&t=' + Date.now(), { cache: 'no-store' }); };
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
  // ESP8266: ESP-NOW hat eine andere Schnittstelle (espnow.h)
  const COM_RADIO_8266 = String.raw`// Funk zwischen ESP8266 und ESP32 (ESP-NOW, ohne WLAN-Router)
uint8_t funkGruppe = 1;
volatile bool funkNeu = false;
char funkPuffer[201];
String funkText = "";

void funkEmpfang(uint8_t *mac, uint8_t *daten, uint8_t n)
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
  if (WiFi.getMode() == WIFI_OFF) WiFi.mode(WIFI_STA);
  esp_now_init();
  esp_now_set_self_role(ESP_NOW_ROLE_COMBO);
  esp_now_register_recv_cb(funkEmpfang);
  uint8_t alle[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  esp_now_add_peer(alle, ESP_NOW_ROLE_COMBO, 0, NULL, 0);
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
  const WIFI_H = () => is8266() ? '#include <ESP8266WiFi.h>' : '#include <WiFi.h>';
  const usb = () => { A.setupPre_.serial = 'Serial.begin(115200);'; A.helpers_.usb = COM_USB; };
  const wifi = () => { A.includes_.wifi = WIFI_H(); A.helpers_.wifi = COM_WIFI; };
  const web = () => { A.includes_.wifi = WIFI_H(); A.includes_.web = is8266() ? '#include <ESP8266WebServer.h>\nusing WebServer = ESP8266WebServer;' : '#include <WebServer.h>'; A.helpers_.web = COM_WEB; };
  const radio = () => { A.includes_.wifi = WIFI_H(); A.includes_.radio = is8266() ? '#include <espnow.h>' : '#include <esp_now.h>'; A.helpers_.radio = is8266() ? COM_RADIO_8266 : COM_RADIO; };
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
  const COM_BLE = String.raw`// Bluetooth (BLE-UART): Nachrichten mit einer Handy-App oder dem seriellen Monitor der Werkstatt austauschen
#define BT_UART "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define BT_RX   "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define BT_TX   "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
static NimBLECharacteristic *btSenden = nullptr;
static volatile bool btNeu = false;     // fertige Nachricht liegt bereit
static volatile size_t btLaenge = 0;    // so viele Zeichen sind schon angekommen
static volatile unsigned long btZeit = 0;
static char btPuffer[201];
String btText = "";

class BtEmpfangCb : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo &info) override {
    if (btNeu) return; // vorige Nachricht wurde noch nicht abgeholt
    btZeit = millis();
    NimBLEAttValue v = c->getValue();
    for (size_t i = 0; i < v.size(); i++) {
      char z = (char)v.data()[i];
      if (z == '\n' || z == '\r') { if (btLaenge > 0) { btPuffer[btLaenge] = 0; btNeu = true; return; } continue; }
      if (btLaenge < 200) btPuffer[btLaenge++] = z;
    }
    btZeit = millis();
  }
};

void btEinrichten(String name)
{
  // Ist die Bluetooth-Übertragung eingeschaltet, läuft Bluetooth schon (mit deren Namen)
  bool neu = !NimBLEDevice::isInitialized();
  if (neu) NimBLEDevice::init(name.c_str());
  NimBLEServer *server = NimBLEDevice::createServer();
  server->advertiseOnDisconnect(true);
  NimBLEAdvertising *werbung = NimBLEDevice::getAdvertising();
  werbung->stop();
  NimBLEService *dienst = server->createService(BT_UART);
  dienst->createCharacteristic(BT_RX, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR)->setCallbacks(new BtEmpfangCb());
  btSenden = dienst->createCharacteristic(BT_TX, NIMBLE_PROPERTY::NOTIFY);
  dienst->start();
  server->start();
  if (neu) {
    werbung->addServiceUUID(BT_UART);
    werbung->enableScanResponse(true);
    werbung->setName(name.c_str());
  }
  werbung->start();
}

bool btVerbunden()
{
  return NimBLEDevice::getServer() != nullptr && NimBLEDevice::getServer()->getConnectedCount() > 0;
}

void btSende(String text)
{
  if (btSenden == nullptr || !btVerbunden()) return;
  text += "\n";
  for (unsigned int i = 0; i < text.length(); i += 20) { // in kleinen Stücken senden
    String teil = text.substring(i, i + 20);
    btSenden->setValue((const uint8_t *)teil.c_str(), teil.length());
    btSenden->notify();
    delay(5);
  }
}

bool btEmpfangen()
{
  // Nachricht ohne Zeilenende (manche Apps): nach 100 ms Pause gilt sie als fertig
  if (!btNeu && btLaenge > 0 && millis() - btZeit > 100) { btPuffer[btLaenge] = 0; btNeu = true; }
  if (!btNeu) return false;
  btText = String(btPuffer);
  btLaenge = 0;
  btNeu = false;
  return true;
}`;
  const ble = () => { A.includes_.ble = '#include <NimBLEDevice.h>'; A.helpers_.ble = COM_BLE; };
  A['com_bt_init'] = b => { ble(); return `btEinrichten(${str(b, 'N')});\n`; };
  A['com_bt_send'] = b => { ble(); return `btSende(${str(b, 'V')});\n`; };
  A['com_bt_conn'] = () => { ble(); return ['btVerbunden()', A.ORDER_ATOMIC]; };
  A['com_bt_avail'] = () => { ble(); return ['btEmpfangen()', A.ORDER_ATOMIC]; };
  A['com_bt_text'] = () => { ble(); return ['btText', A.ORDER_ATOMIC]; };
  A['com_bt_num'] = () => { ble(); return ['btText.toFloat()', A.ORDER_ATOMIC]; };
  // Kommunikationsblöcke gibt es nur für den ESP32: beim Arduino Uno nichts erzeugen (sonst Übersetzungsfehler)
  for (const k of Object.keys(A).filter(k => /^com_/.test(k))) {
    const gen = A[k];
    A[k] = b => {
      if (BOARD === 'esp32' && (hasBT() || !/^com_bt_/.test(k))) return gen(b);
      return b.outputConnection ? ['0', A.ORDER_ATOMIC] : (is8266() ? '// (Bluetooth gibt es beim ESP8266 nicht)\n' : '// (Block nur mit dem ESP32 möglich)\n');
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
