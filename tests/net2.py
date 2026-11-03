"""Lehrkraft mit Schreibrechten im Netzwerk-Modus: Updates und Einrichten möglich"""
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(sys.argv[1]); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='01';f.vor.value='Lehrer';f.proj.value='Test'}"); pg.click('button[value=new]'); pg.wait_for_timeout(600)
    pg.evaluate("()=>Settings.open(App)"); pg.wait_for_timeout(800)
    print('Hinweis:', pg.inner_text('#dlg .set-sec').replace('\n', ' | ')[:260])
    print('gesperrt:', pg.evaluate("()=>[...document.querySelectorAll('#dlg button:disabled')].map(b=>b.textContent.trim())"))
    print('Netzwerk-Knopf:', pg.locator('#setNet').count())
    pg.click('#setNet'); pg.wait_for_timeout(2500); print('Netzwerk einrichten:', pg.inner_text('#upMsg'))
    print('gesperrt danach:', pg.evaluate("()=>[...document.querySelectorAll('#dlg button:disabled')].map(b=>b.textContent.trim())"))
    pg.screenshot(path='net2.png')
    print('Fehler:', errs)
    b.close()
