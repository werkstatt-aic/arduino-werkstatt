# Alle Blöcke des Werkzeugkastens (mit allen Erweiterungen) für ESP32-C5 und ESP8266 erzeugen,
# danach mit dem echten Compiler übersetzen (siehe ENTWICKLUNG.md: /root/ard)
from playwright.sync_api import sync_playwright
EXT = ['neopixel', 'keypad', 'multimeter', 'oled', 'comm', 'motoren']
ALL = r"""(ext)=>{
  App.setExtensions(ext);
  const ws = App.workspace; Blockly.Events.disable(); ws.clear();
  const xml = new DOMParser().parseFromString(buildToolbox(ext), 'text/xml');
  const loop = ws.newBlock('ard_loop'); loop.initSvg(); let conn = loop.getInput('DO').connection; let n = 0;
  for (const el of xml.querySelectorAll('category > block')) {
    const b = Blockly.Xml.domToBlock(el, ws);
    if (b.previousConnection) { conn.connect(b.previousConnection); let last = b; while (last.getNextBlock()) last = last.getNextBlock(); conn = last.nextConnection; }
    else if (b.outputConnection) {
      const v = ws.createVariable('wert' + (++n));
      const s = ws.newBlock('variables_set'); s.initSvg(); s.setFieldValue(v.getId(), 'VAR');
      s.getInput('VALUE').connection.connect(b.outputConnection);
      conn.connect(s.previousConnection); conn = s.nextConnection;
    }
  }
  Blockly.Events.enable();
  Uploader.app = App;
  return Uploader.fullCode();
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(1200); pg.keyboard.press('Escape')
    for key in ['esp32c5', 'esp8266']:
        pg.select_option('#boardSel', key); pg.wait_for_timeout(300)
        code = pg.evaluate(ALL, EXT)
        open(f'/tmp/claude-0/t/alle_{key}.ino', 'w').write(code)
        print(key, len(code.splitlines()), 'Zeilen', '| BT im Code:', 'NimBLE' in code)
    print('Fehler:', errs)
    b.close()
