"""Netzwerk-Version: Ordner schreibgeschützt, Benutzer „schueler“ – Projekte im persönlichen Ordner"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8642/'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='03';f.vor.value='Mia';f.proj.value='Ampel'}"); pg.click('button[value=new]'); pg.wait_for_timeout(800)
    pg.evaluate("()=>{App.circuit.addTemplate(365,430); App.circuit.renderAll(); App.changed();}"); pg.wait_for_timeout(2500)
    print('Projektliste:', pg.evaluate("async()=>(await (await fetch('api/list')).json()).map(p=>p.file)"))
    # Hochladen (Ersatz-Compiler)
    r = pg.evaluate("""async()=>{const res=await fetch('api/upload?fqbn=arduino:avr:uno&port=COM3',{method:'POST',body:'void setup(){}\\nvoid loop(){}'}); return (await res.text()).split('\\n').filter(l=>l.startsWith('##')).join(' | ');}""")
    print('Hochladen:', r)
    r = pg.evaluate("""async()=>{const res=await fetch('api/tools/install?board=uno',{method:'POST'}); return (await res.text()).split('\\n').filter(l=>l.startsWith('##')).join(' | ');}""")
    print('Einrichten:', r[:160])
    r = pg.evaluate("""async()=>{const res=await fetch('api/update/install?from=github',{method:'POST'}); return (await res.text()).split('\\n').filter(l=>l.startsWith('##')).join(' | ');}""")
    print('Update:', r[:120])
    # gelöste Aufgabe merken
    print('gelöst speichern:', pg.evaluate("async()=>(await fetch('api/solved',{method:'POST',body:JSON.stringify({g1:'2026-11-03'})})).status"))
    pg.evaluate("()=>Settings.open(App)"); pg.wait_for_timeout(800)
    print('Einstellungen:', pg.inner_text('#dlg .set-sec').replace('\n', ' | ')[:400])
    print('gesperrt:', pg.evaluate("()=>[...document.querySelectorAll('#dlg button:disabled')].map(b=>b.textContent.trim())"))
    pg.screenshot(path='net1.png')
    print('Fehler:', errs)
    b.close()
