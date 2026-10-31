# Aufgaben: Prüf-Engine an den Beispielprojekten, Dialog, Start einer Aufgabe, Speichern im Projekt
import json, time
from playwright.sync_api import sync_playwright
CASES = [  # (Beispiel, Aufgabe oder eigene Prüfungen, erwartet alles erfüllt?)
  ('ampel', 'g3', True), ('ampel', [{'k':'sequence','n':4}], False), ('ampel', 'g2', False),
  ('blinken', [{'k':'blink','ms':1000}], None), ('taster', [{'k':'button','watch':'out'}], True),
  ('dimmer', 'g6', True), ('dimmer', [{'k':'sensor','type':'poti','a':5,'b':95,'watch':'out'}], True),
  ('thermometer', [{'k':'sensor','type':'tmp36','a':10,'b':35,'watch':'lcd'}, {'k':'lcd','text':''}], True),
  ('servo', [{'k':'sensor','type':'poti','a':5,'b':95,'watch':'out'}, {'k':'servo'}], True),
  ('motor', 'm2', True), ('bluetooth', 'k1', True), ('bluetooth', [{'k':'message','ch':'bt','a':'x','b':'y','watch':'out'}], False),
]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    # Startfenster: Link „Aufgabe wählen“
    pg.click('#dlgForm [data-act=tasks]'); pg.wait_for_timeout(500)
    print('Dialog:', pg.inner_text('#dlg h2'), '| Karten:', pg.locator('.tcard').count(), '| Stufen:', pg.locator('#dlg .start-sec').all_inner_texts())
    pg.click('[data-task=g3]'); pg.wait_for_timeout(200)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='04';f.nach.value='Test'}"); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(800)
    print('Projekt:', pg.input_value('#projName'), '| Bauteile:', pg.evaluate("()=>App.project.components.map(c=>c.type).join(',')"), '| Panel:', pg.inner_text('#taskPanel').split('\n')[:2])
    pg.click('#taskPanel [data-act=tip]'); pg.wait_for_timeout(100); pg.click('#taskPanel [data-act=tip]'); pg.wait_for_timeout(100)
    print('Tipps sichtbar:', pg.locator('#taskPanel .tp-tips li').count())
    pg.screenshot(path='tk1_panel.png')
    pg.wait_for_timeout(2500)
    saved = json.loads(open('/tmp/claude-0/stick2/Projekte/04 – Test – Ampel.awp', encoding='utf-8').read())
    print('Gespeichert mit Aufgabe:', saved.get('task', {}).get('id'), 'Tipps:', saved.get('task', {}).get('tipsShown'))
    # Prüf-Engine
    for ex, task, expect in CASES:
        r = pg.evaluate("""async ([ex, task]) => {
          const e = EXAMPLES.find(x => x.id === ex);
          App.loadProject({ format: FORMAT, version: 1, name: '04 – Test – ' + ex, board: e.board, extensions: e.ext || [], circuit: JSON.parse(JSON.stringify(e.circuit)), blocks: e.blocks });
          App.task = typeof task === 'string' ? { ...TaskStore.get(task) } : { id: 'x', title: 'Test', checks: task };
          TaskUi.render();
          const t0 = performance.now();
          document.querySelector('#taskPanel [data-act=check]').click();
          await new Promise(r => setTimeout(r, 100));
          while (TaskChecker.running) await new Promise(r => setTimeout(r, 100));
          return { secs: Math.round((performance.now() - t0) / 100) / 10, res: App.task.results.map(r => (r.ok ? '✓ ' : '✗ ') + TASK_CHECKS[r.check.k].label(r.check) + (r.ok ? '' : ' — ' + (r.hint || ''))) };
        }""", [ex, task])
        allok = all(x.startswith('✓') for x in r['res'])
        flag = '' if expect is None else ('OK' if allok == expect else '!!! UNERWARTET')
        print(f"\n[{ex} / {task if isinstance(task, str) else 'eigene'}] {r['secs']} s {flag}")
        for x in r['res']: print('   ', x)
    pg.screenshot(path='tk1_res.png')
    print('\nFehler:', errs)
