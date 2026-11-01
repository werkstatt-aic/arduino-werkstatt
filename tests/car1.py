# Fahrzeug-Blöcke: zwei Getriebemotoren am L9110S, alle Fahrmanöver, C++-Code
from playwright.sync_api import sync_playwright
N = lambda x: f'<shadow type="math_number"><field name="NUM">{x}</field></shadow>'
def chain(lst):
    out = ''
    for b in reversed(lst): out = b.replace('</block>', f'<next>{out}</next></block>', 1) if out and b.endswith('</block>') and '<next>' not in b else b if not out else b[:-8] + f'<next>{out}</next></block>'
    return out
drive = lambda d, s=80: f'<block type="car_drive"><field name="DIR">{d}</field><value name="SPEED">{N(s)}</value></block>'
wait = f'<block type="ard_wait"><field name="UNIT">S</field><value name="N">{N(1)}</value></block>'
seq = [drive('FWD'), wait, drive('BWD'), wait, drive('CL'), wait, drive('CR'), wait, drive('TL'), wait, drive('TR'), wait,
       f'<block type="car_motors"><value name="L">{N(-50)}</value><value name="R">{N(100)}</value></block>', wait, '<block type="car_stop"></block>', wait]
init = '<block type="car_init"><field name="LA">5</field><field name="LB">6</field><field name="RA">9</field><field name="RB">10</field></block>'
XML = f'<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="20" y="20"><statement name="DO">{init}</statement></block><block type="ard_loop" x="20" y="200"><statement name="DO">{chain(seq)}</statement></block></xml>'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    r = pg.evaluate("""async (xml)=>{
      App.loadProject({format:FORMAT,version:1,name:'01 – Test – Auto',board:'uno',extensions:[],circuit:{components:[],wires:[]},blocks:xml});
      const ext1 = App.extensions.join(',');
      const C=App.circuit, P=App.project, w=(a,b)=>P.wires.push({id:C.newId('w'),a,b,color:'blau',pts:[]});
      const u=C.addComponent('uno',400,350), d=C.addComponent('mdriver',150,120), L=C.addComponent('gearmotor',40,40), R=C.addComponent('gearmotor',260,40);
      for (const [a,bb] of [['D5','AIA'],['D6','AIB'],['D9','BIA'],['D10','BIB'],['5V','VCC'],['GND_1','GND']]) w({c:u.id,p:a},{c:d.id,p:bb});
      w({c:L.id,p:'P'},{c:d.id,p:'MA1'}); w({c:L.id,p:'N'},{c:d.id,p:'MA2'}); w({c:R.id,p:'P'},{c:d.id,p:'MB1'}); w({c:R.id,p:'N'},{c:d.id,p:'MB2'});
      C.renderAll(); App.changed(); App.startSim();
      const names=['vorwärts','rückwärts','Linkskurve','Rechtskurve','links drehen','rechts drehen','links -50/rechts 100','anhalten'], o=[];
      await new Promise(r=>setTimeout(r,500));
      const f=s=>s.running?(s.dir>0?'+':'-')+Math.round(s.speed*100):'0';
      for (const n of names){ const s=App.circuit.states; o.push(n.padEnd(22)+' L '+f(s[L.id]).padStart(4)+'   R '+f(s[R.id]).padStart(4)); await new Promise(r=>setTimeout(r,1000)); }
      const msgs=[...App.sim.messages.values()].map(m=>m.text); App.stopSim();
      return {ext1, o, msgs, cpp: generateArduinoCode(App.workspace)};
    }""", XML)
    print('Erweiterung beim Laden:', r['ext1']); print('\n'.join(r['o'])); print('Prüfung:', r['msgs'])
    open('/tmp/claude-0/cpp/out/car_uno.cpp', 'w').write(r['cpp'])
    # ohne „Fahrzeug einrichten“
    r2 = pg.evaluate("""async (xml)=>{ App.loadProject({format:FORMAT,version:1,name:'01 – Test – Auto2',board:'uno',extensions:['motoren'],circuit:JSON.parse(JSON.stringify(App.project.circuit||{components:[],wires:[]})),blocks:xml.replace(/<block type="car_init">.*?<\\/block>/,'')});
      App.circuit.addComponent('uno',400,350); App.startSim(); await new Promise(r=>setTimeout(r,600)); const m=[...App.sim.messages.values()].map(m=>m.text); App.stopSim(); return m; }""", XML)
    print('ohne Einrichten:', r2)
    # ESP32-Code
    code = pg.evaluate("""(xml)=>{App.loadProject({format:FORMAT,version:1,name:'01 – Test – AutoE',board:'esp32',extensions:['motoren'],circuit:{components:[],wires:[]},blocks:xml.replace(/>5</,'>25<').replace(/>6</,'>26<').replace(/>9</,'>27<').replace(/>10</,'>14<')}); Uploader.app=App; return Uploader.fullCode();}""", XML)
    open('/tmp/claude-0/cpp/out/car_esp.cpp', 'w').write(code)
    print('Fehler:', errs)
