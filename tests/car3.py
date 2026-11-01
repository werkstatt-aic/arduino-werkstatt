from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    for ex in ('fahrzeug', 'motor'):
        pg.evaluate("""(id)=>{const e=EXAMPLES.find(x=>x.id===id); App.loadProject({format:FORMAT,version:1,name:'01 – Test – '+id,board:e.board,extensions:e.ext||[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks}); App.setMode('parts');}""", ex)
        pg.wait_for_timeout(700); pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(1500)
        print(ex, pg.evaluate("()=>App.project.components.filter(c=>['gearmotor','wheelL','wheelR'].includes(c.type)).map(c=>JSON.stringify(App.circuit.states[c.id])).join(' ')"), [m['text'] for m in pg.evaluate("()=>[...App.sim.messages.values()]")])
        pg.screenshot(path=f'car3_{ex}.png', clip={'x': 0, 'y': 52, 'width': 1150, 'height': 683})
        pg.evaluate("()=>App.stopSim()")
    print(errs)
