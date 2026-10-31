from playwright.sync_api import sync_playwright
import sys, json, os
url = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1400,'height':860})
    errs=[]
    pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.goto(url); pg.wait_for_timeout(800)
    pg.evaluate("() => App.loadProject(App.blankProject('Maus Test'))")
    pg.drag_and_drop('.part[data-type="template"]', '#circuit', target_position={'x':500,'y':330})
    pg.wait_for_timeout(300)
    n = pg.evaluate("() => App.project.components.length")
    pg.click('#zoomFit'); pg.wait_for_timeout(200)
    pg.drag_and_drop('.part[data-type="led"]', '#circuit', target_position={'x':300,'y':200})
    pg.wait_for_timeout(200)
    # Wire by clicks: Uno D13 -> some breadboard hole
    def center(sel):
        bb = pg.locator(sel).first.bounding_box(); return bb['x']+bb['width']/2, bb['y']+bb['height']/2
    uno = pg.evaluate("() => App.project.components.find(c=>c.type==='uno').id")
    bbid = pg.evaluate("() => App.project.components.find(c=>c.type==='breadboard').id")
    x1,y1 = center(f'.comp[data-id="{uno}"] .pin[data-pin="D13"]')
    x2,y2 = center(f'.comp[data-id="{bbid}"] .pin[data-pin="20j"]')
    pg.mouse.click(x1,y1); pg.mouse.click((x1+x2)/2, y1-30); pg.mouse.click(x2,y2)
    pg.wait_for_timeout(300)
    w = pg.evaluate("() => App.project.wires.slice(-1)[0]")
    # move LED by dragging body
    led = pg.evaluate("() => App.project.components.find(c=>c.type==='led').id")
    lx,ly = center(f'.comp[data-id="{led}"] .body')
    before = pg.evaluate(f"() => {{ const c=App.circuit.comp('{led}'); return [c.x,c.y]; }}")
    pg.mouse.move(lx,ly); pg.mouse.down(); pg.mouse.move(lx+60, ly+40, steps=5); pg.mouse.up()
    after = pg.evaluate(f"() => {{ const c=App.circuit.comp('{led}'); return [c.x,c.y]; }}")
    pg.keyboard.press('r'); pg.wait_for_timeout(100)
    rot = pg.evaluate(f"() => App.circuit.comp('{led}').rot")
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(100)
    rot2 = pg.evaluate(f"() => (App.circuit.comp('{led}')||{{}}).rot")
    pg.wait_for_timeout(1200)
    print('comps', n, 'wire', json.dumps(w), 'move', before, after, 'rot', rot, 'undo', rot2)
    print('saved files', os.listdir('/root/werkstatt/Projekte'), open('/root/werkstatt/Projekte/.zuletzt').read())
    pg.click('#simBtn'); pg.wait_for_timeout(600)
    pg.screenshot(path='s8.png')
    pg.reload(); pg.wait_for_timeout(1200)
    print('after reload name:', pg.input_value('#projName'), pg.evaluate("() => App.project.components.length"))
    print('\n'.join(errs) or 'no errors')
    b.close()
