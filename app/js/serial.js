/* Serieller Monitor für den echten Arduino/ESP32: per USB (Web Serial) oder beim ESP32 per Bluetooth
   (Block „Bluetooth einrichten“, BLE-UART). Beim Hochladen per USB wird die USB-Verbindung kurz getrennt
   und danach wiederhergestellt. */
'use strict';

const BLE_UART = { svc: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', rx: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', tx: '6e400003-b5a3-f393-e0a9-e50e24dcca9e' };

const SerialLink = {
  port: null,
  connected: false,
  mode: null, // 'usb' oder 'bt'
  reader: null,
  available: typeof navigator !== 'undefined' && !!navigator.serial,
  btAvailable: typeof navigator !== 'undefined' && !!navigator.bluetooth,

  init(app) {
    this.app = app;
    const btn = document.querySelector('#serialConn'), bt = document.querySelector('#serialBt');
    btn.onclick = e => (this.connected && this.mode === 'usb' ? this.disconnect() : this.connect(true, e.shiftKey));
    bt.onclick = () => (this.connected && this.mode === 'bt' ? this.disconnect() : this.connectBt());
    document.querySelector('#serialClr').onclick = () => app.serialClear();
    document.querySelector('#serialCsv').onclick = () => app.serialCsv();
    if (this.available) navigator.serial.addEventListener('disconnect', e => { if (e.target === this.port && this.connected && this.mode === 'usb') { this.closeQuietly(); app.toast('Mikrocontroller wurde abgezogen.'); } });
    this.setUi();
  },

  baud() { return BOARD === 'esp32' ? 115200 : 9600; },

  setUi() {
    const btn = document.querySelector('#serialConn'), bt = document.querySelector('#serialBt');
    if (!btn) return;
    btn.hidden = !this.available || (this.connected && this.mode === 'bt');
    bt.hidden = !this.btAvailable || BOARD !== 'esp32' || (this.connected && this.mode === 'usb');
    btn.textContent = this.connected && this.mode === 'usb' ? 'USB trennen' : 'Per USB verbinden';
    bt.textContent = this.connected && this.mode === 'bt' ? 'Bluetooth trennen' : 'Per Bluetooth verbinden';
    btn.classList.toggle('primary', !this.connected);
    document.querySelector('#serialWrap').classList.toggle('live', this.connected);
  },

  /* USB-Wandler, die auf Arduino- und ESP32-Boards sitzen: CH340, CP210x, FTDI, Arduino, ESP32-S3/C3 */
  USB_IDS: [0x1a86, 0x10c4, 0x0403, 0x2341, 0x2a03, 0x303a],

  async connect(ask, all) {
    if (!this.available) return false;
    try {
      // Auswahlfenster zeigt nur Anschlüsse mit Mikrocontroller (Umschalt+Klick: alle Anschlüsse)
      if (!this.port || ask) this.port = (ask && !all && await this.autoPort()) || await this.picked(() => navigator.serial.requestPort(all ? {} : { filters: this.USB_IDS.map(v => ({ usbVendorId: v })) }));
      await this.port.open({ baudRate: this.baud() });
      if (BOARD === 'esp32') { try { await this.port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (e) { /* egal */ } }
      this.connected = true; this.mode = 'usb';
      this.setUi();
      this.app.serialWrite(`[Verbunden per USB mit dem echten ${BOARD === 'esp32' ? 'ESP32' : 'Arduino'}, ${this.baud()} Baud]\n`);
      this.readLoop();
      return true;
    } catch (e) {
      if (e && e.name === 'NotFoundError') { // Auswahl abgebrochen oder kein Mikrocontroller gefunden
        if (!all) this.app.toast('Kein Mikrocontroller in der Liste? USB-Kabel prüfen. Mit Umschalt+Klick auf „Per USB verbinden“ werden alle Anschlüsse angezeigt.');
        return false;
      }
      this.app.toast(/already open|in use|Failed to open/i.test(String(e && e.message)) ? 'Der Anschluss ist belegt (z. B. durch ein anderes Programm oder ein Hochladen).' : 'Verbinden fehlgeschlagen: ' + (e && e.message));
      return false;
    }
  },

  /* Auswahlfenster des Browsers: in der Prüfung nicht als „Werkstatt verlassen“ melden */
  async picked(fn) {
    if (typeof School !== 'undefined') School.picker = true;
    try { return await fn(); } finally { setTimeout(() => { if (typeof School !== 'undefined') School.picker = false; }, 500); }
  },

  /* Automatische Suche: Steckt genau ein Mikrocontroller (USB-Wandler CH340, CP210x, FTDI, Arduino, ESP32-S3),
     den Chrome schon einmal freigegeben hat, wird er ohne Auswahlfenster verbunden. Sonst fragt Chrome einmal nach. */
  async autoPort() {
    try {
      const known = this.USB_IDS;
      const ports = (await navigator.serial.getPorts()).filter(p => known.includes((p.getInfo() || {}).usbVendorId));
      return ports.length === 1 ? ports[0] : null;
    } catch (e) { return null; }
  },

  /* Bluetooth: Programm mit dem Block „Bluetooth einrichten“ (BLE-UART) */
  async connectBt() {
    let dev;
    try {
      dev = await this.picked(() => navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_UART.svc] }, { services: [BT_UUID.svc] }], optionalServices: [BLE_UART.svc] }));
      const srv = await dev.gatt.connect();
      let svc;
      try { svc = await srv.getPrimaryService(BLE_UART.svc); } catch (e) {
        dev.gatt.disconnect();
        this.app.toast('Auf diesem ESP32 läuft kein Programm mit dem Block „Bluetooth einrichten“.');
        return false;
      }
      this.btRx = await svc.getCharacteristic(BLE_UART.rx);
      const tx = await svc.getCharacteristic(BLE_UART.tx);
      const dec = new TextDecoder();
      tx.addEventListener('characteristicvaluechanged', ev => this.app.serialWrite(dec.decode(ev.target.value, { stream: true }).replace(/\r/g, '')));
      await tx.startNotifications();
      dev.addEventListener('gattserverdisconnected', () => {
        if (this.mode !== 'bt' || this.btDev !== dev) return;
        this.connected = false; this.mode = null; this.setUi();
        this.app.serialWrite('[Bluetooth getrennt]\n');
      });
      this.btDev = dev; this.connected = true; this.mode = 'bt';
      this.setUi();
      this.app.serialWrite(`[Verbunden per Bluetooth mit „${dev.name || 'ESP32'}“]\n`);
      return true;
    } catch (e) {
      if (e && e.name === 'NotFoundError') return false; // Auswahl abgebrochen
      try { if (dev) dev.gatt.disconnect(); } catch (er) { /* egal */ }
      this.app.toast('Bluetooth-Verbindung fehlgeschlagen. Ist der ESP32 eingeschaltet und in der Nähe?');
      return false;
    }
  },

  async readLoop() {
    const dec = new TextDecoder();
    try {
      while (this.connected && this.mode === 'usb' && this.port.readable) {
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
    if (!this.connected) return;
    const data = new TextEncoder().encode(text + '\n');
    if (this.mode === 'bt') {
      // Eine Nachricht = ein Schreibvorgang (der ESP32 nimmt bis 200 Zeichen an); nur notfalls in Stücken
      const msg = data.slice(0, 200);
      try { await this.btRx.writeValueWithResponse(msg); } catch (e) {
        for (let i = 0; i < msg.length; i += 20) await this.btRx.writeValueWithResponse(msg.slice(i, i + 20));
      }
      return;
    }
    if (!this.port.writable) return;
    const w = this.port.writable.getWriter();
    try { await w.write(data); } finally { w.releaseLock(); }
  },

  async closeQuietly() {
    const mode = this.mode;
    this.connected = false; this.mode = null;
    if (mode === 'bt') { try { this.btDev.gatt.disconnect(); } catch (e) { /* egal */ } }
    if (mode === 'usb') {
      try { if (this.reader) await this.reader.cancel(); } catch (e) { /* egal */ }
      try { await this.port.close(); } catch (e) { /* egal */ }
    }
    this.setUi();
  },

  async disconnect() {
    await this.closeQuietly();
    this.app.serialWrite('[Getrennt]\n');
  },

  /* Vor dem Hochladen per USB den Anschluss freigeben, danach wieder verbinden */
  async pauseForUpload() {
    if (!this.connected || this.mode !== 'usb') return false;
    await this.closeQuietly();
    return true;
  },
  async resumeAfterUpload() {
    await new Promise(r => setTimeout(r, 1500));
    if (!this.connected && this.port) await this.connect(false);
  },
};
