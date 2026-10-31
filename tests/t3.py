from playwright.sync_api import sync_playwright
import sys, json
url = sys.argv[1]
SETUP = """
window.T = {
  setup(blocksXml) {
    const C = App.circuit;
    App.loadProject(App.blankProject('Test'));
    C.addTemplate(400, 300);
    this.bb = C.project.components.find(c=>c.type==='breadboard');
    this.uno = C.project.components.find(c=>c.type==='uno');
    Blockly.Events.disable(); App.workspace.clear();
    Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom('<xml xmlns="https://developers.google.com/blockly/xml">'+blocksXml+'</xml>'), App.workspace);
    Blockly.Events.enable();
  },
  hx(col){ return this.bb.x + 20 + (col-1)*10; },
  ry(row){ return this.bb.y + ({a:40,b:50,c:60,d:70,e:80,f:110,g:120,h:130,i:140,j:150})[row]; },
  put(type, col, row, props, rot){ const c = App.circuit.addComponent(type,0,0,props); c.x=this.hx(col); c.y=this.ry(row); if(rot) c.rot=rot; App.circuit.renderAll(); return c; },
  wire(a, b, color){ App.circuit.project.wires.push({id:'t'+Math.random(), a, b, pts:[], color: color||'gruen'}); App.circuit.renderAll(); },
  U(p){ return {c:this.uno.id, p}; }, B(p){ return {c:this.bb.id, p}; },
};
"""
def run(pg, js, wait=700):
    pg.evaluate(js); pg.wait_for_timeout(wait)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1400,'height':860})
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
    pg.goto(url); pg.wait_for_timeout(800)
    pg.evaluate(SETUP)
    # A) Standard-Blinkprogramm
    pg.evaluate("() => { App.loadProject(App.blankProject('Blink')); App.circuit.addComponent('uno', 300, 300); App.startSim(); }")
    seq=[]
    for i in range(5):
        pg.wait_for_timeout(450); seq.append(pg.evaluate("() => !!(App.circuit.states[App.circuit.project.components[0].id]||{}).pin13"))
    print('A blink L:', seq)
    pg.evaluate("() => App.stopSim()")
    # B) Taster mit Pulldown an D9, LED an D3 über Variante 1
    xml = '''<block type="ard_setup" x="10" y="10"></block><block type="ard_loop" x="10" y="100"><statement name="DO"><block type="controls_if"><mutation else="1"></mutation>
      <value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="ard_digital_read"><field name="PIN">9</field></block></value><value name="B"><block type="math_number"><field name="NUM">1</field></block></value></block></value>
      <statement name="DO0"><block type="ard_digital_write"><field name="PIN">3</field><field name="V">HIGH</field></block></statement>
      <statement name="ELSE"><block type="ard_digital_write"><field name="PIN">3</field><field name="V">LOW</field></block></statement></block></statement></block>'''
    r = pg.evaluate("""(xml) => { T.setup(xml);
      const btn = T.put('button', 20, 'c'); // A an 20c/20e, B an 22c/22e
      const r1 = T.put('resistor', 22, 'b'); r1.props.ohm = 1000; // 22b -> 26b
      T.wire(T.B('20a'), T.B('tp-20'), 'rot');
      T.wire(T.B('26a'), T.B('tm-26'), 'schwarz');
      T.wire(T.U('D9'), T.B('22d'));
      const led = T.put('led', 5, 'h'); const r2 = T.put('resistor', 6, 'g');
      T.wire(T.U('D3'), T.B('5j')); T.wire(T.B('10f'), T.B('bm-10'), 'schwarz');
      App.circuit.fitView(); App.startSim(); return {btn: btn.id, led: led.id}; }""", xml)
    pg.wait_for_timeout(300)
    off = pg.evaluate(f"() => App.sim.ledLevel['{r['led']}']")
    pg.evaluate(f"() => App.sim.pressButton('{r['btn']}', true)"); pg.wait_for_timeout(300)
    on = pg.evaluate(f"() => App.sim.ledLevel['{r['led']}']")
    pg.screenshot(path='s5.png')
    pg.evaluate(f"() => App.sim.pressButton('{r['btn']}', false)"); pg.wait_for_timeout(300)
    off2 = pg.evaluate(f"() => App.sim.ledLevel['{r['led']}']")
    print('B button led off/on/off:', off, on, off2, [m['text'] for m in pg.evaluate("() => [...App.sim.messages.values()]")])
    # ohne Pulldown
    pg.evaluate("() => { App.stopSim(); const C=App.circuit; C.project.components = C.project.components.filter(c=> !(c.type==='resistor' && c.props.ohm===1000)); C.renderAll(); App.startSim(); }")
    pg.wait_for_timeout(500)
    print('B ohne Pulldown:', [m['text'] for m in pg.evaluate("() => [...App.sim.messages.values()]")])
    pg.evaluate("() => App.stopSim()")
    # C) LDR an A1 + LCD Anzeige
    xml = '''<block type="ard_setup" x="10" y="10"><statement name="DO"><block type="ard_lcd_config"><field name="ADDR">39</field><next><block type="ard_lcd_cmd"><field name="CMD">BL_ON</field></block></next></block></statement></block>
      <block type="ard_loop" x="10" y="150"><statement name="DO"><block type="ard_lcd_cmd"><field name="CMD">CLEAR</field><next><block type="ard_lcd_print"><value name="V"><block type="ard_analog_read"><field name="PIN">A1</field></block></value><next><block type="ard_wait"><value name="N"><block type="math_number"><field name="NUM">0.2</field></block></value></block></next></block></next></block></statement></block>'''
    pg.evaluate("""(xml) => { T.setup(xml);
      const ldr = T.put('ldr', 12, 'c'); const r = T.put('resistor', 13, 'd'); r.props.ohm = 1000;
      T.wire(T.B('12a'), T.B('tp-11'), 'rot'); T.wire(T.B('17a'), T.B('tm-17'), 'schwarz'); T.wire(T.U('A1'), T.B('13a'));
      const lcd = App.circuit.addComponent('lcd', 0, 0); lcd.x = T.bb.x + 420; lcd.y = T.bb.y + 300;
      T.wire(T.U('GND_2'), {c:lcd.id,p:'GND'}, 'schwarz'); T.wire(T.B('bp-28'), {c:lcd.id,p:'VCC'}, 'rot');
      T.wire(T.U('SDA'), {c:lcd.id,p:'SDA'}); T.wire(T.U('SCL'), {c:lcd.id,p:'SCL'});
      App.circuit.fitView(); App.startSim(); }""", xml)
    pg.wait_for_timeout(900)
    print('C LCD:', pg.evaluate("() => App.sim.lcd.lines"), [m['text'] for m in pg.evaluate("() => [...App.sim.messages.values()]")])
    pg.screenshot(path='s6.png')
    pg.evaluate("() => App.stopSim()")
    # D) Countdown mit Schleife
    xml = '''<variables><variable id="vi">i</variable></variables><block type="ard_setup" x="10" y="10"><statement name="DO"><block type="ard_lcd_config"><field name="ADDR">39</field><next><block type="ard_count"><field name="DIR">DOWN</field><field name="VAR" id="vi">i</field><value name="STEP"><block type="math_number"><field name="NUM">1</field></block></value><value name="FROM"><block type="math_number"><field name="NUM">3</field></block></value><value name="TO"><block type="math_number"><field name="NUM">0</field></block></value>
      <statement name="DO"><block type="ard_lcd_cmd"><field name="CMD">CLEAR</field><next><block type="ard_lcd_pos"><value name="COL"><block type="math_number"><field name="NUM">7</field></block></value><value name="ROW"><block type="math_number"><field name="NUM">0</field></block></value><next><block type="ard_lcd_print"><value name="V"><block type="variables_get"><field name="VAR" id="vi">i</field></block></value><next><block type="ard_wait"><value name="N"><block type="math_number"><field name="NUM">0.3</field></block></value></block></next></block></next></block></next></block></statement></block></next></block></statement></block><block type="ard_loop" x="10" y="300"></block>'''
    pg.evaluate("(xml) => { const lines = App.circuit.toJSON(); T.setup(xml); }", xml)
    print('D C++:\n' + pg.evaluate("() => generateArduinoCode(App.workspace)"))
    print('D sim code ok:', 'for (i = 3' in pg.evaluate("() => generateSimCode(App.workspace)"))
    pg.click('#modeCode'); pg.wait_for_timeout(400)
    pg.screenshot(path='s7.png')
    print('\n'.join(errs) or 'no errors')
    b.close()
