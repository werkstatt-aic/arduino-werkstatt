/* Hochladen auf den echten Arduino (über das Startprogramm und arduino-cli) */
'use strict';

// Feste Bibliotheksliste für den ESP32 (siehe Uploader.code)
const ESP_FIXED_INCLUDES = '// Von der Arduino-Werkstatt ergänzt: feste Bibliotheksliste (schnelleres Übersetzen)\n' +
  ['Wire', 'LiquidCrystal_I2C', 'ESP32Servo', 'Adafruit_NeoPixel', 'Keypad', 'Adafruit_GFX', 'Adafruit_SSD1306',
   'Adafruit_ADS1X15', 'Adafruit_INA219'].map(n => `#include <${n}.h>\n`).join('');

const Uploader = {
  async streamLines(url, opts, onLine) {
    const r = await fetch(url, opts);
    if (!r.ok || !r.body) throw new Error('Keine Verbindung zum Startprogramm.');
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
    }
    if (buf) onLine(buf);
  },

  /* Häufige englische Meldungen in verständliches Deutsch übersetzen */
  explain(log) {
    const t = log.join('\n');
    const rules = [
      [/not in sync|not responding|stk500_recv|stk500_getsync|timeout communicating|programmer is not responding/i, 'Der Arduino antwortet nicht. Ist der richtige Anschluss gewählt und das USB-Kabel fest eingesteckt? Manche Kabel können nur laden und keine Daten übertragen.'],
      [/access is denied|zugriff verweigert|resource busy|could not open port|can't open device|permission denied|ser_open/i, 'Der Anschluss ist belegt oder nicht erreichbar. Schließe andere Programme, die den Arduino benutzen (z. B. die Arduino IDE), und versuche es erneut.'],
      [/no such file or directory.*(\.h|include)|fatal error: .*\.h/i, 'Eine benötigte Bibliothek fehlt. Richte die Werkzeuge erneut ein.'],
      [/(error|fehler):.*(not declared|was not declared)/i, 'Im Programm wird etwas verwendet, das nicht definiert ist.'],
      [/Sketch too big|text section exceeds/i, 'Das Programm ist zu groß für den Arduino Uno.'],
      [/not enough memory|low memory/i, 'Der Arbeitsspeicher des Arduino reicht nicht aus (z. B. zu viele oder zu große OLED-Bilder).'],
      [/Ungültiger FQBN|Invalid FQBN/i, 'Die Einstellungen für den Mikrocontroller passen nicht zum installierten Paket.'],
      [/Failed to connect to ESP32|Wrong boot mode|No serial data received/i, 'Der ESP32 meldet sich nicht. Halte beim Hochladen die Taste „BOOT“ gedrückt, bis „Connecting…“ verschwindet.'],
      [/no upload port provided|port.*not found|no such file or directory.*COM/i, 'Der gewählte Anschluss wurde nicht gefunden. Ist der Arduino angesteckt?'],
    ];
    for (const [re, msg] of rules) if (re.test(t)) return msg;
    const err = log.find(l => /error:/i.test(l));
    return err ? 'Fehlermeldung des Übersetzers: ' + err.replace(/^.*?error:\s*/i, '') : '';
  },

  async open(app) {
    this.app = app;
    if (!app.launcher) {
      app.dialog(`<h2>Auf den Arduino übertragen</h2><p>Das Hochladen funktioniert nur, wenn die Werkstatt über <b>„Arduino-Werkstatt starten.exe“</b> gestartet wurde.</p><p>Den C++-Code findest du unter <b>Code &gt; Text (C++)</b>.</p><div class="dlg-btns"><button class="btn primary" value="ok">Verstanden</button></div>`);
      return;
    }
    let info = { ready: false };
    try { info = await (await fetch('api/tools', { cache: 'no-store' })).json(); } catch (e) { /* alte Version */ }
    const esp = BOARD === 'esp32';
    if (esp ? info.readyEsp32 : info.ready) this.showUpload(); else this.showSetup(esp ? 'esp32' : 'uno');
  },
  openUsb(app) { this.mode = 'usb'; return this.open(app);
  },

  showSetup(board) {
    const d = document.querySelector('#dlg');
    this.setupBoard = board;
    const esp = board === 'esp32';
    this.app.dialog(`<h2>Werkzeuge einrichten${esp ? ' für den ESP32' : ''}</h2>
      <p>Zum Übertragen braucht die Werkstatt einmalig das offizielle Arduino-Übersetzungsprogramm, das Paket für den ${esp ? '<b>ESP32</b>' : 'Arduino Uno'} und die Bibliotheken für LCD, Servo, NeoPixel, Tastenfeld, Messmodule, OLED und DHT-Sensor.</p>
      <p>Dafür ist <b>einmal eine Internetverbindung</b> nötig (${esp ? 'etwa 1 GB, das ESP32-Paket ist groß. Das dauert eine Weile' : 'etwa 250 MB, einige Minuten'}). Alles landet im Ordner <b>„Werkzeuge“</b> neben der Startdatei. Diesen Ordner kann man danach auf andere Sticks kopieren, dann ist dort keine Einrichtung mehr nötig.</p>
      <div class="up-steps" id="upSteps" hidden></div>
      <div class="up-bar" id="upBar" hidden><div></div></div>
      <div class="up-msg" id="upMsg"></div>
      <details class="up-log" id="upLogBox" hidden><summary>Details anzeigen</summary><pre id="upLog"></pre></details>
      <div class="dlg-btns"><button class="btn" value="cancel" id="upClose">Schließen</button><button class="btn primary" type="button" id="upGo">Jetzt einrichten</button></div>`);
    document.querySelector('#upGo').onclick = () => this.runSetup();
    d.oncancel = e => { if (this.busy) e.preventDefault(); };
  },

  async runSetup() {
    const go = document.querySelector('#upGo');
    go.disabled = true; go.textContent = 'Wird eingerichtet …';
    this.busy = true;
    const res = await this.runStream('api/tools/install?board=' + (this.setupBoard || 'uno'), { method: 'POST' }, 4);
    this.busy = false;
    if (res.ok) {
      go.disabled = false; go.textContent = 'Weiter zum Hochladen';
      go.onclick = () => this.showUpload();
    } else { go.disabled = false; go.textContent = 'Erneut versuchen'; }
  },

  /* Gemeinsame Anzeige: Schritte, Fortschritt, Meldung, Protokoll */
  async runStream(url, opts, nSteps) {
    const steps = document.querySelector('#upSteps'), bar = document.querySelector('#upBar'), msg = document.querySelector('#upMsg');
    const logBox = document.querySelector('#upLogBox'), logEl = document.querySelector('#upLog');
    steps.hidden = false; steps.innerHTML = ''; msg.className = 'up-msg'; msg.textContent = ''; logEl.textContent = ''; logBox.hidden = false; logBox.open = false;
    const log = [];
    let result = { ok: false };
    let cur = null;
    const done = cls => { if (cur) { cur.className = 'up-step ' + cls; cur.textContent += ` (${Math.max(1, Math.round((performance.now() - cur.t0) / 1000))} s)`; cur = null; } };
    try {
      await this.streamLines(url, opts, line => {
        if (line.startsWith('##SCHRITT')) {
          done('ok');
          const m = /^##SCHRITT (\d+) (.*)$/.exec(line);
          cur = document.createElement('div'); cur.className = 'up-step run'; cur.t0 = performance.now();
          cur.textContent = (m ? m[2] : line.slice(10));
          steps.appendChild(cur);
          bar.hidden = true;
        } else if (line.startsWith('##INFO')) {
          const el = document.createElement('div'); el.className = 'up-info'; el.textContent = line.slice(7);
          steps.appendChild(el);
        } else if (line.startsWith('##FORTSCHRITT')) {
          bar.hidden = false; bar.firstElementChild.style.width = Math.min(100, Number(line.slice(14)) || 0) + '%';
        } else if (line.startsWith('##OK')) {
          done('ok'); bar.hidden = true;
          msg.className = 'up-msg ok'; msg.textContent = line.slice(5);
          result = { ok: true };
        } else if (line.startsWith('##FEHLER')) {
          done('err'); bar.hidden = true;
          const why = this.explain(log);
          msg.className = 'up-msg err'; msg.textContent = line.slice(9) + (why ? ' ' + why : '');
          result = { ok: false };
        } else {
          log.push(line);
          logEl.textContent += line + '\n';
          if (logEl.textContent.length > 60000) logEl.textContent = logEl.textContent.slice(-40000);
          logEl.scrollTop = logEl.scrollHeight;
        }
      });
    } catch (e) {
      done('err'); msg.className = 'up-msg err'; msg.textContent = 'Verbindung zum Startprogramm unterbrochen: ' + e.message;
    }
    return result;
  },

  showUpload() {
    const d = document.querySelector('#dlg');
    const esp = BOARD === 'esp32';
    const fq = esp ? 'esp32:esp32:esp32:PartitionScheme=min_spiffs' : 'arduino:avr:uno';
    this.mode = this.mode === 'bt' && esp ? 'bt' : 'usb';
    this.app.dialog(`<h2>${esp ? 'Auf den ESP32 übertragen' : 'Auf den Arduino übertragen'}</h2>
      ${esp ? `<div class="seg small up-mode"><button type="button" data-mode="usb">USB-Kabel</button><button type="button" data-mode="bt">Bluetooth</button></div>` : ''}
      <div id="upUsb">
        <div class="up-row">
          <label>Mikrocontroller <select id="upBoard" disabled><option value="${fq}">${esp ? 'ESP32' : 'Arduino Uno'}</option></select></label>
          <label>Anschluss <select id="upPort"><option value="">wird gesucht …</option></select></label>
          <button class="btn small" type="button" id="upRefresh" title="Anschlüsse neu suchen">↻</button>
        </div>
        <div class="up-hint" id="upHint"></div>
      </div>
      <div id="upBtInfo" class="up-hint" hidden>Der ESP32 muss vorher <b>einmal per USB-Kabel</b> mit eingeschalteter Bluetooth-Übertragung bespielt worden sein. Nach dem Klick auf „Hochladen“ wählst du ihn in der Liste aus.</div>
      ${esp ? `<div class="up-bt">
        <label class="up-check"><input type="checkbox" id="btOn" ${BT_OPT.on ? 'checked' : ''}> Bluetooth-Übertragung in das Programm einbauen</label>
        <div class="up-note" id="btLockNote" hidden>Bei der Übertragung per Bluetooth bleibt der Empfänger immer eingebaut – sonst wäre der ESP32 danach per Bluetooth nicht mehr erreichbar. Ausschalten kann man ihn beim Hochladen per USB-Kabel.</div>
        <label class="up-name">Name des ESP32 <input type="text" id="btName" maxlength="20" spellcheck="false" value="${esc(btName(BT_OPT.name))}"></label>
      </div>` : ''}
      <div class="up-steps" id="upSteps" hidden></div>
      <div class="up-bar" id="upBar" hidden><div></div></div>
      <div class="up-msg" id="upMsg"></div>
      <details class="up-log" id="upLogBox" hidden><summary>Details anzeigen</summary><pre id="upLog"></pre></details>
      <div class="dlg-btns"><button class="btn" value="cancel">Schließen</button><button class="btn primary" type="button" id="upGo">Hochladen</button></div>`,
    () => { clearInterval(this.portTimer); });
    d.oncancel = e => { if (this.busy) e.preventDefault(); };
    document.querySelector('#upRefresh').onclick = () => this.loadPorts(true);
    document.querySelector('#upGo').onclick = () => (this.mode === 'bt' ? this.runBluetooth() : this.runUpload());
    if (esp) {
      const on = document.querySelector('#btOn'), nm = document.querySelector('#btName');
      const store = () => { BT_OPT = { on: on.checked, name: btName(nm.value) }; this.app.scheduleSave(); this.app.updateCodeText(); this.precompile(); };
      on.onchange = store;
      nm.onchange = () => { nm.value = btName(nm.value); store(); };
      document.querySelectorAll('.up-mode button').forEach(b => { b.onclick = () => this.setMode(b.dataset.mode); });
    }
    this.setMode(this.mode);
    this.precompile();
    this.loadPorts(true);
    clearInterval(this.portTimer);
    this.portTimer = setInterval(() => { if (!this.busy && d.open && this.mode === 'usb') this.loadPorts(false); }, 3000);
  },

  setMode(m) {
    this.mode = m;
    document.querySelectorAll('.up-mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    const usb = document.querySelector('#upUsb'), info = document.querySelector('#upBtInfo'), on = document.querySelector('#btOn');
    if (usb) usb.hidden = m === 'bt';
    if (info) info.hidden = m !== 'bt';
    if (on) {
      // Bei Übertragung per Bluetooth muss der Empfänger im neuen Programm bleiben, sonst klappt es beim nächsten Mal nicht mehr.
      if (m === 'bt' && !on.checked) { on.checked = true; on.onchange(); }
      on.disabled = m === 'bt';
      const note = document.querySelector('#btLockNote'); if (note) note.hidden = m !== 'bt';
    }
  },

  async loadPorts(manual) {
    const sel = document.querySelector('#upPort'), hint = document.querySelector('#upHint');
    if (!sel) return;
    let ports = [];
    try { ports = await (await fetch('api/ports', { cache: 'no-store' })).json(); } catch (e) { ports = []; }
    const key = JSON.stringify(ports);
    if (!manual && key === this.lastPorts) return;
    this.lastPorts = key;
    const prev = sel.value;
    if (!ports.length) {
      sel.innerHTML = '<option value="">kein Arduino gefunden</option>';
      hint.className = 'up-hint warn';
      hint.textContent = BOARD === 'esp32'
        ? 'Stecke das USB-Kabel direkt in die Buchse am ESP32, nicht in die Buchsen am Expansion Board (die liefern nur Strom). Wird der ESP32 nicht gefunden, fehlt eventuell der Treiber „CP210x“ (Silicon Labs). Manche Kabel können nur laden und keine Daten übertragen.'
        : 'Stecke den Arduino per USB an. Wird er auch dann nicht gefunden, fehlt bei Nachbauten oft der Treiber „CH340“ (Windows lädt ihn meist automatisch über Windows Update).';
      return;
    }
    sel.innerHTML = ports.map(p => `<option value="${esc(p.port)}">${esc(p.port)} – ${esc(p.label)}</option>`).join('');
    const want = BOARD === 'esp32' ? /esp32|cp210/i : /arduino|ch340/i;
    const best = ports.find(p => p.port === prev) || ports.find(p => want.test(p.label)) || ports.find(p => !/kein USB/.test(p.label)) || ports[0];
    sel.value = best.port;
    const usb = ports.filter(p => !/kein USB/.test(p.label));
    hint.className = 'up-hint'; hint.textContent = usb.length > 1 ? 'Mehrere USB-Geräte gefunden. Prüfe, ob der richtige Anschluss gewählt ist.' : '';
    if (BOARD === 'esp32' && !ports.some(p => /esp32|cp210/i.test(p.label))) { hint.className = 'up-hint warn'; hint.textContent = 'Kein ESP32 erkannt. Das USB-Kabel muss direkt in die Buchse am ESP32, nicht ins Expansion Board.'; }
  },

  async runUpload() {
    const go = document.querySelector('#upGo');
    const port = document.querySelector('#upPort').value;
    const fqbn = document.querySelector('#upBoard').value;
    if (!port) { this.fail('Kein Anschluss gewählt. Stecke den Mikrocontroller an und warte einen Moment.'); return; }
    const code = this.code(); if (code === null) return;
    go.disabled = true; go.textContent = 'Läuft …';
    this.busy = true;
    const serialWas = await SerialLink.pauseForUpload(); // Anschluss für das Hochladen freigeben
    await this.runStream(`api/upload?port=${encodeURIComponent(port)}&fqbn=${encodeURIComponent(fqbn)}${this.details()}`, { method: 'POST', body: code, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }, 2);
    this.busy = false;
    go.disabled = false; go.textContent = 'Erneut hochladen';
    if (serialWas) SerialLink.resumeAfterUpload();
  },

  /* Variante A: Schon beim Öffnen des Fensters im Hintergrund übersetzen. Das Startprogramm
     merkt sich das Ergebnis; beim Klick auf „Hochladen“ wird dann nur noch übertragen. */
  precompile() {
    const sel = document.querySelector('#upBoard');
    if (!sel) return;
    let c;
    try { c = this.fullCode(); } catch (e) { return; } // Fehler zeigt erst das richtige Hochladen
    fetch(`api/upload?pre=1&port=&fqbn=${encodeURIComponent(sel.value)}`, { method: 'POST', body: c, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      .then(r => r.text()).catch(() => { /* egal: dann wird beim Hochladen übersetzt */ });
  },

  code() {
    try {
      const c = this.fullCode();
      if (this.app.sim.running) this.app.stopSim();
      return c;
    }
    catch (e) { this.fail('Fehler im Programm: ' + e.message); return null; }
  },

  fullCode() {
    {
      let c = generateArduinoCode(this.app.workspace);
      // ESP32: immer dieselben Bibliotheken einbinden. Sonst übersetzt arduino-cli bei jedem
      // Wechsel der Bibliotheken (anderes Projekt) alle Bibliotheken neu – das dauert lange.
      // Nicht benutzte Teile entfernt der Linker wieder.
      if (BOARD === 'esp32') {
        // WLAN-Teile nur, wenn das Programm sie nutzt: sie machen das Programm um gut 500 KB größer
        const net = c.includes('<WiFi.h>') ? '#include <WiFi.h>\n#include <WebServer.h>\n#include <esp_now.h>\n' : '';
        c = ESP_FIXED_INCLUDES + net + (c.includes('<NimBLEDevice.h>') ? '#include <NimBLEDevice.h>\n#include <Update.h>\n' : '') + c;
      }
      return c;
    }
  },

  // Einstellung „Zeitmessung beim Übersetzen“ (nur in diesem Browser gespeichert)
  details() { try { return localStorage.getItem('werkstatt.details') === '1' ? '&details=1' : ''; } catch (e) { return ''; } },

  fail(text) { const m = document.querySelector('#upMsg'); m.className = 'up-msg err'; m.textContent = text; },

  addStep(text) {
    const steps = document.querySelector('#upSteps');
    steps.hidden = false;
    const el = document.createElement('div'); el.className = 'up-step run'; el.textContent = text; el.t0 = performance.now();
    steps.appendChild(el);
    return el;
  },

  /* Übertragung per Bluetooth (Web Bluetooth in Chrome) */
  async runBluetooth() {
    const go = document.querySelector('#upGo');
    if (!navigator.bluetooth) { this.fail('Dieser Browser unterstützt kein Bluetooth. Bitte die Werkstatt mit Google Chrome starten.'); return; }
    const fqbn = document.querySelector('#upBoard').value;
    // Das Auswahlfenster muss direkt nach dem Klick kommen, deshalb zuerst den ESP32 wählen, dann übersetzen.
    let device;
    try {
      device = await navigator.bluetooth.requestDevice({ filters: [{ services: [BT_UUID.svc] }], optionalServices: [BT_UUID.svc] });
    } catch (e) {
      if (e.name === 'NotFoundError') this.fail('Kein ESP32 ausgewählt. Ist er eingeschaltet und wurde er einmal per USB mit Bluetooth-Übertragung bespielt?');
      else this.fail('Bluetooth ist nicht verfügbar: ' + e.message + ' Ist Bluetooth am Computer eingeschaltet?');
      return;
    }
    const code = this.code(); if (code === null) return;
    go.disabled = true; go.textContent = 'Läuft …';
    this.busy = true;
    try {
      const res = await this.runStream(`api/upload?port=&fqbn=${encodeURIComponent(fqbn)}${this.details()}`, { method: 'POST', body: code, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }, 1);
      if (!res.ok) return;
      document.querySelector('#upMsg').className = 'up-msg'; document.querySelector('#upMsg').textContent = '';
      await this.sendBluetooth(device, fqbn);
    } finally {
      this.busy = false;
      go.disabled = false; go.textContent = 'Erneut hochladen';
    }
  },

  async sendBluetooth(device, fqbn) {
    const bar = document.querySelector('#upBar'), msg = document.querySelector('#upMsg');
    const enc = new TextEncoder(), dec = new TextDecoder();
    let step = this.addStep(`Mit „${device.name || 'ESP32'}“ verbinden`);
    const secs = el => ` (${Math.max(1, Math.round((performance.now() - el.t0) / 1000))} s)`;
    let ctrl = null, phase = 'connect';
    try {
      const r = await fetch('api/firmware?fqbn=' + encodeURIComponent(fqbn), { cache: 'no-store' });
      if (!r.ok) throw new Error('Die übersetzte Datei fehlt.');
      const bin = new Uint8Array(await r.arrayBuffer());
      const md5 = (r.headers.get('X-MD5') || '').toLowerCase();
      const server = await device.gatt.connect();
      let svc;
      try { svc = await server.getPrimaryService(BT_UUID.svc); } catch (e) { phase = 'service'; throw e; }
      ctrl = await svc.getCharacteristic(BT_UUID.ctrl);
      const data = await svc.getCharacteristic(BT_UUID.data);
      const cmd = async t => { await ctrl.writeValueWithResponse(enc.encode(t)); return dec.decode(await ctrl.readValue()); };
      step.className = 'up-step ok'; step.textContent += secs(step);
      step = this.addStep(`Per Bluetooth übertragen (${Math.round(bin.length / 1024)} KB)`);
      phase = 'start';
      const a = await cmd('START ' + bin.length + (md5 ? ' ' + md5 : ''));
      if (a !== 'OK') throw new Error(a);
      phase = 'send';
      bar.hidden = false;
      // Schnell: Pakete ohne Einzelbestätigung senden, jedes 20. mit Bestätigung (Takt halten).
      // Paketgröße: so groß wie möglich, bei Fehler kleiner. Die MD5-Prüfsumme sichert die Vollständigkeit.
      const sizes = [509, 244, 180];
      let CH = sizes[0], k = 0, n = 0;
      // Ältere Empfänger (vor 0.8.2) kennen kein Schreiben ohne Bestätigung
      let fast = typeof data.writeValueWithoutResponse === 'function' && !!(data.properties && data.properties.writeWithoutResponse);
      const t0 = performance.now();
      for (let off = 0; off < bin.length;) {
        const chunk = bin.subarray(off, Math.min(bin.length, off + CH));
        const last = off + chunk.length >= bin.length;
        try {
          if (fast && (n % 20 !== 19) && !last) await data.writeValueWithoutResponse(chunk);
          else await data.writeValueWithResponse(chunk);
        } catch (e) {
          // Erste Pakete zu groß? Dann mit kleineren Paketen weiter.
          if (n === 0 && !/disconnect/i.test(String(e.message))) {
            if (k < sizes.length - 1) { CH = sizes[++k]; continue; }
            if (fast) { fast = false; CH = sizes[k = 0]; continue; }
          }
          throw e;
        }
        off += chunk.length; n++;
        if (n % 16 === 0 || last) {
          const pct = off / bin.length, sec = (performance.now() - t0) / 1000;
          bar.firstElementChild.style.width = Math.round(pct * 100) + '%';
          if (pct > 0.05) step.textContent = `Per Bluetooth übertragen (${Math.round(pct * 100)} %, noch etwa ${Math.max(1, Math.round(sec / pct - sec))} s)`;
        }
      }
      bar.firstElementChild.style.width = '100%';
      phase = 'end';
      const z = await cmd('ENDE');
      if (z !== 'FERTIG') throw new Error(z);
      step.className = 'up-step ok'; step.textContent = `Per Bluetooth übertragen (${Math.round(bin.length / 1024)} KB)` + secs(step);
      bar.hidden = true;
      msg.className = 'up-msg ok'; msg.textContent = 'Fertig! Der ESP32 startet neu und das neue Programm läuft.';
      try { device.gatt.disconnect(); } catch (e) { /* schon getrennt */ }
    } catch (e) {
      step.className = 'up-step err'; bar.hidden = true;
      if (phase === 'send' && ctrl) { try { await ctrl.writeValueWithResponse(enc.encode('ABBRUCH')); } catch (x) { /* Verbindung weg */ } }
      try { device.gatt.disconnect(); } catch (x) { /* egal */ }
      this.fail(this.explainBt(e, phase));
    }
  },

  explainBt(e, phase) {
    const t = String(e && e.message || e);
    if (phase === 'service') return 'Auf diesem ESP32 ist die Bluetooth-Übertragung nicht eingebaut. Lade einmal per USB-Kabel mit eingeschalteter Bluetooth-Übertragung hoch.';
    if (/FEHLER Speicher/.test(t)) return 'Auf dem ESP32 ist nicht genug Platz für das neue Programm. Lade einmal per USB-Kabel hoch, dann wird der Speicher passend eingeteilt.';
    if (/FEHLER Pruefung/.test(t)) return 'Die Übertragung war unvollständig oder fehlerhaft. Bitte noch einmal versuchen.';
    if (/disconnect|GATT|NetworkError|not connected/i.test(t) || e.name === 'NetworkError') return 'Die Bluetooth-Verbindung ist abgerissen. Ist der ESP32 eingeschaltet und in der Nähe? Bitte noch einmal versuchen.';
    return 'Die Übertragung per Bluetooth ist fehlgeschlagen: ' + t;
  },
};
