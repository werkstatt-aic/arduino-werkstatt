from playwright.sync_api import sync_playwright
N=lambda s:f'<shadow type="math_number"><field name="NUM">{s}</field></shadow>'
XML=f'<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_loop" x="20" y="20"><statement name="DO"><block type="ard_motor"><field name="IA">5</field><field name="IB">6</field><field name="DIR">-1</field><value name="SPEED">{N(100)}</value></block></statement></block></xml>'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='16';f.nach.value='Test';f.proj.value='L298N'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.evaluate("""()=>{const C=App.circuit,P=C.project; const u=makeComp('uno',300,300,0,{},C.newId('c')); const d=makeComp('l298n',300,180,0,{},C.newId('c'));
      const s=makeComp('source',120,250,0,{volt:9},C.newId('c')); const m=makeComp('gearmotor',150,90,0,{},C.newId('c')); P.components.push(u,d,s,m);
      const w=(a,b,col)=>P.wires.push({id:C.newId('w'),a,b,color:col||'gruen',pts:[]});
      w({c:u.id,p:'D5'},{c:d.id,p:'IN1'}); w({c:u.id,p:'D6'},{c:d.id,p:'IN2'},'blau'); w({c:u.id,p:'GND_T'},{c:d.id,p:'GND'},'schwarz');
      w({c:s.id,p:'P'},{c:d.id,p:'VS'},'rot'); w({c:s.id,p:'N'},{c:d.id,p:'GND'},'schwarz');
      w({c:m.id,p:'P'},{c:d.id,p:'OUT1'},'rot'); w({c:m.id,p:'N'},{c:d.id,p:'OUT2'},'schwarz'); C.renderAll(); C.fitView();}""")
    pg.evaluate('(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace);}', XML)
    st="()=>{const m=App.project.components.find(c=>c.type==='gearmotor'); return App.circuit.states[m.id];}"
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(1200); print('Jumper an, 9 V:', pg.evaluate(st)); pg.screenshot(path='l1.png')
    pg.evaluate("()=>App.stopSim()"); pg.evaluate("()=>{App.project.components.find(c=>c.type==='l298n').props.ena='0'}"); pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(1000)
    print('Jumper ab, ENA offen:', pg.evaluate(st)); pg.evaluate("()=>App.stopSim()")
    code=pg.evaluate("()=>generateArduinoCode(App.workspace)"); print('C++ ok:', 'motor(5, 6, -1, 100);' in code)
    print('Fehler:', errs)
