/* Serieller Monitor für den echten Arduino/ESP32 (Web Serial in Chrome/Edge).
   Beim Hochladen per USB wird die Verbindung kurz getrennt und danach wiederhergestellt. */
'use strict';

const SerialLink = {
  port: null,
  connected: false,
  reader: null,
  available: typeof navigator !== 'undefined' && !!navigator.serial,

  init(app) {
    this.app = app;
    const btn = document.querySelector('#serialConn');
    if (!this.available) { btn.hidden = true; return; }
    btn.onclick = () => (this.connected ? this.disconnect() : this.connect(true));
    document.querySelector('#serialClr').onclick = () => app.serialClear();
    navigator.serial.addEventListener('disconnect', e => { if (e.target === this.port && this.connected) { this.closeQuietly(); app.toast('Mikrocontroller wurde abgezogen.'); } });
  },

  baud() { return BOARD === 'esp32' ? 115200 : 9600; },

  setUi() {
    const btn = document.querySelector('#serialConn');
    btn.textContent = this.connected ? 'Trennen' : 'Mit Mikrocontroller verbinden';
    btn.classList.toggle('primary', !this.connected);
    document.querySelector('#serialWrap').classList.toggle('live', this.connected);
  },

  async connect(ask) {
    try {
      if (!this.port || ask) this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.baud() });
      if (BOARD === 'esp32') { try { await this.port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (e) { /* egal */ } }
      this.connected = true;
      this.setUi();
      this.app.serialWrite(`[Verbunden mit dem echten ${BOARD === 'esp32' ? 'ESP32' : 'Arduino'}, ${this.baud()} Baud]\n`);
      this.readLoop();
      return true;
    } catch (e) {
      if (e && e.name === 'NotFoundError') return false; // Auswahl abgebrochen
      this.app.toast(/already open|in use|Failed to open/i.test(String(e && e.message)) ? 'Der Anschluss ist belegt (z. B. durch ein anderes Programm oder ein Hochladen).' : 'Verbinden fehlgeschlagen: ' + (e && e.message));
      return false;
    }
  },

  async readLoop() {
    const dec = new TextDecoder();
    try {
      while (this.connected && this.port.readable) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value) this.app.serialWrite(dec.decode(value, { stream: true }).replace(/\r/g, ''));
          }
        } finally { this.reader.releaseLock(); this.reader = null; }
      }
    } catch (e) { /* Verbindung beendet */ }
  },

  async send(text) {
    if (!this.connected || !this.port.writable) return;
    const w = this.port.writable.getWriter();
    try { await w.write(new TextEncoder().encode(text + '\n')); } finally { w.releaseLock(); }
  },

  async closeQuietly() {
    this.connected = false;
    try { if (this.reader) await this.reader.cancel(); } catch (e) { /* egal */ }
    try { await this.port.close(); } catch (e) { /* egal */ }
    this.setUi();
  },

  async disconnect() {
    await this.closeQuietly();
    this.app.serialWrite('[Getrennt]\n');
  },

  /* Vor dem Hochladen per USB den Anschluss freigeben, danach wieder verbinden */
  async pauseForUpload() {
    if (!this.connected) return false;
    await this.closeQuietly();
    return true;
  },
  async resumeAfterUpload() {
    await new Promise(r => setTimeout(r, 1500));
    if (!this.connected && this.port) await this.connect(false);
  },
};
