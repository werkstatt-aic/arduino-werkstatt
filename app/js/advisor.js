/* Hilfe-Knopf: prüft Schaltung und Programm ohne Simulation und gibt Fehler, Hinweise und Tipps aus.
   Alle Prüfungen sind feste Regeln (keine KI, kein Internet). Jeder Eintrag kann auf ein Bauteil oder einen Block zeigen. */
'use strict';

const Advisor = {
  /* Ergebnis: [{ level: 'error' | 'warn' | 'tip', text, comp?, block? }] */
  analyze(app) {
    const out = [], add = (level, text, target) => out.push(Object.assign({ level, text }, target || {}));
    const P = app.project, ws = app.workspace;
    const comps = P.components, mcu = comps.find(c => c.def.mcu);
    const blocks = ws.getAllBlocks(false);
    const live = blocks.filter(b => b.isEnabled() && !b.isInFlyout);
    const has = t => live.some(b => b.type === t);
    const name = c => c.def.name;
    const blockText = b => { try { return blockLabel(b); } catch (e) { return b.type; } };
    const task = app.task && !app.task.preview ? app.task : null;

    /* ---------- Grundgerüst ---------- */
    if (!mcu) {
      add('tip', `Zieh zuerst die Vorlage „${BOARD === 'esp32' ? 'ESP32' : 'Arduino'} + Steckplatine“ aus der Bauteilleiste auf die Werkbank. Dann sind Mikrocontroller und Steckplatine schon verbunden.`);
    } else if (mcu.def.mcu.kind !== BOARD) {
      add('error', `In der Schaltung steckt ein ${mcu.def.mcu.kind === 'esp32' ? 'ESP32' : 'Arduino Uno'}, oben ist aber „${BOARD === 'esp32' ? 'ESP32' : 'Arduino Uno'}“ ausgewählt.`, { comp: mcu.id });
    }

    const nl = buildNetlist(P);
    const M = mcu ? mcu.def.mcu : (BOARD === 'esp32' ? ESP_MCU : UNO_MCU);
    const net = (c, p) => nl.net(c.id, p);
    const mnet = p => mcu ? nl.net(mcu.id, p) : -1;
    const n5 = mnet(M.v5), n33 = mnet(M.v33), g = mnet(M.gnd);
    const members = n => (nl.members[n] || []);
    const others = (n, c) => members(n).filter(k => !k.startsWith(c.id + ':'));
    const compOf = k => P.components.find(x => x.id === k.split(':')[0]);
    const hasType = (n, types) => members(n).some(k => { const c = compOf(k); return c && types.includes(c.type); });
    const supplied = n => n === n5 || n === n33 || members(n).some(k => { const c = compOf(k); return c && c.type === 'source' && k.endsWith(':P'); });
    // Anschlüsse des Mikrocontrollers, die man im Programm benutzen kann
    const ioPins = mcu ? mcu.def.pins.filter(p => /^(D\d+|A\d)$/.test(p.id) && !/^D[01]$/.test(p.id)).map(p => p.id) : [];
    const pinOfNet = n => ioPins.find(p => mnet(p) === n);

    if (mcu && n5 >= 0 && n5 === g) add('error', 'Kurzschluss: 5V ist direkt mit GND verbunden. Prüfe die roten und schwarzen Leitungen.');

    /* ---------- Schaltung ---------- */
    for (const c of comps) {
      if (c.type === 'led') {
        const a = net(c, 'A'), k = net(c, 'K');
        const aCon = others(a, c).length > 0, kCon = others(k, c).length > 0;
        if (!aCon && !kCon) { add('warn', 'Eine LED steckt nirgends: Beide Beine sind nicht verbunden.', { comp: c.id }); continue; }
        // verkehrt herum: Anode (langes Bein) führt – direkt oder über einen Widerstand – zu GND, Kathode zu einem Anschluss/5V
        const viaRes = n => members(n).some(k => { const r = compOf(k); if (!r || r.type !== 'resistor') return false; const o = k.endsWith(':1') ? '2' : '1'; return nl.net(r.id, o) === g; });
        if (a === g || (viaRes(a) && (pinOfNet(k) || k === n5 || k === n33))) { add('error', 'LED verkehrt herum: Das lange Bein (Anode, +) zeigt Richtung GND, das kurze zum Anschluss. Dreh die LED um (Taste R zweimal).', { comp: c.id }); continue; }
        if (aCon && !kCon) add('warn', 'Das kurze Bein der LED (Kathode, –) ist mit nichts verbunden. Es muss (über den Vorwiderstand) zu GND.', { comp: c.id });
        if (!aCon && kCon) add('warn', 'Das lange Bein der LED (Anode, +) ist mit nichts verbunden. Es kommt an einen Anschluss des Mikrocontrollers.', { comp: c.id });
        const res = hasType(a, ['resistor']) || hasType(k, ['resistor']);
        if (aCon && kCon && !res && (pinOfNet(a) || a === n5 || a === n33)) add('error', 'LED ohne Vorwiderstand – sie würde durchbrennen. Setze einen Widerstand (z. B. 220 Ω) in Reihe.', { comp: c.id });
      }
      if (c.def.pressable && c.def.sw) {
        const [s1, s2] = c.def.sw.map(p => net(c, p));
        const pin = pinOfNet(s1) ? s1 : pinOfNet(s2) ? s2 : null, other = pin === s1 ? s2 : s1;
        if (pin !== null) {
          if (!hasType(pin, ['resistor'])) add('warn', `Der Taster an ${pinOfNet(pin)} hat keinen Pull-down-Widerstand. Ohne ihn „schwebt“ der Eingang. Setze 10 kΩ vom Eingang nach GND.`, { comp: c.id });
          if (other !== n5 && other !== n33 && !supplied(other)) add('warn', `Die zweite Seite des Tasters an ${pinOfNet(pin)} ist nicht mit 5V verbunden – Drücken ändert dann nichts.`, { comp: c.id });
        } else if (others(s1, c).length + others(s2, c).length > 0 && c.type !== 'touch') {
          add('warn', 'Ein Taster ist mit keinem Anschluss des Mikrocontrollers verbunden.', { comp: c.id });
        }
      }
      const pins = c.def.pins.map(p => p.id);
      if (!c.def.mcu && pins.includes('VCC') && pins.includes('GND') && c.type !== 'l298n' && c.type !== 'mdriver') {
        if (mcu && !moduleSupply(nl, c, 'VCC', 'GND', n5, n33, g)) add('warn', `${name(c)}: keine Versorgung. VCC kommt an 5V (beim ESP32 an 3,3 V), GND an GND.`, { comp: c.id });
      }
      if (['gearmotor', 'wheelL', 'wheelR'].includes(c.type)) {
        const direct = ['P', 'N'].map(p => pinOfNet(net(c, p))).find(Boolean);
        if (direct) add('error', `${name(c)} hängt direkt an ${direct}. Ein Getriebemotor braucht zu viel Strom – schließ ihn über den Motortreiber L298N an.`, { comp: c.id });
        else if (!['P', 'N'].every(p => others(net(c, p), c).length)) add('warn', `${name(c)}: Ein Kabel fehlt (rot an OUT1/OUT3, schwarz an OUT2/OUT4 des Motortreibers).`, { comp: c.id });
      }
      if (c.type === 'l298n' && mcu) {
        if (net(c, 'GND') !== g) add('error', 'Motortreiber L298N: Sein GND muss auch mit GND des Arduino verbunden sein, sonst versteht er die Steuersignale nicht.', { comp: c.id });
        if (!supplied(net(c, 'VS'))) add('warn', 'Motortreiber L298N: Die Motorspannung fehlt. Batterie (+) an „+12V“, (–) an GND.', { comp: c.id });
        if (String(c.props.ena) === '0' && !pinOfNet(net(c, 'ENA'))) add('warn', 'Motortreiber L298N: Der Jumper auf ENA ist entfernt, aber ENA ist nicht angeschlossen – Motor A bleibt aus.', { comp: c.id });
        if (String(c.props.enb) === '0' && !pinOfNet(net(c, 'ENB'))) add('warn', 'Motortreiber L298N: Der Jumper auf ENB ist entfernt, aber ENB ist nicht angeschlossen – Motor B bleibt aus.', { comp: c.id });
      }
    }

    /* ---------- Schaltung und Programm zusammen ---------- */
    const PIN_FIELDS = /^(PIN|TRIG|ECHO|IA|IB|LA|LB|RA|RB|P[1-4]|R\d|C\d)$/;
    const pinId = v => /^[AD]\d/.test(v) ? v : 'D' + v;
    const used = new Map(); // Anschluss → Block
    for (const b of live) for (const inp of b.inputList) for (const f of inp.fieldRow) {
      if (!f.name || !PIN_FIELDS.test(f.name) || !/^(A\d|D?\d+)$/.test(String(f.getValue()))) continue;
      const p = pinId(String(f.getValue()));
      if (!used.has(p)) used.set(p, b);
    }
    if (has('ard_builtin_led')) used.set(M.led, live.find(b => b.type === 'ard_builtin_led'));
    const i2c = has('ard_lcd_init') || has('oled_init') || comps.some(c => ['lcd', 'oled', 'ads1115', 'ina219'].includes(c.type));
    if (mcu) {
      for (const [p, b] of used) {
        if (!ioPins.includes(p) || p === M.led && b.type === 'ard_builtin_led') continue;
        if (!others(mnet(p), mcu).length) add('warn', `Der Block „${blockText(b)}“ nutzt ${p}, aber dort ist in der Schaltung nichts angeschlossen.`, { block: b.id });
      }
      const unused = new Map(); // Bauteil → nicht benutzte Anschlüsse
      for (const p of ioPins) {
        if (used.has(p) || (i2c && /^(A4|A5|D21|D22)$/.test(p))) continue;
        const n = mnet(p), att = others(n, mcu).map(compOf).filter(c => c && !c.def.isBreadboard && c.type !== 'resistor');
        if (n === n5 || n === g || !att.length) continue;
        if (!unused.has(att[0])) unused.set(att[0], []);
        unused.get(att[0]).push(p);
      }
      for (const [c, ps] of unused) add('warn', ps.length > 1 ? `An ${ps.join(', ')} ist das Bauteil „${c.def.name}“ angeschlossen, aber kein Block im Programm benutzt diese Anschlüsse.` : `An ${ps[0]} ist das Bauteil „${c.def.name}“ angeschlossen, aber kein Block im Programm benutzt ${ps[0]}.`, { comp: c.id });
    }
    if (BOARD === 'uno') {
      for (const b of live) {
        const fields = { ard_analog_write: ['PIN'], ard_motor: ['IA', 'IB'], car_init: ['LA', 'LB', 'RA', 'RB'] }[b.type];
        if (!fields) continue;
        const bad = fields.map(f => pinId(b.getFieldValue(f))).filter(p => !UNO_MCU.pwm.includes(p));
        if (bad.length) add('warn', `Der Block „${blockText(b)}“ nutzt ${bad.join(', ')} – dort gibt es kein PWM (nur ganz an oder aus). PWM können nur die Anschlüsse mit ~: D3, D5, D6, D9, D10, D11.`, { block: b.id });
      }
    }
    for (const b of live.filter(b => b.type === 'ard_dht')) {
      const n = mnet(pinId(b.getFieldValue('PIN'))), d = comps.find(c => c.type === 'dht' && net(c, 'DATA') === n);
      if (d && String(d.props.model) !== String(b.getFieldValue('MODEL'))) add('error', `Im Block steht DHT${b.getFieldValue('MODEL')}, in der Schaltung steckt ein DHT${d.props.model}. Stell beides gleich ein.`, { block: b.id });
    }

    /* ---------- Programm ---------- */
    for (const b of ws.getTopBlocks(false)) {
      if (/^(ard_setup|ard_loop|procedures_def)/.test(b.type)) continue;
      if (b.previousConnection || b.outputConnection) add('warn', `Der Block „${blockText(b)}“ liegt lose auf der Fläche und wird nie ausgeführt. Schieb ihn in „beim Start“ oder „für immer“.`, { block: b.id });
    }
    const loop = ws.getTopBlocks(false).find(b => b.type === 'ard_loop'), setup = ws.getTopBlocks(false).find(b => b.type === 'ard_setup');
    const inside = top => top ? top.getDescendants(false).filter(b => b !== top) : [];
    const progEmpty = !inside(loop).length && !inside(setup).length;
    if (loop) {
      const lb = inside(loop);
      const waits = lb.some(b => /^(ard_wait|ard_wait_until|ard_tone|car_drive|ard_stepper)$/.test(b.type) || b.type === 'ard_millis');
      const cond = lb.some(b => /^(controls_if|controls_whileUntil)$/.test(b.type));
      const byPin = {};
      for (const b of lb.filter(b => b.type === 'ard_digital_write' || b.type === 'ard_builtin_led')) {
        const p = b.type === 'ard_builtin_led' ? 'L' : b.getFieldValue('PIN');
        (byPin[p] = byPin[p] || new Set()).add(b.getFieldValue('V'));
      }
      const blink = Object.entries(byPin).find(([, s]) => s.size > 1);
      if (blink && !waits && !cond) add('warn', `Im Dauerlauf wird ${blink[0] === 'L' ? 'die integrierte LED' : 'Anschluss D' + blink[0]} ein- und sofort wieder ausgeschaltet. Ohne „warten“ dazwischen sieht man davon nichts.`, { block: loop.id });
    }
    const NEED = [[/^car_(drive|stop|motors)$/, 'car_init', 'Fahrzeug einrichten'], [/^ard_lcd_(print|clear|pos|backlight)$/, 'ard_lcd_init', 'LCD einrichten'],
      [/^neo_(?!init)/, 'neo_init', 'NeoPixel einrichten'], [/^oled_(?!init)/, 'oled_init', 'OLED einrichten'], [/^kp_(read|key)$/, /^kp_init/, 'Tastenfeld einrichten'],
      [/^com_bt_(?!init)/, 'com_bt_init', 'Bluetooth einrichten'], [/^com_radio_(?!init)/, 'com_radio_init', 'Funk einrichten'], [/^com_web_(?!start)/, 'com_web_start', 'Webseite starten']];
    for (const [re, init, label] of NEED) {
      const user = live.find(b => re.test(b.type));
      const ok = live.some(b => init instanceof RegExp ? init.test(b.type) : b.type === init);
      if (user && !ok) add('error', `Der Block „${blockText(user)}“ braucht vorher „${label}“ (am besten in „beim Start“).`, { block: user.id });
    }
    const setVars = new Set(), getVars = new Map();
    for (const b of live) {
      if (['variables_set', 'math_change', 'ard_count', 'controls_for'].includes(b.type) && b.getField('VAR')) setVars.add(b.getFieldValue('VAR'));
      if (b.type === 'variables_get' && b.getField('VAR')) getVars.set(b.getFieldValue('VAR'), b);
    }
    const params = new Set();
    for (const b of live.filter(b => /^procedures_def/.test(b.type))) (b.getVars ? b.getVars() : []).forEach(n => params.add(n));
    for (const [id, b] of getVars) {
      const v = ws.getVariableById(id);
      if (v && !setVars.has(id) && !params.has(v.name)) add('warn', `Die Variable „${v.name}“ wird benutzt, bekommt aber nie einen Wert (Block „setze ${v.name} auf …“ fehlt).`, { block: b.id });
    }

    /* ---------- Tipps ---------- */
    const problems = out.filter(o => o.level !== 'tip').length;
    if (task) {
      const ctx = { app };
      const missing = (task.checks || []).filter(c => TASK_CHECKS[c.k] && TASK_CHECKS[c.k].kind === 'static' && !TASK_CHECKS[c.k].run(ctx, c).ok);
      for (const c of missing) add('tip', 'Für die Aufgabe fehlt noch: ' + TASK_CHECKS[c.k].label(c));
      const tips = task.tips || [], shown = task.tipsShown || 0;
      if (tips.length && shown < tips.length) add('tip', `Tipp ${shown + 1} aus der Aufgabe: ${tips[shown]}`, { revealTip: true });
      if (!missing.length && !problems) add('tip', 'Alles, was sich ohne Simulation prüfen lässt, sieht gut aus. Klicke auf der Aufgabenkarte „Aufgabe prüfen“.');
    } else if (mcu) {
      const parts = comps.filter(c => !c.def.mcu && !c.def.isBreadboard);
      if (!parts.length && progEmpty) add('tip', 'Jetzt die Schaltung bauen: Bauteile aus der Leiste rechts ziehen und mit Leitungen an den Mikrocontroller anschließen. Ideen gibt es unter „Datei › Aufgaben“.');
      else if (progEmpty) add('tip', 'Die Schaltung steht – jetzt das Programm: oben auf „Code“ umschalten. Was einmal passieren soll, kommt in „beim Start“, was immer wieder passieren soll, in „für immer“.');
      const sensor = parts.find(c => ['ldr', 'ntc', 'tmp36', 'dht', 'ultrasonic', 'poti', 'moisture', 'soil'].includes(c.type));
      if (sensor && !progEmpty && !has('ard_serial') && !has('ard_lcd_print')) add('tip', `Tipp: Lass dir den Messwert des Bauteils „${name(sensor)}“ im seriellen Monitor anzeigen (Block „auf seriellem Monitor drucken“ unter „Anzeige“). So siehst du, welche Werte er liefert.`);
      if (!problems && !progEmpty) add('tip', 'Keine Fehler gefunden. Starte die Simulation und schau, ob alles so funktioniert, wie du es dir vorstellst.');
    }
    // gleiche Meldung nur einmal
    const seen = new Set();
    return out.filter(o => !seen.has(o.text) && seen.add(o.text));
  },

  open(app) {
    if (app.sim.running) app.stopSim();
    const res = this.analyze(app);
    const order = { error: 0, warn: 1, tip: 2 };
    res.sort((a, b) => order[a.level] - order[b.level]);
    const icon = { error: '✗', warn: '!', tip: '→' }, head = { error: 'Fehler', warn: 'Hinweise', tip: 'Tipps' };
    let h = `<h2>Hilfe</h2><p>Die Werkstatt hat deine Schaltung und dein Programm durchgesehen.</p>`;
    for (const lv of ['error', 'warn', 'tip']) {
      const list = res.filter(r => r.level === lv);
      if (!list.length) continue;
      h += `<div class="start-sec">${head[lv]} (${list.length})</div><ul class="adv-list">` + list.map(r => {
        const i = res.indexOf(r);
        const btn = r.comp || r.block ? `<button type="button" class="btn small ghost" data-show="${i}">Zeigen</button>` : r.revealTip ? `<button type="button" class="btn small ghost" data-tip="${i}">Auf der Karte merken</button>` : '';
        return `<li class="adv-${lv}"><span class="adv-ico">${icon[lv]}</span><span class="adv-t">${esc(r.text)}</span>${btn}</li>`;
      }).join('') + '</ul>';
    }
    h += `<p class="te-note">Die Hilfe kennt typische Fehler, aber nicht alle. Was sich nur beim Ausprobieren zeigt, findet die Simulation.</p><div class="dlg-btns"><button class="btn primary" value="ok">Schließen</button></div>`;
    app.dialog(h);
    $('#dlgForm').addEventListener('click', e => {
      const s = e.target.closest('[data-show]'), t = e.target.closest('[data-tip]');
      if (s) {
        const r = res[Number(s.dataset.show)];
        $('#dlg').close('cancel');
        if (r.comp) { app.setMode('parts'); app.circuit.select({ kind: 'comp', id: r.comp }); }
        else if (r.block) {
          app.setMode('code');
          setTimeout(() => { const b = app.workspace.getBlockById(r.block); if (b) { b.select(); app.workspace.centerOnBlock(r.block); } }, 80);
        }
      } else if (t && app.task) {
        app.task.tipsShown = (app.task.tipsShown || 0) + 1; TaskUi.render(); app.scheduleSave();
        t.disabled = true; t.textContent = 'Steht jetzt auf der Aufgabenkarte';
      }
    });
  },
};
