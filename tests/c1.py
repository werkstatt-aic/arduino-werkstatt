from playwright.sync_api import sync_playwright
import sys
T=lambda s:f'<shadow type="text"><field name="TEXT">{s}</field></shadow>'
N=lambda s:f'<shadow type="math_number"><field name="NUM">{s}</field></shadow>'
XML=f'''<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="w">wert</variable></variables>
<block type="ard_setup" x="0" y="0"><statement name="DO">
<block type="com_wifi_ap"><value name="SSID">{T("ESP-Tisch-11")}</value><value name="PW">{T("werkstatt")}</value><next>
<block type="com_web_start"><value name="T">{T("Mein ESP32")}</value><next>
<block type="com_radio_init"><field name="G">11</field><next>
<block type="ard_serial"><value name="V"><block type="com_wifi_ip"></block></value></block></next></block></next></block></next></block></statement></block>
<block type="ard_loop" x="0" y="300"><statement name="DO">
<block type="com_web_show"><field name="N">Lichtwert</field><value name="V"><block type="ard_analog_read"><field name="PIN">D34</field></block></value><next>
<block type="controls_if"><value name="IF0"><block type="com_web_button"><field name="N">Licht an</field></block></value><statement name="DO0"><block type="ard_digital_write"><field name="PIN">4</field><field name="V">HIGH</field></block></statement><next>
<block type="ard_motor"><field name="IA">25</field><field name="IB">26</field><field name="DIR">1</field><value name="SPEED"><block type="com_web_slider"><field name="N">Tempo</field></block></value><next>
<block type="controls_if"><value name="IF0"><block type="com_usb_avail"></block></value><statement name="DO0"><block type="com_radio_send"><value name="V"><block type="com_usb_text"></block></value><next><block type="variables_set"><field name="VAR" id="w">wert</field><value name="VALUE"><block type="ard_round"><field name="OP">ROUND</field><value name="V"><block type="com_usb_num"></block></value></block></value></block></next></block></statement><next>
<block type="controls_if"><value name="IF0"><block type="com_radio_avail"></block></value><statement name="DO0"><block type="ard_serial"><value name="V"><block type="ard_join"><value name="A">{T("Funk: ")}</value><value name="B"><block type="com_radio_text"></block></value></block></value></block></statement><next>
<block type="ard_serial"><value name="V"><block type="ard_math1"><field name="OP">SQRT</field><value name="V"><block type="com_radio_num"></block></value></block></value><next>
<block type="ard_wait"><value name="N">{N(1)}</value></block></next></block></next></block></next></block></next></block></next></block></next></block></statement></block></xml>'''
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.select_option('#dlgForm select[name=tisch]','11'); pg.fill('#dlgForm input[name=vor]','Aichler'); pg.fill('#dlgForm input[name=proj]','Funk Test'); pg.click('button[value=new]'); pg.wait_for_timeout(500)
    print('Name:', pg.input_value('#projName'))
    pg.select_option('#boardSel','esp32'); pg.wait_for_timeout(300)
    pg.evaluate("()=>App.setExtensions(['comm'])")
    code = pg.evaluate('(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace); App.uploaderTest=1; Uploader.app=App; return Uploader.fullCode();}', XML)
    open('/tmp/claude-0/cpp/out/comm_test.cpp','w').write(code)
    print('Zeilen:', code.count('\n'), '| Fehler:', errs)
