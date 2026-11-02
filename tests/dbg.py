from playwright.sync_api import sync_playwright
JS=open('ex_build.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    ex = pg.evaluate(JS)
    for e in ex:
        data={'format':'arduino-werkstatt','version':1,'name':'14 – Test – x','board':e['board'],'extensions':e.get('ext',[]),'circuit':e['circuit'],'blocks':e['blocks']}
        pg.evaluate('(d)=>App.loadProject(d)', data); pg.wait_for_timeout(300)
        print(e['id'], len(e['circuit']['components']), pg.evaluate("()=>App.project.components.map(c=>c.type).join(',')"))
    print(errs)
