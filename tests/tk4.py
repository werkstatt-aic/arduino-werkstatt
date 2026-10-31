# Aufgaben-Editor (Lehrkraft): anlegen, testen, speichern, als Schüler lösen, abhaken, exportieren, löschen
import json, os, glob
from playwright.sync_api import sync_playwright
STICK = '/tmp/claude-0/stick2'
for f in glob.glob(STICK + '/Aufgaben/*') + glob.glob(STICK + '/Projekte/.geloest.json'): os.remove(f)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    # ohne Lehrkraft-Modus keine Werkzeuge
    pg.evaluate("()=>TaskUi.dialog()"); pg.wait_for_timeout(400)
    print('Schüler: Neu-Knopf:', pg.locator('[data-new]').count())
    pg.evaluate("()=>document.querySelector('#dlg').close()")
    # Lehrkraft-Modus in den Einstellungen
    pg.click('#setBtn'); pg.wait_for_timeout(600); pg.check('#setTeacher'); pg.evaluate("()=>document.querySelector('#dlg').close()")
    # Lösung als Projekt: Ampel-Beispiel
    pg.evaluate("""()=>{const e=EXAMPLES.find(x=>x.id==='ampel'); App.loadProject({format:FORMAT,version:1,name:'01 – Lehrer – Ampel',board:e.board,extensions:[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks});}""")
    pg.evaluate("()=>TaskUi.dialog()"); pg.wait_for_timeout(400)
    pg.click('[data-new]'); pg.wait_for_timeout(300)
    print('Editor:', pg.inner_text('#dlg h2'), '| vorgeschlagene Prüfungen:', pg.locator('.te-check').count(), pg.locator('.te-check b').all_inner_texts())
    # ohne Titel speichern geht nicht
    pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(200)
    print('ohne Titel:', pg.is_visible('#teErr'), pg.inner_text('#teErr'))
    pg.fill('#dlgForm input[name=title]', 'Fußgängerampel'); pg.fill('#dlgForm textarea[name=goal]', 'Baue eine Ampel.\nSie soll schalten.')
    pg.fill('#dlgForm textarea[name=tips]', 'Erster Tipp\nZweiter Tipp')
    pg.select_option('#teKind', 'sequence'); pg.click('#teAdd'); pg.wait_for_timeout(100)
    pg.locator('.te-check').last.locator('input[data-key=n]').fill('3')
    pg.select_option('#teKind', 'block'); pg.click('#teAdd'); pg.wait_for_timeout(100)
    print('Block-Auswahl:', pg.locator('.te-check').last.locator('select option').all_inner_texts()[:4])
    # Testlauf
    pg.click('#dlgForm button[value=test]'); pg.wait_for_timeout(300)
    pg.wait_for_function("()=>!TaskChecker.running && App.task && App.task.results", timeout=30000)
    print('Testlauf:', pg.inner_text('#taskPanel .tp-res').replace('\n', ' | '))
    print('Testlauf im Projekt gespeichert?', 'task' in pg.evaluate("()=>App.projectData()"))
    pg.click('#taskPanel [data-act=back]'); pg.wait_for_timeout(300)
    print('zurück im Editor, Titel:', pg.input_value('#dlgForm input[name=title]'), '| Prüfungen:', pg.locator('.te-check').count())
    pg.select_option('#dlgForm select[name=start]', 'schaltung')
    pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(800)
    files = os.listdir(STICK + '/Aufgaben'); print('Dateien:', files)
    t = json.load(open(STICK + '/Aufgaben/' + files[0], encoding='utf-8'))
    print('Datei:', t['title'], t['level'], t['start'], len(t['checks']), 'Prüfungen | Schaltung dabei:', 'project' in t, '| Tipps:', t['tips'])
    print('Panel nach Speichern:', pg.is_visible('#taskPanel'))
    # als Schüler beginnen
    pg.click('[data-task^=eigen]'); pg.wait_for_timeout(200)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.nach.value='Schueler'}"); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(800)
    print('Start:', pg.input_value('#projName'), '| Bauteile:', pg.evaluate("()=>App.project.components.length"), '| Blöcke:', pg.evaluate("()=>App.workspace.getAllBlocks(false).map(b=>b.type).join(',')"))
    # Programm aus der Lösung einsetzen, dann prüfen
    pg.evaluate("""()=>{const e=EXAMPLES.find(x=>x.id==='ampel'); App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(e.blocks), App.workspace);}""")
    pg.click('#taskPanel [data-act=check]'); pg.wait_for_timeout(300)
    pg.wait_for_function("()=>!TaskChecker.running && App.task.results", timeout=30000)
    print('Schüler-Prüfung:', pg.inner_text('#taskPanel').split('\n')[-2:])
    pg.wait_for_timeout(500)
    print('gelöst gespeichert:', json.load(open(STICK + '/Projekte/.geloest.json')))
    pg.screenshot(path='tk4_done.png')
    pg.evaluate("()=>TaskUi.dialog()"); pg.wait_for_timeout(400)
    print('Haken in der Liste:', pg.locator('.tcard.done').count(), pg.locator('#dlg .start-sec').all_inner_texts())
    pg.screenshot(path='tk4_list.png')
    with pg.expect_download() as dl: pg.click('[data-export^=eigen]')
    print('Export:', dl.value.suggested_filename)
    pg.click('[data-del^=eigen]'); pg.wait_for_timeout(100); print('Löschen-Knopf:', pg.inner_text('[data-del^=eigen]'))
    pg.click('[data-del^=eigen]'); pg.wait_for_timeout(600)
    print('nach Löschen:', os.listdir(STICK + '/Aufgaben'), '| Karten:', pg.locator('.tcard').count())
    # Import
    pg.set_input_files('#taskImport', dl.value.path()); pg.wait_for_timeout(800)
    print('nach Import:', os.listdir(STICK + '/Aufgaben'))
    print('Fehler:', errs)
