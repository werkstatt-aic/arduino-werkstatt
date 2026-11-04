# Vollbild: Knopf unten links schaltet Seiten-Vollbild ein und aus, ping meldet die Einstellung
import json, urllib.request
from playwright.sync_api import sync_playwright
print('ping:', json.loads(urllib.request.urlopen('http://127.0.0.1:8642/api/ping').read()).get('vollbild'))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1366, 'height': 768})
    pg.add_init_script("Object.defineProperty(screen, 'height', { get: () => 900 })")  # wie ein normales Fenster (kleiner als der Bildschirm)
    err = []; pg.on('pageerror', lambda e: err.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(1200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    print('wantFull:', pg.evaluate('App.wantFull'), '| Knopf sichtbar:', pg.is_visible('#fullBtn'))
    pg.click('#fullBtn'); pg.wait_for_timeout(500)
    print('nach Klick Vollbild:', pg.evaluate('!!document.fullscreenElement'), pg.get_attribute('#fullBtn', 'class'))
    pg.click('#fullBtn'); pg.wait_for_timeout(500)
    print('nach 2. Klick Vollbild:', pg.evaluate('!!document.fullscreenElement'))
    pg.screenshot(path='/tmp/claude-0/t/full1.png', clip={'x': 0, 'y': 640, 'width': 400, 'height': 128})
    print('Fehler:', err)
    b.close()
