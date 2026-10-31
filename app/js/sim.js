/* Laufzeit der Simulation: führt den Blockcode aus und steuert die Bauteile */
'use strict';

class StopSignal extends Error {}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const LED_FULL = 0.02; // 20 mA = volle Helligkeit

class Simulator {
  constructor(app) {
    this.app = app;
    this.running = false;
    this.audio = null;
  }

  get project() { return this.app.project; }

  start(code) {
    this.stop();
    this.runId = (this.runId || 0) + 1;
    this.running = true;
    this.outputs = {};
    this.pressed = new Set();
    this.keys = new Map();
    this.kpReported = new Map();
    this.broken = new Set();
    this.servo = {};
    this.tones = {};
    this.lcd = { ready: false, backlight: false, lines: ['', ''], cur: [0, 0] };
    this.neo = null;
    this.oled = null;
    this.kp = null; this.kpKeyVal = '';
    this.ads = {}; this.ina = {};
    this.usbQ = []; this.usbVal = '';
    this.wifi = null; this.web = null; this.radio = null; this.radioQ = []; this.radioVal = ''; this.radioLog = [];
    this.bt = null; this.btQ = []; this.btVal = ''; this.btLog = [];
    CommPanel.render(this);
    this.messages = new Map();
    this.lastYield = performance.now();
    this.t0 = performance.now();
    this.lastHl = 0;
    this.nl = buildNetlist(this.project);
    this.app.serialClear();
    this.update();
    this.loop(code, this.runId);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    for (const p in (this.tones || {})) this.stopTone(p);
    if (this.app.workspace) this.app.workspace.highlightBlock(null);
  }

  async loop(code, runId) {
    const api = this.makeApi(runId);
    try {
      const prog = await new AsyncFunction('api', code)(api);
      if (prog.setup) await prog.setup();
      for (;;) {
        if (prog.loop) await prog.loop(); else await api.wait(200);
        await api.tick(true);
      }
    } catch (e) {
      if (e instanceof StopSignal) return;
      console.error(e);
      this.msg('prog', 'error', 'Programmfehler: ' + e.message);
      this.app.onSimCrashed();
    }
  }

  makeApi(runId) {
    const S = this;
    const check = () => { if (!S.running || S.runId !== runId) throw new StopSignal(); };
    return {
      fmt: v => S.fmt(v),
      async hl(id) {
        check();
        const t = performance.now();
        if (t - S.lastHl > 60) { S.lastHl = t; S.app.workspace.highlightBlock(id); }
      },
      async tick(force) {
        check();
        const t = performance.now();
        if (force || t - S.lastYield > 12) { S.lastYield = t; await new Promise(r => setTimeout(r, force ? 1 : 0)); check(); }
      },
      millis(div) { const t = performance.now() - S.t0; return div === 1 ? Math.floor(t) : t / div; },
      async wait(ms) {
        check();
        ms = Math.max(0, Number(ms) || 0);
        await new Promise(r => setTimeout(r, ms));
        S.lastYield = performance.now();
        check();
      },
      async digitalWrite(pin, v) { check(); S.outputs[pin] = { v: v ? S.m().logic : 0, duty: 1 }; S.update(); },
      async builtinLed(v) { check(); S.outputs[S.m().led] = { v: v ? S.m().logic : 0, duty: 1 }; S.update(); },
      async analogWrite(pin, val) {
        check();
        val = Math.max(0, Math.min(255, Math.round(Number(val) || 0)));
        const M = S.m(), pwm = !M.pwm || M.pwm.includes(pin);
        if (!pwm) S.outputs[pin] = { v: val >= 128 ? M.logic : 0, duty: 1 };
        else S.outputs[pin] = { v: val > 0 ? M.logic : 0, duty: val / 255 };
        S.update();
      },
      async digitalRead(pin) { check(); return S.readDigital(pin); },
      async analogRead(pin) { check(); return S.readAnalog(pin); },
      async tmp36(pin, unit) { check(); const M = S.m(); const c = (S.readAnalog(pin) * M.vref / M.adcMax - 0.5) * 100; return unit === 'F' ? c * 9 / 5 + 32 : c; },
      async ultrasonic(trig, echo, unit) { check(); return S.ultrasonic(trig, echo, unit); },
      async motor(ia, ib, dir, pct) {
        check();
        const v = Math.round(Math.max(0, Math.min(100, Number(pct) || 0)) * 255 / 100);
        await this.analogWrite(ia, dir > 0 ? v : 0); await this.analogWrite(ib, dir < 0 ? v : 0);
      },
      async servo(pin, deg) { check(); S.setServo(pin, Number(deg) || 0); },
      async tone(pin, freq, dur) { check(); S.playTone(pin, Number(freq) || 0, Number(dur) || 0); },
      async noTone(pin) { check(); S.stopTone(pin); },
      async serial(v, nl) { check(); S.app.serialWrite(S.fmt(v) + (nl ? '\n' : '')); },
      async lcdInit() { check(); S.lcdInit(); },
      async lcdBacklight(on) { check(); if (S.lcd.ready) { S.lcd.backlight = on; S.render(); } },
      async lcdClear() { check(); if (S.lcd.ready) { S.lcd.lines = ['', '']; S.lcd.cur = [0, 0]; S.render(); } },
      async lcdPrint(v) { check(); S.lcdPrint(S.fmt(v)); },
      async lcdSetCursor(c, r) { check(); if (S.lcd.ready) S.lcd.cur = [Math.max(0, Math.round(c)), Math.max(0, Math.min(1, Math.round(r)))]; },
      async neoInit(pin, n) { check(); S.neo = { pin, n, px: Array.from({ length: n }, () => [0, 0, 0]), bright: 255 }; S.render(); },
      async neoSet(i, c) { check(); if (!S.neo) return; i = Math.round(Number(i)) - 1; if (i >= 0 && i < S.neo.n) S.neo.px[i] = c.map(x => Math.max(0, Math.min(255, Math.round(Number(x) || 0)))); S.render(); },
      async neoFill(c) { check(); if (!S.neo) return; S.neo.px = S.neo.px.map(() => c.slice()); S.render(); },
      async neoBrightness(v) { check(); if (!S.neo) return; S.neo.bright = Math.max(0, Math.min(255, Math.round(Number(v) || 0))); S.render(); },
      async oledInit() { check(); S.oledInit(); },
      async oledClear() { check(); if (S.oled) S.oled.fb.fill(0); },
      async oledShow() { check(); S.oledShow(); },
      async oledCursor(x, y) { check(); if (S.oled) { S.oled.cx = Math.round(Number(x) || 0); S.oled.cy = Math.round(Number(y) || 0); } },
      async oledSize(n) { check(); if (S.oled) S.oled.size = Math.max(1, Math.min(8, Math.round(Number(n) || 1))); },
      async oledPrint(v) { check(); S.oledPrint(S.fmt(v)); },
      async oledPixel(x, y, c) { check(); S.oledPx(x, y, c); },
      async oledLine(x0, y0, x1, y1, c) { check(); S.oledLine(x0, y0, x1, y1, c); },
      async oledRect(x, y, w, h, fill, c) { check(); S.oledRect(x, y, w, h, fill, c); },
      async oledBitmap(x, y, w, h, d, c) { check(); const px = Bitmap.toPixels({ w, h, d }); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (px[j * w + i]) S.oledPx(Number(x) + i, Number(y) + j, c); },
      async oledCircle(x, y, r, fill, c) { check(); S.oledCircle(x, y, r, fill, c); },
      async kpInit(cols, rows, colPins) { check(); S.kp = { cols, rows, colPins }; },
      async kpRead() { check(); S.kpKeyVal = S.kpRead(); },
      kpKey() { return S.kpKeyVal; },
      /* Kommunikation (ESP32) */
      async usbAvail() { check(); if (!S.usbQ.length) return false; S.usbVal = S.usbQ.shift(); return true; },
      usbText() { return S.usbVal; },
      usbNum() { return parseFloat(String(S.usbVal).replace(',', '.')) || 0; },
      async wifiConnect(name, pw) { check(); await this.wait(1200); S.wifi = { mode: 'sta', ssid: S.fmt(name), ip: '192.168.178.42' }; CommPanel.render(S); },
      async wifiAp(name, pw) { check(); S.wifi = { mode: 'ap', ssid: S.fmt(name), pw: String(pw).length >= 8, ip: '192.168.4.1' }; CommPanel.render(S); },
      wifiOk() { return !!S.wifi; },
      wifiIp() { return S.wifi ? S.wifi.ip : '0.0.0.0'; },
      async webStart(title) { check(); S.web = { title: S.fmt(title), values: new Map(), buttons: new Map(), sliders: new Map() }; CommPanel.render(S); },
      async webShow(name, v) { check(); if (!S.web) return; const t = S.fmt(v); if (S.web.values.get(name) !== t) { S.web.values.set(name, t); CommPanel.render(S); } },
      async webButton(name) { check(); if (!S.web) return false; if (!S.web.buttons.has(name)) { S.web.buttons.set(name, false); CommPanel.render(S); } const p = S.web.buttons.get(name); S.web.buttons.set(name, false); return p; },
      async webSlider(name) { check(); if (!S.web) return 0; if (!S.web.sliders.has(name)) { S.web.sliders.set(name, 0); CommPanel.render(S); } return S.web.sliders.get(name); },
      async radioInit(g) { check(); S.radio = { group: g }; CommPanel.render(S); },
      async radioSend(v) { check(); if (!S.radio) return; S.radioLog.push({ out: true, text: S.fmt(v) }); CommPanel.render(S); },
      async radioAvail() { check(); if (!S.radio || !S.radioQ.length) return false; S.radioVal = S.radioQ.shift(); return true; },
      radioText() { return S.radioVal; },
      radioNum() { return parseFloat(String(S.radioVal).replace(',', '.')) || 0; },
      async btInit(name) { check(); if (!S.bt) S.bt = { name: S.fmt(name), connected: true }; CommPanel.render(S); },
      async btSend(v) { check(); if (!S.bt || !S.bt.connected) return; S.btLog.push({ out: true, text: S.fmt(v) }); CommPanel.render(S); },
      btConn() { return !!(S.bt && S.bt.connected); },
      async btAvail() { check(); if (!S.bt || !S.btQ.length) return false; S.btVal = S.btQ.shift(); return true; },
      btText() { return S.btVal; },
      btNum() { return parseFloat(String(S.btVal).replace(',', '.')) || 0; },
      async adsInit(addr, fs) { check(); S.adsInit(addr, fs); },
      async adsRead(addr, kind, ch) { check(); return S.adsRead(addr, kind, ch); },
      async inaInit(addr, cal) { check(); S.inaInit(addr, cal); },
      async inaRead(addr, mode) { check(); return S.inaRead(addr, mode); },
    };
  }

  fmt(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
    if (typeof v === 'boolean') return v ? '1' : '0';
    return String(v);
  }

  msg(key, level, text) { this.messages.set(key, { level, text }); this.app.showMessages(this.messages); }
  clearMsg(key) { if (this.messages.delete(key)) this.app.showMessages(this.messages); }

  uno() { return this.project.components.find(c => c.def.mcu); }
  m() { const u = this.uno(); return u ? u.def.mcu : UNO_MCU; }
  unoNet(pin) { const u = this.uno(); return u ? this.nl.net(u.id, pin) : -1; }
  V(net) { const r = this.lastRes; if (!r || r.floating.has(net)) return NaN; return r.V[net] || 0; }
  powered(c, vcc, gnd) { const u = this.uno(); if (!u) return 0; const M = u.def.mcu; return moduleSupply(this.nl, c, vcc, gnd, this.nl.net(u.id, M.v5), this.nl.net(u.id, M.v33), this.nl.net(u.id, M.gnd)); }
  i2cOk(c) { const M = this.m(); return this.nl.net(c.id, 'SDA') === this.unoNet(M.sda) && this.nl.net(c.id, 'SCL') === this.unoNet(M.scl); }

  /* Hängt außer dem Arduino-Anschluss noch etwas an diesem Netz? */
  attached(net) {
    const u = this.uno();
    return (this.nl.members[net] || []).some(k => !k.startsWith(u.id + ':'));
  }

  /* ---------- Eingänge ---------- */
  readDigital(pin) {
    if (this.outputs[pin]) return this.outputs[pin].v > 0.1 ? 1 : 0;
    const res = this.lastRes;
    if (!res) return 0;
    const n = this.unoNet(pin);
    if (res.floating.has(n)) return Math.random() < 0.5 ? 0 : 1;
    return res.V[n] >= this.m().logic / 2 ? 1 : 0;
  }

  readAnalog(pin) {
    const res = this.lastRes;
    if (!res) return 0;
    const n = this.unoNet(pin);
    if (res.floating.has(n)) return Math.floor(this.m().adcMax * (0.2 + Math.random() * 0.6));
    const M = this.m();
    return Math.max(0, Math.min(M.adcMax, Math.round(res.V[n] / M.vref * M.adcMax)));
  }

  ultrasonic(trig, echo, unit) {
    const c = this.project.components.find(x => x.type === 'ultrasonic' && this.powered(x) &&
      this.nl.net(x.id, 'TRIG') === this.unoNet(trig) && this.nl.net(x.id, 'ECHO') === this.unoNet(echo));
    if (!c) return 0;
    const dur = Math.round(Math.max(2, Math.min(400, Number(c.props.dist))) / 0.01723);
    return dur * (unit === 'CM' ? 0.01723 : 0.00675);
  }

  /* ---------- Aktoren ---------- */
  setServo(pin, deg) {
    deg = Math.max(0, Math.min(180, deg));
    const pn = this.unoNet(pin);
    for (const c of this.project.components) {
      if (c.type !== 'servo' || this.nl.net(c.id, 'SIG') !== pn || !this.powered(c)) continue;
      this.animateServo(c.id, deg);
    }
  }

  animateServo(id, target) {
    const start = this.servo[id] !== undefined ? this.servo[id] : 0;
    const t0 = performance.now();
    const dur = Math.abs(target - start) / 180 * 400 + 1;
    const step = () => {
      if (!this.running) return;
      const k = Math.min(1, (performance.now() - t0) / dur);
      this.servo[id] = start + (target - start) * k;
      this.render();
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  piezoOn(pin) {
    const pn = this.unoNet(pin), g = this.unoNet(this.m().gnd);
    return this.project.components.filter(c => c.type === 'piezo' &&
      ((this.nl.net(c.id, 'P') === pn && this.nl.net(c.id, 'N') === g) || (this.nl.net(c.id, 'N') === pn && this.nl.net(c.id, 'P') === g)));
  }

  playTone(pin, freq, dur) {
    this.stopTone(pin);
    const piezos = this.piezoOn(pin);
    if (!piezos.length || freq <= 0) return;
    try {
      if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
      const osc = this.audio.createOscillator();
      const gain = this.audio.createGain();
      osc.type = 'square'; osc.frequency.value = Math.max(31, Math.min(20000, freq)); gain.gain.value = 0.05;
      osc.connect(gain).connect(this.audio.destination);
      osc.start();
      const entry = { osc, ids: piezos.map(p => p.id) };
      this.tones[pin] = entry;
      if (dur > 0) entry.timer = setTimeout(() => { if (this.tones[pin] === entry) this.stopTone(pin); }, dur * 1000);
    } catch (e) { console.warn(e); }
    this.render();
  }

  stopTone(pin) {
    const t = this.tones && this.tones[pin];
    if (!t) return;
    try { t.osc.stop(); } catch (e) { /* schon gestoppt */ }
    clearTimeout(t.timer);
    delete this.tones[pin];
    this.render();
  }

  lcdInit() {
    const l = this.project.components.find(c => c.type === 'lcd' && this.powered(c) && this.i2cOk(c));
    this.lcd = { ready: !!l, backlight: false, lines: ['', ''], cur: [0, 0] };
    this.render();
  }

  lcdPrint(text) {
    if (!this.lcd.ready) return;
    let [c, r] = this.lcd.cur;
    let line = this.lcd.lines[r].padEnd(40, ' ');
    for (const ch of text) { if (c < 40) line = line.slice(0, c) + ch + line.slice(c + 1); c++; }
    this.lcd.lines[r] = line.replace(/\s+$/, '');
    this.lcd.cur = [c, r];
    this.render();
  }

  /* ---------- OLED SSD1306 (128 × 64) ---------- */
  oledInit() {
    const c = this.project.components.find(x => x.type === 'oled' && this.powered(x) && this.i2cOk(x));
    this.oled = c ? { fb: new Uint8Array(128 * 64), cx: 0, cy: 0, size: 1, img: null } : null;
    if (this.oled) this.oledShow();
  }
  oledPx(x, y, c) {
    if (!this.oled) return;
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < 128 && y >= 0 && y < 64) this.oled.fb[y * 128 + x] = c === 0 ? 0 : 1;
  }
  oledLine(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    for (;;) { this.oledPx(x0, y0, c); if ((x0 === x1 && y0 === y1) || ++n > 4000) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  oledRect(x, y, w, h, fill, c) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (fill || i === 0 || j === 0 || i === w - 1 || j === h - 1) this.oledPx(x + i, y + j, c);
  }
  oledCircle(x0, y0, r, fill, c) {
    r = Math.max(0, Math.round(r));
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (fill ? d <= r * r + r : (d <= r * r + r && d >= r * r - r)) this.oledPx(x0 + x, y0 + y, c);
    }
  }
  oledGlyph(ch) { this.glyphs = this.glyphs || {}; return this.glyphs[ch] || (this.glyphs[ch] = fontGlyph(ch)); }
  oledPrint(text) {
    const o = this.oled; if (!o) return;
    for (const ch of text) {
      if (ch === '\n') { o.cx = 0; o.cy += 8 * o.size; continue; }
      if (o.cx + 6 * o.size > 128) { o.cx = 0; o.cy += 8 * o.size; }
      for (const [x, y] of this.oledGlyph(ch)) for (let a = 0; a < o.size; a++) for (let b = 0; b < o.size; b++) this.oledPx(o.cx + x * o.size + a, o.cy + y * o.size + b, 1);
      o.cx += 6 * o.size;
    }
  }
  oledShow() {
    const o = this.oled; if (!o) return;
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    const g = cv.getContext('2d'); const im = g.createImageData(128, 64);
    for (let i = 0; i < o.fb.length; i++) { const on = o.fb[i]; im.data.set(on ? [150, 225, 255, 255] : [5, 5, 5, 255], i * 4); }
    g.putImageData(im, 0, 0);
    o.img = cv.toDataURL();
    this.render();
  }

  /* ---------- Tastenfeld ---------- */
  kpRead() {
    if (!this.kp) return '';
    const kc = this.kp.cols;
    for (const c of this.project.components) {
      if (c.def.cols !== kc || !/^keypad/.test(c.type)) continue;
      const ok = this.kp.rows.every((p, i) => this.nl.net(c.id, 'R' + (i + 1)) === this.unoNet(p)) &&
        this.kp.colPins.every((p, i) => this.nl.net(c.id, 'C' + (i + 1)) === this.unoNet(p));
      if (!ok) continue;
      const k = this.keys.get(c.id);
      if (k && this.kpReported.get(c.id) !== k) { this.kpReported.set(c.id, k); return k; }
    }
    return '';
  }
  pressKey(id, key) {
    if (key) this.keys.set(id, key); else { this.keys.delete(id); this.kpReported.delete(id); }
    this.update();
  }

  /* ---------- Multimeter ---------- */
  adsAddr(c) {
    const a = this.nl.net(c.id, 'ADDR');
    if (a === this.nl.net(c.id, 'VDD')) return '0x49';
    if (a === this.nl.net(c.id, 'SDA')) return '0x4A';
    if (a === this.nl.net(c.id, 'SCL')) return '0x4B';
    return '0x48';
  }
  adsInit(addr, fs) {
    const c = this.project.components.find(x => x.type === 'ads1115' && this.powered(x, 'VDD') && this.i2cOk(x) && this.adsAddr(x) === addr);
    this.ads[addr] = c ? { c, fs } : null;
  }
  adsRead(addr, kind, ch) {
    const a = this.ads[addr];
    if (!a) return 0;
    const n = p => this.nl.net(a.c.id, p);
    let v;
    if (kind === 'diff') v = ch === 0 ? this.V(n('A0')) - this.V(n('A1')) : this.V(n('A2')) - this.V(n('A3'));
    else v = this.V(n('A' + ch));
    if (isNaN(v)) v = (Math.random() - 0.5) * 0.01;
    const lsb = a.fs / 32768;
    return Math.round(Math.max(-a.fs, Math.min(a.fs - lsb, v)) / lsb) * lsb;
  }
  inaInit(addr, cal) {
    const c = this.project.components.find(x => x.type === 'ina219' && this.powered(x) && this.i2cOk(x) && '0x' + Number(x.props.address).toString(16) === addr.toLowerCase());
    this.ina[addr] = c ? { c, cal } : null;
  }
  inaRead(addr, mode) {
    const a = this.ina[addr];
    const r = a && this.lastRes && this.lastRes.shuntI[a.c.id];
    if (!r) return 0;
    const maxI = { '16V_400mA': 400, '32V_1A': 1000, '32V_2A': 2000 }[a.cal] || 400;
    if (mode === 'CURRENT') return Math.round(Math.max(-maxI, Math.min(maxI, r.I * 1000)) * 10) / 10;
    if (mode === 'BUS_VOLT') return Math.round(Math.max(0, r.Vbus) * 250) / 250;
    return Math.round(r.Vsh * 1000 * 100) / 100;
  }

  /* ---------- Elektrik ---------- */
  update() {
    if (!this.running) return;
    const io = { outputs: {}, pressed: this.pressed, keys: this.keys, broken: this.broken };
    const pwm = [];
    for (const p in this.outputs) {
      const o = this.outputs[p];
      io.outputs[p] = { v: o.v, duty: o.duty };
      if (o.duty > 0 && o.duty < 1) pwm.push(p);
    }
    const res = solveCircuit(this.project, this.nl, io);
    const ledI = {};
    for (const id in res.led) ledI[id] = res.led[id].I;
    for (const p of pwm) {
      const io2 = Object.assign({}, io, { outputs: Object.assign({}, io.outputs, { [p]: { v: 0 } }) });
      const r2 = solveCircuit(this.project, this.nl, io2);
      const d = this.outputs[p].duty;
      for (const id in ledI) ledI[id] -= (1 - d) * (res.led[id].I - (r2.led[id] ? r2.led[id].I : 0));
    }
    this.lastRes = res;
    this.ledI = {};
    for (const id in res.led) this.ledI[id] = Math.max(0, ledI[id]);
    this.peakI = res.led;
    this.checkElectrics(res);
    this.render();
  }

  checkElectrics(res) {
    if (!this.uno()) return;
    if (res.short) this.msg('short', 'error', 'Kurzschluss zwischen 5V und GND.'); else this.clearMsg('short');
    if (!res.short && Math.abs(res.pinI['5V'] || 0) > 0.5) this.msg('short5', 'error', 'Kurzschluss: zu hoher Strom an 5V.'); else this.clearMsg('short5');
    let changed = false;
    const names = { R: 'Rot', G: 'Grün', B: 'Blau' };
    for (const key in res.led) {
      const I = res.led[key].I;
      const [cid, part] = key.split(':');
      const c = this.project.components.find(x => x.id === cid);
      const name = part ? `RGB-LED (${names[part]})` : `LED (${LED_COLOR_NAMES[c.props.color] || ''})`;
      if (I > 0.03 && !this.broken.has(key)) {
        this.broken.add(key); changed = true;
        this.msg('led' + key, 'error', `${name} durchgebrannt (${Math.round(I * 1000)} mA).`);
      } else if (I > 0.021 && !this.broken.has(key)) {
        this.msg('led' + key, 'warn', `${name}: Strom zu hoch (${Math.round(I * 1000)} mA).`);
      } else if (!this.broken.has(key)) this.clearMsg('led' + key);
    }
    for (const pin in res.pinI) {
      if (!/^D\d+$/.test(pin)) continue;
      const I = Math.abs(res.pinI[pin]);
      if (I > 0.04) this.msg('pin' + pin, 'warn', `Anschluss ${pin} überlastet (${Math.round(I * 1000)} mA).`);
      else this.clearMsg('pin' + pin);
    }
    if (changed) this.update();
  }

  render() {
    if (!this.running) return;
    const res = this.lastRes;
    const states = {};
    const lvl = key => Math.min(1, (this.ledI[key] || 0) / LED_FULL);
    for (const c of this.project.components) {
      switch (c.type) {
        case 'uno': case 'esp32': case 'esp32exp': { const lo = this.outputs[c.def.mcu.led]; const on = !!(lo && lo.v > 0); states[c.id] = { running: true, pin13: on, led: on }; break; }
        case 'led': states[c.id] = { brightness: lvl(c.id), broken: this.broken.has(c.id) }; break;
        case 'rgbled': states[c.id] = { rgb: ['R', 'G', 'B'].map(p => this.broken.has(c.id + ':' + p) ? 0 : lvl(c.id + ':' + p)), broken: ['R', 'G', 'B'].some(p => this.broken.has(c.id + ':' + p)) }; break;
        case 'button': case 'button2': case 'pushbutton': states[c.id] = { pressed: this.pressed.has(c.id) }; break;
        case 'touch': case 'pir': states[c.id] = { active: this.pressed.has(c.id) }; break;
        case 'keypad3': case 'keypad4': states[c.id] = { key: this.keys.get(c.id) || null }; break;
        case 'servo': states[c.id] = { angle: this.servo[c.id] || 0 }; break;
        case 'piezo': states[c.id] = { sounding: Object.values(this.tones).some(t => t.ids.includes(c.id)) }; break;
        case 'motor': case 'gearmotor': {
          const a = res ? res.V[this.nl.net(c.id, 'P')] : 0, b = res ? res.V[this.nl.net(c.id, 'N')] : 0;
          const d = (a || 0) - (b || 0);
          states[c.id] = { running: Math.abs(d) > 1, speed: Math.min(1, Math.abs(d) / 4.5), dir: d < 0 ? -1 : 1 };
          break;
        }
        case 'lcd': states[c.id] = this.lcd.ready && this.powered(c) && this.i2cOk(c) ? { backlight: this.lcd.backlight, lines: this.lcd.lines.map(l => l.slice(0, 16)) } : { backlight: false, lines: ['', ''] }; break;
        case 'oled': states[c.id] = { img: this.oled && this.powered(c) && this.i2cOk(c) ? this.oled.img : null }; break;
        case 'strip': case 'ring': {
          const n = this.neo;
          if (n && this.powered(c) && this.nl.net(c.id, 'DIN') === this.unoNet(n.pin)) {
            const f = Math.pow(n.bright / 255, 0.5);
            states[c.id] = { pixels: Array.from({ length: c.def.count }, (_, i) => (n.px[i] || [0, 0, 0]).map(x => x * f)) };
          } else states[c.id] = { pixels: null };
          break;
        }
      }
    }
    this.app.circuit.renderStates(states);
  }

  pressButton(id, down) {
    if (down) this.pressed.add(id); else this.pressed.delete(id);
    this.update();
  }
}
