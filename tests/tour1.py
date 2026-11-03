"""Einführungstour: erscheint nach dem ersten Projekt, alle Schritte, merkt sich „fertig“, wieder aufrufbar"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1366, 'height': 768})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/?tour'); pg.wait_for_timeout(1000)
    print('Tour vor dem Projekt:', pg.locator('.tour').count())
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Mia';f.proj.value='Tour'+Date.now()}"); pg.click('button[value=new]'); pg.wait_for_timeout(1200)
    print('Tour nach dem Projekt:', pg.locator('.tour').count())
    n = 0
    while pg.locator('.tour').count():
        n += 1
        t = pg.inner_text('.tour-card h3'); hole = pg.locator('.tour-hole').bounding_box(); card = pg.locator('.tour-card').bounding_box()
        inside = card['x'] >= 0 and card['y'] >= 0 and card['x'] + card['width'] <= 1366 and card['y'] + card['height'] <= 768
        print(f'{n:2d} {t:38s} Loch {round(hole["width"])}×{round(hole["height"])} Karte im Bild: {inside}')
        if n in (1, 3, 7, 11): pg.screenshot(path=f'tour{n}.png')
        pg.click('.tour-card [data-t=next]'); pg.wait_for_timeout(450)
    print('Ansicht danach:', 'Code' if pg.evaluate("()=>$('#main').classList.contains('mode-code')") else 'Bauteile', '| gemerkt:', pg.evaluate("()=>localStorage.getItem('werkstatt.tour')"))
    pg.reload(); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Mia';f.proj.value='Tour2'+Date.now()}"); pg.click('button[value=new]'); pg.wait_for_timeout(1200)
    print('zweiter Start, Tour:', pg.locator('.tour').count())
    pg.keyboard.press('F1'); pg.wait_for_timeout(400); pg.click('#tourAgain'); pg.wait_for_timeout(600)
    print('über Hilfe gestartet:', pg.locator('.tour').count()); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    print('Esc beendet:', pg.locator('.tour').count() == 0)
    print('Fehler:', errs)
    b.close()
