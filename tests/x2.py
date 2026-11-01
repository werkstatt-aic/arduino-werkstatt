from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.click('#dlgForm [data-act=examples]'); pg.wait_for_timeout(300); pg.click('[data-ex=motor]'); pg.wait_for_timeout(300)
    pg.select_option('#dlgForm select[name=tisch]','05'); pg.fill('#dlgForm input[name=vor]','Test'); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(800)
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(1500)
    pg.screenshot(path='x2a.png')
    pg.evaluate("()=>App.stopSim()"); pg.click('#modeCode'); pg.wait_for_timeout(500)
    pg.evaluate("()=>App.setExtensions(['multimeter'])"); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{const ws=App.workspace; const t=['init_voltmeter_i2c','read_voltmeter_differential','read_voltmeter_channel','calculate_pmfc_power','init_ina219_i2c','read_ina219_value','ard_round','ard_math1','ard_motor'];
      t.forEach((ty,i)=>{const b=ws.newBlock(ty); b.initSvg(); b.render(); b.moveBy(420, 20+i*55);});}""")
    pg.wait_for_timeout(500); pg.screenshot(path='x2b.png')
    print('Fehler:', errs)
