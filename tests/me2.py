# Lüfter ohne Erweiterung direkt an einem digitalen Ausgang
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    print('Lüfter in der Leiste ohne Erweiterung:', pg.evaluate("()=>!!document.querySelector('.part[data-type=motor]').offsetParent"), '| Getriebemotor:', pg.evaluate("()=>!!document.querySelector('.part[data-type=gearmotor]').offsetParent"))
    r = pg.evaluate("""async()=>{
      App.loadProject({format:FORMAT,version:1,name:'01 – Test – Lüfter',board:'uno',extensions:[],circuit:{components:[],wires:[]},
        blocks:'<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_loop" x="20" y="20"><statement name="DO"><block type="ard_digital_write"><field name="PIN">7</field><field name="V">HIGH</field><next><block type="ard_wait"><field name="UNIT">S</field><value name="N"><shadow type="math_number"><field name="NUM">1</field></shadow></value><next><block type="ard_digital_write"><field name="PIN">7</field><field name="V">LOW</field><next><block type="ard_wait"><field name="UNIT">S</field><value name="N"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block></next></block></next></block></next></block></statement></block></xml>'});
      const C=App.circuit, P=App.project; const u=C.addComponent('uno',300,300); const m=C.addComponent('motor',150,120);
      P.wires.push({id:C.newId('w'),a:{c:u.id,p:'D7'},b:{c:m.id,p:'P'},color:'blau',pts:[]});
      P.wires.push({id:C.newId('w'),a:{c:u.id,p:'GND_1'},b:{c:m.id,p:'N'},color:'schwarz',pts:[]});
      C.renderAll(); App.changed(); App.startSim(); const o=[];
      for (let i=0;i<8;i++){ await new Promise(r=>setTimeout(r,250)); o.push(App.circuit.states[m.id].running?'läuft':'steht'); }
      const msgs=[...App.sim.messages.values()].map(x=>x.text);
      App.stopSim(); return {ext:App.extensions.join(','), o:o.join(' '), msgs};
    }""")
    print('Erweiterungen:', repr(r['ext']), '| Lüfter:', r['o'], '| Prüfung:', r['msgs'])
    print('Fehler:', errs)
