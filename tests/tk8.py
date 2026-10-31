import subprocess
from playwright.sync_api import sync_playwright
JS = open('tk5.js').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    sols = pg.evaluate(JS)
    for tid, sol in sols.items():
        code = pg.evaluate("""(sol)=>{App.loadProject({format:FORMAT,version:1,name:'01 – a – b',board:sol.board,extensions:sol.ext||[],circuit:sol.circuit,blocks:sol.blocks}); Uploader.app=App; return Uploader.fullCode();}""", sol)
        f = f'/tmp/claude-0/cpp/out/task_{tid}.cpp'; open(f, 'w').write(code)
        if sol['board'] == 'uno':
            r = subprocess.run(['g++', '-std=gnu++11', '-fsyntax-only', '-Wall', '-Wno-unused-variable', '-I', '/tmp/claude-0/cpp/inc', '-include', 'Arduino.h', '-x', 'c++', f], capture_output=True, text=True)
            print(tid, 'Uno:', 'OK' if r.returncode == 0 else 'FEHLER\n' + r.stderr[:1500])
        else: print(tid, 'ESP32: Code erzeugt')
