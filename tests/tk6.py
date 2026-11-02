from playwright.sync_api import sync_playwright
JS=open('tk5.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    print(pg.evaluate("""async(js)=>{const sols=eval(js); const s=sols.s3;
      App.loadProject({format:FORMAT,version:1,name:'01 – a – b',board:s.board,extensions:[],circuit:s.circuit,blocks:s.blocks});
      App.startSim(); const o=[]; const u=App.project.components.find(c=>c.type==='ultrasonic');
      for (const d of [10,150]) { u.props.dist=d; await new Promise(r=>setTimeout(r,1000)); o.push(d+': '+App.sim.ultrasonic('D7','D8','CM')+' pow '+App.sim.powered(u)+' vcc '+App.sim.nl.net(u.id,'VCC')+' gnd '+App.sim.nl.net(u.id,'GND')+' 5V '+App.sim.unoNet('5V')+' G '+App.sim.unoNet(App.sim.m().gnd)+' trig '+App.sim.nl.net(u.id,'TRIG')+'/'+App.sim.unoNet('D7')+' echo '+App.sim.nl.net(u.id,'ECHO')+'/'+App.sim.unoNet('D8')+' led '+JSON.stringify(App.circuit.states[App.project.components.find(c=>c.type==='led').id])); }
      o.push([...App.sim.messages.values()].map(m=>m.text).join(';'));
      return o.join('\\n');}""", JS))
