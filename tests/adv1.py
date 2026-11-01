# Hilfe-Knopf: korrekte Projekte (Beispiele, Musterlösungen) und typische Fehler
from playwright.sync_api import sync_playwright
JS = open('tk5.js').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    sols = pg.evaluate(JS)
    run = """(d)=>{App.loadProject({format:FORMAT,version:1,name:'01 – T – x',board:d.board,extensions:d.ext||[],circuit:JSON.parse(JSON.stringify(d.circuit)),blocks:d.blocks}); App.task=null;
      return Advisor.analyze(App).map(r=>r.level.toUpperCase()+': '+r.text);}"""
    print('=== Beispiele')
    for ex in pg.evaluate("()=>EXAMPLES.map(e=>e.id)"):
        r = pg.evaluate("(id)=>{const e=EXAMPLES.find(x=>x.id===id); return e;}", ex)
        res = pg.evaluate(run, {'board': r['board'], 'ext': r.get('ext', []), 'circuit': r['circuit'], 'blocks': r['blocks']})
        bad = [x for x in res if not x.startswith('TIP')]
        print(f"{ex:12s} {len(bad)} Probleme", *(['\n    ' + x for x in res]))
    print('=== Musterlösungen')
    for tid, sol in sols.items():
        res = pg.evaluate(run, sol)
        bad = [x for x in res if not x.startswith('TIP')]
        print(f"{tid:4s} {len(bad)} Probleme", *(['\n    ' + x for x in bad]))
    print('Fehler:', errs)
