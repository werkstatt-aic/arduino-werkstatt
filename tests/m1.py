from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    pg.click('#fileBtn'); pg.wait_for_timeout(200)
    print(pg.evaluate("()=>[...document.querySelectorAll('#fileMenu button')].map(b=>b.textContent+': '+Math.round(b.getBoundingClientRect().height)).join(' | ')"))
    box=pg.locator('#fileMenu').bounding_box(); pg.screenshot(path='m1.png', clip={'x':box['x']-5,'y':box['y']-5,'width':box['width']+10,'height':box['height']+10})
