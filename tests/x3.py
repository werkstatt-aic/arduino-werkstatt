from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.click('#dlgForm [data-act=examples]'); pg.wait_for_timeout(300); pg.click('[data-ex=motor]'); pg.wait_for_timeout(300)
    pg.select_option('#dlgForm select[name=tisch]','05'); pg.fill('#dlgForm input[name=nach]','Test'); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(800)
    for pos in (50, 0):
        pg.evaluate(f"()=>{{App.project.components.find(c=>c.type==='poti').props.position={pos}; App.startSim();}}"); pg.wait_for_timeout(1200)
        print(pos, pg.evaluate("()=>{const m=App.project.components.find(c=>c.type==='gearmotor'); return App.circuit.states[m.id];}"))
        pg.screenshot(path=f'x3_{pos}.png'); pg.evaluate("()=>App.stopSim()")
