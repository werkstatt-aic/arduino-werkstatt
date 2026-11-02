"""Rot/Schwarz nur für Plus/GND: Umstecken in alle Richtungen, Farbfelder gesperrt"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Neu';f.proj.value='Kabel'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    def run(frm, to, color):
        wid = pg.evaluate("""([frm,color])=>{const C=App.circuit; C.load({components:[],wires:[]}); C.addTemplate(365,430);
          const P=C.project, bb=P.components.find(c=>c.type==='breadboard');
          const w={id:C.newId('w'),a:{c:bb.id,p:frm},b:{c:bb.id,p:'10j'},pts:[]}; w.color=color||App.defaultWireColor(w.a,w.b); P.wires.push(w);
          C.renderAll(); C.fitView(); C.select({kind:'wire',id:w.id}); C.renderWires(); return w.id;}""", [frm, color])
        pg.wait_for_timeout(250)
        before = pg.evaluate("(id)=>App.project.wires.find(w=>w.id===id).color", wid)
        e = pg.locator('.wire-endh[data-end=a]').bounding_box()
        t = pg.evaluate("""(to)=>{const C=App.circuit, bb=C.project.components.find(c=>c.type==='breadboard'); const el=[...document.querySelectorAll('.pin')].find(x=>{const r=C.pinRef(x); return r && r.c===bb.id && r.p===to;}); const r=el.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2];}""", to)
        pg.mouse.move(e['x']+e['width']/2, e['y']+e['height']/2); pg.mouse.down(); pg.mouse.move(t[0], t[1], steps=8); pg.mouse.up(); pg.wait_for_timeout(250)
        after = pg.evaluate("(id)=>App.project.wires.find(w=>w.id===id).color", wid)
        pg.evaluate("(id)=>App.circuit.select({kind:'wire',id})", wid); pg.wait_for_timeout(150)
        dis = pg.evaluate("()=>[...document.querySelectorAll('#props .swatch:disabled')].map(b=>b.dataset.color)")
        print(f'{frm}→{to} ({color or "auto"}): {before} → {after} | gesperrt: {dis}')
    run('bm-10', 'bp-10', None)    # GND → Plus
    run('bm-10', '20a', None)      # GND → Signal
    run('20a', 'bm-10', None)      # Signal → GND
    run('20a', '25a', 'weiss')     # Signal (von Hand weiß) → Signal
    run('20a', 'bp-10', 'weiss')   # Signal (weiß) → Plus
    print('Fehler:', errs)
    b.close()
