"""Update: Fortschritt erscheint unter dem Abschnitt „Programm“"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 700})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='02';f.vor.value='Upd';f.proj.value='U'+Date.now()}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.evaluate("()=>Settings.open(App)"); pg.wait_for_timeout(800)
    # Update-Lauf nachstellen (ohne echtes Update): run() mit Ziel-Abschnitt „Programm“
    pg.evaluate("()=>{Settings.run('api/tools/check', {}, document.querySelector('#setUpd').closest('.set-sec'));}"); pg.wait_for_timeout(1500)
    r = pg.evaluate("()=>{const m=document.querySelector('#upMsg'), sec=document.querySelector('#setUpd').closest('.set-sec'); let e=sec.nextElementSibling, ids=[]; while(e && !e.classList.contains('set-sec')){ids.push(e.id); e=e.nextElementSibling;} return [ids, m.getBoundingClientRect().top < innerHeight, m.textContent.slice(0,60)]}")
    print('unter „Programm“:', r)
    pg.screenshot(path='upd2.png')
    print('Fehler:', errs)
    b.close()
