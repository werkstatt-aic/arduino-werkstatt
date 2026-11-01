# Hilfe-Knopf: typische Fehler müssen erkannt werden
from playwright.sync_api import sync_playwright
JS = open('tk5.js').read()
N = lambda x: f'<shadow type="math_number"><field name="NUM">{x}</field></shadow>'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    sols = pg.evaluate(JS)
    def case(title, setup_js, sol='g2', ext=None):
        r = pg.evaluate("""([sol, setup])=>{App.loadProject({format:FORMAT,version:1,name:'01 – T – x',board:sol.board,extensions:sol.ext||[],circuit:JSON.parse(JSON.stringify(sol.circuit)),blocks:sol.blocks}); App.task=null;
          const C=App.circuit, P=App.project; (new Function('App','C','P', setup))(App,C,P); C.renderAll();
          return Advisor.analyze(App).filter(r=>r.level!=='tip').map(r=>r.level.toUpperCase()+': '+r.text+(r.comp?' [Bauteil]':'')+(r.block?' [Block]':''));}""", [sols[sol], setup_js])
        print('--', title); [print('   ', x) for x in r] if r else print('    (nichts erkannt!)')
    # g2: LED rot an D12 mit 220 Ω, Blink mit warten
    case('Vorwiderstand entfernt', "const r=P.components.find(c=>c.type==='resistor'); const l=P.components.find(c=>c.type==='led'); P.components=P.components.filter(c=>c!==r); const w=P.wires; const bb=P.components.find(c=>c.def.isBreadboard); P.wires.push({id:C.newId('w'),a:{c:l.id,p:'K'},b:{c:App.project.components.find(c=>c.def.mcu).id,p:'GND_T'},color:'schwarz',pts:[]});")
    case('LED verkehrt herum (Beine getauscht)', "const l=P.components.find(c=>c.type==='led'); const r=P.components.find(c=>c.type==='resistor'); const u=P.components.find(c=>c.def.mcu); P.components=P.components.filter(c=>c!==l); const n=makeComp('led',900,100,0,{color:'rot'},C.newId('c')); P.components.push(n); P.wires=P.wires.filter(w=>!(w.a.c===u.id&&w.a.p==='D12')); P.wires.push({id:C.newId('w'),a:{c:u.id,p:'D12'},b:{c:n.id,p:'K'},color:'blau',pts:[]}); P.wires.push({id:C.newId('w'),a:{c:n.id,p:'A'},b:{c:r.id,p:'1'},color:'blau',pts:[]});")
    case('Block nutzt D7 (nichts dran), LED an D12 unbenutzt', "App.workspace.getAllBlocks(false).filter(b=>b.type==='ard_digital_write').forEach(b=>b.setFieldValue('7','PIN'));")
    case('Blinken ohne warten', "App.workspace.getAllBlocks(false).filter(b=>b.type==='ard_wait').forEach(b=>b.dispose(true));")
    case('loser Block', "const b=App.workspace.newBlock('ard_digital_write'); b.initSvg(); b.render(); b.moveBy(400,400);")
    fz = pg.evaluate("()=>{const e=EXAMPLES.find(x=>x.id==='fahrzeug'); return {board:e.board,ext:e.ext,circuit:e.circuit,blocks:e.blocks};}"); sols['fz'] = fz
    case('Fahren ohne Einrichten', "App.workspace.getAllBlocks(false).filter(b=>b.type==='car_init').forEach(b=>b.dispose(true));", 'fz')
    case('Taster ohne Pull-down', "const r=P.components.find(c=>c.type==='resistor' && c.props.ohm===10000); P.components=P.components.filter(c=>c!==r);", 'g4')
    case('DHT22 im Block, DHT11 gesteckt', "App.workspace.getAllBlocks(false).filter(b=>b.type==='ard_dht').forEach(b=>b.setFieldValue('22','MODEL'));", 's2')
    case('Ultraschall ohne GND', "P.wires=P.wires.filter(w=>!(w.b && /^bm-/.test(w.b.p) && w.a.p==='6j'));", 's3')
    case('Variable gelesen, nie gesetzt', "const v=App.workspace.createVariable('wert'); const loop=App.workspace.getTopBlocks(false).find(b=>b.type==='ard_loop'); const s=App.workspace.newBlock('ard_serial'); s.initSvg(); const g=App.workspace.newBlock('variables_get'); g.setFieldValue(v.getId(),'VAR'); g.initSvg(); s.getInput('V').connection.connect(g.outputConnection); loop.getInput('DO').connection.connect(s.previousConnection);")
    case('PWM an D12', "App.workspace.getAllBlocks(false).filter(b=>b.type==='ard_digital_write').forEach(b=>{const a=App.workspace.newBlock('ard_analog_write'); a.setFieldValue('12','PIN'); a.initSvg(); b.getParent()&&b.previousConnection.targetConnection.connect(a.previousConnection); b.dispose(true);});")
    case('Getriebemotor direkt am Pin, Treiber ohne GND', """const u=P.components.find(c=>c.def.mcu); const m=makeComp('gearmotor',600,100,0,{},C.newId('c')); P.components.push(m); P.wires.push({id:C.newId('w'),a:{c:u.id,p:'D9'},b:{c:m.id,p:'P'},color:'blau',pts:[]});
      const d=makeComp('l298n',700,300,0,{},C.newId('c')); P.components.push(d);""")
    # Tipps: leeres Projekt, Aufgabe
    t = pg.evaluate("""()=>{App.loadProject(App.blankProject('01 – T – leer')); App.task=null; const a=Advisor.analyze(App).map(r=>r.level+': '+r.text);
      App.circuit.addTemplate(400,300); const b=Advisor.analyze(App).map(r=>r.level+': '+r.text);
      App.task={...TaskStore.get('g3'), tipsShown:0}; const c=Advisor.analyze(App).map(r=>r.level+': '+r.text); return {a,b,c};}""")
    print('-- leer:', t['a']); print('-- nur Vorlage:', t['b']); print('-- Aufgabe Ampel:', *(['\n    ' + x for x in t['c']]))
    # Dialog: Zeigen-Knopf
    pg.evaluate("""()=>{const e=EXAMPLES.find(x=>x.id==='ampel'); App.loadProject({format:FORMAT,version:1,name:'01 – T – y',board:'uno',extensions:[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks}); App.task=null;
      App.workspace.getAllBlocks(false).filter(b=>b.type==='ard_digital_write' && b.getFieldValue('PIN')==='12').forEach(b=>b.setFieldValue('7','PIN'));}""")
    pg.click('#adviceBtn'); pg.wait_for_timeout(400)
    pg.screenshot(path='adv_dlg.png')
    pg.click('[data-show]'); pg.wait_for_timeout(500)
    print('Zeigen →', pg.evaluate("()=>document.querySelector('#main').className"), pg.evaluate("()=>{const s=Blockly.selected; return s? s.type+' '+s.getFieldValue('PIN') : (App.circuit.sel? JSON.stringify(App.circuit.sel):'-')}"))
    print('Fehler:', errs)
