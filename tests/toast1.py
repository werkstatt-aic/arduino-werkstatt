from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    pg.evaluate("()=>App.toast('Kein Mikrocontroller in der Liste? USB-Kabel prüfen. Mit Umschalt+Klick auf „Per USB verbinden“ werden alle Anschlüsse angezeigt.')")
    for t in [4000, 4000, 2500]:
        pg.wait_for_timeout(t); print('sichtbar:', pg.evaluate("()=>document.querySelector('#toast').classList.contains('show')"))
    pg.evaluate("()=>App.toast('kurz')"); pg.wait_for_timeout(300); pg.click('#toast'); pg.wait_for_timeout(100)
    print('nach Klick sichtbar:', pg.evaluate("()=>document.querySelector('#toast').classList.contains('show')"), '| Fehler:', errs)
    b.close()
