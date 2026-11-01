from playwright.sync_api import sync_playwright
XML='''<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="0" y="0"><statement name="DO"><block type="ard_lcd_print"><value name="V"><shadow type="text"><field name="TEXT">Hi</field></shadow></value></block></statement></block></xml>'''
XML2=XML.replace('<block type="ard_lcd_print">','<block type="ard_lcd_init"><next><block type="ard_lcd_print">').replace('</block></statement>','</block></next></block></statement>')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '13 – Sim – Test'); pg.click('button[value=new]'); pg.wait_for_timeout(300)
    pg.evaluate("()=>App.circuit.addTemplate ? App.circuit.addTemplate(100,100,false) : null"); pg.wait_for_timeout(300)
    for x in (XML, XML2):
        pg.evaluate('(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace);}', x)
        pg.click('#simBtn'); pg.wait_for_timeout(1200); print(pg.inner_text('#msgs')); pg.click('#simBtn'); pg.wait_for_timeout(300)
    print('Fehler:', errs)
