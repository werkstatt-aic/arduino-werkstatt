from playwright.sync_api import sync_playwright
T=lambda s:f'<shadow type="text"><field name="TEXT">{s}</field></shadow>'
N=lambda s:f'<shadow type="math_number"><field name="NUM">{s}</field></shadow>'
XML=f'''<xml xmlns="https://developers.google.com/blockly/xml"><block type="ard_setup" x="0" y="0"><statement name="DO"><block type="com_bt_init"><value name="N">{T("ESP-07")}</value></block></statement></block>
<block type="ard_loop" x="0" y="150"><statement name="DO"><block type="controls_if"><value name="IF0"><block type="com_bt_avail"></block></value><statement name="DO0"><block type="com_bt_send"><value name="V"><block type="ard_join"><value name="A">{T("Echo: ")}</value><value name="B"><block type="com_bt_text"></block></value></block></value>
<next><block type="ard_servo"><field name="PIN">13</field><value name="DEG"><block type="com_bt_num"></block></value></block></next></block></statement>
<next><block type="controls_if"><value name="IF0"><block type="com_bt_conn"></block></value><statement name="DO0"><block type="ard_wait"><value name="N">{N(0.2)}</value></block></statement></block></next></block></statement></block></xml>'''
MOCK = r"""
window.FakeBle = { sent: [], notify: null };
Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async (o) => {
  FakeBle.filter = JSON.stringify(o);
  const dev = new EventTarget(); dev.name = 'ESP-07';
  const tx = new EventTarget(); tx.startNotifications = async () => { FakeBle.notify = (s) => { const v = new DataView(new TextEncoder().encode(s).buffer); Object.defineProperty(tx, 'value', { value: v, configurable: true }); tx.dispatchEvent(new Event('characteristicvaluechanged')); }; };
  const rx = { writeValueWithResponse: async (d) => FakeBle.sent.push(new TextDecoder().decode(d)) };
  dev.gatt = { connect: async () => ({ getPrimaryService: async (u) => ({ getCharacteristic: async (c) => c.endsWith('0003-b5a3-f393-e0a9-e50e24dcca9e') ? tx : rx }) }), disconnect: () => dev.dispatchEvent(new Event('gattserverdisconnected')) };
  return dev; } } });
"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(MOCK)
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='07';f.vor.value='Blue';f.proj.value='Zahn'}"); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    pg.select_option('#boardSel','esp32'); pg.wait_for_timeout(300)
    pg.evaluate("()=>{App.setExtensions(['comm']); App.circuit.addTemplate(365,430,false);}")
    pg.evaluate('(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace);}', XML)
    code=pg.evaluate("()=>{Uploader.app=App; return Uploader.fullCode();}"); open('/tmp/claude-0/cpp/out/bt_msg.cpp','w').write(code)
    code2=pg.evaluate("()=>{BT_OPT.on=true; const c=Uploader.fullCode(); BT_OPT.on=false; return c;}"); open('/tmp/claude-0/cpp/out/bt_msg_upl.cpp','w').write(code2)
    # Simulation
    pg.click('#simBtn'); pg.wait_for_timeout(1200); pg.click('#tabComm'); pg.wait_for_timeout(200)
    pg.fill('.bt-in input','90'); pg.click('.bt-in button'); pg.wait_for_timeout(1200)
    print('BT-Panel:', pg.inner_text('#comm').split('Bluetooth')[-1].replace('\n',' | ')[:200])
    pg.screenshot(path='bt1.png'); pg.click('#simBtn'); pg.wait_for_timeout(300)
    # Monitor per Bluetooth
    pg.click('#tabSerial'); print('BT-Knopf sichtbar:', pg.is_visible('#serialBt'))
    pg.click('#serialBt'); pg.wait_for_timeout(500)
    pg.evaluate("()=>FakeBle.notify('Messwert 42\\n')"); pg.wait_for_timeout(200)
    pg.fill('#serialText','Hallo ESP'); pg.press('#serialText','Enter'); pg.wait_for_timeout(300)
    print('Monitor:', pg.inner_text('#serial').replace('\n',' | '), '| gesendet:', pg.evaluate('FakeBle.sent'), '| Knopf:', pg.inner_text('#serialBt'))
    pg.click('#serialBt'); pg.wait_for_timeout(300); print('nach Trennen:', pg.inner_text('#serialBt'))
    pg.select_option('#boardSel','uno'); pg.wait_for_timeout(300); print('Uno: BT-Knopf sichtbar:', pg.is_visible('#serialBt'))
    print('Fehler:', errs)
