from playwright.sync_api import sync_playwright
exec(open('u2.py').read().split("SETUP = ")[0].split("import json")[1])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900}, device_scale_factor=2)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    xml = '<block type="ard_setup" x="10" y="10"><statement name="DO"><block type="oled_init"><next><block type="oled_print"><value name="V"><block type="text"><field name="TEXT">Hallo Welt! äöü 123</field></block></value><next><block type="oled_cursor"><value name="X"><block type="math_number"><field name="NUM">0</field></block></value><value name="Y"><block type="math_number"><field name="NUM">20</field></block></value><next><block type="oled_size"><field name="N">2</field><next><block type="oled_print"><value name="V"><block type="text"><field name="TEXT">Temp: 23.5°C</field></block></value><next><block type="oled_show"></block></next></block></next></block></next></block></next></block></next></block></statement></block>'
    pg.evaluate("""(xml)=>{ T.fresh(xml,['oled']); const o=T.free('oled',380,40); T.wire(T.C(o,'GND'),T.U('GND_2'),'schwarz'); T.wire(T.C(o,'VCC'),T.U('5V'),'rot'); T.wire(T.C(o,'SCL'),T.U('SCL')); T.wire(T.C(o,'SDA'),T.U('SDA'));
       const C=App.circuit; C.view={x:-300,y:-120,k:3.2}; C.applyView(); App.startSim(); }""", xml); pg.wait_for_timeout(700)
    pg.locator('#stage').screenshot(path='u5.png')
    pg.evaluate("()=>{ App.stopSim(); const C=App.circuit; C.view={x:-80,y:-650,k:2.6}; C.applyView(); }"); pg.wait_for_timeout(200)
    pg.locator('#stage').screenshot(path='u5b.png')
    print(errs or 'ok'); b.close()
