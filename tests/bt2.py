from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.click('#dlgForm [data-act=examples]'); pg.wait_for_timeout(300); pg.click('[data-ex=bluetooth]'); pg.wait_for_timeout(200)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='09';f.vor.value='Handy'}"); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(600)
    pg.click('#simBtn'); pg.wait_for_timeout(800); pg.click('#tabComm')
    for w in ('an','aus','an'):
        pg.fill('.bt-in input', w); pg.click('.bt-in button'); pg.wait_for_timeout(700)
        print(w, '-> LED', pg.evaluate("()=>{const l=App.project.components.find(c=>c.type==='led'); return Math.round(App.circuit.states[l.id].brightness*100)/100;}"))
    print(pg.inner_text('.bt-c + .radio-log').replace('\n',' | '))
    code=pg.evaluate("()=>{Uploader.app=App; return Uploader.fullCode();}"); open('/tmp/claude-0/cpp/out/ex_bt.cpp','w').write(code)
    print('WLAN-Teile im Code:', '<WiFi.h>' in code, '| NimBLE:', '<NimBLEDevice.h>' in code)
    print('Fehler:', errs)
