from playwright.sync_api import sync_playwright
MOCK = r"""
window.FakeESP = { mode: 'ok', received: 0, size: 0, cmds: [], name: 'ESP-Aichler' };
const svcU = '8e4f0001-6a1b-4c5e-9d2a-7765726b7374';
navigator.bluetooth = { requestDevice: async (opt) => {
  FakeESP.filter = JSON.stringify(opt);
  if (FakeESP.mode === 'cancel') { const e = new Error('User cancelled the requestDevice() chooser.'); e.name = 'NotFoundError'; throw e; }
  let ctrlVal = 'BEREIT', connected = false;
  const ctrl = { writeValueWithResponse: async (b) => { const t = new TextDecoder().decode(b); FakeESP.cmds.push(t);
      if (t.startsWith('START ')) { const p = t.split(' '); FakeESP.size = +p[1]; FakeESP.md5 = p[2] || ''; FakeESP.received = 0; FakeESP.nr = 0; FakeESP.wr = 0; ctrlVal = FakeESP.mode === 'full' ? 'FEHLER Speicher' : 'OK'; }
      else if (t === 'ENDE') ctrlVal = FakeESP.received === FakeESP.size ? 'FERTIG' : 'FEHLER Pruefung';
      else if (t === 'ABBRUCH') ctrlVal = 'ABGEBROCHEN'; },
    readValue: async () => new DataView(new TextEncoder().encode(ctrlVal).buffer) };
  const recv = (b) => { if (FakeESP.mode === 'drop' && FakeESP.received > 20000) { const e = new Error('GATT Server is disconnected. Cannot perform GATT operations.'); e.name = 'NetworkError'; throw e; }
      if (b.byteLength > (FakeESP.mtu || 512)) { const e = new Error('Value too long'); e.name = 'InvalidModificationError'; throw e; }
      FakeESP.received += b.byteLength; };
  const data = { writeValueWithResponse: async (b) => { await new Promise(r => setTimeout(r, 1)); recv(b); FakeESP.wr++; },
                 writeValueWithoutResponse: async (b) => { if (FakeESP.old) { const e = new Error('GATT operation not permitted.'); e.name = 'NotSupportedError'; throw e; } recv(b); FakeESP.nr++; },
                 get properties() { return { write: true, writeWithoutResponse: !FakeESP.old && !FakeESP.oldNoProps }; } };
  const svc = { getCharacteristic: async (u) => u.endsWith('0002-6a1b-4c5e-9d2a-7765726b7374') ? ctrl : data };
  return { name: FakeESP.name, gatt: { connect: async () => ({ getPrimaryService: async (u) => { if (FakeESP.mode === 'noservice') { const e = new Error('No Services matching UUID found in Device.'); e.name = 'NotFoundError'; throw e; } return svc; } }),
                                       disconnect: () => { FakeESP.disconnected = true; } } };
} };
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(MOCK)
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.vor.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '08 – Bluetooth – Aichler'); pg.click('button[value=new]'); pg.wait_for_timeout(400)
    pg.select_option('#boardSel', 'esp32'); pg.wait_for_timeout(300)
    pg.click('#uploadBtn'); pg.wait_for_timeout(400); pg.click('#upGo'); pg.wait_for_timeout(5000)   # ESP32-Einrichtung
    pg.click('#upGo'); pg.wait_for_timeout(800)
    print('Name vorbelegt:', pg.input_value('#btName'), '| Bluetooth an:', pg.is_checked('#btOn'))
    # 1) einmal per USB mit Bluetooth-Empfänger
    pg.check('#btOn'); pg.wait_for_timeout(200); pg.click('#upGo'); pg.wait_for_timeout(2500)
    print('USB:', pg.inner_text('#upMsg'))
    # 2) per Bluetooth
    pg.click('.up-mode button[data-mode=bt]'); pg.wait_for_timeout(200)
    print('BT-Modus: Anschlusswahl versteckt:', pg.is_hidden('#upUsb'), '| Haken gesperrt:', pg.is_disabled('#btOn'))
    pg.click('#upGo'); pg.wait_for_timeout(9000)
    print('BT ok:', pg.inner_text('#upMsg'), '| Bytes:', pg.evaluate('()=>[FakeESP.received, FakeESP.size, FakeESP.cmds.filter(c=>c!=="").join(","), FakeESP.nr, FakeESP.wr]'))
    pg.screenshot(path='b1.png')
    # kleine MTU: Rückfall auf kleinere Pakete
    pg.evaluate("()=>{FakeESP.mtu=200}"); pg.click('#upGo'); pg.wait_for_timeout(9000)
    print('BT kleine MTU:', pg.inner_text('#upMsg'), '| Bytes:', pg.evaluate('()=>[FakeESP.received, FakeESP.size, FakeESP.nr, FakeESP.wr]'))
    # alter Empfänger ohne "Schreiben ohne Bestätigung"
    pg.evaluate("()=>{FakeESP.mtu=512; FakeESP.old=true}"); pg.click('#upGo'); pg.wait_for_timeout(9000)
    print('BT alter Empfänger:', pg.inner_text('#upMsg'), '| Bytes:', pg.evaluate('()=>[FakeESP.received, FakeESP.size, FakeESP.nr, FakeESP.wr]'))
    pg.evaluate("()=>{FakeESP.old=false}")
    print('Schritte:', pg.inner_text('#upSteps') if pg.query_selector('#upSteps') else pg.inner_text('.up-steps'))
    for mode in ['noservice', 'full', 'drop', 'cancel']:
        pg.evaluate(f"()=>{{ FakeESP.mode='{mode}'; FakeESP.cmds=[]; }}"); pg.click('#upGo'); pg.wait_for_timeout(6000)
        print(f'{mode}:', pg.inner_text('#upMsg'), '| Befehle:', pg.evaluate('()=>FakeESP.cmds.join(",")'))
    print('Filter:', pg.evaluate('()=>FakeESP.filter'))
    pg.click('#dlgForm button[value=cancel]'); pg.wait_for_timeout(1200)
    print('Gespeichert:', pg.evaluate("()=>App.projectData().bt"))
    pg.click('#modeCode'); pg.click('#tabText'); pg.wait_for_timeout(300)
    print('Code enthält Empfänger:', 'werkstattBluetooth();' in pg.inner_text('#textcode'), '| Name:', 'BLEDevice::init("ESP-Aichler")' in pg.inner_text('#textcode'))
    print(errs or 'no errors'); b.close()
