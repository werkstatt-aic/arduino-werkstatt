from playwright.sync_api import sync_playwright
exec(open('u2.py').read().split("SETUP = ")[0].split("import json")[1])
N = lambda v: f'<block type="math_number"><field name="NUM">{v}</field></block>'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    ev = pg.evaluate
    # 1) ESP32-Vorlage mit Expansion Board: LED an D4 über 220 Ohm, Poti an D32, Taster an D18 mit Pulldown
    xml = ('<block type="ard_setup"><statement name="DO"><block type="ard_digital_write"><field name="PIN">4</field><field name="V">HIGH</field><next><block type="ard_builtin_led"><field name="V">HIGH</field></block></next></block></statement></block>'
           '<block type="ard_loop" y="200"><statement name="DO"><block type="ard_serial"><value name="V"><block type="ard_join"><value name="A"><block type="ard_analog_read"><field name="PIN">D32</field></block></value><value name="B"><block type="ard_join"><value name="A"><block type="text"><field name="TEXT"> T=</field></block></value><value name="B"><block type="ard_digital_read"><field name="PIN">18</field></block></value></block></value></block></value><next><block type="ard_wait"><value name="N">'+N(0.2)+'</value></block></next></block></statement></block>')
    r = ev("""(xml)=>{ App.loadProject(App.blankProject('ESP Test')); App.setBoard('esp32');
      App.circuit.addTemplate(400,300,false);
      T.bb=App.project.components.find(c=>c.type==='breadboard'); T.uno=App.project.components.find(c=>c.def.mcu);
      T.blocks(xml);
      const led=T.put('led',5,'h'); T.put('resistor',6,'g',{ohm:220}); T.wire(T.U('D4'),T.B('5j')); T.wire(T.B('10f'),T.B('bm-10'),'schwarz');
      const po=T.put('poti',14,'c',{position:30}); T.wire(T.B('14a'),T.B('tp-14'),'rot'); T.wire(T.B('16a'),T.B('tm-16'),'schwarz'); T.wire(T.U('D32'),T.B('15a'));
      const bt=T.put('button',22,'e'); T.wire(T.B('22a'),T.B('tp-22'),'rot'); T.put('resistor',24,'j',{ohm:10000}); T.wire(T.B('28j'),T.B('bm-28'),'schwarz'); T.wire(T.U('D18'),T.B('24g'));
      App.circuit.fitView(); App.startSim(); return {led:led.id, bt:bt.id, esp:T.uno.id, type:T.uno.type}; }""", xml)
    pg.wait_for_timeout(700)
    s1 = ev("()=>document.querySelector('#serial').textContent.trim().split('\\n').slice(-1)[0]")
    ev(f"()=>App.sim.pressButton('{r['bt']}', true)"); pg.wait_for_timeout(500)
    s2 = ev("()=>document.querySelector('#serial').textContent.trim().split('\\n').slice(-1)[0]")
    st = ev(f"()=>[App.circuit.states['{r['led']}'], App.circuit.states['{r['esp']}']]")
    print('Typ:', r['type'], '| Seriell:', s1, '->', s2, '| LED/ESP:', st, '| Meldungen:', ev("()=>T.msgs()"))
    pg.screenshot(path='e2.png'); ev("()=>App.stopSim()")
    # 2) LCD-Vorlage ESP32: SDA/SCL an D21/D22
    xml = '<block type="ard_setup"><statement name="DO"><block type="ard_lcd_init"><next><block type="ard_lcd_backlight"><next><block type="ard_lcd_print"><value name="V"><block type="text"><field name="TEXT">Hallo ESP32</field></block></value></block></next></block></next></block></statement></block>'
    ev("""(xml)=>{ App.loadProject(Object.assign(App.blankProject('ESP LCD'), {board:'esp32'})); App.circuit.addTemplate(400,300,true);
      T.bb=App.project.components.find(c=>c.type==='breadboard'); T.uno=App.project.components.find(c=>c.def.mcu); T.blocks(xml);
      const l=App.project.components.find(c=>c.type==='lcd'); T.wire(T.U('D21'),T.C(l,'SDA')); T.wire(T.U('D22'),T.C(l,'SCL'));
      App.circuit.fitView(); App.startSim(); }""", xml); pg.wait_for_timeout(500)
    print('LCD am ESP32:', ev('()=>App.sim.lcd.lines'), ev("()=>T.msgs()"))
    pg.screenshot(path='e3.png')
    # 3) Board-Wechsel: Blöcke und Werkzeugkasten
    ev("()=>App.stopSim()")
    print('Ausgang-Optionen ESP32:', [o[0] for o in PIN_OUT] if False else ev("()=>PIN.out().map(o=>o[0]).join(' ')"))
    print('Analog ESP32:', ev("()=>PIN.ana().map(o=>o[0]).join(' ')"))
    ev("()=>App.setBoard('uno')"); print('nach Wechsel:', ev('()=>BOARD'), ev("()=>PIN.ana().map(o=>o[0]).join(' ')"))
    print(errs or 'no errors'); b.close()
