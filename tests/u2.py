from playwright.sync_api import sync_playwright
import json
H = """
document.querySelector("#dlg").open && document.querySelector("#dlg").close("cancel");
window.T = {
  fresh(xml, ext) {
    App.loadProject(Object.assign(App.blankProject('Test'), {extensions: ext||[]}));
    App.circuit.addTemplate(400, 300);
    this.bb = App.project.components.find(c=>c.type==='breadboard');
    this.uno = App.project.components.find(c=>c.type==='uno');
    if (xml) this.blocks(xml);
  },
  blocks(xml){ Blockly.Events.disable(); App.workspace.clear();
    Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom('<xml xmlns="https://developers.google.com/blockly/xml">'+xml+'</xml>'), App.workspace); Blockly.Events.enable(); },
  hx(col){ return this.bb.x + 20 + (col-1)*10; },
  ry(row){ return this.bb.y + ({a:40,b:50,c:60,d:70,e:80,f:110,g:120,h:130,i:140,j:150})[row]; },
  put(type, col, row, props){ const c = App.circuit.addComponent(type,0,0,props); c.x=this.hx(col); c.y=this.ry(row); App.circuit.renderAll(); return c; },
  free(type, dx, dy, props){ const c = App.circuit.addComponent(type,0,0,props); c.x=this.bb.x+dx; c.y=this.bb.y+dy; App.circuit.renderAll(); return c; },
  wire(a, b, color){ App.circuit.project.wires.push({id:'t'+Math.random(), a, b, pts:[], color: color||'gruen'}); App.circuit.renderAll(); },
  U(p){ return {c:this.uno.id, p}; }, B(p){ return {c:this.bb.id, p}; }, C(c,p){ return {c:c.id,p}; },
  msgs(){ return [...App.sim.messages.values()].map(m=>m.level+': '+m.text); },
};
"""
SETUP = '<block type="ard_setup" x="10" y="10"><statement name="DO">%s</statement></block>'
LOOP = '<block type="ard_loop" x="10" y="300"><statement name="DO">%s</statement></block>'
NUM = lambda v: f'<block type="math_number"><field name="NUM">{v}</field></block>'
out = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    ev = lambda js, *a: pg.evaluate(js, *a)
    W = lambda ms=400: pg.wait_for_timeout(ms)

    # B LED Helligkeit
    for ohm in [1000, 220, 0.5]:
        r = ev("""(ohm)=>{ T.fresh('%s'); const led=T.put('led',5,'h'); T.put('resistor',6,'g',{ohm}); T.wire(T.U('D3'),T.B('5j')); T.wire(T.B('10f'),T.B('bm-10'),'schwarz'); App.startSim(); return led.id; }""" % (SETUP % '<block type="ard_digital_write"><field name="PIN">3</field><field name="V">HIGH</field></block>'), ohm)
        W(300); out.append(f"LED {ohm} Ohm: {ev(f'() => JSON.stringify(App.circuit.states[\"{r}\"])')} {ev('()=>T.msgs()')}")
        ev("()=>App.stopSim()")
    pg.screenshot(path='u2_led.png')
    # P Steckmarkierung
    out.append('legs marked in: %s' % ev("()=>document.querySelectorAll('.pin.leg.in').length"))

    # C/D Taster
    xml = SETUP % '' + LOOP % f'<block type="ard_serial"><value name="V"><block type="ard_digital_read"><field name="PIN">2</field></block></value></block>'
    r = ev("""(xml)=>{ T.fresh(xml); const btn=T.put('button',10,'e'); /* A1=10e A2=10f? */ return btn.id; }""", xml)
    ev(f"""()=>{{ const c=App.circuit.comp('{r}'); c.x=T.hx(10); c.y=T.ry('e'); App.circuit.renderAll(); }}""")
    ins = ev("()=>[...computeInsertions(App.project).keys()]")
    out.append('button legs inserted: ' + str(ins))
    ev("""()=>{ T.wire(T.B('10a'), T.B('tp-10'),'rot'); T.put('resistor',12,'j',{ohm:10000}); T.wire(T.B('16j'),T.B('bm-16'),'schwarz'); T.wire(T.U('D2'),T.B('12g')); App.startSim(); }""")
    W(300); v0 = ev("()=>App.sim.readDigital('D2')")
    ev(f"()=>App.sim.pressButton('{r}', true)"); W(100); v1 = ev("()=>App.sim.readDigital('D2')")
    ev(f"()=>App.sim.pressButton('{r}', false)")
    out.append(f'button pulldown read: {v0} pressed: {v1} msgs {ev("()=>T.msgs()")}')
    ev("()=>App.stopSim()")
    ev("()=>{ App.project.components = App.project.components.filter(c=>c.type!=='resistor'); App.circuit.renderAll(); App.startSim(); }"); W(400)
    out.append(f'no pulldown msgs: {ev("()=>T.msgs()")}')
    ev("()=>App.stopSim()")
    ev("""(xml)=>{ T.fresh(xml); App.startSim(); }""", xml); W(400)
    out.append(f'unconnected pin msgs: {ev("()=>T.msgs()")}')
    ev("()=>App.stopSim()")

    # A LCD-Vorlage
    lxml = SETUP % '<block type="ard_lcd_init"><next><block type="ard_lcd_backlight"><field name="ON">1</field><next><block type="ard_lcd_print"><value name="V"><block type="text"><field name="TEXT">Hallo</field></block></value></block></next></block></next></block>'
    ev("""(xml)=>{ App.loadProject(App.blankProject('LCD')); App.circuit.addTemplate(400,300,true); T.bb=App.project.components.find(c=>c.type==='breadboard'); T.uno=App.project.components.find(c=>c.type==='uno'); T.blocks(xml); App.circuit.fitView(); App.startSim(); }""", lxml); W(400)
    out.append(f"LCD template (unwired SDA/SCL): {ev('()=>JSON.stringify(App.sim.lcd)')} msgs {ev('()=>T.msgs()')}")
    pg.screenshot(path='u2_lcdtpl.png')
    ev("()=>{ App.stopSim(); const l=App.project.components.find(c=>c.type==='lcd'); T.wire(T.U('SDA'),T.C(l,'SDA')); T.wire(T.U('SCL'),T.C(l,'SCL')); App.startSim(); }"); W(400)
    out.append(f"LCD wired: {ev('()=>JSON.stringify(App.sim.lcd.lines)')}")
    ev("()=>App.stopSim()")

    # E RGB
    xml = SETUP % '<block type="ard_analog_write"><field name="PIN">3</field><value name="V">%s</value><next><block type="ard_analog_write"><field name="PIN">5</field><value name="V">%s</value><next><block type="ard_analog_write"><field name="PIN">6</field><value name="V">%s</value></block></next></block></next></block>' % (NUM(255), NUM(0), NUM(255))
    r = ev("""(xml)=>{ T.fresh(xml); const c=T.put('rgbled',10,'f'); /* R10f K11f G12f B13f */
      T.put('resistor',10,'g',{ohm:220}); T.put('resistor',12,'h',{ohm:220}); T.put('resistor',13,'i',{ohm:220});
      T.wire(T.B('11j'),T.B('bm-11'),'schwarz'); T.wire(T.U('D3'),T.B('14g')); T.wire(T.U('D5'),T.B('16h')); T.wire(T.U('D6'),T.B('17i'));
      App.startSim(); return c.id; }""", xml); W(400)
    out.append(f"RGB: {ev(f'()=>JSON.stringify(App.circuit.states[\"{r}\"])')} {ev('()=>T.msgs()')}")
    pg.screenshot(path='u2_rgb.png'); ev("()=>App.stopSim()")

    # F/G NTC + TMP36 + Feuchte + Ultraschall
    xml = SETUP % '' + LOOP % ('<block type="ard_serial"><value name="V"><block type="ard_join"><value name="A"><block type="ard_analog_read"><field name="PIN">A0</field></block></value><value name="B"><block type="ard_join"><value name="A"><block type="text"><field name="TEXT"> T=</field></block></value><value name="B"><block type="ard_tmp36"><field name="PIN">A1</field></block></value></block></value></block></value>'
        '<next><block type="ard_serial"><value name="V"><block type="ard_join"><value name="A"><block type="ard_analog_read"><field name="PIN">A2</field></block></value><value name="B"><block type="ard_ultrasonic"><field name="TRIG">7</field><field name="ECHO">8</field></block></value></block></value><next><block type="ard_wait"><value name="N">'+NUM(0.2)+'</value></block></next></block></next></block>')
    ids = ev("""(xml)=>{ T.fresh(xml);
      const ntc=T.put('ntc',3,'c'); const r=T.put('resistor',4,'d',{ohm:10000}); T.wire(T.B('3a'),T.B('tp-3'),'rot'); T.wire(T.B('8a'),T.B('tm-8'),'schwarz'); T.wire(T.U('A0'),T.B('4b'));
      const tmp=T.put('tmp36',14,'c',{temp:23}); T.wire(T.B('14a'),T.B('tp-14'),'rot'); T.wire(T.B('16a'),T.B('tm-16'),'schwarz'); T.wire(T.U('A1'),T.B('15a'));
      const m=T.put('moisture',20,'c',{wet:40}); T.wire(T.B('20a'),T.B('tm-20'),'schwarz'); T.wire(T.B('21a'),T.B('tp-21'),'rot'); T.wire(T.U('A2'),T.B('22a'));
      const us=T.free('ultrasonic',150,330,{dist:42}); T.wire(T.B('bp-19'),T.C(us,'VCC'),'rot'); T.wire(T.B('bm-20'),T.C(us,'GND'),'schwarz'); T.wire(T.U('D7'),T.C(us,'TRIG')); T.wire(T.U('D8'),T.C(us,'ECHO'));
      App.circuit.fitView(); App.startSim(); return {ntc:ntc.id}; }""", xml); W(700)
    s1 = ev("()=>document.querySelector('#serial').textContent.trim().split('\\n').slice(-2)")
    ev(f"()=>App.circuit.setProp('{ids['ntc']}','temp',50,true)"); W(500)
    s2 = ev("()=>document.querySelector('#serial').textContent.trim().split('\\n').slice(-2)")
    out.append(f'sensors 20°C: {s1} / NTC 50°C: {s2} msgs {ev("()=>T.msgs()")}')
    pg.screenshot(path='u2_sens.png'); ev("()=>App.stopSim()")

    # I NeoPixel
    xml = SETUP % ('<block type="neo_init"><field name="PIN">6</field><field name="N">8</field><next><block type="neo_set"><value name="I">'+NUM(2)+'</value><field name="C">#ff0000</field><next><block type="neo_set_rgb"><value name="I">'+NUM(5)+'</value><value name="R">'+NUM(0)+'</value><value name="G">'+NUM(0)+'</value><value name="B">'+NUM(255)+'</value></block></next></block></next></block>')
    r = ev("""(xml)=>{ T.fresh(xml,['neopixel']); const s=T.free('strip',100,-60); T.wire(T.C(s,'VCC'),T.B('tp-10'),'rot'); T.wire(T.C(s,'GND'),T.B('tm-11'),'schwarz'); T.wire(T.C(s,'DIN'),T.U('D6')); App.circuit.fitView(); App.startSim(); return s.id; }""", xml); W(400)
    out.append(f"Neo: {ev(f'()=>JSON.stringify(App.circuit.states[\"{r}\"].pixels.slice(0,6))')}")
    pg.screenshot(path='u2_neo.png'); ev("()=>App.stopSim()")

    # J Tastenfeld
    kxml = '<block type="kp_init3"><field name="R0">9</field><field name="R1">8</field><field name="R2">7</field><field name="R3">6</field><field name="C0">5</field><field name="C1">4</field><field name="C2">3</field></block>'
    xml = SETUP % kxml + LOOP % '<block type="kp_read"><next><block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">NEQ</field><value name="A"><block type="kp_key"></block></value><value name="B"><block type="text"><field name="TEXT"></field></block></value></block></value><statement name="DO0"><block type="ard_serial"><value name="V"><block type="kp_key"></block></value></block></statement></block></next></block>'
    r = ev("""(xml)=>{ T.fresh(xml,['keypad']); const k=T.free('keypad3',400,300); ['R1','R2','R3','R4','C1','C2','C3'].forEach((p,i)=>T.wire(T.C(k,p),T.U('D'+(9-i)))); App.circuit.fitView(); App.startSim(); return k.id; }""", xml); W(300)
    ev(f"()=>App.sim.pressKey('{r}','5')"); W(250); ev(f"()=>App.sim.pressKey('{r}',null)"); W(100)
    ev(f"()=>App.sim.pressKey('{r}','#')"); W(250)
    pg.screenshot(path='u2_kp.png'); ev(f"()=>App.sim.pressKey('{r}',null)")
    out.append(f"Keypad serial: {ev('()=>JSON.stringify(document.querySelector(\"#serial\").textContent)')}")
    ev("()=>App.stopSim()")

    # K/L Multimeter
    xml = SETUP % '<block type="init_voltmeter_i2c"><field name="ADDRESS">0x48</field><field name="RANGE">1</field><next><block type="init_ina219_i2c"><field name="ADDRESS">0x40</field></block></next></block>' + LOOP % ('<block type="ard_serial"><value name="V"><block type="ard_join"><value name="A"><block type="read_voltmeter_differential"><field name="ADDRESS">0x48</field><field name="KANAL">0</field></block></value><value name="B"><block type="ard_join"><value name="A"><block type="text"><field name="TEXT"> V  I=</field></block></value><value name="B"><block type="read_ina219_value"><field name="ADDRESS">0x40</field><field name="MEASURE_MODE">CURRENT</field></block></value></block></value></block></value><next><block type="ard_wait"><value name="N">'+NUM(0.2)+'</value></block></next></block>')
    ev("""(xml)=>{ T.fresh(xml,['multimeter']);
      const a=T.free('ads1115',20,-70); const s=T.free('source',200,-140,{volt:0.62, ri:1000});
      T.wire(T.C(a,'VDD'),T.U('5V'),'rot'); T.wire(T.C(a,'GND'),T.U('GND_2'),'schwarz'); T.wire(T.C(a,'SDA'),T.U('SDA')); T.wire(T.C(a,'SCL'),T.U('SCL'));
      T.wire(T.C(s,'P'),T.C(a,'A0'),'rot'); T.wire(T.C(s,'N'),T.C(a,'A1'),'blau');
      const ina=T.free('ina219',150,-70); T.wire(T.C(ina,'VCC'),T.B('tp-15'),'rot'); T.wire(T.C(ina,'GND'),T.B('tm-16'),'schwarz'); T.wire(T.C(ina,'SDA'),T.U('A4')); T.wire(T.C(ina,'SCL'),T.U('A5'));
      T.wire(T.C(ina,'VINP'),T.B('tp-20'),'rot'); T.put('resistor',22,'c',{ohm:100}); T.wire(T.C(ina,'VINM'),T.B('22a')); T.wire(T.B('26a'),T.B('tm-26'),'schwarz');
      App.circuit.fitView(); App.startSim(); }""", xml); W(700)
    out.append(f"Multimeter: {ev('()=>document.querySelector(\"#serial\").textContent.trim().split(\"\\n\").slice(-1)')} {ev('()=>T.msgs()')}")
    pg.screenshot(path='u2_mm.png')
    out.append('C++ MM:\n' + ev("()=>generateArduinoCode(App.workspace)"))
    ev("()=>App.stopSim()")

    # M Funktionen + N Töne
    xml = ('<variables><variable id="vz">zahl</variable><variable id="vx">x</variable></variables>'
      '<block type="procedures_defreturn" x="400" y="10"><mutation><arg name="x" varid="vx"></arg></mutation><field name="NAME">doppelt</field><statement name="STACK"><block type="ard_wait"><value name="N">'+NUM(0.1)+'</value></block></statement><value name="RETURN"><block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A"><block type="variables_get"><field name="VAR" id="vx">x</field></block></value><value name="B">'+NUM(2)+'</value></block></value></block>'
      + SETUP % ('<block type="variables_set"><field name="VAR" id="vz">zahl</field><value name="VALUE"><block type="procedures_callreturn"><mutation name="doppelt"><arg name="x"></arg></mutation><value name="ARG0">'+NUM(21)+'</value></block></value><next><block type="ard_serial"><value name="V"><block type="variables_get"><field name="VAR" id="vz">zahl</field></block></value><next><block type="ard_tone"><field name="PIN">8</field><field name="NOTE">9</field><field name="ACC">-1</field><field name="OCT">4</field><value name="DUR">'+NUM(0.5)+'</value></block></next></block></next></block>'))
    ev("(xml)=>{ T.fresh(xml); App.startSim(); }", xml); W(600)
    out.append(f"Function result: {ev('()=>JSON.stringify(document.querySelector(\"#serial\").textContent)')} {ev('()=>T.msgs()')}")
    out.append('C++ FN:\n' + ev("()=>generateArduinoCode(App.workspace)"))
    ev("()=>App.stopSim()")

    # O Code-Ansicht wechseln
    ev("()=>{ App.setMode('parts'); }"); W(200)
    ev("()=>{ App.loadProject(App.blankProject('Ansicht')); }"); W(200)
    pg.click('#modeCode'); W(500)
    bb = ev("()=>{ const b=App.workspace.getTopBlocks()[0]; const r=b.getSvgRoot().getBoundingClientRect(); return [r.width, r.height, r.x, r.y]; }")
    out.append(f'blocks visible after switch: {bb}')
    pg.click('#tabBoth'); W(400); pg.screenshot(path='u2_both.png')
    pg.click('#extBtn'); W(200); pg.screenshot(path='u2_ext.png')
    pg.evaluate("()=>{ const f=document.querySelector('#dlgForm'); f.elements.neopixel.checked=true; f.elements.keypad.checked=true; f.elements.multimeter.checked=true; document.querySelector('#dlg').close('ok'); }"); W(300)
    pg.screenshot(path='u2_toolbox.png')
    print('\n'.join(out)); print('\n'.join(errs) or 'no errors')
    b.close()
