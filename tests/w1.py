from playwright.sync_api import sync_playwright
MOCK = r"""
window.FakeSer = { opened: 0, closed: 0, written: [], signals: [] };
function makePort() {
  let ctrl;
  const port = {
    readable: null, writable: null,
    async open(o) { FakeSer.opened++; FakeSer.baud = o.baudRate;
      port.readable = new ReadableStream({ start(c) { ctrl = c; c.enqueue(new TextEncoder().encode('Hallo vom ESP\r\n')); } });
      port.writable = new WritableStream({ write(ch) { FakeSer.written.push(new TextDecoder().decode(ch)); } }); },
    async close() { FakeSer.closed++; port.readable = null; port.writable = null; },
    async setSignals(s) { FakeSer.signals.push(s); },
  };
  return port;
}
Object.defineProperty(navigator, 'serial', { configurable: true, value: Object.assign(new EventTarget(), { requestPort: async () => makePort(), getPorts: async () => [] }) });
"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(MOCK)
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.select_option('#dlgForm select[name=tisch]','13'); pg.fill('#dlgForm input[name=vor]','Aichler'); pg.fill('#dlgForm input[name=proj]','Seriell'); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.select_option('#boardSel','esp32'); pg.wait_for_timeout(300)
    pg.click('#tabSerial'); pg.click('#serialConn'); pg.wait_for_timeout(800)
    print('Monitor:', pg.inner_text('#serial').replace('\n',' | '), '| Knopf:', pg.inner_text('#serialConn'), '| Baud:', pg.evaluate('FakeSer.baud'))
    pg.fill('#serialText','42'); pg.press('#serialText','Enter'); pg.wait_for_timeout(300)
    print('gesendet:', pg.evaluate('FakeSer.written'))
    pg.click('#uploadBtn'); pg.wait_for_timeout(1500); pg.click('#upGo'); pg.wait_for_timeout(5000)
    print('Upload:', pg.inner_text('#upMsg'), '| geöffnet/geschlossen:', pg.evaluate('[FakeSer.opened, FakeSer.closed]'), '| verbunden:', pg.evaluate('SerialLink.connected'))
    print('Fehler:', errs)
