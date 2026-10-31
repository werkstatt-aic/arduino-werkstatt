# Aufgaben ohne Startprogramm (Notstart, file://): eigene Aufgaben und Haken im Browser
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 900}); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///root/werkstatt/app/index.html'); pg.wait_for_timeout(1200)
    pg.click('#dlgForm [data-act=tasks]'); pg.wait_for_timeout(400)
    print('Karten offline:', pg.locator('.tcard').count())
    pg.evaluate("()=>document.querySelector('#dlg').close()")
    pg.click('#setBtn'); pg.wait_for_timeout(300); pg.check('#setTeacher'); pg.evaluate("()=>document.querySelector('#dlg').close()")
    pg.evaluate("""()=>{const e=EXAMPLES.find(x=>x.id==='ampel'); App.loadProject({format:FORMAT,version:1,name:'01 – L – A',board:'uno',extensions:[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks});}""")
    pg.evaluate("()=>TaskUi.dialog()"); pg.wait_for_timeout(300); pg.click('[data-new]'); pg.wait_for_timeout(200)
    pg.fill('#dlgForm input[name=title]', 'Offline-Ampel'); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(500)
    print('Karten nach Anlegen:', pg.locator('.tcard').count(), '| gespeichert:', pg.evaluate("()=>JSON.parse(localStorage.getItem('werkstatt.aufgaben')).map(t=>t.title)"))
    print('Dialogklasse:', pg.get_attribute('#dlg', 'class')); pg.evaluate("()=>document.querySelector('#dlg').close()")
    # Aufgabe ohne Prüfungen
    pg.evaluate("()=>{App.task={id:'leer',title:'Ohne Prüfung',goal:'x',checks:[]}; TaskUi.render();}")
    pg.click('#taskPanel [data-act=check]'); pg.wait_for_timeout(500)
    print('ohne Prüfung gelöst?', pg.locator('#taskPanel .tp-done').count(), pg.evaluate("()=>JSON.parse(localStorage.getItem('werkstatt.geloest')||'{}')"))
    print('Fehler:', errs)
