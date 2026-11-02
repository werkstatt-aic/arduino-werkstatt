"""Knickpunkte nachträglich: am Kabel ziehen fügt ein, Doppelklick entfernt, Rückgängig"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Neu';f.proj.value='Knick'+Date.now()}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    wid = pg.evaluate("""()=>{const C=App.circuit; C.load({components:[],wires:[]}); C.addTemplate(365,430);
      const P=C.project, bb=P.components.find(c=>c.type==='breadboard');
      const w={id:C.newId('w'),a:{c:bb.id,p:'5a'},b:{c:bb.id,p:'25a'},pts:[[bb.x+60,bb.y-60],[bb.x+260,bb.y-60]],color:'blau'}; P.wires.push(w);
      C.renderAll(); C.fitView(); return w.id;}""")
    pg.wait_for_timeout(300)
    pts = lambda: pg.evaluate("(id)=>App.project.wires.find(w=>w.id===id).pts.length", wid)
    # Mitte des waagrechten Abschnitts auf dem Bildschirm
    mid = pg.evaluate("""(id)=>{const w=App.project.wires.find(w=>w.id===id), C=App.circuit, v=C.view, r=C.svg.getBoundingClientRect();
      const x=(w.pts[0][0]+w.pts[1][0])/2, y=w.pts[0][1]; return [r.left+v.x+x*v.k, r.top+v.y+y*v.k];}""", wid)
    pg.mouse.click(mid[0], mid[1]); pg.wait_for_timeout(200)
    print('nur Klick: Knickpunkte', pts(), '| ausgewählt:', pg.evaluate("()=>App.circuit.sel && App.circuit.sel.kind"))
    pg.mouse.move(mid[0], mid[1]); pg.mouse.down(); pg.mouse.move(mid[0], mid[1]+80, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    order = pg.evaluate("(id)=>App.project.wires.find(w=>w.id===id).pts.map(p=>p.join(','))", wid)
    print('nach Ziehen: Knickpunkte', pts(), order)
    pg.screenshot(path='knot1.png')
    k = pg.locator('.wire-knot[data-knot="1"]').bounding_box()
    print('Knick-Kreis:', k, pg.evaluate("()=>{const el=document.querySelectorAll('.wire-knot'); return [...el].map(e=>e.dataset.knot)}"))
    hit = pg.evaluate("([x,y])=>{const e=document.elementFromPoint(x,y); return e.getAttribute('class')+' '+(e.dataset.knot||'')}", [k['x']+k['width']/2, k['y']+k['height']/2])
    print('Treffer:', hit)
    pg.mouse.dblclick(k['x']+k['width']/2, k['y']+k['height']/2); pg.wait_for_timeout(200)
    print('nach Doppelklick: Knickpunkte', pts())
    for _ in range(2):
        pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
        print('Strg+Z: Knickpunkte', pg.evaluate("(id)=>{const w=App.project.wires.find(w=>w.id===id); return w ? w.pts.length : 'Kabel weg'}", wid))
    print('Fehler:', errs)
    b.close()
