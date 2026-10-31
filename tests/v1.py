from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1200,'height':800})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(800)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    pg.evaluate("()=>{App.setBoard('esp32'); App.loadProject(App.blankProject('V')); }"); pg.wait_for_timeout(200)
    print('Hinweis:', pg.inner_text('#emptyHint p'))
    pg.evaluate("""()=>{const C=App.circuit;
      const a=C.addComponent('dht',60,140); const b2=C.addComponent('dht',130,140); b2.props.model='22';
      C.addComponent('relay',220,140); C.addComponent('stepper',360,200); C.renderAll(); App.changed();
      C.view={x:0,y:40,k:2.2}; C.applyView();}""")
    pg.wait_for_timeout(300); print('Hinweis versteckt:', pg.evaluate("()=>document.querySelector('#emptyHint').hidden"))
    pg.screenshot(path='v1.png', clip={'x':0,'y':50,'width':1150,'height':700}); print(errs)
