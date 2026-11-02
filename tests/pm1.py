"""pinMode: Anschlüsse, die geschaltet UND gelesen werden, bleiben OUTPUT (alle Beispiele)"""
import re
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    ids = pg.evaluate("()=>EXAMPLES.map(e=>e.id)")
    bad = 0
    for eid in ids:
        code = pg.evaluate("""(id)=>{const e=EXAMPLES.find(x=>x.id===id);
          App.loadProject({format:FORMAT,version:1,name:'04 – Test – '+id,board:e.board,extensions:e.ext||[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks});
          Uploader.app=App; return Uploader.fullCode();}""", eid)
        open(f'/tmp/claude-0/cpp/out/ex_{eid}.cpp', 'w').write(code)
        written = set(re.findall(r'digitalWrite\((\d+),', code)); inputs = set(re.findall(r'pinMode\((\d+), INPUT\)', code))
        clash = written & inputs
        bad += bool(clash)
        print(eid, '| geschaltet:', sorted(written, key=int), '| INPUT:', sorted(inputs, key=int), '| KONFLIKT' if clash else '')
    print('Konflikte:', bad, '| Fehler:', errs)
    b.close()
