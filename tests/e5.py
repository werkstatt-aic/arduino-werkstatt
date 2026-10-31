from playwright.sync_api import sync_playwright
exec(open('u2.py').read().split("SETUP = ")[0].split("import json")[1])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    r = pg.evaluate("""()=>{ App.loadProject(Object.assign(App.blankProject('Jumper'), {board:'esp32'})); const e=App.circuit.addComponent('esp32exp',400,300);
      const led=App.circuit.addComponent('led',0,0); led.x=e.x+40; led.y=e.y-80; const r=App.circuit.addComponent('resistor',0,0); r.x=e.x+60; r.y=e.y-100;
      App.circuit.project.wires.push({id:'w1',a:{c:e.id,p:'V5'},b:{c:r.id,p:'1'},pts:[],color:'rot'},{id:'w2',a:{c:r.id,p:'2'},b:{c:led.id,p:'A'},pts:[],color:'gruen'},{id:'w3',a:{c:led.id,p:'K'},b:{c:e.id,p:'G6'},pts:[],color:'schwarz'});
      App.circuit.renderAll(); App.circuit.select({kind:'comp', id:e.id}); return {e:e.id, led:led.id}; }""")
    pg.wait_for_timeout(200); pg.screenshot(path='e5.png')
    def run():
        pg.evaluate("()=>{ T.blocks('<block type=\"ard_setup\"></block>'); App.startSim(); }"); pg.wait_for_timeout(300)
        v = pg.evaluate(f"()=>App.circuit.states['{r['led']}'].brightness"); pg.evaluate("()=>App.stopSim()"); return round(v,3)
    a = run()
    pg.evaluate("()=>App.circuit.select({kind:'comp', id: App.project.components.find(c=>c.type==='esp32exp').id})")
    pg.select_option('#props select[data-prop=jump]', '5'); pg.wait_for_timeout(200)
    b5 = run()
    print('LED an V-Pin: 3,3 V ->', a, '| 5 V ->', b5)
    print(errs or 'no errors'); b.close()
