# Gegenprobe: Fahrzeug fährt nur geradeaus → Prüfung „dreht sich“ schlägt fehl
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    r = pg.evaluate("""async()=>{const e=EXAMPLES.find(x=>x.id==='fahrzeug');
      App.loadProject({format:FORMAT,version:1,name:'01 – T – F',board:'uno',extensions:['motoren'],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks.replace('>TR<','>FWD<')});
      App.task={...TaskStore.get('m5')}; TaskUi.render(); document.querySelector('#taskPanel [data-act=check]').click();
      await new Promise(r=>setTimeout(r,100)); while(TaskChecker.running) await new Promise(r=>setTimeout(r,100));
      return App.task.results.map(r=>(r.ok?'✓ ':'✗ ')+TASK_CHECKS[r.check.k].label(r.check)+(r.ok?'':' — '+r.hint));}""")
    print('\n'.join(r))
