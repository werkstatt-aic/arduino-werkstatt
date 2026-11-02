"""„für immer“ rutscht nach unten, wenn „beim Start“ wächst"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.vor.value='Neu';f.proj.value='Rutschen'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.click('#modeCode'); pg.wait_for_timeout(400)
    pos = "()=>{const t=App.workspace.getTopBlocks(false), s=t.find(b=>b.type==='ard_setup'), l=t.find(b=>b.type==='ard_loop'); const a=s.getBoundingRectangle(), c=l.getBoundingRectangle(); return [Math.round(a.bottom), Math.round(c.top)];}"
    print('Start (Unterkante beim Start, Oberkante für immer):', pg.evaluate(pos))
    pg.evaluate("""()=>{const ws=App.workspace, s=ws.getTopBlocks(false).find(b=>b.type==='ard_setup');
      for (let i=0;i<5;i++){ const b=ws.newBlock('ard_digital_write'); b.initSvg(); b.render();
        let c=s.getInput('DO').connection; while (c.targetBlock()) c=c.targetBlock().nextConnection; c.connect(b.previousConnection); }}""")
    pg.wait_for_timeout(300)
    print('nach 5 Blöcken:', pg.evaluate(pos))
    pg.screenshot(path='bump1.png')
    pg.evaluate("()=>App.workspace.undo(false)"); pg.wait_for_timeout(300)
    print('nach Rückgängig:', pg.evaluate(pos))
    print('Fehler:', errs)
    b.close()
