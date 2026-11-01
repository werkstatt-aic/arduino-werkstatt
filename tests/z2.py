from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('file:///root/werkstatt/app/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='01';f.vor.value='Offline';f.proj.value='Test'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    print('Name:', pg.input_value('#projName'), '| Status:', pg.inner_text('#saveState'))
    pg.click('#fileBtn'); pg.click('#fileMenu [data-act=examples]'); pg.wait_for_timeout(300); pg.click('[data-ex=ampel]'); pg.wait_for_timeout(200); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(500)
    print('Beispiel offline:', pg.input_value('#projName'))
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(1500); print('Sim:', pg.inner_text('#msgs')); pg.evaluate("()=>App.stopSim()")
    pg.click('#setBtn'); pg.wait_for_timeout(300); print('Einstellungen:', pg.inner_text('#dlgForm')[:80].replace('\n',' '))
    print('Fehler:', errs)
