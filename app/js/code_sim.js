/* Code für die Simulation (JavaScript): jeder Block wird zu einem Aufruf der Simulations-Schnittstelle */
'use strict';

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
  J['ard_wait_until'] = b => `while (!(${v(b, 'C', J.ORDER_NONE, 'true')})) { await api.wait(10); }\n`;
  J['ard_millis'] = b => [`api.millis(${b.getFieldValue('U') === 'S' ? 1000 : 1})`, J.ORDER_ATOMIC];
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
  J['com_bt_init'] = b => `await api.btInit(${t(b, 'N')});\n`;
  J['com_bt_send'] = b => `await api.btSend(${t(b, 'V')});\n`;
  J['com_bt_conn'] = () => ['api.btConn()', J.ORDER_ATOMIC];
  J['com_bt_avail'] = () => ['(await api.btAvail())', J.ORDER_ATOMIC];
  J['com_bt_text'] = () => ['api.btText()', J.ORDER_ATOMIC];
  J['com_bt_num'] = () => ['api.btNum()', J.ORDER_ATOMIC];

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
