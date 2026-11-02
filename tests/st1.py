"""Startfenster: Beispiel/Aufgabe/Öffnen abbrechen → zurück ins Startfenster; Auswahl öffnet normal"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(1000)
    start = lambda: pg.evaluate("()=>document.querySelector('#dlg').open && document.querySelector('#dlg').classList.contains('start')")
    title = lambda: pg.evaluate("()=>document.querySelector('#dlg').open ? (document.querySelector('#dlg h2')||{}).textContent : '(kein Dialog)'")
    print('Start:', start())
    # Beispiel: Liste abbrechen
    pg.click('#dlg [data-act=examples]'); pg.wait_for_timeout(300); print('  ', title())
    pg.click('#dlg button[value=cancel]'); pg.wait_for_timeout(300); print('Beispiel-Liste abgebrochen → Start:', start())
    # Beispiel wählen, Namensdialog abbrechen
    pg.click('#dlg [data-act=examples]'); pg.wait_for_timeout(300); pg.click('[data-ex=ampel]'); pg.wait_for_timeout(300); print('  ', title())
    if pg.locator('#dlg button[value=cancel]').count(): pg.click('#dlg button[value=cancel]'); pg.wait_for_timeout(300)
    print('Beispiel-Name abgebrochen → Start:', start(), '| Projekt:', pg.input_value('#projName'))
    # Aufgabe: Liste abbrechen
    pg.click('#dlg [data-act=tasks]'); pg.wait_for_timeout(300); print('  ', title())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); print('Aufgaben (Esc) → Start:', start())
    # Öffnen abbrechen
    pg.click('#dlg [data-act=open]'); pg.wait_for_timeout(500); print('  ', title())
    pg.click('#dlg button[value=cancel]'); pg.wait_for_timeout(300); print('Öffnen abgebrochen → Start:', start())
    # Beispiel wirklich öffnen
    pg.click('#dlg [data-act=examples]'); pg.wait_for_timeout(300); pg.click('[data-ex=ampel]'); pg.wait_for_timeout(300)
    if pg.locator('#dlgForm input[name=vor]').count():
        pg.fill('#dlgForm input[name=vor]', 'Test'); pg.select_option('#dlgForm select[name=tisch]', '07')
        pg.fill('#dlgForm input[name=proj]', 'Ampel' + str(pg.evaluate('Date.now()')))
        pg.click('#dlg button[value=ok]'); pg.wait_for_timeout(600)
    print('Beispiel geöffnet → Dialog offen:', pg.evaluate("()=>document.querySelector('#dlg').open"), '| Projekt:', pg.input_value('#projName'))
    print('Fehler:', errs)
    b.close()
