"""Jumper am Relais per Klick umstecken (Bauteilansicht und Simulation)"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Neu';f.proj.value='Jumper'+Date.now()}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.evaluate("""()=>{const C=App.circuit; C.load({components:[],wires:[]}); C.addTemplate(365,430);
      const P=C.project, bb=P.components.find(c=>c.type==='breadboard'), uno=P.components.find(c=>c.def.mcu);
      const r=makeComp('relay', bb.x+200, bb.y-40, 0, {}, 'c950'); P.components.push(r);
      P.wires.push({id:'w950',a:{c:r.id,p:'VCC'},b:{c:bb.id,p:'tp-25'},pts:[],color:'rot'},{id:'w951',a:{c:r.id,p:'GND'},b:{c:uno.id,p:'GND_1'},pts:[],color:'schwarz'},{id:'w952',a:{c:r.id,p:'IN'},b:{c:uno.id,p:'D7'},pts:[],color:'blau'});
      App.setExtensions(['motoren']); C.renderAll(); C.fitView();
      const xml='<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="30" y="30"></block><block type="ard_loop" x="30" y="150"><statement name="DO"><block type="ard_digital_write"><field name="PIN">7</field><field name="V">HIGH</field></block></statement></block></xml>';
      App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), App.workspace);}""")
    pg.wait_for_timeout(300)
    st = lambda: pg.evaluate("()=>[App.project.components.find(c=>c.id==='c950').props.trig, (document.querySelector('#props select[data-prop=trig]')||{}).value, (App.circuit.states['c950']||{}).on]")
    def click():
        j = pg.locator('[data-id="c950"] .jumper rect').first.bounding_box()
        pg.mouse.click(j['x']+j['width']/2, j['y']+j['height']/2); pg.wait_for_timeout(300)
    print('Start:', st())
    click(); print('Klick 1:', st())
    click(); print('Klick 2:', st())
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(800)
    print('Simulation, D7 HOCH:', st())
    click(); pg.wait_for_timeout(300); print('Simulation, umgesteckt:', st())
    pg.screenshot(path='rel4.png')
    pg.evaluate("()=>App.stopSim()")
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); print('Strg+Z:', st())
    print('Fehler:', errs)
    b.close()
