from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(1200)
    pg.screenshot(path='u1.png')
    pg.evaluate("document.querySelector('#partList').scrollTop = 900"); pg.wait_for_timeout(200)
    pg.locator('#parts').screenshot(path='u1b.png')
    pg.evaluate("document.querySelector('#partList').scrollTop = 2400"); pg.wait_for_timeout(200)
    pg.locator('#parts').screenshot(path='u1c.png')
    print('\n'.join(errs) or 'no errors')
    b.close()
