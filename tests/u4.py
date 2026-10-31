from playwright.sync_api import sync_playwright
exec(open('u2.py').read().split("SETUP = ")[0].split("import json")[1])
NUM = lambda v: f'<block type="math_number"><field name="NUM">{v}</field></block>'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900}, device_scale_factor=2)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    xml = ('<block type="ard_setup" x="10" y="10"><statement name="DO"><block type="oled_init"><next><block type="oled_size"><field name="N">2</field><next><block type="oled_print"><value name="V"><block type="text"><field name="TEXT">Hallo 42</field></block></value><next>'
      '<block type="oled_rect"><field name="F">0</field><value name="X">'+NUM(0)+'</value><value name="Y">'+NUM(20)+'</value><value name="W">'+NUM(60)+'</value><value name="H">'+NUM(30)+'</value><next>'
      '<block type="oled_circle"><field name="F">1</field><value name="X">'+NUM(100)+'</value><value name="Y">'+NUM(40)+'</value><value name="R">'+NUM(15)+'</value><next><block type="oled_show"></block></next></block></next></block></next></block></next></block></next></block></statement></block>'
      '<block type="neo_set" x="400" y="10"><value name="I">'+NUM(1)+'</value><field name="C">#00ff00</field></block>'
      '<block type="read_ina219_value" x="400" y="80"></block><block type="read_voltmeter_channel" x="400" y="130"></block>'
      '<block type="ard_loop" x="10" y="300"></block>')
    r = pg.evaluate("""(xml)=>{ T.fresh(xml,['oled','neopixel','multimeter']);
      const o=T.free('oled',380,40); T.wire(T.C(o,'GND'),T.U('GND_2'),'schwarz'); T.wire(T.C(o,'VCC'),T.U('5V'),'rot'); T.wire(T.C(o,'SCL'),T.U('SCL')); T.wire(T.C(o,'SDA'),T.U('SDA'));
      const so=T.put('soil',5,'c',{wet:80}); const r=T.put('resistor',6,'d',{ohm:10000}); T.wire(T.B('5a'),T.B('tp-5'),'rot'); T.wire(T.B('10a'),T.B('tm-10'),'schwarz');
      const g=T.free('gearmotor',380,250); T.wire(T.C(g,'P'),T.U('D5')); T.wire(T.C(g,'N'),T.B('bm-27'),'schwarz');
      App.circuit.fitView(); App.startSim(); return so.id; }""", xml); pg.wait_for_timeout(800)
    print('oled img', pg.evaluate("()=>!!(App.sim.oled && App.sim.oled.img)"), 'soil A?', pg.evaluate("()=>{ const nl=App.sim.nl; return 'ok'; }"))
    pg.locator('#stage').screenshot(path='u4.png')
    pg.evaluate("()=>{ App.stopSim(); App.setMode('code'); }"); pg.wait_for_timeout(500)
    pg.screenshot(path='u4b.png')
    print('C++:', pg.evaluate("()=>generateArduinoCode(App.workspace)")[:600])
    pg.evaluate("()=>{ App.setMode('parts'); App.loadProject(App.blankProject('x')); App.circuit.addTemplate(400,300,true); App.circuit.fitView(); }"); pg.wait_for_timeout(300)
    pg.screenshot(path='u4c.png')
    print(errs or 'no errors'); b.close()
