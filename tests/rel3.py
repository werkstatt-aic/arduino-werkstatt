"""Neues Relais-Modul: Zeichnung (an/aus, H/L), altes Projekt mit Relais in der Steckplatine wird umgestellt"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    # Einzelbild: vier Zustände
    html = pg.evaluate("""()=>{const css=[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('')}catch(e){return ''}}).join('');
      const one=(props,st,x,y)=>{const c=makeComp('relay',0,0,0,props,'x1'); return `<g transform="translate(${x},${y})">${COMPONENTS.relay.render(c,st)}</g>`;};
      return `<style>${css}</style><svg class="circuit" width="900" height="560" style="background:#f4f4f2;width:900px;height:560px;position:static"><g transform="scale(2.1)">`+one({trig:'H'},null,100,110)+one({trig:'H'},{on:true},310,110)+one({trig:'L'},{on:false},100,230)+one({trig:'L'},{on:true},310,230)+'</g></svg>';}""")
    pg2 = b.new_page(viewport={'width': 900, 'height': 560}); pg2.set_content(html); pg2.screenshot(path='rel3.png'); pg2.close()
    # altes Projekt: Relais mit Stiftleiste in der Steckplatine (wie tk5 bis 0.12.12)
    r = pg.evaluate("""async ()=>{
      const C=App.circuit; C.load({components:[],wires:[]}); C.addTemplate(365,430);
      const P=C.project, bb=P.components.find(c=>c.type==='breadboard');
      const hole=(c,r)=>({x:bb.x+20+(c-1)*10, y:bb.y+({h:130})[r]});
      const h=hole(20,'h'); const old={id:'c900',type:'relay',x:h.x,y:h.y,rot:0,props:{trig:'H'}};
      const data=C.toJSON(); data.components.push(old);
      const w=(a,b,color)=>data.wires.push({id:'w'+(900+data.wires.length),a,b,color,pts:[]});
      const col=(c)=>({x:bb.x+20+(c-1)*10});
      w({c:bb.id,p:'20j'},{c:bb.id,p:'bp-20'},'rot'); w({c:bb.id,p:'21j'},{c:bb.id,p:'bm-21'},'schwarz');
      const uno=P.components.find(c=>c.def.mcu); w({c:uno.id,p:'D7'},{c:bb.id,p:'22j'},'blau');
      const xml='<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="30" y="30"></block><block type="ard_loop" x="30" y="150"><statement name="DO"><block type="ard_digital_write"><field name="PIN">7</field><field name="V">HIGH</field></block></statement></block></xml>';
      App.loadProject({format:FORMAT,version:1,name:'04 – Test – Relais'+Date.now(),board:'uno',extensions:[],circuit:data,blocks:xml});
      const nw=App.circuit.project.wires.filter(x=>x.a.c==='c900').map(x=>x.a.p+'→'+x.b.p+' '+x.color);
      App.startSim(); await new Promise(r=>setTimeout(r,800));
      const st=App.circuit.states['c900']; const dbg=[App.sim.running, Object.keys(App.circuit.states||{}).length, [...document.querySelectorAll('#msgs li')].map(l=>l.textContent.slice(0,80))]; App.stopSim();
      return {kabel: nw, an: st && st.on, dbg};}""")
    print('altes Projekt:', r)
    pg.screenshot(path='rel3_alt.png')
    print('Fehler:', errs)
    b.close()
