from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    print('nur Enter -> Dialog offen:', pg.evaluate("()=>document.querySelector('#dlg').open"), '| Fehler sichtbar:', pg.locator('.field-err').is_visible())
    pg.screenshot(path='u10a.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    print('Esc -> Dialog offen:', pg.evaluate("()=>document.querySelector('#dlg').open"))
    for v in ['01 – LED', '1 - LED - 7']:
        pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", v); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
        print(repr(v), 'abgelehnt:', pg.evaluate("()=>document.querySelector('#dlg').open"))
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '3 - Ampel bauen - Müller'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    print('angenommen als:', pg.input_value('#projName'), '| Datei:', [f for f in os.listdir('/root/werkstatt/Projekte') if 'Ampel' in f])
    pg.fill('#projName', 'Quatsch'); pg.keyboard.press('Enter'); pg.locator('body').click(position={'x':500,'y':400}); pg.wait_for_timeout(200)
    print('Titelfeld nach ungültig:', pg.input_value('#projName'))
    print(errs or 'no errors'); b.close()
