# Zeitmessung auch beim Vorübersetzen (Hintergrund) und für das Übertragen
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>localStorage.setItem('werkstatt.details','1')")
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\\s+[-–]\\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '10 – Zeit – Messung'); pg.click('button[value=new]'); pg.wait_for_timeout(300)
    pg.select_option('#boardSel','esp32'); pg.wait_for_timeout(300)
    pg.click('#uploadBtn'); pg.wait_for_timeout(5000)
    pg.click('#upGo'); pg.wait_for_timeout(3000)
    print('gewartet:', pg.inner_text('#upSteps').replace('\n',' | '))
    print('Details:', pg.evaluate("()=>document.querySelector('#upLog').textContent"))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("()=>localStorage.setItem('werkstatt.details','0')")
    pg.click('#uploadBtn'); pg.wait_for_timeout(5000)
    pg.click('#upGo'); pg.wait_for_timeout(3000)
    print('ohne Zeitmessung:', pg.inner_text('#upSteps').replace('\n',' | '))
    print('Fehler:', errs)
