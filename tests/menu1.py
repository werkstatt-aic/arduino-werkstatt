# Datei-Menü liegt im Code-Modus über der Blockleiste (Kategorien und aufgeklappte Blockauswahl)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (1500, 1100):
        pg = b.new_page(viewport={'width': w, 'height': 850})
        pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(1200); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        pg.click('#modeCode'); pg.wait_for_timeout(400)
        pg.click('.blocklyTreeRow >> nth=1'); pg.wait_for_timeout(400)  # Blockauswahl aufklappen
        pg.click('#fileBtn'); pg.wait_for_timeout(300)
        res = pg.evaluate("""(() => { const m = document.querySelector('#fileMenu'), r = m.getBoundingClientRect(); const pts = []; for (let y = r.top + 8; y < r.bottom - 4; y += 25) for (const x of [r.left + 10, r.left + r.width / 2, r.right - 10]) { const e = document.elementFromPoint(x, y); pts.push(!!(e && e.closest('#fileMenu'))); } return [pts.filter(Boolean).length, pts.length]; })()""")
        print(w, 'px: Menüpunkte sichtbar', res)
        pg.screenshot(path=f'/tmp/claude-0/t/menu_{w}.png', clip={'x': 0, 'y': 0, 'width': 760, 'height': 520})
        pg.close()
    b.close()
