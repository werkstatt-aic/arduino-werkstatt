from playwright.sync_api import sync_playwright
XML = '''<xml xmlns="https://developers.google.com/blockly/xml">
<variables><variable id="v1">Länge</variable><variable id="v2">temp</variable><variable id="v3">x</variable><variable id="i">i</variable></variables>
<block type="ard_setup" x="0" y="0"><statement name="DO">
 <block type="variables_set"><field name="VAR" id="v2">temp</field><value name="VALUE"><block type="ard_tmp36"><field name="PIN">A0</field><field name="UNIT">C</field></block></value>
 <next><block type="variables_set"><field name="VAR" id="v1">Länge</field><value name="VALUE"><block type="math_constrain"><value name="VALUE"><block type="variables_get"><field name="VAR" id="v2">temp</field></block></value><value name="LOW"><shadow type="math_number"><field name="NUM">0</field></shadow></value><value name="HIGH"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block></value>
 <next><block type="controls_repeat_ext"><value name="TIMES"><block type="math_random_int"><value name="FROM"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="TO"><shadow type="math_number"><field name="NUM">6</field></shadow></value></block></value>
 <next><block type="ard_count"><field name="VAR" id="i">i</field><value name="FROM"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="TO"><block type="ard_analog_read"><field name="PIN">A1</field></block></value><value name="STEP"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
 <next><block type="procedures_callnoreturn"><mutation name="zeige"><arg name="wert"></arg></mutation><value name="ARG0"><block type="variables_get"><field name="VAR" id="v2">temp</field></block></value></block></next>
 </block></next></block></next></block></next></block></statement></block>
<block type="procedures_defnoreturn" x="0" y="400"><mutation><arg name="wert" varid="v3"></arg></mutation><field name="NAME">zeige</field><statement name="STACK"><block type="ard_serial"><value name="V"><block type="variables_get"><field name="VAR" id="v3">x</field></block></value></block></statement></block>
</xml>'''
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("n=>{const f=document.querySelector('#dlgForm');const p=n.split(/\s+[-–]\s+/);f.tisch.value=p[0].padStart(2,'0');f.nach.value=p[1];f.proj.value=p.slice(2).join(' – ')}", '11 – Test – Aichler'); pg.click('button[value=new]'); pg.wait_for_timeout(300)
    code = pg.evaluate('''(x)=>{App.workspace.clear(); Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(x), App.workspace); return generateArduinoCode(App.workspace);}''', XML)
    print(code)
