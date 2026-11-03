/* Schulversion: Anmeldung mit Stundencode, Prüfungsmodus (Sperren, Abgabe, Verlassen melden),
   Aufgabenstellung der Lehrkraft. Alles läuft über das eigene Startprogramm (api/schule/…),
   das die Anfragen an den Schulserver weiterreicht. */
'use strict';

const School = {
  on: false,       // Schulversion (Startprogramm hat einen Schulserver eingetragen)
  who: null,       // { klasse, tisch, vorname }
  state: { modus: 'normal' },
  examDone: null,  // Kennung der Prüfung, für die das Prüfungsprojekt schon angelegt ist
  away: null,      // Zeitpunkt, seit dem das Fenster verlassen ist
  picker: false,   // Auswahlfenster des Browsers offen (USB/Bluetooth) – kein „Verlassen“

  exam() { return this.on && this.state.modus === 'pruefung'; },

  async init(app) {
    this.app = app;
    if (!app.launcher) return false;
    let info;
    try { info = await (await fetch('api/schule/info', { cache: 'no-store' })).json(); } catch (e) { return false; }
    if (!info.schule) return false;
    this.on = true;
    this.server = info.server;
    document.body.classList.add('school-mode');
    if (info.angemeldet && info.wer) this.setWho(info.wer);
    this.bindGuards();
    // Fenster geschlossen: abmelden, damit am selben Rechner (Gastkonto) niemand die Anmeldung übernimmt
    window.addEventListener('pagehide', () => { if (this.who && !this.keepLogin) navigator.sendBeacon('api/schule/abmelden'); });
    return true;
  },

  setWho(w) {
    this.who = w;
    if (w.zustand) this.state = w.zustand;
    try { localStorage.setItem('werkstatt.schueler', JSON.stringify({ tisch: w.tisch, vor: w.vorname })); } catch (e) { /* ohne Speicher */ }
    const chip = $('#schoolChip');
    if (chip) { chip.hidden = false; chip.querySelector('span').textContent = `${w.vorname} · T${parseInt(w.tisch, 10)}`; chip.title = `${w.vorname}, Tisch ${parseInt(w.tisch, 10)}, Klasse ${w.klasse}`; }
  },

  /* Anmeldung: Stundencode (von der Tafel), Tisch-Nr., Vorname */
  loginScreen(then) {
    const d = $('#dlg');
    let last = {};
    try { last = JSON.parse(localStorage.getItem('werkstatt.schueler') || '{}'); } catch (e) { last = {}; }
    const opts = '<option value="">–</option>' + Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, '0')).map(n => `<option ${n === last.tisch ? 'selected' : ''}>${n}</option>`).join('');
    d.classList.add('start');
    this.app.dialog(`<h2>Willkommen in der Arduino-Werkstatt</h2>
      <p>Melde dich mit dem <b>Stundencode</b> von der Tafel an.</p>
      <div class="name3 school-login">
        <label>Stundencode<input type="text" name="code" inputmode="numeric" maxlength="6" autocomplete="off" spellcheck="false" placeholder="z. B. 4711"></label>
        <label>Tisch-Nr.<select name="tisch">${opts}</select></label>
        <label>Vorname<input type="text" name="vor" value="${esc(last.vor || '')}" autocomplete="off" spellcheck="false"></label>
      </div>
      <div class="field-err" id="loginErr" hidden></div>
      <div class="start-go"><button class="btn primary" value="join">Anmelden</button></div>`);
    d.oncancel = e => e.preventDefault();
    const f = $('#dlgForm');
    setTimeout(() => f.elements.code.focus(), 0);
    f.addEventListener('submit', async e => {
      if (!e.submitter || e.submitter.value !== 'join') return;
      e.preventDefault();
      const err = $('#loginErr'), show = m => { err.textContent = m; err.hidden = false; };
      const code = f.elements.code.value.trim(), tisch = f.elements.tisch.value, vor = f.elements.vor.value.trim();
      if (!/^\d{4,6}$/.test(code)) return show('Gib den Stundencode von der Tafel ein (4 Ziffern).');
      if (!tisch) return show('Wähle deine Tisch-Nummer.');
      if (!/\p{L}/u.test(vor)) return show('Gib deinen Vornamen ein.');
      e.submitter.disabled = true;
      try {
        const r = await fetch('api/schule/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, tisch, vorname: vor }) });
        if (!r.ok) throw new Error((await r.text()).trim());
        this.setWho(await r.json());
        d.oncancel = null; d.classList.remove('start');
        d.close('ok');
        then();
      } catch (er) { show(er.message || 'Anmeldung fehlgeschlagen.'); e.submitter.disabled = false; }
    });
  },

  async logout() {
    if (this.exam()) { this.app.toast('Während der Prüfung kann man sich nicht abmelden. Gib zuerst ab.'); return; }
    try { await this.app.save(); } catch (e) { /* weiter */ }
    await fetch('api/schule/abmelden', { method: 'POST' });
    this.who = null;
    try { localStorage.removeItem('werkstatt.current'); } catch (e) { /* egal */ }
    location.reload();
  },

  /* Zustand vom Server holen (alle 3 s) und anwenden */
  startPolling() {
    const poll = async () => {
      if (!this.who) return;
      let st;
      try {
        const r = await fetch('api/schule/state?projekt=' + encodeURIComponent($('#projName').value), { cache: 'no-store' });
        if (r.status === 401) { this.app.toast('Die Anmeldung ist abgelaufen. Bitte neu anmelden.'); setTimeout(() => location.reload(), 2500); return; }
        if (!r.ok) throw new Error();
        st = await r.json();
        this.offline = false;
      } catch (e) {
        if (!this.offline) { this.offline = true; this.app.toast('Keine Verbindung zum Schulserver. Deine Arbeit bleibt im Browser gesichert, bis die Verbindung wieder da ist.'); }
        return;
      }
      this.apply(st);
    };
    poll();
    setInterval(poll, 3000);
  },

  apply(st) {
    const was = this.exam();
    this.state = st;
    const exam = this.exam();
    document.body.classList.toggle('exam-mode', exam);
    $('#examBtn').hidden = !exam;
    $('#projName').readOnly = exam;
    if (exam && !was) { this.app.toast('Die Prüfung hat begonnen. Beispiele, Aufgaben und Hilfe sind gesperrt.'); }
    if (!exam && was) { this.app.toast('Die Prüfung ist beendet.'); this.examDone = null; }
    if (exam && this.examDone !== st.pruefung) this.startExam(st);
    this.renderExamTask(exam ? st.aufgabe : '');
    this.overlay(exam && st.abgegeben);
  },

  /* Prüfung: eigenes, neues Prüfungsprojekt (oder das schon angelegte nach einem Neustart) */
  async startExam(st) {
    this.app.opening = true; // kein Zurück ins Startfenster, während das Prüfungsprojekt geladen wird
    try { await this.startExamInner(st); } finally { this.app.opening = false; }
  },
  async startExamInner(st) {
    this.examDone = st.pruefung;
    const app = this.app;
    const d = $('#dlg');
    if (d.open) { d.classList.remove('start'); d.oncancel = null; d.close('cancel'); } // Startfenster oder anderen Dialog schließen
    try { await app.save(); } catch (e) { /* weiter */ }
    if (app.task) { app.task = null; if (TaskUi.panel) TaskUi.render(); }
    let list = [];
    try { list = await (await app.api('list')).json(); } catch (e) { list = []; }
    const dt = new Date(st.pruefung);
    const name = `${this.who.tisch} – ${this.who.vorname} – Prüfung ${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.`;
    const file = app.fileFor(name);
    if (list.some(p => p.file === file)) {
      try { const data = await (await app.api('load?file=' + encodeURIComponent(file))).json(); app.loadProject(data); app.fileName = file; return; } catch (e) { /* neu anlegen */ }
    }
    app.loadProject(app.blankProject(name));
    app.fileName = null;
    app.save();
  },

  renderExamTask(text) {
    let p = $('#examPanel');
    if (!text) { if (p) p.remove(); return; }
    if (!p) {
      p = document.createElement('div');
      p.id = 'examPanel'; p.className = 'task-panel exam-panel';
      $('#stage').append(p);
      if (this.app.makeMovable) this.app.makeMovable(p, '.tp-head');
    }
    if (p.dataset.text === text) return;
    p.dataset.text = text;
    p.innerHTML = `<div class="tp-head"><span class="tp-tag">Prüfung</span><b>Aufgabenstellung</b></div><div class="tp-body"><p class="tp-goal">${esc(text).replace(/\n/g, '<br>')}</p></div>`;
  },

  overlay(on) {
    let o = $('#examOverlay');
    if (!on) { if (o) { o.remove(); this.app.toast('Deine Lehrkraft hat die Abgabe zurückgenommen – du kannst weiterarbeiten.'); } return; }
    if (o) return;
    o = document.createElement('div');
    o.id = 'examOverlay'; o.className = 'exam-overlay';
    o.innerHTML = `<div><div class="big">✓ Abgegeben</div><p>Deine Prüfung ist bei deiner Lehrkraft angekommen.</p><p><b>Bitte melde dich jetzt bei deiner Lehrkraft.</b></p></div>`;
    document.body.append(o);
    if (this.app.sim.running) this.app.stopSim();
  },

  submit() {
    if (!this.exam()) return;
    this.app.dialog(`<h2>Prüfung abgeben?</h2><p>Dein Projekt <b>${esc($('#projName').value)}</b> wird an deine Lehrkraft geschickt. Danach kannst du nicht mehr daran arbeiten.</p><div class="dlg-btns"><button class="btn" value="cancel">Noch nicht</button><button class="btn primary" value="ok">Jetzt abgeben</button></div>`, async rv => {
      if (rv !== 'ok') return;
      try {
        await this.app.save();
        if (!this.app.fileName) throw new Error('Das Projekt konnte nicht gespeichert werden.');
        await this.app.api('schule/abgabe?file=' + encodeURIComponent(this.app.fileName), { method: 'POST' });
        this.apply(Object.assign({}, this.state, { abgegeben: new Date().toISOString() }));
      } catch (e) { this.app.toast('Abgeben fehlgeschlagen: ' + e.message + ' – bitte noch einmal versuchen oder die Lehrkraft rufen.'); }
    });
  },

  async examples() {
    if (!this.on || !this.who || this.exam()) return [];
    try { return await (await this.app.api('schule/beispiele')).json(); } catch (e) { return []; }
  },

  /* Sperren im Prüfungsmodus und Melden, wenn die Werkstatt verlassen wird */
  bindGuards() {
    const report = (art, dauer) => fetch('api/schule/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art, dauer }) }).catch(() => {});
    const leave = () => {
      if (!this.exam() || this.away || this.picker || this.state.abgegeben) return;
      this.away = Date.now();
      report('verlassen');
    };
    const back = () => {
      if (!this.away) return;
      const s = Math.round((Date.now() - this.away) / 1000);
      this.away = null;
      report('zurueck', s);
    };
    window.addEventListener('blur', () => setTimeout(() => { if (!document.hasFocus()) leave(); }, 300));
    window.addEventListener('focus', back);
    document.addEventListener('visibilitychange', () => (document.hidden ? leave() : back()));
    // Einfügen von außen sperren (die Werkstatt-eigene Zwischenablage für Blöcke bleibt)
    document.addEventListener('paste', e => {
      if (!this.exam()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.app.toast('In der Prüfung ist Einfügen von außen gesperrt.');
    }, true);
    ['dragover', 'drop'].forEach(t => document.addEventListener(t, e => {
      if (this.exam() && e.dataTransfer && [...(e.dataTransfer.types || [])].some(x => x === 'Files' || x === 'text/plain')) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true));
  },
};
