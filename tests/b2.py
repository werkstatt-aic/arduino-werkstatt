from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.nach.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '09 – Test – Aichler'); pg.click('button[value=new]'); pg.wait_for_timeout(300)
    pg.click('#btBtn'); pg.wait_for_timeout(300); print('Uno:', pg.inner_text('#toast'))
    pg.select_option('#boardSel', 'esp32'); pg.wait_for_timeout(300); pg.click('#btBtn'); pg.wait_for_timeout(600)
    print('ESP32 Bluetooth-Knopf -> Modus:', pg.evaluate('()=>Uploader.mode'), pg.is_hidden('#upUsb'))
    pg.click('#dlgForm button[value=cancel]'); pg.click('#uploadBtn'); pg.wait_for_timeout(600)
    print('Hochladen-Knopf -> Modus:', pg.evaluate('()=>Uploader.mode'))
    b.close()
