from playwright.sync_api import sync_playwright
import json
JS=open('ex_build.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.select_option('#dlgForm select[name=tisch]','14'); pg.fill('#dlgForm input[name=nach]','Bau'); pg.fill('#dlgForm input[name=proj]','Beispiele'); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    ex = pg.evaluate(JS)
    # jedes Beispiel laden, Simulation kurz laufen lassen und Zustände prüfen
    for e in ex:
        data={'format':'arduino-werkstatt','version':1,'name':'14 – Test – '+e['title'],'board':e['board'],'extensions':e.get('ext',[]),'circuit':e['circuit'],'blocks':e['blocks']}
        pg.evaluate('(d)=>App.loadProject(d)', data); pg.wait_for_timeout(400)
        if e['id'] in ('dimmer','servo','motor'):
            pg.evaluate("(v)=>{const c=App.project.components.find(c=>c.type==='poti'); c.props.position=v;}", 20 if e['id']=='motor' else 80)
        pg.evaluate("()=>App.startSim()"); pg.wait_for_timeout(2600)
        if e['id']=='taster':
            pg.evaluate("()=>App.sim.pressButton(App.project.components.find(c=>c.type==='button').id,true)"); pg.wait_for_timeout(500)
        st = pg.evaluate("""()=>{const s=App.circuit.states||{}; const out={}; for(const c of App.project.components){const x=s[c.id]; if(!x) continue;
            if(c.type==='led') out[c.type+'-'+c.props.color]=Math.round(x.brightness*100)/100;
            if(c.type==='uno'||c.type==='esp32exp') out.L=x.led; if(c.type==='servo') out.servo=Math.round(x.angle);
            if(c.type==='gearmotor') out.motor=[x.running, Math.round((x.speed||0)*100)/100]; if(c.type==='lcd') out.lcd=x.lines;}
            return out;}""")
        msgs = pg.inner_text('#msgs').replace('\n',' / ')
        ser = pg.inner_text('#serial')[-60:].replace('\n',' | ')
        print(f"{e['id']:12s}", st, '| Prüfung:', msgs[:90], '| seriell:', ser)
        pg.evaluate("()=>App.stopSim()")
        e['circuit']=pg.evaluate("()=>App.circuit.toJSON()")
    out = '/* Beispielprojekte (erzeugt mit tests/ex_build.py) */\n\'use strict\';\nconst EXAMPLES = ' + json.dumps(ex, ensure_ascii=False, indent=0) + ';\n'
    open('/root/werkstatt/app/js/examples.js','w').write(out)
    print('Fehler:', errs)
