from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':1400,'height':900}); pg = ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    # alter Entwurf nur im Browser
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(600)
    pg.evaluate("""()=>localStorage.setItem('werkstatt.current', JSON.stringify(Object.assign(App.blankProject('03 – Ampel – Aichler'), {circuit:{components:[{id:'c1',type:'uno',x:0,y:0,rot:0,props:{}}],wires:[]}})))""")
    pg.reload(); pg.wait_for_timeout(900); pg.screenshot(path='u9a.png')
    print('A rescue offered:', pg.locator('[data-act=rescue]').count(), 'items:', pg.locator('.start-item').count())
    # neues Projekt anlegen
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.nach.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '01 – LED – Aichler'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    print('B name:', pg.input_value('#projName'), sorted(os.listdir('/tmp/claude-0/stick/Projekte')))
    pg.evaluate("()=>{ App.circuit.addComponent('uno',300,300); }"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(900); pg.screenshot(path='u9b.png')
    print('C items:', pg.locator('.start-item').all_inner_texts(), 'rescue:', pg.locator('[data-act=rescue]').count())
    pg.click('.start-item.main'); pg.wait_for_timeout(600)
    print('D loaded:', pg.input_value('#projName'), pg.evaluate("()=>App.project.components.length"))
    print(errs or 'no errors'); b.close()
