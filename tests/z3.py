from playwright.sync_api import sync_playwright
N=lambda s:f'<shadow type="math_number"><field name="NUM">{s}</field></shadow>'
T=lambda s:f'<shadow type="text"><field name="TEXT">{s}</field></shadow>'
XML=f'''<xml xmlns="https://developers.google.com/blockly/xml"><variables><variable id="x">x</variable></variables><block type="ard_loop" x="0" y="0"><statement name="DO">
<block type="kp_read"><next><block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="kp_key"></block></value><value name="B">{N(5)}</value></block></value><statement name="DO0"><block type="variables_set"><field name="VAR" id="x">x</field><value name="VALUE">{T("fuenf")}</value></block></statement>
<next><block type="variables_set"><field name="VAR" id="x">x</field><value name="VALUE">{N(3)}</value></block></next></block></next></block></statement></block>
<block type="kp_init3" x="0" y="300"></block></xml>'''
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const f=document.querySelector('#dlgForm');f.tisch.value='18';f.nach.value='Typ';f.proj.value='Test'}"); pg.click('button[value=new]'); pg.wait_for_timeout(400)
    code=pg.evaluate('(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace); return generateArduinoCode(App.workspace);}', XML)
    open('/tmp/claude-0/cpp/out/typ.cpp','w').write(code); print(code[code.index('void loop'):])
