from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');f.tisch.value='15';f.vor.value='Code';f.proj.value='Export'}",''); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    for ex in ('webseite','funk','motor','thermometer','ampel'):
        code=pg.evaluate("""(id)=>{const e=EXAMPLES.find(x=>x.id===id); App.loadProject({format:'arduino-werkstatt',version:1,name:'15 – Code – '+id,board:e.board,extensions:e.ext||[],circuit:e.circuit,blocks:e.blocks}); Uploader.app=App; return Uploader.fullCode();}""", ex)
        open(f'/tmp/claude-0/cpp/out/ex_{ex}.cpp','w').write(code)
        print(ex, code.count('\n'))
