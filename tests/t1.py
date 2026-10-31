from playwright.sync_api import sync_playwright
import sys
url = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1400,'height':860})
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
    pg.goto(url); pg.wait_for_timeout(1500)
    pg.screenshot(path='s1.png')
    print('\n'.join(errs) or 'no errors')
    b.close()
