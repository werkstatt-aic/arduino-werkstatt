from playwright.sync_api import sync_playwright
import os, json
P='/tmp/claude-0/stick2/Projekte'
ls=lambda: sorted(f for f in os.listdir(P) if f.startswith('12'))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '12 – Ampel – Test'); pg.click('button[value=new]'); pg.wait_for_timeout(1500)
    print('1 angelegt:', ls())
    pg.click('#fileBtn'); pg.click('[data-act=new]'); pg.wait_for_timeout(400)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '12 – Ampel – Test'); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(500)
    print('2 doppelt neu: Dialog offen:', pg.evaluate("()=>document.querySelector('#dlg').open"), '|', pg.inner_text('.field-err'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.fill('#projName', '12 – Ampel neu – Test'); pg.press('#projName','Enter'); pg.wait_for_timeout(1800)
    print('3 umbenannt:', ls())
    # zweites Projekt anlegen und dann auf den Namen des ersten umbenennen
    pg.click('#fileBtn'); pg.click('[data-act=new]'); pg.wait_for_timeout(400)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '12 – Zweites – Test'); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(1500)
    pg.fill('#projName', '12 – Ampel neu – Test'); pg.press('#projName','Enter'); pg.wait_for_timeout(1500)
    print('4 Umbenennen auf vorhandenen Namen:', pg.input_value('#projName'), '| Toast:', pg.inner_text('#toast'), '|', ls())
    # Import einer Datei mit vorhandenem Namen
    data=json.load(open(P+'/12 – Ampel neu – Test.awp')); open('/tmp/imp.awp','w').write(json.dumps(data))
    pg.set_input_files('#fileInput','/tmp/imp.awp'); pg.wait_for_timeout(1500)
    print('5 Import:', pg.input_value('#projName'), '|', ls())
    print('Fehler:', errs)
