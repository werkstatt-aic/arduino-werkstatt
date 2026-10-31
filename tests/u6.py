from playwright.sync_api import sync_playwright
JS = r"""()=>{ Blockly.Events.disable(); App.workspace.clear();
 Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom('<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup"><statement name="DO"><block type="ard_lcd_print"><value name="V"><block type="text"><field name="TEXT">Grüße 23°C</field></block></value><next><block type="oled_print"><value name="V"><block type="text"><field name="TEXT">Grüße 23°C</field></block></value></block></next></block></statement></block></xml>'), App.workspace);
 Blockly.Events.enable(); return generateArduinoCode(App.workspace).split('\n').filter(l=>l.includes('print')).join(' | '); }"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(800)
    print(pg.evaluate(JS)); b.close()
