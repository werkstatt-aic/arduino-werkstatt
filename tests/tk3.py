from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    print(pg.evaluate("""async()=>{const e=EXAMPLES.find(x=>x.id==='motor');
      App.loadProject({format:FORMAT,version:1,name:'01 – a – b',board:e.board,extensions:e.ext||[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks});
      App.startSim(); await new Promise(r=>setTimeout(r,1500));
      const S=App.sim, nl=S.nl, V=n=>S.lastRes.V[n];
      const d=App.project.components.find(c=>c.type==='mdriver'), m=App.project.components.find(c=>c.type==='gearmotor');
      const o=[];
      for(const p of d.def.pins.map(x=>x.id)) o.push(p+'='+(V(nl.net(d.id,p))||0).toFixed(2));
      for(const p of ['P','N']) o.push('M'+p+'='+(V(nl.net(m.id,p))||0).toFixed(2));
      o.push(JSON.stringify(S.outputs));
      o.push(JSON.stringify(App.project.wires.filter(w=>w.a.c===d.id||w.b.c===d.id||w.a.c===m.id||w.b.c===m.id).map(w=>[w.a.p,w.b.p])));
      return o.join('\\n');}"""))
