from playwright.sync_api import sync_playwright
import sys, json
exec(open('t3.py').read().split('def run')[0].split('url = sys.argv[1]')[1])
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':860})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(700); pg.evaluate(SETUP)
    xml='''<block type="ard_setup" x="10" y="10"><statement name="DO"><block type="ard_analog_write"><field name="PIN">3</field><value name="V"><block type="math_number"><field name="NUM">70</field></block></value><next><block type="ard_servo"><field name="PIN">11</field><value name="DEG"><block type="math_number"><field name="NUM">90</field></block></value><next><block type="ard_digital_write"><field name="PIN">5</field><field name="V">HIGH</field></block></next></block></next></block></statement></block><block type="ard_loop" x="10" y="200"></block>'''
    r = pg.evaluate("""(xml)=>{ T.setup(xml);
      const led=T.put('led',5,'h'); T.put('resistor',6,'g'); T.wire(T.U('D3'),T.B('5j')); T.wire(T.B('10f'),T.B('bm-10'),'schwarz');
      const s=App.circuit.addComponent('servo',0,0); s.x=T.bb.x+400; s.y=T.bb.y+100;
      T.wire(T.B('bm-27'),{c:s.id,p:'GND'},'schwarz'); T.wire(T.B('bp-27'),{c:s.id,p:'VCC'},'rot'); T.wire(T.U('D11'),{c:s.id,p:'SIG'});
      const m=App.circuit.addComponent('motor',0,0); m.x=T.bb.x+420; m.y=T.bb.y+250;
      T.wire(T.U('D5'),{c:m.id,p:'P'}); T.wire(T.U('GND_T'),{c:m.id,p:'N'},'schwarz');
      App.circuit.fitView(); App.startSim(); return {led:led.id, s:s.id, m:m.id}; }""", xml)
    pg.wait_for_timeout(800)
    print(pg.evaluate(f"() => ({{led: App.circuit.states['{r['led']}'], servo: App.circuit.states['{r['s']}'], motor: App.circuit.states['{r['m']}'], msgs:[...App.sim.messages.values()]}})"))
    pg.screenshot(path='s9.png')
    print(errs or 'no errors'); b.close()
