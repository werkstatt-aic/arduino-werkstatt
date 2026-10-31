from playwright.sync_api import sync_playwright
exec(open('u2.py').read().split("SETUP = ")[0].split("import json")[1])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    pg.locator('#parts').screenshot(path='u7_parts.png')
    pg.evaluate("document.querySelector('#partList').scrollTop = 520"); pg.wait_for_timeout(100); pg.locator('#parts').screenshot(path='u7_parts2.png')
    xml = '<block type="ard_setup" x="20" y="20"><statement name="DO"><block type="oled_init"><next><block type="oled_bitmap"><value name="X"><shadow type="math_number"><field name="NUM">10</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">5</field></shadow></value><next><block type="oled_show"></block></next></block></next></block></statement></block><block type="ard_loop" x="20" y="250"></block>'
    pg.evaluate("""(xml)=>{ T.fresh(xml,['oled']); const o=T.free('oled',380,40); T.wire(T.C(o,'GND'),T.U('GND_2'),'schwarz'); T.wire(T.C(o,'VCC'),T.U('5V'),'rot'); T.wire(T.C(o,'SCL'),T.U('SCL')); T.wire(T.C(o,'SDA'),T.U('SDA')); }""", xml)
    pg.click('#modeCode'); pg.wait_for_timeout(600)
    pg.screenshot(path='u7_block.png')
    # Feld anklicken -> Editor
    el = pg.evaluate("()=>{ const b=App.workspace.getAllBlocks().find(x=>x.type==='oled_bitmap'); const r=b.getField('BMP').getSvgRoot().getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; }")
    pg.mouse.click(*el); pg.wait_for_timeout(400)
    pg.click('#dlgForm [data-act=clear]')
    pg.fill('#dlgForm [name=bw]', '48'); pg.press('#dlgForm [name=bw]', 'Tab'); pg.fill('#dlgForm [name=bh]', '24'); pg.press('#dlgForm [name=bh]', 'Tab'); pg.wait_for_timeout(100)
    box = pg.locator('#bmCanvas').bounding_box(); c = box['width']/48
    P = lambda x,y: (box['x']+(x+.5)*c, box['y']+(y+.5)*c)
    def drag(tool, a, z):
        pg.click(f'#dlgForm [data-tool={tool}]'); pg.mouse.move(*P(*a)); pg.mouse.down(); pg.mouse.move(*P(*z), steps=4); pg.mouse.up()
    drag('rect', (0,0), (47,23)); drag('line', (2,2), (20,21)); drag('circle', (34,12), (34,20))
    pg.check('#dlgForm [name=bfill]'); drag('circle', (34,12), (34,15))
    pg.click('#dlgForm [data-tool=text]'); pg.fill('#dlgForm [name=btext]', 'Hi'); pg.mouse.click(*P(5,14))
    pg.wait_for_timeout(200); pg.screenshot(path='u7_editor.png')
    pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(400)
    print(pg.evaluate("()=>{ const c=generateArduinoCode(App.workspace); return c.slice(c.indexOf('// Bild'), c.indexOf('// Bild')+160) + ' ... ' + c.split('\\n').filter(l=>l.includes('drawBitmap')).join(''); }"))
    pg.click('#tabBoth'); pg.wait_for_timeout(300)
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(600)
    pg.screenshot(path='u7_sim.png')
    print(errs or 'no errors'); b.close()
