from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1150,'height':760})
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='17';f.vor.value='Bild';f.proj.value='Check'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    ids = pg.evaluate("()=>EXAMPLES.map(e=>e.id)")
    for i in ids:
        pg.evaluate("(id)=>{const e=EXAMPLES.find(x=>x.id===id); App.loadProject({format:'arduino-werkstatt',version:1,name:'17 – Bild – '+id,board:e.board,extensions:e.ext||[],circuit:e.circuit,blocks:e.blocks});}", i)
        pg.wait_for_timeout(500)
        pg.locator('#stage').screenshot(path=f'ex_{i}.png')
