from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    print(pg.evaluate("""async()=>{const e=EXAMPLES.find(x=>x.id==='motor');
      App.loadProject({format:FORMAT,version:1,name:'01 – a – b',board:e.board,extensions:e.ext||[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks});
      App.startSim(); const out=[];
      for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,500)); const m=App.project.components.find(c=>c.type==='gearmotor'); out.push(JSON.stringify(App.circuit.states[m.id]));}
      out.push(App.project.components.find(c=>c.type==='poti').props.position);
      out.push(generateArduinoCode(App.workspace)); return out.join('\\n');}"""))
