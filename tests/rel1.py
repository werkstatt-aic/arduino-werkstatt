from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 800})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    pg.evaluate("""()=>{App.loadProject(App.blankProject('01 – R – R')); App.setExtensions(['motoren']); const C=App.circuit, P=App.project;
      const u=C.addComponent('uno',380,420); const r1=C.addComponent('relay',60,120); const r2=C.addComponent('relay',260,120);
      const w=(a,b,c)=>P.wires.push({id:C.newId('w'),a,b,color:c||'blau',pts:[]});
      for (const r of [r1,r2]) { w({c:u.id,p:'5V'},{c:r.id,p:'VCC'},'rot'); w({c:u.id,p:'GND_1'},{c:r.id,p:'GND'},'schwarz'); }
      w({c:u.id,p:'D7'},{c:r2.id,p:'IN'}); w({c:u.id,p:'D8'},{c:r1.id,p:'IN'});
      App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom('<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="20" y="20"><statement name="DO"><block type="ard_digital_write"><field name="PIN">7</field><field name="V">HIGH</field></block></statement></block></xml>'), App.workspace);
      C.renderAll(); App.changed(); }""")
    pg.wait_for_timeout(400); pg.evaluate("()=>{const C=App.circuit; C.view={x:-1050,y:-380,k:4.2}; C.applyView();}")
    pg.wait_for_timeout(300); pg.screenshot(path='rel_off.png', clip={'x':0,'y':50,'width':940,'height':420})
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(800); pg.evaluate("()=>{const C=App.circuit; C.view={x:-1050,y:-380,k:4.2}; C.applyView(); C.select(null);}"); pg.wait_for_timeout(200)
    print('Zustand:', pg.evaluate("()=>App.project.components.filter(c=>c.type==='relay').map(c=>JSON.stringify(App.circuit.states[c.id]))"))
    pg.screenshot(path='rel_on.png', clip={'x':0,'y':50,'width':940,'height':420})
    print('Leiste: L9110S', pg.evaluate("()=>!!document.querySelector('.part[data-type=mdriver]')"), '| L298N', pg.evaluate("()=>!!document.querySelector('.part[data-type=l298n]')"))
    print(errs)
