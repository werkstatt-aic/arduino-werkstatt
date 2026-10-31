from playwright.sync_api import sync_playwright
import sys, json
url = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1400,'height':860})
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
    pg.goto(url); pg.wait_for_timeout(800); pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    r = pg.evaluate("""() => {
      const C = App.circuit;
      App.loadProject(App.blankProject('Test LED'));
      C.addTemplate(400, 300);
      const bb = C.project.components.find(c=>c.type==='breadboard');
      const uno = C.project.components.find(c=>c.type==='uno');
      const hx = col => bb.x + 20 + (col-1)*10;
      const led = C.addComponent('led', 0, 0); led.x = hx(10); led.y = bb.y + 80;
      const r = C.addComponent('resistor', 0, 0); r.x = hx(11); r.y = bb.y + 60;
      C.project.wires.push({id:'wx1', a:{c:uno.id,p:'D3'}, b:{c:bb.id,p:'10a'}, pts:[], color:'gruen'});
      C.project.wires.push({id:'wx2', a:{c:bb.id,p:'15a'}, b:{c:bb.id,p:'tm-15'}, pts:[], color:'schwarz'});
      C.renderAll();
      const xml = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="20" y="20"><statement name="DO"><block type="ard_digital_write"><field name="PIN">3</field><field name="V">HIGH</field></block></statement></block><block type="ard_loop" x="20" y="150"></block></xml>`;
      App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), App.workspace);
      App.circuit.fitView();
      App.startSim();
      return {ins: computeInsertions(C.project).size};
    }""")
    pg.wait_for_timeout(600)
    st = pg.evaluate("() => ({led: App.sim.ledLevel, msgs:[...App.sim.messages.values()], states: App.circuit.states})")
    print(json.dumps(r), json.dumps(st)[:900])
    pg.screenshot(path='s2.png')
    # ohne Widerstand: Widerstand durch Draht ersetzen
    pg.evaluate("""() => { App.stopSim(); const C=App.circuit; const r=C.project.components.find(c=>c.type==='resistor'); r.props.ohm=1; C.renderAll(); App.startSim(); }""")
    pg.wait_for_timeout(500)
    print(json.dumps(pg.evaluate("() => ({led: App.sim.ledLevel, msgs:[...App.sim.messages.values()]})")))
    pg.screenshot(path='s3.png')
    pg.click('#modeCode'); pg.wait_for_timeout(300); pg.click('#tabText'); pg.wait_for_timeout(300)
    print(pg.inner_text('#textcode'))
    pg.screenshot(path='s4.png')
    print('\n'.join(errs) or 'no errors')
    b.close()
