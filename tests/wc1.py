"""Kabelende per Maus von GND auf 5V umstecken: Farbe schwarz -> rot (und von Hand gewählte Farbe bleibt)"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Neu';f.proj.value='Kabel'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    for manual in [False, True]:
        wid = pg.evaluate("""(manual)=>{const C=App.circuit; C.load({components:[],wires:[]}); C.addTemplate(365,430);
          const P=C.project, bb=P.components.find(c=>c.type==='breadboard');
          const w={id:C.newId('w'),a:{c:bb.id,p:'bm-10'},b:{c:bb.id,p:'10j'},pts:[]}; w.color=manual?'weiss':App.defaultWireColor(w.a,w.b); P.wires.push(w);
          C.renderAll(); App.circuit.fitView(); C.select({kind:'wire',id:w.id}); C.renderWires(); return w.id;}""", manual)
        pg.wait_for_timeout(300)
        before = pg.evaluate("(id)=>App.project.wires.find(w=>w.id===id).color", wid)
        e = pg.locator('.wire-endh[data-end=a]').bounding_box()
        t = pg.evaluate("""()=>{const C=App.circuit, bb=C.project.components.find(c=>c.type==='breadboard'); const el=[...document.querySelectorAll('.pin')].find(x=>{const r=C.pinRef(x); return r && r.c===bb.id && r.p==='bp-10';}); const r=el.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2];}""")
        pg.mouse.move(e['x']+e['width']/2, e['y']+e['height']/2); pg.mouse.down(); pg.mouse.move(t[0], t[1], steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
        after = pg.evaluate("(id)=>{const w=App.project.wires.find(w=>w.id===id); return [w.a.p, w.color]}", wid)
        print('von Hand gefärbt' if manual else 'automatisch', ':', before, '→', after)
    print('Fehler:', errs)
    b.close()
