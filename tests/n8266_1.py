# ESP8266 NodeMCU: Auswahl, Vorlage, Pins, Kommunikation ohne Bluetooth, Simulation (LED an D4 invertiert), Code für den echten Compiler
# und: Datei-Menü liegt im Code-Modus über der Blockleiste
from playwright.sync_api import sync_playwright
OUT = '/tmp/claude-0/t/'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1500, 'height': 900})
    err = []; pg.on('pageerror', lambda e: err.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(1200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.select_option('#boardSel', 'esp8266'); pg.wait_for_timeout(400)
    print('Auswahl:', pg.evaluate('[BOARD, ESP_CHIP, boardKey(), boardName()]'))
    print('MCU in der Leiste:', pg.evaluate("[...document.querySelectorAll('.part')].filter(p => p.style.display !== 'none' && p.dataset.mcu).map(p => p.dataset.type)"))
    pg.evaluate("App.setExtensions(['comm'])")
    pg.evaluate("""() => {
      const C = App.circuit; C.load({ components: [], wires: [] }); C.addTemplate(400, 400, true);
      const P = C.project, bb = P.components.find(c => c.type === 'breadboard'), m = P.components.find(c => c.def.mcu);
      const h = (c, r) => ({ c: bb.id, p: c + r });
      P.components.push(makeComp('led', bb.x + 20 + 9 * 10, bb.y + 110, 0, { color: 'gruen' }, C.newId('c')));
      P.components.push(makeComp('resistor', bb.x + 20 + 10 * 10, bb.y + 130, 0, { ohm: 220 }, C.newId('c')));
      P.wires.push({ id: C.newId('w'), a: { c: m.id, p: 'D5' }, b: h(10, 'j'), color: 'blau', pts: [] });
      P.wires.push({ id: C.newId('w'), a: h(15, 'j'), b: { c: bb.id, p: 'bm-15' }, color: 'schwarz', pts: [] });
      C.renderAll(); C.fitView(); App.changed();
    }""")
    xml = '''<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="20" y="20"><statement name="DO">
      <block type="ard_lcd_init"><next><block type="com_wifi_ap"><value name="SSID"><shadow type="text"><field name="TEXT">ESP-Tisch-01</field></shadow></value><value name="PW"><shadow type="text"><field name="TEXT">werkstatt</field></shadow></value>
      <next><block type="com_web_start"><value name="T"><shadow type="text"><field name="TEXT">Mein NodeMCU</field></shadow></value><next><block type="com_radio_init"><field name="G">3</field>
      <next><block type="com_bt_init"><value name="N"><shadow type="text"><field name="TEXT">BT</field></shadow></value></block></next></block></next></block></next></block></next></block></statement></block>
      <block type="ard_loop" x="20" y="320"><statement name="DO"><block type="ard_builtin_led"><field name="V">HIGH</field><next><block type="ard_digital_write"><field name="PIN">D5</field><field name="V">HIGH</field>
      <next><block type="com_web_show"><field name="N">Licht</field><value name="V"><block type="ard_analog_read"><field name="PIN">A0</field></block></value>
      <next><block type="com_radio_send"><value name="V"><shadow type="text"><field name="TEXT">Hallo</field></shadow></value>
      <next><block type="ard_wait"><field name="UNIT">MS</field><value name="N"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block></next></block></next></block></next></block></next></block></statement></block></xml>'''
    pg.evaluate("x => { App.setMode('code'); const ws = App.workspace; ws.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), ws); App.markBoardBlocks(); }", xml)
    pg.wait_for_timeout(500)
    print('Pins (Ausgang):', pg.evaluate("Blockly.getMainWorkspace().getAllBlocks().filter(b => b.type === 'ard_digital_write').map(b => b.getField('PIN').getOptions().map(o => o[0]).join(' '))"))
    print('BT-Block-Warnung:', pg.evaluate("Blockly.getMainWorkspace().getAllBlocks().filter(b => b.type === 'com_bt_init').map(b => b.warning && b.warning.getText ? b.warning.getText() : String(!!b.warning))"))
    tb = pg.evaluate("buildToolbox(App.extensions)")
    print('Werkzeugkasten: WLAN', 'com_wifi_connect' in tb, '| Webseite', 'com_web_start' in tb, '| Funk', 'com_radio_init' in tb, '| Bluetooth', 'com_bt_init' in tb)
    code = pg.evaluate("(Uploader.app = App, Uploader.fullCode())")
    open(OUT + 'n8266_code.ino', 'w').write(code)
    print('Code:', [l.strip() for l in code.splitlines() if any(k in l for k in ['LED_BUILTIN, ', 'D5,', 'espnow', 'ESP8266WebServer', 'Bluetooth', 'analogRead'])][:9])
    # Datei-Menü im Code-Modus
    pg.click('#fileBtn'); pg.wait_for_timeout(300)
    top = pg.evaluate("(() => { const r = document.querySelector('#fileMenu').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 20, r.top + r.height / 2); return !!e.closest('#fileMenu'); })()")
    print('Datei-Menü oben:', top)
    pg.screenshot(path=OUT + 'n8266_menu.png', clip={'x': 0, 'y': 0, 'width': 700, 'height': 500})
    pg.keyboard.press('Escape'); pg.mouse.click(900, 600); pg.wait_for_timeout(200)
    pg.evaluate("App.setMode('parts')"); pg.wait_for_timeout(200)
    pg.click('#simBtn'); pg.wait_for_timeout(1500)
    print('Sim läuft:', pg.evaluate('App.sim.running'), '| D4 (LED, invertiert):', pg.evaluate("JSON.stringify(App.sim.outputs['D4'])"), '| D5:', pg.evaluate("JSON.stringify(App.sim.outputs['D5'])"))
    pg.screenshot(path=OUT + 'n8266_sim.png')
    pg.click('#simBtn'); pg.wait_for_timeout(300)
    d = pg.evaluate("App.projectData()")
    print('Gespeichert board/chip:', d.get('board'), d.get('chip'))
    print('Fehler:', err)
    b.close()
