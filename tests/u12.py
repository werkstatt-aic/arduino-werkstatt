from playwright.sync_api import sync_playwright
import subprocess, os, json
exec(open('u2.py').read().split("SETUP = ")[0].split("import json")[1])
ALL = r"""()=>{
  const ws = App.workspace; Blockly.Events.disable(); ws.clear();
  const xml = new DOMParser().parseFromString(buildToolbox(['neopixel','keypad','multimeter','oled']), 'text/xml');
  const loop = ws.newBlock('ard_loop'); loop.initSvg(); let conn = loop.getInput('DO').connection; let n = 0;
  for (const el of xml.querySelectorAll('category > block')) {
    const b = Blockly.Xml.domToBlock(el, ws);
    if (b.previousConnection) { conn.connect(b.previousConnection); conn = b.nextConnection || b.getInput('DO') && b.getInput('DO').connection || conn; let last=b; while (last.getNextBlock()) last=last.getNextBlock(); conn = last.nextConnection; }
    else if (b.outputConnection) {
      const v = ws.createVariable('wert' + (++n));
      const s = ws.newBlock('variables_set'); s.initSvg(); s.setFieldValue(v.getId(), 'VAR');
      s.getInput('VALUE').connection.connect(b.outputConnection);
      conn.connect(s.previousConnection); conn = s.nextConnection;
    }
  }
  Blockly.Events.enable();
  return generateArduinoCode(ws);
}"""
def prog(pg, xml):
    return pg.evaluate("(xml)=>{ T.blocks(xml); return generateArduinoCode(App.workspace); }", xml)
N = lambda v: f'<block type="math_number"><field name="NUM">{v}</field></block>'
T_ = lambda v: f'<block type="text"><field name="TEXT">{v}</field></block>'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900); pg.evaluate(H)
    progs = {}
    progs['alle_bloecke'] = pg.evaluate(ALL)
    progs['countdown'] = prog(pg, '<variables><variable id="x">x</variable></variables><block type="ard_setup"><statement name="DO"><block type="ard_lcd_init"><next><block type="ard_lcd_backlight"><next><block type="ard_count"><field name="VAR" id="x">x</field><value name="FROM">'+N(10)+'</value><value name="TO">'+N(0)+'</value><value name="STEP">'+N(1)+'</value><statement name="DO"><block type="ard_lcd_clear"><next><block type="ard_lcd_pos"><value name="COL">'+N(7)+'</value><value name="ROW">'+N(0)+'</value><next><block type="ard_lcd_print"><value name="V"><block type="variables_get"><field name="VAR" id="x">x</field></block></value><next><block type="ard_wait"><value name="N">'+N(1)+'</value></block></next></block></next></block></next></block></statement></block></next></block></next></block></statement></block><block type="ard_loop" y="300"></block>')
    progs['countdown_var'] = prog(pg, '<variables><variable id="x">x</variable><variable id="e">ende</variable></variables><block type="ard_setup"><statement name="DO"><block type="variables_set"><field name="VAR" id="e">ende</field><value name="VALUE">'+N(3)+'</value><next><block type="ard_count"><field name="VAR" id="x">x</field><value name="FROM"><block type="variables_get"><field name="VAR" id="e">ende</field></block></value><value name="TO">'+N(0)+'</value><value name="STEP">'+N(1)+'</value></block></next></block></statement></block>')
    progs['funktionen'] = prog(pg, '<variables><variable id="a">a</variable><variable id="t">temp</variable></variables><block type="procedures_defreturn" x="300"><mutation><arg name="a" varid="a"></arg></mutation><field name="NAME">doppelt</field><statement name="STACK"><block type="procedures_ifreturn"><mutation value="1"></mutation><value name="CONDITION"><block type="logic_compare"><field name="OP">GT</field><value name="A"><block type="variables_get"><field name="VAR" id="a">a</field></block></value><value name="B">'+N(100)+'</value></block></value><value name="VALUE">'+N(0)+'</value></block></statement><value name="RETURN"><block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A"><block type="variables_get"><field name="VAR" id="a">a</field></block></value><value name="B">'+N(2)+'</value></block></value></block>'
      '<block type="procedures_defnoreturn" x="300" y="200"><field name="NAME">blinken</field><statement name="STACK"><block type="ard_builtin_led"><field name="V">HIGH</field></block></statement></block>'
      '<block type="ard_loop"><statement name="DO"><block type="procedures_callnoreturn"><mutation name="blinken"></mutation><next><block type="variables_set"><field name="VAR" id="t">temp</field><value name="VALUE"><block type="ard_tmp36"><field name="PIN">A0</field></block></value><next><block type="ard_serial"><value name="V"><block type="ard_join"><value name="A">'+T_('T=')+'</value><value name="B"><block type="procedures_callreturn"><mutation name="doppelt"><arg name="a"></arg></mutation><value name="ARG0"><block type="variables_get"><field name="VAR" id="t">temp</field></block></value></block></value></block></value></block></next></block></next></block></statement></block>')
    progs['tastenfeld'] = prog(pg, '<variables><variable id="k">code</variable></variables><block type="ard_setup"><statement name="DO"><block type="kp_init4"><field name="R0">9</field><field name="R1">8</field><field name="R2">7</field><field name="R3">6</field><field name="C0">5</field><field name="C1">4</field><field name="C2">3</field><field name="C3">2</field></block></statement></block><block type="ard_loop"><statement name="DO"><block type="kp_read"><next><block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="kp_key"></block></value><value name="B">'+T_('A')+'</value></block></value><statement name="DO0"><block type="variables_set"><field name="VAR" id="k">code</field><value name="VALUE"><block type="ard_join"><value name="A"><block type="variables_get"><field name="VAR" id="k">code</field></block></value><value name="B"><block type="kp_key"></block></value></block></value></block></statement></block></next></block></statement></block>')
    progs['umlaute'] = prog(pg, '<block type="ard_setup"><statement name="DO"><block type="ard_lcd_print"><value name="V">'+T_('Grüße 23°C')+'</value><next><block type="oled_print"><value name="V">'+T_('Größe "x"')+'</value></block></next></block></statement></block>')
    os.makedirs('/tmp/claude-0/cpp/out', exist_ok=True)
    bad = 0
    for name, code in progs.items():
        f = f'/tmp/claude-0/cpp/out/{name}.cpp'; open(f,'w').write('#include <Arduino.h>\n' + code)
        r = subprocess.run(['g++','-std=gnu++11','-fsyntax-only','-Wall','-Wno-unused-variable','-I','/tmp/claude-0/cpp/inc',f], capture_output=True, text=True)
        ok = r.returncode == 0
        bad += not ok
        print(f'{name}: {"OK" if ok else "FEHLER"} ({len(code.splitlines())} Zeilen)')
        if not ok or r.stderr.strip(): print(r.stderr[:2500])
    print(errs or 'no page errors'); b.close()
