# ESP32-C5: Auswahl, Vorlage, Pins in den Blöcken, Simulation (eingebaute LED, LED an D4), erzeugter C++-Code, Speichern/Laden
from playwright.sync_api import sync_playwright
OUT = '/tmp/claude-0/t/'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1500, 'height': 900})
    err = []; pg.on('pageerror', lambda e: err.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(1200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.select_option('#boardSel', 'esp32c5'); pg.wait_for_timeout(400)
    print('Auswahl:', pg.evaluate('[BOARD, ESP_CHIP, boardKey()]'))
    vis = pg.evaluate("[...document.querySelectorAll('.part')].filter(p => p.style.display !== 'none' && p.dataset.mcu).map(p => p.dataset.type)")
    tpl = pg.evaluate("[...document.querySelectorAll('.part')].filter(p => p.style.display !== 'none' && /^template/.test(p.dataset.type)).map(p => p.textContent.trim())")
    print('Mikrocontroller in der Leiste:', vis, '| Vorlagen:', tpl)
    pg.evaluate("""() => {
      const C = App.circuit; C.load({ components: [], wires: [] }); C.addTemplate(400, 400, true);
      const P = C.project, bb = P.components.find(c => c.type === 'breadboard'), m = P.components.find(c => c.def.mcu);
      const h = (c, r) => ({ c: bb.id, p: c + r });
      const led = makeComp('led', bb.x + 20 + 9 * 10, bb.y + 110, 0, { color: 'rot' }, C.newId('c')); P.components.push(led);
      const r = makeComp('resistor', bb.x + 20 + 10 * 10, bb.y + 130, 0, { ohm: 220 }, C.newId('c')); P.components.push(r);
      P.wires.push({ id: C.newId('w'), a: { c: m.id, p: 'D4' }, b: h(10, 'j'), color: 'blau', pts: [] });
      P.wires.push({ id: C.newId('w'), a: h(15, 'j'), b: { c: bb.id, p: 'bm-15' }, color: 'schwarz', pts: [] });
      C.renderAll(); C.fitView(); App.changed();
    }""")
    pg.wait_for_timeout(300)
    print('MCU in Schaltung:', pg.evaluate("App.project.components.filter(c => c.def.mcu).map(c => c.type)"))
    pg.screenshot(path=OUT + 'c5_vorlage.png')
    xml = '''<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="20" y="20"><statement name="DO">
      <block type="ard_lcd_init"><next><block type="ard_lcd_print"><value name="V"><shadow type="text"><field name="TEXT">Hallo C5</field></shadow></value></block></next></block></statement></block>
      <block type="ard_loop" x="20" y="220"><statement name="DO"><block type="ard_builtin_led"><field name="V">HIGH</field><next><block type="ard_digital_write"><field name="PIN">4</field><field name="V">HIGH</field><next><block type="ard_serial"><field name="NL">Y</field><value name="V"><block type="ard_analog_read"><field name="PIN">D2</field></block></value><next><block type="ard_wait"><field name="UNIT">MS</field><value name="N"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block></next></block></next></block></next></block></statement></block></xml>'''
    pg.evaluate("x => { App.setMode('code'); const ws = App.workspace; ws.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), ws); }", xml)
    pg.wait_for_timeout(500)
    print('Pins im Block:', pg.evaluate("Blockly.getMainWorkspace().getAllBlocks().filter(b => b.type === 'ard_digital_write').map(b => b.getField('PIN').getOptions().map(o => o[0]).join(' '))"))
    print('Analog-Pins:', pg.evaluate("Blockly.getMainWorkspace().getAllBlocks().filter(b => b.type === 'ard_analog_read').map(b => b.getField('PIN').getOptions().map(o => o[0]).join(' '))"))
    code = pg.evaluate("generateArduinoCode(App.workspace)")
    open(OUT + 'c5_code.ino', 'w').write(code)
    print('Code (Auszug):', [l.strip() for l in code.splitlines() if 'LED_BUILTIN' in l or 'Wire' in l or 'analogRead' in l][:6])

    pg.evaluate("App.setMode('parts')"); pg.wait_for_timeout(200)
    pg.click('#simBtn'); pg.wait_for_timeout(1500)
    print('Sim läuft:', pg.evaluate('App.sim.running'), '| LED D27:', pg.evaluate("JSON.stringify(App.sim.outputs['D27'])"), '| D4:', pg.evaluate("JSON.stringify(App.sim.outputs['D4'])"))
    pg.screenshot(path=OUT + 'c5_sim.png')
    pg.click('#simBtn'); pg.wait_for_timeout(300)
    d = pg.evaluate("App.projectData ? App.projectData() : null")
    print('Gespeichert board/chip:', d and (d.get('board'), d.get('chip')))
    hints = pg.evaluate("(() => { try { return Advisor.run ? 'ok' : 'x'; } catch (e) { return String(e); } })()")
    print('Fehler:', err)
    b.close()
