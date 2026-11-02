"""Messwerte speichern: ESP32-Startmeldungen werden nicht als Messwerte übernommen"""
from playwright.sync_api import sync_playwright
BOOT = """ets Jul 29 2019 12:21:46

rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
configsip: 0, SPIWP:0xee
clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00
mode:DIO, clock div:1
load:0x3fff0030,len:4980
load:0x40078000,len:16532
load:0x40080400,len:3500
entry 0x400805b4
"""
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(accept_downloads=True); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Neu';f.proj.value='Csv'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    for case, extra in [('nur Start', ''), ('mit Werten', ''.join(f'Temperatur: {20+i/10:.1f} C\n' for i in range(6)))]:
        pg.evaluate("t => { App.serialClear(); App.serialWrite(t); }", BOOT + extra)
        try:
            with pg.expect_download(timeout=2000) as dl:
                pg.evaluate("App.serialCsv()")
            txt = open(dl.value.path(), encoding='utf-8-sig').read()
            print(case, '->', txt.replace('\r\n', ' | '))
        except Exception:
            print(case, '-> kein Download:', pg.inner_text('body')[-0:0], pg.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('/')"))
    print('Fehler:', errs)
    b.close()
