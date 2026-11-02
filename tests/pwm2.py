"""PWM 255 an D12 (ohne ~): LED bleibt aus; an D11 (~): LED an"""
from playwright.sync_api import sync_playwright
JS = open('tk5.js').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    sols = pg.evaluate(JS)
    for pin in ['12', '11']:
        r = pg.evaluate("""async ([sol, pin]) => {
          const circ = JSON.parse(JSON.stringify(sol.circuit));
          if (pin === '11') for (const w of circ.wires) for (const e of [w.a, w.b]) if (e.p === 'D12') e.p = 'D11';
          const xml = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="30" y="30"></block><block type="ard_loop" x="30" y="150"><statement name="DO"><block type="ard_analog_write"><field name="PIN">' + pin + '</field><value name="V"><shadow type="math_number"><field name="NUM">255</field></shadow></value></block></statement></block></xml>';
          App.loadProject({ format: FORMAT, version: 1, name: '04 – Test – pwm' + pin, board: 'uno', extensions: [], circuit: circ, blocks: xml });
          App.startSim(); await new Promise(r => setTimeout(r, 1200));
          const led = App.project.components.find(c => c.type === 'led'), st = App.circuit.states[led.id];
          const msgs = [...document.querySelectorAll('#msgs li')].map(l => l.textContent.slice(0, 60));
          App.stopSim(); return [JSON.stringify(st), msgs];
        }""", [sols['g1'], pin])
        print('D' + pin, r)
    print('Fehler:', errs)
    b.close()
