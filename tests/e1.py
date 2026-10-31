from playwright.sync_api import sync_playwright
exec(open('u2.py').read().split("SETUP = ")[0].split("import json")[1])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900}, device_scale_factor=2)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    pg.evaluate("""()=>{ App.loadProject(App.blankProject('Galerie')); const C=App.circuit;
      const a=C.addComponent('esp32',0,0); a.x=0; a.y=0; const e=C.addComponent('esp32exp',0,0); e.x=320; e.y=60; C.renderAll(); C.select(null); C.fitView(); }""")
    pg.wait_for_timeout(300); pg.locator('#stage').screenshot(path='e1.png')
    print('Board nach Hineinziehen:', pg.evaluate('()=>BOARD'), pg.input_value('#boardSel'))
    pg.locator('#parts').screenshot(path='e1b.png')
    print(errs or 'no errors'); b.close()
