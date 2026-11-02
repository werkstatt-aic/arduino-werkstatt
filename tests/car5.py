# Fahrzeug mit Rädern: Fahrtrichtung je Rad (vor/zurück) bei allen Manövern
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    r = pg.evaluate("""async()=>{const e=EXAMPLES.find(x=>x.id==='fahrzeug'); const out=[];
      const N=x=>`<shadow type="math_number"><field name="NUM">${x}</field></shadow>`;
      const cases=[['vorwärts','<block type="car_drive"><field name="DIR">FWD</field><value name="SPEED">'+N(80)+'</value></block>'],
        ['rückwärts','<block type="car_drive"><field name="DIR">BWD</field><value name="SPEED">'+N(80)+'</value></block>'],
        ['Linkskurve','<block type="car_drive"><field name="DIR">CL</field><value name="SPEED">'+N(80)+'</value></block>'],
        ['links drehen','<block type="car_drive"><field name="DIR">TL</field><value name="SPEED">'+N(80)+'</value></block>'],
        ['rechts drehen','<block type="car_drive"><field name="DIR">TR</field><value name="SPEED">'+N(80)+'</value></block>'],
        ['L -50 / R 100','<block type="car_motors"><value name="L">'+N(-50)+'</value><value name="R">'+N(100)+'</value></block>']];
      for (const [n,blk] of cases) {
        const xml=e.blocks.replace(/<block type="ard_loop"[\\s\\S]*<\\/xml>/, '<block type="ard_loop" x="30" y="200"><statement name="DO">'+blk+'</statement></block></xml>');
        App.loadProject({format:FORMAT,version:1,name:'01 – T – '+n,board:'uno',extensions:['motoren'],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:xml});
        App.startSim(); await new Promise(r=>setTimeout(r,700));
        const w=t=>{const c=App.project.components.find(c=>c.type===t), s=App.circuit.states[c.id]; if(!s||!s.running) return 'steht'; return (((s.dir<0)!==(t==='wheelR'))?'vor ':'zurück ')+Math.round(s.speed*100)+'%';};
        out.push(n.padEnd(14)+' links: '+w('wheelL').padEnd(12)+' rechts: '+w('wheelR')); App.stopSim();
      }
      return out;}""")
    print('\n'.join(r)); print('Fehler:', errs)
