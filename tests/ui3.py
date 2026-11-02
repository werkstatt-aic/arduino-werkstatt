"""0.12.5: Kabelfarbe beim Umstecken, Codefenster ziehen, Fenster verschieben, Einstellungen, Aufgabe k2, Liste leeren"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Neu';f.proj.value='UI'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    # 4) Kabel umstecken GND -> 5V
    r = pg.evaluate("""()=>{const C=App.circuit; C.load({components:[],wires:[]}); C.addTemplate(365,430); C.renderAll();
      const P=C.project, uno=P.components.find(c=>c.def.mcu), bb=P.components.find(c=>c.type==='breadboard');
      const w={id:C.newId('w'),a:{c:uno.id,p:'GND1'},b:{c:bb.id,p:'5a'},pts:[]}; w.color=App.defaultWireColor(w.a,w.b); P.wires.push(w);
      const before=w.color; const auto=App.defaultWireColor(w.a,w.b); w.a={c:uno.id,p:'5V'}; if (w.color===auto) w.color=App.defaultWireColor(w.a,w.b);
      return [before, w.color, uno.def.pins.map(p=>p.id).filter(x=>/GND|5V/.test(x)).join(',')];}""")
    print('Kabelfarbe GND→5V:', r)
    # echter Zieh-Ablauf am Kabelende
    pg.evaluate("()=>App.circuit.renderAll()")
    # 8) Codefenster ziehen
    pg.click('#modeCode'); pg.wait_for_timeout(400)
    sp = pg.locator('#codeSplit').bounding_box(); w0 = pg.locator('#codepanel').bounding_box()['width']
    pg.mouse.move(sp['x']+4, sp['y']+200); pg.mouse.down(); pg.mouse.move(sp['x']-300, sp['y']+200, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    w1 = pg.locator('#codepanel').bounding_box()['width']
    pg.reload(); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    pg.click('#modeCode'); pg.wait_for_timeout(400)
    w2 = pg.locator('#codepanel').bounding_box()['width']
    pg.dblclick('#codeSplit'); pg.wait_for_timeout(300); w3 = pg.locator('#codepanel').bounding_box()['width']
    print('Codefenster:', round(w0), '→', round(w1), 'nach Neuladen', round(w2), 'Doppelklick', round(w3))
    pg.click('#modeParts'); pg.wait_for_timeout(300)
    # 9) Aufgabe k2 starten, Panel verschieben
    pg.evaluate("()=>{App.loadProject({format:FORMAT,version:1,name:'05 – Neu – k2',board:'esp32',extensions:[],circuit:{components:[],wires:[]},blocks:DEFAULT_BLOCKS_XML,task:{...TaskStore.clean(TaskStore.get('k2'))}}); }")
    pg.evaluate("()=>{TaskUi.start ? 0 : 0}")
    pg.wait_for_timeout(400)
    print('Du brauchst:', pg.inner_text('#taskPanel .tp-parts').replace('\n', ' | '))
    h = pg.locator('#taskPanel .tp-head b').bounding_box(); p0 = pg.locator('#taskPanel').bounding_box()
    pg.mouse.move(h['x']+5, h['y']+5); pg.mouse.down(); pg.mouse.move(h['x']+500, h['y']+200, steps=6); pg.mouse.up()
    p1 = pg.locator('#taskPanel').bounding_box()
    print('Aufgabe verschoben:', round(p0['x']), round(p0['y']), '→', round(p1['x']), round(p1['y']))
    # Eigenschaften-Fenster
    pg.evaluate("()=>{const C=App.circuit; C.load({components:[],wires:[]}); C.addTemplate(365,430); const P=C.project; const l=makeComp('ldr',200,100,0,{},C.newId('c')); P.components.push(l); C.renderAll(); C.select({kind:'comp',id:l.id});}")
    pg.wait_for_timeout(300)
    h = pg.locator('#props > h3').first.bounding_box(); q0 = pg.locator('#props').bounding_box()
    pg.mouse.move(h['x']+10, h['y']+5); pg.mouse.down(); pg.mouse.move(h['x']-400, h['y']+300, steps=6); pg.mouse.up()
    q1 = pg.locator('#props').bounding_box()
    print('Eigenschaften verschoben:', round(q0['x']), round(q0['y']), '→', round(q1['x']), round(q1['y']))
    pg.screenshot(path='ui3_move.png')
    # 7) Meldung vor dem Blockmenü
    pg.click('#modeCode'); pg.wait_for_timeout(300)
    pg.evaluate("()=>App.toast('Testmeldung über den Blöcken')")
    z = pg.evaluate("()=>[getComputedStyle(document.querySelector('#toast')).zIndex, getComputedStyle(document.querySelector('.blocklyToolboxDiv')||document.body).zIndex]")
    print('z-index Meldung/Blockmenü:', z)
    pg.screenshot(path='ui3_toast.png')
    # 1) Einstellungen: Fortschritt unter dem Abschnitt
    pg.click('#modeParts')
    pg.evaluate("()=>Settings.open(App)"); pg.wait_for_timeout(800)
    pg.click('#setTools'); pg.wait_for_timeout(1500)
    pos = pg.evaluate("()=>{const m=document.querySelector('#upMsg'); return [m.previousElementSibling && m.previousElementSibling.id, m.textContent.slice(0,80), m.getBoundingClientRect().top < innerHeight]}")
    print('Einstellungen Fortschritt:', pos)
    pg.screenshot(path='ui3_settings.png')
    print('Fehler:', errs)
    b.close()
