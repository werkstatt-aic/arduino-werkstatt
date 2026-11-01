from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, accept_downloads=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.screenshot(path='x1a.png')
    pg.select_option('#dlgForm select[name=tisch]','7'.zfill(2)); pg.fill('#dlgForm input[name=nach]','Müller'); pg.fill('#dlgForm input[name=proj]','Start'); pg.click('button[value=new]'); pg.wait_for_timeout(600)
    print('Name:', pg.input_value('#projName'))
    pg.click('#fileBtn'); pg.click('[data-act=examples]'); pg.wait_for_timeout(400)
    pg.screenshot(path='x1b.png')
    pg.click('[data-ex=ampel]'); pg.wait_for_timeout(300)
    print('Vorbelegt:', pg.input_value('#dlgForm select[name=tisch]'), pg.input_value('#dlgForm input[name=nach]'), pg.input_value('#dlgForm input[name=proj]'))
    pg.press('#dlgForm input[name=proj]','Enter'); pg.wait_for_timeout(1200)
    print('Beispiel:', pg.input_value('#projName'), '| Bauteile:', pg.evaluate('App.project.components.length'), '| Dateien:', sorted(os.listdir('/tmp/claude-0/stick2/Projekte')))
    # Sicherung: zweimal speichern
    pg.evaluate("()=>App.save()"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{App.circuit.load({components:[],wires:[]}); App.save();}"); pg.wait_for_timeout(500)
    print('Nach Löschen:', pg.evaluate('App.project.components.length'), '| Sicherungen:', os.listdir('/tmp/claude-0/stick2/Projekte/.sicherungen/07 – Müller – Ampelschaltung'))
    pg.click('#fileBtn'); pg.click('[data-act=backups]'); pg.wait_for_timeout(400)
    print('Liste:', pg.inner_text('#dlgForm .plist'))
    pg.click('#dlgForm .plist li[data-v]'); pg.wait_for_timeout(800)
    print('Wiederhergestellt:', pg.evaluate('App.project.components.length'), '| Name:', pg.input_value('#projName'), '|', pg.inner_text('#toast'))
    with pg.expect_download() as d:
        pg.click('#fileBtn'); pg.click('[data-act=image]')
    dl=d.value; dl.save_as('/tmp/claude-0/t/schaltung.png'); print('Bild:', dl.suggested_filename, os.path.getsize('/tmp/claude-0/t/schaltung.png'))
    with pg.expect_popup() as pp:
        pg.click('#fileBtn'); pg.click('[data-act=print]')
    pop=pp.value; pop.wait_for_timeout(1500); pop.screenshot(path='x1c.png', full_page=True); print('Druck: Bilder', pop.evaluate('[...document.images].map(i=>i.naturalWidth)'))
    print('Fehler:', errs)
