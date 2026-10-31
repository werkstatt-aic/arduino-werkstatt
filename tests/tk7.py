from playwright.sync_api import sync_playwright
JS = open('tk5.js').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8642/'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{const d=document.querySelector('#dlg'); if(d.open) d.close();}")
    sols = pg.evaluate(JS)
    run = """async ([tid, sol, fix]) => {
      App.loadProject({ format: FORMAT, version: 1, name: '04 – Test – ' + tid, board: sol.board, extensions: sol.ext || [], circuit: JSON.parse(JSON.stringify(sol.circuit)), blocks: fix(sol.blocks) });
      App.task = { ...TaskStore.get(tid) }; TaskUi.render();
      document.querySelector('#taskPanel [data-act=check]').click();
      await new Promise(r => setTimeout(r, 100));
      while (TaskChecker.running) await new Promise(r => setTimeout(r, 100));
      return App.task.results.map(r => (r.ok ? '✓ ' : '✗ ') + TASK_CHECKS[r.check.k].label(r.check) + (r.ok ? '' : ' — ' + (r.hint || '')));
    }"""
    # Blinken mit 0,5 s statt 1 s
    print('Blinken 0,5 s:', *pg.evaluate(run.replace('fix(sol.blocks)', "sol.blocks.replace(/<field name=\"NUM\">1<\\/field>/g, '<field name=\"NUM\">0.5</field>')"), ['g2', sols['g2'], None]), sep='\n  ')
    # PWM an D12 (kein ~): LED an D12 der Lösung g1 mit PWM 100
    pwm = "sol.blocks.replace(/<block type=\"ard_digital_write\"><field name=\"PIN\">12<\\/field><field name=\"V\">HIGH<\\/field><\\/block>/, '<block type=\"ard_analog_write\"><field name=\"PIN\">12</field><value name=\"V\"><shadow type=\"math_number\"><field name=\"NUM\">100</field></shadow></value></block>')"
    print('PWM an D12:', *pg.evaluate(run.replace('fix(sol.blocks)', pwm), ['g6', sols['g1'], None]), sep='\n  ')
    print('Auswahl PWM-Block (Uno):', pg.evaluate("()=>{const b=App.workspace.newBlock('ard_analog_write'); const o=b.getField('PIN').getOptions().map(x=>x[0]); b.dispose(); return o.join(' ');}"))
    print('Fehler:', errs)
