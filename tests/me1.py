# Erweiterung „Motoren“: Bauteilleiste, Werkzeugkasten, automatisches Einschalten, Aufgaben, Beispiel
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    vis = "()=>['motor','gearmotor','stepper','mdriver','l298n','servo','relay'].map(t=>{const e=document.querySelector(`.part[data-type=${t}]`); return t+':'+(e&&e.offsetParent?'ja':'nein')}).join(' ')"
    cats = "()=>App.workspace.getToolbox().getToolboxItems().map(i=>i.getName&&i.getName()).filter(Boolean).join(',')"
    out = "()=>{const t=App.workspace.getToolbox(); const it=t.getToolboxItems().find(i=>i.getName&&i.getName()==='Ausgang'); t.setSelectedItem(it); const r=App.workspace.getFlyout().getWorkspace().getTopBlocks(true).map(b=>b.type).join(','); t.clearSelection(); return r;}"
    print('ohne Erweiterung | Bauteile:', pg.evaluate(vis)); print('  Kategorien:', pg.evaluate(cats)); print('  Ausgang:', pg.evaluate(out))
    pg.evaluate("()=>App.setExtensions(['motoren'])"); pg.wait_for_timeout(200)
    print('mit Erweiterung | Bauteile:', pg.evaluate(vis)); print('  Kategorien:', pg.evaluate(cats))
    print('  Motoren-Blöcke:', pg.evaluate("()=>{const t=App.workspace.getToolbox(); t.setSelectedItem(t.getToolboxItems().find(i=>i.getName&&i.getName()==='Motoren')); const r=App.workspace.getFlyout().getWorkspace().getTopBlocks(true).map(b=>b.type).join(','); t.clearSelection(); return r;}"))
    print('  Dialog:', pg.evaluate("()=>{App.extensionDialog(); const t=[...document.querySelectorAll('.extlist b')].map(b=>b.textContent).join(' | '); document.querySelector('#dlg').close(); return t;}"))
    # älteres Projekt ohne Erweiterung, aber mit Motor und Block
    pg.evaluate("""()=>{const e=EXAMPLES.find(x=>x.id==='motor'); App.loadProject({format:FORMAT,version:1,name:'01 – Alt – Motor',board:'uno',extensions:[],circuit:JSON.parse(JSON.stringify(e.circuit)),blocks:e.blocks});}""")
    print('altes Projekt mit Motor →', pg.evaluate("()=>App.extensions.join(',')"), '| gespeichert:', pg.evaluate("()=>App.projectData().extensions.join(',')"))
    pg.evaluate("""()=>App.loadProject({format:FORMAT,version:1,name:'01 – Alt – Block',board:'uno',extensions:[],circuit:{components:[],wires:[]},blocks:'<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_loop" x="20" y="20"><statement name="DO"><block type="ard_stepper"></block></statement></block></xml>'})""")
    print('nur Schrittmotor-Block →', pg.evaluate("()=>App.extensions.join(',')"))
    pg.evaluate("()=>App.loadProject(App.blankProject('01 – Neu – Leer'))")
    print('neues Projekt →', repr(pg.evaluate("()=>App.extensions.join(',')")))
    # Beispiel und Aufgabe
    pg.evaluate("()=>TaskUi.start(TaskStore.get('m3'))"); pg.wait_for_timeout(200)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='03';f.vor.value='Test'}"); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(500)
    print('Aufgabe Schrittmotor →', pg.evaluate("()=>App.extensions.join(',')"), '| Bauteil sichtbar:', pg.evaluate("()=>!!document.querySelector('.part[data-type=stepper]').offsetParent"))
    pg.evaluate("()=>TaskUi.start(TaskStore.get('m4'))"); pg.wait_for_timeout(200)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='03';f.vor.value='Test'}"); pg.click('#dlgForm button[value=ok]'); pg.wait_for_timeout(500)
    print('Aufgabe Relais →', repr(pg.evaluate("()=>App.extensions.join(',')")))
    pg.screenshot(path='me1.png')
    print('Fehler:', errs)
