from playwright.sync_api import sync_playwright
N=lambda s:f'<shadow type="math_number"><field name="NUM">{s}</field></shadow>'
XML=f'''<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="t">t</variable></variables>
<block type="ard_setup" x="0" y="0"><statement name="DO"><block type="ard_wait_until"><value name="C"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="ard_digital_read"><field name="PIN">2</field></block></value><value name="B">{N(1)}</value></block></value>
<next><block type="variables_set"><field name="VAR" id="t">t</field><value name="VALUE"><block type="ard_millis"><field name="U">MS</field></block></value><next><block type="ard_serial"><value name="V"><block type="ard_millis"><field name="U">S</field></block></value></block></next></block></next></block></statement></block></xml>'''
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    print('Tische:', pg.evaluate("()=>[...document.querySelectorAll('#dlgForm select[name=tisch] option')].map(o=>o.value).slice(-2)"))
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='18';f.nach.value='Neu';f.proj.value='Funktionen'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    # Vorlage + Taster
    pg.evaluate("()=>{App.circuit.addTemplate(365,430,false); const bb=App.project.components.find(c=>c.type==='breadboard'); App.circuit.addComponent('led', bb.x+100, bb.y+60);}"); pg.wait_for_timeout(300)
    # Strg+D
    n0=pg.evaluate("App.project.components.length"); pg.evaluate("()=>{App.focusArea='circuit'}"); pg.keyboard.press('Control+d'); pg.wait_for_timeout(300)
    print('Verdoppeln:', n0, '->', pg.evaluate("App.project.components.length"))
    # Kabel ziehen: Grundfarbe
    pg.evaluate("""()=>{const C=App.circuit; const u=App.project.components.find(c=>c.type==='uno'); const bb=App.project.components.find(c=>c.type==='breadboard');
      C.wiring={start:{c:u.id,p:'D7'},pts:[]}; C.finishWire({c:bb.id,p:'20a'});}""")
    w=pg.evaluate("()=>App.project.wires[App.project.wires.length-1]"); print('Neue Leitung:', w['color'], w['b'])
    # Endpunkt umstecken per Maus
    pg.evaluate("()=>App.circuit.select({kind:'wire', id: App.project.wires[App.project.wires.length-1].id})"); pg.wait_for_timeout(200)
    h=pg.locator('.wire-endh[data-end=b]').bounding_box(); tgt=pg.locator(f".comp-breadboard .pin[data-pin='25a']").bounding_box()
    pg.mouse.move(h['x']+h['width']/2, h['y']+h['height']/2); pg.mouse.down(); pg.mouse.move(tgt['x']+tgt['width']/2, tgt['y']+tgt['height']/2, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    print('Umgesteckt nach:', pg.evaluate("()=>App.project.wires[App.project.wires.length-1].b"))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); print('Rückgängig:', pg.evaluate("()=>App.project.wires[App.project.wires.length-1].b"))
    # Hilfe
    pg.click('#helpBtn'); pg.wait_for_timeout(300); print('Hilfe:', pg.inner_text('#dlgForm h2')); pg.screenshot(path='f1_help.png'); pg.keyboard.press('Escape')
    # warten bis / Zeit seit Start
    pg.evaluate('(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace);}', XML)
    code=pg.evaluate("()=>generateArduinoCode(App.workspace)"); open('/tmp/claude-0/cpp/out/f1.cpp','w').write(code)
    print(code[code.index('long'):code.index('long')+12], '|', code[code.index('void setup'):].split('void loop')[0].replace('\n',' '))
    pg.evaluate("()=>{App.circuit.load({components:[],wires:[]}); App.circuit.addTemplate(365,430,false); App.circuit.addComponent('button', 300, 200);}")
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(800); s1=pg.inner_text('#serial')
    pg.evaluate("()=>{const u=App.project.components.find(c=>c.type==='uno'); App.sim.outputs={}; }")
    print('Serial vor Bedingung:', repr(s1))
    print('Fehler:', errs)
