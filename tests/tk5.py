# Musterlösungen für die mitgelieferten Aufgaben: jede Aufgabe muss damit gelöst werden
import json
from playwright.sync_api import sync_playwright
JS = open('tk5.js').read()
EXMAP = {'g3': 'ampel', 'g6': 'dimmer', 'm2': 'motor', 'm5': 'fahrzeug', 'k1': 'bluetooth'}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    sols = pg.evaluate(JS)
    ids = pg.evaluate("()=>BUILTIN_TASKS.map(t=>t.id)")
    bad = 0
    for tid in ids:
        r = pg.evaluate("""async ([tid, sol, exid]) => {
          if (!sol) { const e = EXAMPLES.find(x => x.id === exid); sol = { board: e.board, ext: e.ext || [], circuit: e.circuit, blocks: e.blocks }; }
          App.loadProject({ format: FORMAT, version: 1, name: '04 – Test – ' + tid, board: sol.board, extensions: sol.ext, circuit: JSON.parse(JSON.stringify(sol.circuit)), blocks: sol.blocks });
          App.task = { ...TaskStore.get(tid) }; TaskUi.render();
          const t0 = performance.now();
          document.querySelector('#taskPanel [data-act=check]').click();
          await new Promise(r => setTimeout(r, 100));
          while (TaskChecker.running) await new Promise(r => setTimeout(r, 100));
          return { secs: Math.round((performance.now() - t0) / 100) / 10, res: App.task.results.map(r => (r.ok ? '✓ ' : '✗ ') + TASK_CHECKS[r.check.k].label(r.check) + (r.ok ? '' : ' — ' + (r.hint || ''))) };
        }""", [tid, sols.get(tid), EXMAP.get(tid)])
        ok = all(x.startswith('✓') for x in r['res'])
        bad += not ok
        print(f"{'OK ' if ok else '!! '} {tid} ({r['secs']} s)" + ('' if ok else '\n    ' + '\n    '.join(r['res'])))
        if tid in ('s3', 'm1', 'm4'): pg.screenshot(path=f'tk5_{tid}.png')
    print('nicht gelöst:', bad, '| Fehler:', errs)
