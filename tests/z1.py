from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='18';f.vor.value='Pruef';f.proj.value='Teile'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const l=document.querySelector('#partList'); l.scrollTop=l.scrollHeight;}"); pg.wait_for_timeout(300)
    pg.locator('#parts').screenshot(path='z1a.png')
    # ESP-Block im Uno-Projekt
    pg.select_option('#boardSel','esp32'); pg.wait_for_timeout(300); pg.evaluate("()=>App.setExtensions(['comm'])")
    pg.evaluate("""()=>{const x='<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="20" y="20"><statement name="DO"><block type="com_radio_init"><field name="G">3</field><next><block type="ard_serial"><value name="V"><block type="com_wifi_ip"></block></value></block></next></block></statement></block></xml>'; App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace);}""")
    pg.select_option('#boardSel','uno'); pg.wait_for_timeout(500)
    print('Uno-Code:', pg.evaluate("()=>generateArduinoCode(App.workspace)").split('void setup()')[1][:160].replace('\n',' | '))
    print('Warnung:', pg.evaluate("()=>App.workspace.getAllBlocks(false).filter(b=>/^com_/.test(b.type)).map(b=>!!b.warning)"))
    # Steckplatine verschieben: Knickpunkte wandern mit
    pg.select_option('#boardSel','uno'); pg.evaluate("()=>{App.circuit.load({components:[],wires:[]}); App.circuit.addTemplate(365,430,false);}")
    before = pg.evaluate("()=>App.project.wires.find(w=>w.a.p==='bp-29').pts[0]")
    bb = pg.evaluate("()=>{const c=App.project.components.find(c=>c.type==='breadboard'); const r=App.circuit.svg.querySelector(`.comp[data-id=\"${c.id}\"]`).getBoundingClientRect(); return [r.x+r.width/2, r.y+15];}")
    pg.mouse.move(bb[0], bb[1]); pg.mouse.down(); pg.mouse.move(bb[0]+60, bb[1]+40, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    after = pg.evaluate("()=>App.project.wires.find(w=>w.a.p==='bp-29').pts[0]")
    print('Knickpunkt vorher/nachher:', before, after)
    print('Fehler:', errs)
