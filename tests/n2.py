"""Neue Inhalte 1.0: DHT, Relais, Schrittmotor, Listen, Messwerte als CSV"""
from playwright.sync_api import sync_playwright
import sys, os, glob
BRD = sys.argv[1] if len(sys.argv) > 1 else 'uno'
N = lambda s: f'<shadow type="math_number"><field name="NUM">{s}</field></shadow>'
T = lambda s: f'<shadow type="text"><field name="TEXT">{s}</field></shadow>'
P = {'uno': dict(dht='2', st=['8', '9', '10', '11'], rel='7', gnd='GND_T', v5='5V', mcu='uno'),
     'esp32': dict(dht='4', st=['25', '26', '27', '14'], rel='13', gnd='GND1', v5='5V', mcu='esp32')}[BRD]
LV = '<variables><variable id="L" type="Liste">Messwerte</variable><variable id="M" type="Liste">Töne</variable><variable id="i">i</variable><variable id="t">temp</variable></variables>'
XML = f'''<xml xmlns="https://developers.google.com/blockly/xml">{LV}
<block type="ard_setup" x="20" y="20"><statement name="DO">
 <block type="list_new"><field name="L" id="L" variabletype="Liste">Messwerte</field><field name="N">5</field><next>
 <block type="list_init"><field name="L" id="M" variabletype="Liste">Töne</field><field name="V">262, 294, 330.5</field><next>
 <block type="ard_digital_write"><field name="PIN">{P['rel']}</field><field name="V">HIGH</field><next>
 <block type="ard_stepper"><field name="P1">{P['st'][0]}</field><field name="P2">{P['st'][1]}</field><field name="P3">{P['st'][2]}</field><field name="P4">{P['st'][3]}</field><field name="UNIT">DEG</field><field name="DIR">CW</field><value name="N">{N(90)}</value><value name="RPM">{N(15)}</value><next>
 <block type="ard_serial"><value name="V"><block type="ard_join"><value name="A">{T('Ton 2: ')}</value><value name="B"><block type="list_get"><value name="I">{N(2)}</value><field name="L" id="M" variabletype="Liste">Töne</field></block></value></block></value>
 </block></next></block></next></block></next></block></next></block>
</statement></block>
<block type="ard_loop" x="20" y="400"><statement name="DO">
 <block type="variables_set"><field name="VAR" id="t">temp</field><value name="VALUE"><block type="ard_dht"><field name="MODEL">22</field><field name="PIN">{P['dht']}</field><field name="WHAT">C</field></block></value><next>
 <block type="list_push"><value name="V"><block type="variables_get"><field name="VAR" id="t">temp</field></block></value><field name="L" id="L" variabletype="Liste">Messwerte</field><next>
 <block type="ard_serial"><value name="V"><block type="ard_join"><value name="A"><block type="ard_join"><value name="A">{T('Temperatur: ')}</value><value name="B"><block type="variables_get"><field name="VAR" id="t">temp</field></block></value></block></value><value name="B"><block type="ard_join"><value name="A">{T(' Mittel: ')}</value><value name="B"><block type="list_stat"><field name="OP">AVG</field><field name="L" id="L" variabletype="Liste">Messwerte</field></block></value></block></value></block></value><next>
 <block type="list_set"><value name="I">{N(9)}</value><field name="L" id="L" variabletype="Liste">Messwerte</field><value name="V">{N(1)}</value><next>
 <block type="ard_wait"><field name="UNIT">MS</field><value name="N">{N(300)}</value></block></next></block></next></block></next></block></next></block>
</statement></block></xml>'''

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='05';f.nach.value='Neu';f.proj.value='Inhalte'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.evaluate('(b)=>App.setBoard(b)', BRD); pg.wait_for_timeout(300)
    pg.evaluate("""(P)=>{const C=App.circuit,Pr=C.project; Pr.components=[]; Pr.wires=[];
      const u=makeComp(P.mcu,300,320,0,{},C.newId('c')); const d=makeComp('dht',120,200,0,{model:'22',temp:23.4,hum:51},C.newId('c'));
      const r=makeComp('relay',600,200,0,{trig:'H'},C.newId('c')); const s=makeComp('stepper',380,180,0,{},C.newId('c'));
      const src=makeComp('source',760,120,0,{volt:5},C.newId('c')); const led=makeComp('led',700,40,0,{color:'gruen'},C.newId('c')); const res=makeComp('resistor',640,60,0,{ohm:220},C.newId('c'));
      Pr.components.push(u,d,r,s,src,led,res);
      const w=(a,b,col)=>Pr.wires.push({id:C.newId('w'),a,b,color:col||'blau',pts:[]});
      const U=p=>({c:u.id,p});
      w(U(P.v5),{c:d.id,p:'VCC'},'rot'); w(U(P.gnd),{c:d.id,p:'GND'},'schwarz'); w(U('D'+P.dht),{c:d.id,p:'DATA'});
      w(U(P.v5),{c:r.id,p:'VCC'},'rot'); w(U(P.gnd),{c:r.id,p:'GND'},'schwarz'); w(U('D'+P.rel),{c:r.id,p:'IN'});
      P.st.forEach((p,i)=>w(U('D'+p),{c:s.id,p:'IN'+(i+1)}));
      w(U(P.v5),{c:s.id,p:'VCC'},'rot'); w(U(P.gnd),{c:s.id,p:'GND'},'schwarz');
      // Eigener Stromkreis über das Relais: Quelle + → COM, NO → Widerstand → LED → Quelle –
      w({c:src.id,p:'P'},{c:r.id,p:'COM'},'rot'); w({c:r.id,p:'NO'},{c:res.id,p:'1'}); w({c:res.id,p:'2'},{c:led.id,p:'A'}); w({c:led.id,p:'K'},{c:src.id,p:'N'},'schwarz');
      w({c:src.id,p:'N'},U(P.gnd),'schwarz');
      C.renderAll(); C.fitView();}""", P)
    pg.evaluate('(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace);}', XML)
    pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(700)
    stp = "()=>{const m=App.project.components.find(c=>c.type==='stepper'); return App.circuit.states[m.id];}"
    print('Schrittmotor läuft:', pg.evaluate(stp)); pg.screenshot(path='n2_' + BRD + '.png')
    pg.wait_for_timeout(2600)
    print('Schrittmotor fertig:', pg.evaluate(stp))
    print('Relais:', pg.evaluate("()=>{const r=App.project.components.find(c=>c.type==='relay'); return App.circuit.states[r.id];}"),
          '| LED im Relais-Stromkreis:', pg.evaluate("()=>{const l=App.project.components.find(c=>c.type==='led'); return Math.round(App.circuit.states[l.id].brightness*100)/100;}"))
    pg.evaluate("()=>{const d=App.project.components.find(c=>c.type==='dht'); d.props.temp=30; }"); pg.wait_for_timeout(1500)
    ser = pg.evaluate("()=>document.querySelector('#serial').textContent")
    print('Monitor:', ser.strip().split('\n')[:2], '…', ser.strip().split('\n')[-1])
    print('Meldungen:', pg.evaluate("()=>[...App.sim.messages.values()].map(m=>m.text)"))
    pg.evaluate("()=>App.showBottom('serial')"); pg.wait_for_timeout(200); pg.screenshot(path='n2_ser.png')
    with pg.expect_download() as dl:
        pg.click('#serialCsv')
    path = dl.value.path(); csv = open(path, encoding='utf-8-sig', newline='').read().split('\r\n')
    print('CSV:', dl.value.suggested_filename, '|', csv[0], '|', csv[1], '|', csv[-2], '| Zeilen:', len(csv) - 2)
    pg.evaluate("()=>App.stopSim()")
    # Sensor falsch eingestellt
    pg.evaluate("()=>{App.project.components.find(c=>c.type==='dht').props.model='11'}"); pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(2500)
    print('DHT11 statt 22:', [m for m in pg.evaluate("()=>[...App.sim.messages.values()].map(m=>m.text)") if 'DHT' in m], pg.evaluate("()=>document.querySelector('#serial').textContent").strip().split('\n')[1])
    pg.evaluate("()=>App.stopSim()")
    code = pg.evaluate("()=>generateArduinoCode(App.workspace)")
    os.makedirs('/tmp/claude-0/cpp/out', exist_ok=True)
    full = pg.evaluate("()=>{Uploader.app=App; return Uploader.fullCode();}")
    open(f'/tmp/claude-0/cpp/out/n2_{BRD}.cpp', 'w').write(full)
    print(code)
    # Listen-Werkzeugkasten
    pg.evaluate("()=>App.setMode('code')"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{App.workspace.getToolbox().selectItemByPosition([...App.workspace.getToolbox().getToolboxItems()].findIndex(i=>i.getName&&i.getName()==='Listen'))}"); pg.wait_for_timeout(400)
    print('Listen-Flyout:', pg.evaluate("()=>App.workspace.getFlyout().getWorkspace().getTopBlocks(true).map(b=>b.type)"))
    pg.screenshot(path='n2_list_' + BRD + '.png')
    pg.evaluate("()=>App.setMode('parts')"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{App.startSim();}"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{const C=App.circuit; C.view={x:-120,y:-200,k:2.2}; C.applyView();}"); pg.wait_for_timeout(300)
    pg.screenshot(path='n2_zoom_' + BRD + '.png')
    print('Fehler:', errs)
