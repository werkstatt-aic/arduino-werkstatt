"""LDR ohne Spannungsteiler: Aufgabe darf nicht gelöst sein, Hilfe-Knopf meldet es"""
from playwright.sync_api import sync_playwright
JS = open('tk5.js').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    sols = pg.evaluate(JS)
    for tid in ['s1', 's4']:
        for strip in [False, True]:
            r = pg.evaluate("""async ([tid, sol, strip]) => {
              const circ = JSON.parse(JSON.stringify(sol.circuit));
              if (strip) circ.components = circ.components.filter(c => !(c.type === 'resistor' && Number(c.props.ohm) === 10000));
              App.loadProject({ format: FORMAT, version: 1, name: '04 – Test – ' + tid, board: sol.board, extensions: sol.ext, circuit: circ, blocks: sol.blocks });
              App.task = { ...TaskStore.get(tid) }; TaskUi.render();
              document.querySelector('#taskPanel [data-act=check]').click();
              await new Promise(r => setTimeout(r, 100));
              while (TaskChecker.running) await new Promise(r => setTimeout(r, 100));
              const adv = Advisor.analyze(App).filter(x => x.level === 'error').map(x => x.text.slice(0, 90));
              return { res: App.task.results.filter(r => !r.ok).map(r => TASK_CHECKS[r.check.k].title + ' — ' + (r.hint || '')), adv };
            }""", [tid, sols[tid], strip])
            print(tid, 'ohne 10k' if strip else 'korrekt', '->', r)
    print('Fehler:', errs)
    b.close()
