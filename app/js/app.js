/* Zusammenspiel der Oberfläche: Modi, Speichern, Eigenschaften, Meldungen */
'use strict';

const $ = s => document.querySelector(s);
const FORMAT = 'arduino-werkstatt';

// Ansichtsmodus (Großansicht der Lehrkraft im Schulserver): ?ansicht=<Adresse des Projekts>
const VIEW_URL = new URLSearchParams(location.search).get('ansicht');

const App = {
  viewer: !!VIEW_URL,
  focusArea: 'circuit',
  undoStack: [],
  redoStack: [],
  launcher: false,
  extensions: [],
  codeView: 'blocks',
  fileName: null,

  async init() {
    defineBlocks();
    setupSimGenerator();
    this.sim = new Simulator(this);
    this.circuit = new CircuitEditor($('#circuit'), this);
    this.project = this.circuit.project;
    this.workspace = Blockly.inject('blockly', {
      toolbox: buildToolbox([]), renderer: 'werkstatt', media: 'lib/blockly/media/',
      zoom: { controls: true, wheel: true, startScale: 0.7, maxScale: 2, minScale: 0.3 },
      readOnly: !!VIEW_URL,
      trashcan: true, move: { scrollbars: true, drag: true, wheel: false },
      grid: { spacing: 24, length: 2, colour: '#e3e5e2', snap: false },
    });
    registerListCategory(this.workspace);
    this.workspace.addChangeListener(Blockly.Events.disableOrphans);
    this.workspace.addChangeListener(e => {
      if (e.type === Blockly.Events.BLOCK_CREATE && !this.loading) (e.ids || []).forEach(id => { const b = this.workspace.getBlockById(id); if (b && /^kp_init/.test(b.type) && b.getFieldValue('R0') === '0') initKeypadDefaults(b); });
    });
    this.workspace.addChangeListener(e => this.onBlocksChanged(e));
    // Wächst „beim Start“ nach unten, rutscht „für immer“ mit (damit sich die beiden nicht überdecken)
    this.workspace.addChangeListener(e => {
      if (this.loading || e.isUiEvent || ![Blockly.Events.BLOCK_MOVE, Blockly.Events.BLOCK_CREATE, Blockly.Events.BLOCK_CHANGE].includes(e.type)) return;
      clearTimeout(this.bumpTimer);
      this.bumpTimer = setTimeout(() => this.bumpLoop(e.group), 0);
    });
    $('#blockly').addEventListener('pointerdown', () => { this.focusArea = 'code'; }, true);

    this.buildPartList();
    this.bindUi();
    if (this.viewer) { document.body.classList.add('viewer-mode'); await this.viewerStart(); return; }
    this.launcher = await this.ping();
    await School.init(this);
    await this.loadInitial();
    if (this.launcher) setInterval(() => this.ping(), 5000);
    if (this.winMode === 'maximiert') this.maximize();
    else if (this.winMode === 'vollbild') this.autoFullscreen();
  },

  /* ---------- Vollbild ---------- */
  // Browser-Vollbild (F11 bzw. --start-fullscreen) oder Seiten-Vollbild?
  isFull() { return !!document.fullscreenElement || (Math.abs(innerHeight - screen.height) < 4 && Math.abs(innerWidth - screen.width) < 4); },
  async enterFull() {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      // Esc bleibt für die Werkstatt (Kabel abbrechen …); Vollbild beenden: Esc gedrückt halten, F11 oder Knopf
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {});
    } catch (e) { /* vom Browser abgelehnt */ }
  },
  toggleFull() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (this.isFull()) { this.toast('Vollbild beenden: Taste F11.'); return; }
    this.enterFull();
  },
  // Lief Chrome schon, ignoriert er --start-maximized: Fenster dann selbst auf die ganze Arbeitsfläche ziehen
  maximize() {
    if (navigator.webdriver) return;
    if (outerWidth >= screen.availWidth - 8 && outerHeight >= screen.availHeight - 8) return;
    try { window.moveTo(screen.availLeft || 0, screen.availTop || 0); window.resizeTo(screen.availWidth, screen.availHeight); } catch (e) { /* nicht erlaubt */ }
  },
  // Startete der Browser nicht im Vollbild (z. B. Chrome lief schon), beim ersten Klick nachholen
  autoFullscreen() {
    if (navigator.webdriver || this.isFull()) return;
    const go = () => { window.removeEventListener('pointerdown', go, true); if (!this.isFull()) this.enterFull(); };
    window.addEventListener('pointerdown', go, true);
  },

  /* ---------- Ansichtsmodus: Projekt nur ansehen, laufend aktualisieren ---------- */
  async viewerStart() {
    let last = '';
    const load = async first => {
      let txt;
      try { const r = await fetch(VIEW_URL, { cache: 'no-store' }); if (!r.ok) throw new Error(await r.text()); txt = await r.text(); }
      catch (e) { if (first) { $('#projName').value = 'Noch kein Projekt gespeichert'; this.toast(String(e.message || e)); } return; }
      if (txt === last) return;
      last = txt;
      const data = JSON.parse(txt);
      const keep = !first && { view: Object.assign({}, this.circuit.view), mode: $('#main').classList.contains('mode-code') ? 'code' : 'parts', sim: this.sim.running, scroll: [this.workspace.scrollX, this.workspace.scrollY, this.workspace.scale] };
      this.loadProject(data);
      if (keep) {
        this.setMode(keep.mode);
        this.circuit.view = keep.view; this.circuit.applyView();
        requestAnimationFrame(() => { this.workspace.setScale(keep.scroll[2]); this.workspace.scroll(keep.scroll[0], keep.scroll[1]); });
        if (keep.sim) this.startSim();
      } else requestAnimationFrame(() => this.circuit.fitView());
      $('#saveState').textContent = 'nur Ansicht · Stand ' + new Date().toLocaleTimeString('de-DE');
    };
    $('#projName').readOnly = true;
    await load(true);
    setInterval(() => load(false), 3000);
  },

  /* ---------- Starthilfe vom Stick ---------- */
  async ping() {
    if (location.protocol === 'file:') return false;
    try {
      const r = await fetch('api/ping', { cache: 'no-store' });
      if (r.ok && this.winMode === undefined) { try { this.winMode = (await r.json()).fenster || ''; } catch (e) { this.winMode = ''; } }
      return r.ok;
    } catch (e) { return false; }
  },
  async api(path, opts) {
    const r = await fetch('api/' + path, opts);
    if (!r.ok) throw new Error(await r.text());
    return r;
  },

  /* Startbildschirm: neues Projekt, zuletzt bearbeitet, anderes öffnen, ggf. Notfall-Rettung */
  async loadInitial() {
    // Schulversion: zuerst mit Stundencode anmelden
    if (School.on && !School.who) { this.loadProject(this.blankProject()); School.loginScreen(() => this.loadInitial()); return; }
    if (School.on && !this.schoolPolling) { this.schoolPolling = true; School.startPolling(); }
    this.loadProject(this.blankProject());
    this.loadCount = 0; // zählt ab hier nur Projekte, die der Schüler selbst öffnet oder anlegt
    if (!this.tourHooked) { // Einführungstour, sobald das erste Projekt offen und kein Fenster mehr im Weg ist
      this.tourHooked = true;
      $('#dlg').addEventListener('close', () => setTimeout(() => { if (!$('#dlg').open && this.loadCount > 0 && !Tour.box) Tour.maybeStart(this); }, 500));
    }
    TaskStore.load(this).then(() => TaskUi.render());
    let list = [], last = '';
    if (this.launcher) {
      try { list = await (await this.api('list')).json(); } catch (e) { list = []; }
      this.projectFiles = new Set(list.map(p => p.file));
      try { last = (await (await this.api('last')).text()).trim(); } catch (e) { last = ''; }
    }
    let rescue = null;
    try { rescue = JSON.parse(localStorage.getItem('werkstatt.current') || 'null'); } catch (e) { rescue = null; }
    if (rescue && (!rescue.circuit || (!rescue.circuit.components.length && !/<block type="(?!ard_setup|ard_loop)/.test(rescue.blocks || '')))) rescue = null;
    if (rescue && this.launcher && list.some(p => p.file === this.fileFor(rescue.name || ''))) rescue = null;
    // Schulversion (Gastkonten): nur den eigenen Entwurf anbieten, nie den eines anderen Schülers
    if (rescue && School.on && !String(rescue.name || '').startsWith(`${School.who.tisch} – ${School.who.vorname} – `)) rescue = null;
    this.startScreen(list, last, rescue);
  },

  /* Projektname muss „Nr – Vorname – Projekt“ enthalten */
  checkName(v) {
    const parts = String(v).trim().replace(/^(\d+)\s*[-–—]\s*/, '$1 – ').split(/\s+[-–—]\s+/);
    if (parts.length < 3 || !/^\d{1,2}$/.test(parts[0])) return null;
    const rest = parts.slice(2).join(' – ');
    if (!/\p{L}/u.test(parts[1]) || !/\p{L}/u.test(rest)) return null;
    return `${parts[0].padStart(2, '0')} – ${parts[1]} – ${rest}`;
  },
  /* Eingabe für neue Projekte: Tisch-Nr., Vorname, Projektname → „11 – Lena – Ampelschaltung“ */
  nameFields(pre) {
    pre = pre || {};
    let last = {};
    try { last = JSON.parse(localStorage.getItem('werkstatt.schueler') || '{}'); } catch (e) { last = {}; }
    let tisch = pre.tisch || last.tisch || '', vor = pre.vor != null ? pre.vor : (last.vor || '');
    if (School.who) { tisch = School.who.tisch; vor = School.who.vorname; } // Schulversion: angemeldet
    const opts = '<option value="">–</option>' + Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, '0')).map(n => `<option ${n === tisch ? 'selected' : ''}>${n}</option>`).join('');
    return `<div class="name3">
        <label>Tisch-Nr.<select name="tisch" ${School.who ? 'disabled title="Angemeldet – Tisch und Vorname stehen fest"' : ''}>${opts}</select></label>
        <label>Vorname<input type="text" name="vor" value="${esc(vor)}" spellcheck="false" autocomplete="off" ${School.who ? 'readonly title="Angemeldet – Tisch und Vorname stehen fest"' : ''}></label>
        <label class="wide">Projekt<input type="text" name="proj" value="${esc(pre.proj || '')}" spellcheck="false" autocomplete="off" placeholder="z. B. Ampelschaltung"></label>
        <input type="hidden" name="n">
      </div>`;
  },
  guardNameFields(form) {
    const box = form.querySelector('.name3');
    const err = document.createElement('div');
    err.className = 'field-err'; err.hidden = true;
    box.insertAdjacentElement('afterend', err);
    const els = ['tisch', 'vor', 'proj'].map(n => form.elements[n]);
    els.forEach(el => el.addEventListener('input', () => { err.hidden = true; el.classList.remove('bad'); }));
    // Enter in einem Feld = Anlegen/Speichern (nicht „Abbrechen“)
    form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.name3')) { e.preventDefault(); const b = form.querySelector('button.primary[value]'); if (b) b.click(); } });
    const first = els.find(el => !el.value) || els[2];
    setTimeout(() => first.focus(), 0);
    form.addEventListener('submit', e => {
      const sub = e.submitter && e.submitter.value;
      if (sub === 'cancel' || !e.submitter || !/^(new|ok)$/.test(sub)) return;
      const clean = s => s.trim().replace(/\s+/g, ' ').replace(/\s+[-–—]\s+/g, ' ');
      const [t, n, p] = [els[0].value, clean(els[1].value), clean(els[2].value)];
      const bad = (el, msg) => { e.preventDefault(); err.textContent = msg; err.hidden = false; el.classList.add('bad'); el.focus(); };
      if (!t) return bad(els[0], 'Wähle deine Tisch-Nummer.');
      if (!/\p{L}/u.test(n)) return bad(els[1], 'Gib deinen Vornamen ein.');
      if (!/\p{L}/u.test(p)) return bad(els[2], 'Gib deinem Projekt einen Namen, z. B. Ampelschaltung.');
      const name = `${t} – ${n} – ${p}`;
      if (this.nameTaken(name, true)) return bad(els[2], `Das Projekt „${name}“ gibt es schon. Wähle einen anderen Projektnamen oder öffne das vorhandene Projekt.`);
      form.elements.n.value = name;
      try { localStorage.setItem('werkstatt.schueler', JSON.stringify({ tisch: t, vor: n })); } catch (er) { /* ohne Speicher */ }
    });
  },
  nameParts(name) {
    const m = this.checkName(name || '');
    if (!m) return {};
    const p = m.split(' – ');
    return { tisch: p[0], vor: p[1], proj: p.slice(2).join(' – ') };
  },
  /* Gibt es schon ein (anderes) Projekt mit diesem Namen? Dann würde es überschrieben. */
  nameTaken(name, strict) {
    if (!this.launcher || !this.projectFiles) return false;
    const f = this.fileFor(name);
    return this.projectFiles.has(f) && (strict || f !== this.fileName);
  },
  async refreshFiles() {
    if (!this.launcher) return;
    try { this.projectFiles = new Set((await (await this.api('list')).json()).map(p => p.file)); } catch (e) { /* bleibt */ }
  },
  startScreen(list, last, rescue) {
    const fmt = d => new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    const name = f => esc(f.replace(/\.awp$/, ''));
    const lastItem = list.find(p => p.file === last) || list[0];
    const recent = list.filter(p => p !== lastItem).slice(0, 5);
    let h = `<h2>Willkommen in der Arduino-Werkstatt</h2>
      <div class="start-new">
        <div class="start-sec">Neues Projekt</div>
        ${this.nameFields()}
        <div class="start-go"><button class="btn primary" value="new">Neues Projekt anlegen</button></div>
      </div>`;
    if (lastItem) h += `<div class="start-sec">Zuletzt bearbeitet</div><button class="start-item main" type="button" data-file="${esc(lastItem.file)}"><span>${name(lastItem.file)}</span><span class="d">${fmt(lastItem.modified)}</span></button>`;
    if (recent.length) h += `<div class="start-sec">Weitere Projekte</div>` + recent.map(p => `<button class="start-item" type="button" data-file="${esc(p.file)}"><span>${name(p.file)}</span><span class="d">${fmt(p.modified)}</span></button>`).join('');
    h += `<div class="start-links"><button class="btn ghost small" type="button" data-act="open">${this.launcher ? 'Anderes Projekt öffnen …' : 'Projektdatei öffnen …'}</button><button class="btn ghost small" type="button" data-act="tasks">Aufgabe wählen …</button><button class="btn ghost small" type="button" data-act="examples">Beispiel öffnen …</button>`;
    if (rescue) h += `<button class="btn ghost small" type="button" data-act="rescue" title="Sicherheitskopie aus diesem Browser">Entwurf wiederherstellen: ${esc(rescue.name || 'ohne Namen')}</button>`;
    h += `</div>`;
    const d = $('#dlg');
    d.classList.add('start');
    this.dialog(h, (rv, f) => {
      d.classList.remove('start');
      d.oncancel = null;
      if (rv === 'new' && f.n.value) { this.loadProject(this.blankProject(f.n.value)); this.fileName = null; this.save(); }
    });
    const f = $('#dlgForm');
    this.fileName = null;
    this.guardNameFields(f);
    d.oncancel = e => e.preventDefault(); // Startauswahl nicht mit Esc überspringen
    f.addEventListener('click', async e => {
      const it = e.target.closest('[data-file]');
      const act = e.target.closest('[data-act]');
      if (it || act) d.classList.remove('start'); // der nächste Dialog hat seine eigene Breite
      if (it) {
        d.close('cancel');
        try { const data = await (await this.api('load?file=' + encodeURIComponent(it.dataset.file))).json(); this.loadProject(data); this.fileName = it.dataset.file; }
        catch (err) { this.toast('Öffnen fehlgeschlagen: ' + err.message); }
      } else if (act && act.dataset.act === 'open') { d.close('cancel'); this.backToStart(list, last, rescue); this.fileAction('open'); }
      else if (act && act.dataset.act === 'examples') { d.close('cancel'); this.backToStart(list, last, rescue); this.examplesDialog(); }
      else if (act && act.dataset.act === 'tasks') { d.close('cancel'); this.backToStart(list, last, rescue); TaskUi.dialog(); }
      else if (act && act.dataset.act === 'rescue') { d.close('cancel'); this.loadProject(rescue); this.save(); this.toast('Entwurf wiederhergestellt und gespeichert.'); }
    });
  },

  /* Wird ein Beispiel, eine Aufgabe oder ein Projekt aus dem Startfenster heraus doch nicht geöffnet
     (Abbrechen), geht es zurück ins Startfenster statt in eine Werkstatt ohne Projektnamen. */
  backToStart(list, last, rescue) {
    const d = $('#dlg'), before = this.loadCount || 0;
    const check = () => setTimeout(() => {
      if ((this.loadCount || 0) !== before || this.opening) return; // es wurde (oder wird gerade) etwas geöffnet
      if (d.open) { d.addEventListener('close', check, { once: true }); return; } // nächster Dialog (z. B. Name)
      this.startScreen(list, last, rescue);
    }, 60);
    setTimeout(() => { if (d.open) d.addEventListener('close', check, { once: true }); else check(); }, 0);
  },

  blankProject(name) {
    return { format: FORMAT, version: 1, name: name || 'Neues Projekt', board: 'uno', circuit: { components: [], wires: [] }, blocks: DEFAULT_BLOCKS_XML };
  },

  loadProject(data) {
    this.loadCount = (this.loadCount || 0) + 1;
    if (this.sim.running) this.stopSim();
    this.loading = true;
    $('#projName').value = data.name || 'Neues Projekt';
    this.setBoard(data.board === 'esp32' ? (CHIP_KEY[data.chip] || 'esp32') : 'uno', true);
    // Bluetooth-Übertragung: Standardname aus Tisch-Nr. und Vorname im Projektnamen, z. B. „ESP-11-Lena“
    const np = this.nameParts(data.name), tr = s => String(s || '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue');
    BT_OPT = Object.assign({ on: false, name: btName(np.tisch ? `ESP-${np.tisch}-${tr(np.vor)}` : 'ESP-Werkstatt') }, data.bt || {});
    this.setExtensions(data.extensions || [], true);
    this.task = data.task || null;
    if (TaskUi.panel) TaskUi.render();
    this.circuit.select(null);
    this.circuit.load(data.circuit || {});
    this.ensureExtensions(true);
    Blockly.Events.disable();
    try {
      this.workspace.clear();
      Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(data.blocks || DEFAULT_BLOCKS_XML), this.workspace);
      this.workspace.getAllBlocks(false).forEach(b => { if (!b.getParent() && (b.previousConnection || b.outputConnection)) b.setEnabled(false); });
    } catch (e) { console.error(e); this.toast('Die Blöcke konnten nicht geladen werden.'); }
    Blockly.Events.enable();
    this.workspace.clearUndo();
    this.autoExtensions();
    this.markBoardBlocks();
    SerialLink.setUi();
    this.needCenter = true;
    this.undoStack = []; this.redoStack = [];
    this.loading = false;
    this.updateEmpty();
    this.updateCodeText();
    this.resizeBlockly();
    requestAnimationFrame(() => this.circuit.fitView());
    this.setSaveState(this.launcher ? 'Gespeichert' : 'Gespeichert im Browser');
  },

  projectData() {
    return {
      format: FORMAT, version: 1, name: $('#projName').value.trim() || 'Neues Projekt', board: BOARD, chip: BOARD === 'esp32' ? ESP_CHIP : undefined,
      extensions: this.extensions.slice(), bt: Object.assign({}, BT_OPT), circuit: this.circuit.toJSON(), blocks: Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(this.workspace)), saved: new Date().toISOString(),
      ...this.taskData(),
    };
  },
  /* Aufgabe im Projekt (ein Testlauf des Aufgaben-Editors wird nicht gespeichert) */
  taskData() {
    const t = this.task && this.task.preview ? TaskUi.savedTask : this.task;
    if (!t) return {};
    const c = Object.assign({}, t); delete c.results; delete c.preview;
    return { task: c };
  },
  snapshotData() { return this.circuit.toJSON(); },

  fileFor(name) {
    return (name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Projekt') + '.awp';
  },

  /* ---------- Speichern ---------- */
  changed() { this.ensureExtensions(); this.updateEmpty(); this.scheduleSave(); this.updateCodeText(); },
  changedSilently() { this.scheduleSave(); if (this.sim.running) this.sim.update(); },
  scheduleSave() {
    if (this.loading || this.viewer) return;
    this.setSaveState('Wird gespeichert …');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 800);
  },
  async save() {
    const data = this.projectData();
    const json = JSON.stringify(data);
    try { localStorage.setItem('werkstatt.current', json); } catch (e) { /* voll */ }
    if (this.launcher) {
      const file = this.fileFor(data.name);
      try {
        await this.api('save?file=' + encodeURIComponent(file), { method: 'POST', body: json });
        this.fileName = file;
        if (this.projectFiles) this.projectFiles.add(file);
        this.setSaveState('Gespeichert');
      } catch (e) {
        this.setSaveState('Speichern fehlgeschlagen!');
        this.toast('Speichern auf dem Stick fehlgeschlagen: ' + e.message);
      }
    } else this.setSaveState('Gespeichert im Browser');
  },
  async renameFile(newName) {
    // Beim Umbenennen die Datei mit umbenennen, damit keine Doppel entstehen
    const from = this.fileName, to = this.fileFor(newName);
    if (!this.launcher || !from || from === to) return true;
    try { await this.api(`rename?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { method: 'POST' }); }
    catch (e) { return false; }
    this.projectFiles.delete(from); this.projectFiles.add(to); this.fileName = to;
    return true;
  },
  setSaveState(t) { $('#saveState').textContent = t; },

  /* ---------- Rückgängig ---------- */
  pushUndo() { this.pushUndoRaw(JSON.stringify(this.snapshotData())); },
  pushUndoRaw(snap) { this.undoStack.push(snap); if (this.undoStack.length > 80) this.undoStack.shift(); this.redoStack = []; },
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.snapshotData()));
    this.circuit.load(JSON.parse(this.undoStack.pop()));
    this.onSelect(null);
    this.changed();
  },
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.snapshotData()));
    this.circuit.load(JSON.parse(this.redoStack.pop()));
    this.onSelect(null);
    this.changed();
  },

  /* ---------- Blöcke ---------- */
  onBlocksChanged(e) {
    if (this.loading || e.isUiEvent || e.type === Blockly.Events.UI) return;
    const justMoved = e.type === Blockly.Events.BLOCK_MOVE && e.oldParentId === e.newParentId && e.oldInputName === e.newInputName;
    const isComment = e.type === Blockly.Events.COMMENT_CREATE || e.type === Blockly.Events.COMMENT_CHANGE || e.type === Blockly.Events.COMMENT_MOVE;
    if (this.sim.running && !justMoved && !isComment) {
      this.stopSim();
      this.toast('Simulation gestoppt, weil der Code geändert wurde.');
    }
    this.scheduleSave();
    this.updateCodeText();
  },
  updateCodeText() {
    if (this.codeView === 'blocks') return;
    let code = '';
    try { code = generateArduinoCode(this.workspace); } catch (e) { code = '// Fehler beim Erzeugen: ' + e.message; }
    $('#textcode').innerHTML = highlightCpp(code);
  },

  /* ---------- Simulation ---------- */
  toggleSim() { if (this.sim.running) this.stopSim(); else this.startSim(); },
  startSim() {
    const mcus = this.project.components.filter(c => c.def.mcu);
    if (!mcus.length) { this.toast('Ziehe zuerst einen Mikrocontroller (Arduino Uno oder ESP32) auf die Werkbank.'); return; }
    if (mcus.length > 1) { this.toast('Es kann nur ein Mikrocontroller simuliert werden. Entferne den anderen.'); return; }
    if (mcuKey(mcus[0].def.mcu) !== boardKey()) { this.toast(`Die Auswahl oben passt nicht zum Mikrocontroller in der Schaltung.`); return; }
    if (this.circuit.wiring) this.circuit.cancelWire();
    let code;
    try { code = generateSimCode(this.workspace); } catch (e) { this.toast('Fehler im Programm: ' + e.message); return; }
    document.body.classList.add('simulating');
    const b = $('#simBtn'); b.classList.add('stop'); b.querySelector('.ico').textContent = '■'; b.querySelector('.lbl').textContent = 'Simulation stoppen';
    this.sim.start(code);
    if (!this.sim.messages.size) this.showMessages(this.sim.messages);
    if (this.circuit.sel) this.onSelect(this.circuit.sel);
  },
  stopSim() {
    this.sim.stop();
    CommPanel.render(this.sim);
    document.body.classList.remove('simulating');
    const b = $('#simBtn'); b.classList.remove('stop'); b.querySelector('.ico').textContent = '▶'; b.querySelector('.lbl').textContent = 'Simulation starten';
    this.circuit.clearStates();
    if (this.circuit.sel) this.onSelect(this.circuit.sel);
  },
  onSimCrashed() { this.stopSim(); },

  showMessages(map) {
    const list = [...map.values()];
    const order = { error: 0, warn: 1, info: 2 };
    list.sort((a, b) => order[a.level] - order[b.level]);
    const ul = $('#msgs');
    if (!list.length) ul.innerHTML = `<li class="ok">${this.sim.running ? 'Keine Probleme gefunden.' : 'Starte die Simulation, um deine Schaltung und dein Programm zu prüfen.'}</li>`;
    else ul.innerHTML = list.map(m => `<li class="${m.level}">${esc(m.text)}</li>`).join('');
    const badge = $('#msgBadge');
    const worst = list.length ? list[0].level : null;
    badge.hidden = !list.length;
    badge.textContent = list.length;
    badge.className = 'badge' + (worst === 'warn' ? ' warn' : worst === 'info' ? ' info' : '');
    if (worst === 'error' || worst === 'warn') { this.showBottom('msgs'); }
  },
  serialClear() { $('#serial').textContent = ''; this.serialLen = 0; this.serialLog = []; this.serialPart = ''; },
  serialWrite(t) {
    // Vollständige Zeilen mit Uhrzeit merken (für „Messwerte speichern“, auch wenn die Anzeige gekürzt wird)
    if (!this.serialLog) this.serialLog = [];
    const parts = ((this.serialPart || '') + t).split('\n');
    this.serialPart = parts.pop();
    const now = Date.now();
    for (const line of parts) if (line.trim() && !/^\[.*\]$/.test(line.trim())) this.serialLog.push([now, line]);
    if (this.serialLog.length > 200000) this.serialLog.splice(0, 50000);
    const el = $('#serial');
    el.textContent += t;
    if (el.textContent.length > 20000) el.textContent = el.textContent.slice(-15000);
    if (!$('#serialWrap').hidden) el.scrollTop = el.scrollHeight;
    if (!this.serialShown) { this.serialShown = true; this.showBottom('serial'); }
  },
  /* Messwerte aus dem seriellen Monitor als Tabelle (CSV, für Excel mit Semikolon und Dezimalkomma) */
  serialCsv() {
    // Jede Zeile in Zahlen und Beschriftungen zerlegen: „Spannung: 0.52 V  Strom: 3 mA“ → Spannung (V), Strom (mA)
    const parse = line => {
      const re = /-?\d+(?:\.\d+)?|\bnan\b/gi, cells = [];
      let m, last = 0;
      while ((m = re.exec(line))) {
        let label = line.slice(last, m.index).replace(/[:=|;,]+\s*$/, '').replace(/^[\s|;,]+/, '').trim();
        // Einheit des vorigen Werts steht vorne in der Beschriftung („V Strom“)
        const sp = /^(\S{1,3})\s+(.+)$/.exec(label);
        if (cells.length && sp && !/\d/.test(sp[1])) { cells[cells.length - 1].unit = sp[1]; label = sp[2]; }
        cells.push({ label, value: m[0].toLowerCase() === 'nan' ? '' : m[0].replace('.', ','), unit: '' });
        last = m.index + m[0].length;
      }
      const tail = line.slice(last).trim();
      if (cells.length && /^\S{1,3}$/.test(tail)) cells[cells.length - 1].unit = tail;
      return cells;
    };
    // Startmeldungen des ESP32 (beim Verbinden oder nach einem Neustart) sind keine Messwerte:
    // „rst:0x1 (POWERON_RESET)…“, „load:0x40078000,len:16532“, „entry 0x400805b4“, Fehlerausgaben usw.
    const boot = /^\s*(ets \w|rst:0x|configsip:|clk_drv:|mode:\w+,\s*clock div|load:0x|entry 0x|ho \d+ tail|[EWID] \(\d+\)|Brownout|Guru Meditation|Rebooting|Backtrace:|ELF file SHA256|Core\s+\d+ register dump|E\s*\(\d+\))/i;
    const isBoot = line => boot.test(line) || /\b0x[0-9a-f]{2,}/i.test(line);
    let rows = (this.serialLog || []).filter(([, line]) => !isBoot(line)).map(([t, line]) => ({ t, cells: parse(line), sig: line.replace(/-?\d+(?:\.\d+)?|\bnan\b/gi, '#').trim() })).filter(r => r.cells.length);
    if (!rows.length && (this.serialLog || []).some(([, line]) => isBoot(line))) {
      this.toast('Im seriellen Monitor stehen nur die Startmeldungen des ESP32, noch keine Messwerte. Läuft das Programm schon und gibt es Werte mit „auf seriellem Monitor drucken“ aus?'); return;
    }
    if (!rows.length) { this.toast('Im seriellen Monitor stehen noch keine Zahlen. Gib Messwerte mit „auf seriellem Monitor drucken“ aus.'); return; }
    // Einmalige Zeilen (z. B. Überschrift „Messung 1 startet“) weglassen, wenn es sonst genug Messzeilen gibt
    const count = {};
    rows.forEach(r => { count[r.sig] = (count[r.sig] || 0) + 1; });
    if (rows.length >= 5) rows = rows.filter(r => count[r.sig] > 1);
    // Spalten nach Beschriftung zusammenführen
    const cols = [], idx = new Map();
    const rowVals = rows.map(r => {
      const vals = {}, seen = {};
      r.cells.forEach((c, i) => {
        let key = c.label ? 'L:' + c.label : 'S:' + r.sig + ':' + i;
        seen[key] = (seen[key] || 0) + 1;
        if (seen[key] > 1) key += '#' + seen[key];
        if (!idx.has(key)) { idx.set(key, cols.length); cols.push({ name: c.label || `Wert ${i + 1}`, unit: c.unit }); }
        vals[idx.get(key)] = c.value;
      });
      return vals;
    });
    const q = v => /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const pad = n => String(n).padStart(2, '0');
    const t0 = rows[0].t;
    const lines = [['Datum', 'Uhrzeit', 'Zeit in s', ...cols.map(c => c.unit ? `${c.name} in ${c.unit}` : c.name)].map(q).join(';')];
    rows.forEach((r, k) => {
      const d = new Date(r.t);
      lines.push([`${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`, `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        ((r.t - t0) / 1000).toFixed(1).replace('.', ','), ...cols.map((_, i) => rowVals[k][i] || '')].join(';'));
    });
    const name = ($('#projName').value.trim() || 'Messwerte') + ' – Messwerte.csv';
    Export.download(new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), name);
    this.toast(`${rows.length} Messzeilen gespeichert („${name}“ im Ordner „Downloads“). Öffnen mit Excel oder LibreOffice.`);
  },
  showBottom(tab) {
    $('#bottom').classList.remove('collapsed');
    $('#tabMsgs').classList.toggle('on', tab === 'msgs');
    $('#tabSerial').classList.toggle('on', tab === 'serial');
    $('#tabComm').classList.toggle('on', tab === 'comm');
    $('#msgs').hidden = tab !== 'msgs';
    $('#serialWrap').hidden = tab !== 'serial';
    $('#comm').hidden = tab !== 'comm';
    $('#bottom').classList.toggle('tall', tab === 'comm');
    this.resizeBlockly();
  },

  /* ---------- Bauteilleiste ---------- */
  buildPartList() {
    const cats = { Vorlagen: ['template', 'template-lcd'] };
    for (const c of CATEGORY_ORDER) cats[c] = [];
    for (const t in COMPONENTS) if (!COMPONENTS[t].hidden) cats[COMPONENTS[t].category].push(t); // hidden: nur noch für ältere Projekte
    const WIDE = new Set();
    const stack = (types, h) => `<div class="template-ico" style="flex-direction:column">${types.map(t => componentIcon(t, `height:${h}px;width:auto`)).join('')}</div>`;
    let h = '';
    for (const cat in cats) {
      h += `<div class="part-cat" data-cat="${cat}">${cat}</div><div class="part-grid">`;
      for (const t of cats[cat]) {
        const mc = is8266() ? 'nodemcu' : isC5() ? 'esp32c5' : BOARD === 'esp32' ? 'esp32exp' : 'uno', mn = is8266() ? 'NodeMCU' : isC5() ? 'ESP32-C5' : BOARD === 'esp32' ? 'ESP32' : 'Arduino';
        if (t === 'template') h += `<div class="part" draggable="true" data-type="template" data-name="${mn.toLowerCase()} steckplatine vorlage">${stack(['breadboard', mc], 24)}<span>${mn} + Steckplatine</span></div>`;
        else if (t === 'template-lcd') h += `<div class="part" draggable="true" data-type="template-lcd" data-name="${mn.toLowerCase()} steckplatine lcd display vorlage">${stack(['lcd', 'breadboard', mc], 16)}<span>${mn} + Steckplatine + LCD</span></div>`;
        else h += `<div class="part${WIDE.has(t) ? ' wide' : ''}" draggable="true" data-type="${t}" data-ext="${COMPONENTS[t].ext || ''}" data-mcu="${COMPONENTS[t].mcu ? mcuKey(COMPONENTS[t].mcu) : ''}" data-name="${COMPONENTS[t].name.toLowerCase()}">${componentIcon(t)}<span>${esc(NBSP_NAMES(COMPONENTS[t].label || COMPONENTS[t].name))}</span></div>`;
      }
      h += '</div>';
    }
    $('#partList').innerHTML = h;
    if (this.partsBuilt) { this.filterParts(); return; }
    this.partsBuilt = true;
    $('#partList').addEventListener('dragstart', e => {
      const p = e.target.closest('.part'); if (!p) return;
      e.dataTransfer.setData('text/plain', p.dataset.type); e.dataTransfer.effectAllowed = 'copy';
    });
    $('#partList').addEventListener('dblclick', e => {
      const p = e.target.closest('.part'); if (!p) return;
      if (this.sim.running) { this.toast('Stoppe zuerst die Simulation.'); return; }
      const r = $('#circuit').getBoundingClientRect();
      const [x, y] = this.circuit.pt({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      if (/^template/.test(p.dataset.type)) this.circuit.addTemplate(x, y, p.dataset.type === 'template-lcd'); else this.circuit.addComponent(p.dataset.type, x, y);
    });
    $('#partSearch').addEventListener('input', () => this.filterParts());
  },

  filterParts() {
    const q = $('#partSearch').value.trim().toLowerCase();
    document.querySelectorAll('.part').forEach(p => {
      const ext = p.dataset.ext;
      const mcu = p.dataset.mcu;
      const ok = (!ext || this.extensions.includes(ext)) && (!mcu || mcu === boardKey()) && (!q || p.dataset.name.includes(q));
      p.style.display = ok ? '' : 'none';
    });
    document.querySelectorAll('.part-grid').forEach(g => {
      const any = [...g.children].some(c => c.style.display !== 'none');
      g.style.display = any ? '' : 'none'; g.previousElementSibling.style.display = any ? '' : 'none';
    });
  },

  updateEmpty() {
    const e = $('#emptyHint');
    e.hidden = this.project.components.length > 0;
    if (!e.hidden) e.querySelector('p').innerHTML = is8266()
      ? 'Ziehe den <b>ESP8266 NodeMCU</b> aus der Bauteilleiste rechts hierher. Mit der Vorlage <b>NodeMCU + Steckplatine</b> ist beides schon verbunden.'
      : isC5()
      ? 'Ziehe den <b>ESP32-C5</b> aus der Bauteilleiste rechts hierher. Mit der Vorlage <b>ESP32-C5 + Steckplatine</b> ist beides schon verbunden.'
      : BOARD === 'esp32'
      ? 'Ziehe den <b>ESP32</b> aus der Bauteilleiste rechts hierher. Mit der Vorlage <b>ESP32 + Steckplatine</b> ist beides schon verbunden.'
      : 'Ziehe den <b>Arduino Uno</b> aus der Bauteilleiste rechts hierher. Mit der Vorlage <b>Arduino + Steckplatine</b> ist beides schon verbunden.';
  },

  /* ---------- Eigenschaften ---------- */
  onSelect(sel) {
    const box = $('#props');
    if (!sel) { box.hidden = true; return; }
    const sim = this.sim.running;
    let h = '';
    if (sel.kind === 'wire') {
      const w = this.project.wires.find(x => x.id === sel.id);
      if (!w) { box.hidden = true; return; }
      h += `<h3>Leitung</h3><label>Farbe</label><div class="swatches">`;
      // Rot und Schwarz nur für Plus und GND
      const auto = this.defaultWireColor(w.a, w.b);
      for (const k in WIRE_COLORS) {
        const reserved = (k === 'rot' || k === 'schwarz') && k !== auto;
        h += `<button class="swatch${w.color === k ? ' on' : ''}${reserved ? ' reserved' : ''}" data-color="${k}" title="${WIRE_COLOR_NAMES[k]}${reserved ? (k === 'rot' ? ' – nur für Plus (5V/3,3V)' : ' – nur für GND') : ''}" style="background:${WIRE_COLORS[k]}" ${sim || reserved ? 'disabled' : ''}></button>`;
      }
      h += `</div><div class="note">Schwarz ist für GND, Rot für Plus reserviert, alle anderen Leitungen in anderen Farben. <br>Knickpunkte: an einer Stelle des Kabels ziehen = neuer Knickpunkt, Punkt ziehen = verschieben, Doppelklick auf einen Punkt = entfernen.</div>`;
      if (!sim) h += `<div class="btns"><button class="btn danger small" data-act="delete">Löschen (Entf)</button></div>`;
    } else {
      const c = this.circuit.comp(sel.id);
      if (!c) { box.hidden = true; return; }
      h += `<h3>${esc(c.def.name)}</h3>`;
      const dis = sim ? 'disabled' : '';
      const slider = (prop, label, min, max, unit, step) => `<label>${label}: <b data-out data-unit="${unit}">${String(c.props[prop]).replace('.', ',')} ${unit}</b></label><input type="range" min="${min}" max="${max}" step="${step || 1}" data-live="${prop}" value="${c.props[prop]}">`;
      const pressNote = '<div class="note">In der Simulation mit der Maus gedrückt halten.</div>';
      switch (c.type) {
        case 'led':
          h += `<label>Farbe</label><select data-prop="color" ${dis}>${Object.keys(LED_COLORS).map(k => `<option value="${k}" ${c.props.color === k ? 'selected' : ''}>${LED_COLOR_NAMES[k]}</option>`).join('')}</select>`;
          break;
        case 'resistor': {
          const o = c.props.ohm; const unit = o >= 1e6 ? 1e6 : o >= 1e3 ? 1e3 : 1;
          h += `<label>Widerstand</label><div class="row"><input type="number" min="0" step="any" data-ohm value="${+(o / unit).toFixed(3)}" ${dis}><select data-unit ${dis}><option value="1" ${unit === 1 ? 'selected' : ''}>Ω</option><option value="1000" ${unit === 1e3 ? 'selected' : ''}>kΩ</option><option value="1000000" ${unit === 1e6 ? 'selected' : ''}>MΩ</option></select></div>`;
          break;
        }
        case 'ldr': h += slider('light', 'Helligkeit', 0, 100, '%'); break;
        case 'ntc': case 'tmp36': h += slider('temp', 'Temperatur', -10, 60, '°C'); break;
        case 'moisture': case 'soil': h += slider('wet', 'Feuchtigkeit', 0, 100, '%'); break;
        case 'ultrasonic': h += slider('dist', 'Abstand', 2, 300, 'cm'); break;
        case 'dht':
          h += `<label>Bauart</label><select data-prop="model" ${dis}><option value="11" ${String(c.props.model) !== '22' ? 'selected' : ''}>DHT11 (blau, 0–50 °C, ganze Zahlen)</option><option value="22" ${String(c.props.model) === '22' ? 'selected' : ''}>DHT22 (weiß, −40–80 °C, genauer)</option></select>`;
          h += slider('temp', 'Temperatur', -10, 50, '°C', 0.5) + slider('hum', 'Luftfeuchtigkeit', 0, 100, '%');
          break;
        case 'relay':
          h += `<label>Schaltet bei</label><select data-prop="trig" ${dis}><option value="H" ${String(c.props.trig) !== 'L' ? 'selected' : ''}>HOCH an IN (High-Level-Trigger)</option><option value="L" ${String(c.props.trig) === 'L' ? 'selected' : ''}>NIEDRIG an IN (Low-Level-Trigger)</option></select>`;
          h += '<div class="note">Zum Umstecken auf den Jumper L/H auf der Platine klicken. Anschlüsse rechts: IN (Steuereingang), DC− an GND, DC+ an 5V – mit Kabeln, das Modul hat Schraubklemmen.</div><div class="note">Das Relais ist ein Schalter, den der Mikrocontroller betätigt: COM ist mit NO verbunden, solange es angezogen ist, sonst mit NC. Damit kann man einen eigenen Stromkreis schalten (z. B. Pumpe oder Lampe mit eigener Spannungsquelle).</div>';
          break;
        case 'stepper':
          h += '<div class="note">Treiber ULN2003: IN1 bis IN4 an vier digitale Anschlüsse, – an GND und + an 5V. Die LEDs A bis D zeigen, welche Spule gerade Strom bekommt.</div>';
          break;
        case 'poti':
          h += slider('position', 'Drehung', 0, 100, '%');
          h += `<label>Gesamtwiderstand</label><select data-prop="ohm" ${dis}>${[1000, 10000, 100000].map(v => `<option value="${v}" ${c.props.ohm === v ? 'selected' : ''}>${formatOhm(v)}</option>`).join('')}</select>`;
          break;
        case 'source':
          h += slider('volt', 'Spannung', 0, 12, 'V', 0.05);
          h += `<label>Innenwiderstand</label><select data-prop="ri" ${dis}>${[1, 100, 1000, 10000].map(v => `<option value="${v}" ${Number(c.props.ri) === v ? 'selected' : ''}>${formatOhm(v)}</option>`).join('')}</select>`;
          break;
        case 'ina219':
          h += `<label>Adresse</label><select data-prop="address" ${dis}>${[64, 65, 68, 69].map(v => `<option value="${v}" ${Number(c.props.address) === v ? 'selected' : ''}>0x${v.toString(16)}</option>`).join('')}</select>`;
          break;
        case 'l298n':
          h += `<label>Jumper auf ENA (Motor A)</label><select data-prop="ena" ${dis}><option value="1" ${String(c.props.ena) !== '0' ? 'selected' : ''}>gesteckt (immer freigegeben)</option><option value="0" ${String(c.props.ena) === '0' ? 'selected' : ''}>entfernt (ENA anschließen)</option></select>`;
          h += `<label>Jumper auf ENB (Motor B)</label><select data-prop="enb" ${dis}><option value="1" ${String(c.props.enb) !== '0' ? 'selected' : ''}>gesteckt (immer freigegeben)</option><option value="0" ${String(c.props.enb) === '0' ? 'selected' : ''}>entfernt (ENB anschließen)</option></select>`;
          h += '<div class="note">Motorspannung an „12V“ und GND anschließen (z. B. Spannungsquelle oder 5 V). Der L298N verliert etwa 2 V. GND muss mit dem GND des Mikrocontrollers verbunden sein.</div>';
          break;
        case 'esp32exp':
          h += `<label>Jumper „JUMP“ (Spannung an den V-Pins)</label><select data-prop="jump" ${dis}><option value="3.3" ${String(c.props.jump) !== '5' ? 'selected' : ''}>3,3 V</option><option value="5" ${String(c.props.jump) === '5' ? 'selected' : ''}>5 V</option></select>`;
          h += '<div class="note">Die USB-Buchsen am Board liefern nur Strom. Zum Hochladen das Kabel in die Buchse am ESP32 stecken.</div>';
          h += '<div class="note">Zeige mit der Maus auf einen Anschluss, um seine Bezeichnung zu sehen.</div>';
          break;
        case 'nodemcu':
          h += '<div class="note">Der ESP8266 hat WLAN, aber <b>kein Bluetooth</b>. Nur ein analoger Eingang (A0, 0 – 3,3 V), Messwerte 0 – 1023.</div>';
          h += '<div class="note">Die eingebaute blaue LED hängt an D4 und leuchtet, wenn D4 NIEDRIG ist – der Block „integrierte LED“ berücksichtigt das.</div>';
          h += '<div class="note">Zeige mit der Maus auf einen Anschluss, um seine Bezeichnung zu sehen.</div>';
          break;
        case 'esp32c5':
          h += '<div class="note">Zum Hochladen das Kabel in die Buchse <b>„UART“</b> (USB-Seriell-Wandler) stecken – dort erscheinen auch die Ausgaben im seriellen Monitor.</div>';
          h += '<div class="note">Die eingebaute LED ist eine RGB-LED an D27; der Block „eingebaute LED“ lässt sie weiß leuchten.</div>';
          h += '<div class="note">Zeige mit der Maus auf einen Anschluss, um seine Bezeichnung zu sehen.</div>';
          break;
        case 'esp32':
          h += '<div class="note">Zeige mit der Maus auf einen Anschluss, um seine Bezeichnung zu sehen.</div>';
          break;
        case 'ads1115':
          h += '<div class="note">Adresse über ADDR: an GND (oder offen) 0x48, an VDD 0x49, an SDA 0x4A, an SCL 0x4B.</div>';
          break;
        case 'button': case 'button2': case 'pushbutton': case 'touch': case 'pir': h += pressNote; break;
        case 'keypad3': case 'keypad4': h += '<div class="note">In der Simulation die Tasten mit der Maus drücken.</div>'; break;
      }
      if (!sim) h += `<div class="btns">${!c.def.fixed ? '<button class="btn small" data-act="rotate">Drehen (R)</button><button class="btn small" data-act="dup">Verdoppeln (Strg+D)</button>' : ''}<button class="btn danger small" data-act="delete">Löschen (Entf)</button></div>`;
    }
    box.innerHTML = h;
    box.hidden = false;
  },

  bindProps() {
    const box = $('#props');
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const sel = this.circuit.sel; if (!sel) return;
      if (b.dataset.color) { this.circuit.setWireColor(sel.id, b.dataset.color); this.onSelect(sel); }
      if (b.dataset.act === 'delete') this.circuit.deleteSelection();
      if (b.dataset.act === 'rotate') this.circuit.rotateSelection();
      if (b.dataset.act === 'dup') this.circuit.duplicateSelection();
    });
    box.addEventListener('change', e => {
      const sel = this.circuit.sel; if (!sel) return;
      const t = e.target;
      if (t.dataset.prop) {
        const v = isNaN(Number(t.value)) ? t.value : Number(t.value);
        this.circuit.setProp(sel.id, t.dataset.prop, v);
      }
      if (t.hasAttribute('data-ohm') || t.hasAttribute('data-unit')) {
        const val = Number(box.querySelector('[data-ohm]').value) * Number(box.querySelector('[data-unit]').value);
        if (val > 0) { this.circuit.setProp(sel.id, 'ohm', Math.round(val * 1000) / 1000); this.onSelect(sel); }
      }
    });
    box.addEventListener('input', e => {
      const sel = this.circuit.sel; if (!sel) return;
      const t = e.target;
      if (t.dataset.live) {
        this.circuit.setProp(sel.id, t.dataset.live, Number(t.value), true);
        const out = t.previousElementSibling && t.previousElementSibling.querySelector('[data-out]'); if (out) out.textContent = String(t.value).replace('.', ',') + ' ' + out.dataset.unit;
      }
    });
  },

  defaultWireColor(a, b) {
    const nl = buildNetlist(this.project);
    const uno = this.project.components.find(c => c.def.mcu);
    const isRail = (r, k) => { const c = this.circuit.comp(r.c); return c && c.def.isBreadboard && new RegExp('^(t|b)' + k + '-').test(r.p); };
    if (uno) {
      const M = uno.def.mcu;
      const g = nl.net(uno.id, M.gnd), v = nl.net(uno.id, M.v5), v3 = nl.net(uno.id, M.v33);
      const na = nl.net(a.c, a.p), nb = nl.net(b.c, b.p);
      if (na === g || nb === g) return 'schwarz';
      if (na === v || nb === v || na === v3 || nb === v3) return 'rot';
      // I²C: SCL gelb, SDA grün
      if (na === nl.net(uno.id, M.scl) || nb === nl.net(uno.id, M.scl)) return 'gelb';
      if (na === nl.net(uno.id, M.sda) || nb === nl.net(uno.id, M.sda)) return 'gruen';
    }
    if (a.p === 'SCL' || b.p === 'SCL') return 'gelb';
    if (a.p === 'SDA' || b.p === 'SDA') return 'gruen';
    if (isRail(a, 'm') || isRail(b, 'm')) return 'schwarz';
    if (isRail(a, 'p') || isRail(b, 'p')) return 'rot';
    return 'blau'; // Grün und Gelb bleiben SDA/SCL vorbehalten
  },

  /* ---------- Oberfläche ---------- */
  setMode(m) {
    $('#main').className = 'main mode-' + m;
    $('#modeParts').classList.toggle('on', m === 'parts');
    $('#modeCode').classList.toggle('on', m === 'code');
    $('#main').classList.toggle('view-both', this.codeView === 'both');
    this.needCenter = true;
    this.applyCodeWidth();
    this.resizeBlockly();
    requestAnimationFrame(() => this.circuit.fitView());
  },
  /* Codefenster in der Code-Ansicht breiter ziehen (über die Bauteilseite), je Ansicht gemerkt */
  codeWidths() { try { return JSON.parse(localStorage.getItem('werkstatt.codeBreite') || '{}'); } catch (e) { return {}; } },
  applyCodeWidth() {
    const main = $('#main'), w = this.codeWidths()[this.codeView || 'blocks'];
    main.style.gridTemplateColumns = main.classList.contains('mode-code') && w ? `minmax(160px, 1fr) ${Math.round(w)}px` : '';
  },
  bumpLoop(group) {
    const ws = this.workspace;
    if (!ws || (ws.isDragging && ws.isDragging())) return;
    const top = ws.getTopBlocks(false), setup = top.find(b => b.type === 'ard_setup'), loop = top.find(b => b.type === 'ard_loop');
    if (!setup || !loop) return;
    const s = setup.getBoundingRectangle(), l = loop.getBoundingRectangle(), gap = 24;
    const sideBySide = l.left > s.right || l.right < s.left;
    if (sideBySide || l.top < s.top || l.top >= s.bottom + gap) return;
    const old = Blockly.Events.getGroup();
    Blockly.Events.setGroup(group || true); // zusammen mit dem Auslöser rückgängig machen
    loop.moveBy(0, s.bottom + gap - l.top);
    Blockly.Events.setGroup(old);
  },
  /* Schwebende Fenster (Eigenschaften, Aufgabe) an der Titelzeile zur Seite schieben; Doppelklick: zurück */
  makeMovable(box, handleSel) {
    if (!box) return;
    box.addEventListener('pointerdown', e => {
      const h = e.target.closest(handleSel);
      if (!h || !box.contains(h) || e.target.closest('button, input, select, textarea, a') || e.button !== 0) return;
      if (handleSel === 'h3' && h !== box.querySelector('h3')) return; // nur die oberste Überschrift
      e.preventDefault();
      const stage = box.offsetParent.getBoundingClientRect(), r = box.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      h.setPointerCapture(e.pointerId);
      const move = ev => {
        const x = Math.max(0, Math.min(stage.width - 60, ev.clientX - stage.left - dx));
        const y = Math.max(0, Math.min(stage.height - 30, ev.clientY - stage.top - dy));
        Object.assign(box.style, { left: x + 'px', top: y + 'px', right: 'auto' });
      };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
    });
    box.addEventListener('dblclick', e => {
      const h = e.target.closest(handleSel);
      if (h && !e.target.closest('button, input, select, textarea, a')) Object.assign(box.style, { left: '', top: '', right: '' });
    });
  },
  initCodeSplit() {
    const sp = $('#codeSplit'), main = $('#main');
    if (!sp) return;
    const save = w => { const all = this.codeWidths(); if (w) all[this.codeView || 'blocks'] = w; else delete all[this.codeView || 'blocks']; try { localStorage.setItem('werkstatt.codeBreite', JSON.stringify(all)); } catch (e) { /* ohne Speicher */ } };
    sp.addEventListener('pointerdown', e => {
      e.preventDefault(); sp.setPointerCapture(e.pointerId); sp.classList.add('drag');
      const r = main.getBoundingClientRect();
      const move = ev => {
        const w = Math.max(360, Math.min(r.width - 160, r.right - ev.clientX));
        main.style.gridTemplateColumns = `minmax(160px, 1fr) ${Math.round(w)}px`;
        Blockly.svgResize(this.workspace);
        sp.dataset.w = Math.round(w);
      };
      const up = () => {
        sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up); sp.classList.remove('drag');
        if (sp.dataset.w) save(Number(sp.dataset.w));
        delete sp.dataset.w;
        this.resizeBlockly(); this.circuit.fitView();
      };
      sp.addEventListener('pointermove', move); sp.addEventListener('pointerup', up);
    });
    sp.addEventListener('dblclick', () => { save(0); this.applyCodeWidth(); this.resizeBlockly(); this.circuit.fitView(); });
  },
  setCodeView(v) {
    this.codeView = v;
    $('#codeBody').className = 'code-body view-' + v;
    $('#main').classList.toggle('view-both', v === 'both');
    ['Blocks', 'Both', 'Text'].forEach(k => $('#tab' + k).classList.toggle('on', k.toLowerCase() === v));
    $('#copyCode').hidden = v === 'blocks';
    this.needCenter = true;
    this.updateCodeText();
    this.applyCodeWidth();
    this.resizeBlockly();
  },

  /* Mikrocontroller umschalten: Blöcke neu laden, damit die Anschluss-Listen passen */
  setBoard(b, silent) {
    const changed = b !== boardKey();
    const chip = Object.keys(CHIP_KEY).find(k => CHIP_KEY[k] === b);
    BOARD = chip ? 'esp32' : 'uno';
    ESP_CHIP = chip || 'esp32';
    b = boardKey();
    $('#boardSel').value = b;
    if (this.project) this.updateEmpty();
    if (!changed) return;
    if (!silent && this.workspace) {
      const xml = Blockly.Xml.workspaceToDom(this.workspace);
      Blockly.Events.disable();
      try { this.workspace.clear(); Blockly.Xml.domToWorkspace(xml, this.workspace); } finally { Blockly.Events.enable(); }
      if (!this.viewer) this.workspace.updateToolbox(buildToolbox(this.extensions));
      this.updateCommTab();
      this.markBoardBlocks();
      SerialLink.setUi();
      this.buildPartList();
      this.filterParts();
      this.updateCodeText();
      this.scheduleSave();
      const mcu = this.project.components.find(c => c.def.mcu);
      if (mcu && mcuKey(mcu.def.mcu) !== b) this.toast(`Achtung: In der Schaltung steckt noch ein ${boardName(mcuKey(mcu.def.mcu))}.`);
      else this.toast(`Mikrocontroller: ${boardName(b)}. Prüfe die Anschlüsse in deinen Blöcken.`);
    } else if (this.partsBuilt) { this.buildPartList(); }
  },

  /* Beispielprojekte: auswählen, dann wie ein neues Projekt benennen */
  async examplesDialog() {
    await this.refreshFiles();
    if (School.exam()) { this.toast('Während der Prüfung sind Beispiele gesperrt.'); return; }
    const group = (b, t) => `<div class="start-sec">${t}</div>` + EXAMPLES.filter(e => e.board === b).map(e => `<button class="start-item ex" type="button" data-ex="${e.id}"><span><b>${esc(e.title)}</b><small>${esc(e.desc)}</small></span></button>`).join('');
    // Schulversion: Beispiele der Lehrkraft vom Schulserver
    const srv = await School.examples();
    const srvGroup = srv.length ? `<div class="start-sec">Von deiner Lehrkraft</div>` + srv.map(e => `<button class="start-item ex" type="button" data-srv="${esc(e.id)}"><span><b>${esc(e.titel)}</b><small>${esc(e.beschreibung || '')}${e.board === 'esp32' ? (e.chip === 'c5' ? ' (ESP32-C5)' : ' (ESP32)') : ''}</small></span></button>`).join('') : '';
    this.dialog(`<h2>Beispiel öffnen</h2><p>Das Beispiel wird als <b>neues Projekt</b> angelegt – du kannst es danach frei verändern.</p>${srvGroup}${group('uno', 'Arduino Uno')}${group('esp32', 'ESP32')}<div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button></div>`);
    $('#dlgForm').addEventListener('click', async e => {
      const b = e.target.closest('[data-ex], [data-srv]'); if (!b) return;
      let ex = EXAMPLES.find(x => x.id === b.dataset.ex);
      if (b.dataset.srv) {
        const meta = srv.find(x => x.id === b.dataset.srv);
        let data;
        try { data = await (await this.api('schule/beispiel?id=' + encodeURIComponent(b.dataset.srv))).json(); } catch (er) { this.toast('Beispiel konnte nicht geladen werden: ' + er.message); return; }
        ex = { title: meta.titel, board: data.board === 'esp32' ? 'esp32' : 'uno', chip: data.chip, ext: data.extensions || [], circuit: data.circuit || { components: [], wires: [] }, blocks: data.blocks };
      }
      this.dialog(`<h2>${esc(ex.title)}</h2><p>Wie soll dein Projekt heißen?</p>${this.nameFields({ proj: ex.title })}<div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary" value="ok">Anlegen</button></div>`,
        (rv, f) => {
          if (rv !== 'ok' || !f.n.value) return;
          this.loadProject({ format: FORMAT, version: 1, name: f.n.value, board: ex.board, chip: ex.chip, extensions: ex.ext || [], circuit: JSON.parse(JSON.stringify(ex.circuit)), blocks: ex.blocks });
          this.fileName = null; this.save();
          this.toast(`Beispiel „${ex.title}“ geöffnet.`);
        });
      this.guardNameFields($('#dlgForm'));
    });
  },

  /* Ältere Fassung des aktuellen Projekts wiederherstellen (automatische Sicherungen) */
  async backupsDialog() {
    if (!this.launcher || !this.fileName) { this.toast('Sicherungen gibt es nur für gespeicherte Projekte im Ordner „Projekte“.'); return; }
    let list = [];
    try { list = await (await this.api('backups?file=' + encodeURIComponent(this.fileName))).json(); } catch (e) { list = []; }
    const label = v => { const m = /^(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)/.exec(v); return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]} Uhr` : v; };
    const items = list.length ? list.map(v => `<li data-v="${esc(v)}"><span>Fassung vom ${label(v)}</span><span class="d">wiederherstellen</span></li>`).join('') : '<li>Noch keine älteren Fassungen. Die Werkstatt sichert beim Arbeiten höchstens alle 5 Minuten eine Fassung.</li>';
    this.dialog(`<h2>Ältere Fassung wiederherstellen</h2><p>Automatische Sicherungen von <b>${esc($('#projName').value)}</b>. Die jetzige Fassung wird vorher ebenfalls gesichert.</p><ul class="plist">${items}</ul><div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button></div>`);
    $('#dlgForm .plist').addEventListener('click', async e => {
      const li = e.target.closest('li[data-v]'); if (!li) return;
      $('#dlg').close('cancel');
      try {
        const data = await (await this.api(`backup?file=${encodeURIComponent(this.fileName)}&v=${encodeURIComponent(li.dataset.v)}`)).json();
        const file = this.fileName, name = $('#projName').value;
        data.name = name; // gleicher Projektname und gleiche Datei
        this.loadProject(data); this.fileName = file; this.save();
        this.toast(`Fassung vom ${label(li.dataset.v)} wiederhergestellt.`);
      } catch (err) { this.toast('Wiederherstellen fehlgeschlagen: ' + err.message); }
    });
  },

  helpDialog() {
    if (School.exam()) { this.toast('Während der Prüfung ist die Hilfe gesperrt.'); return; }
    const row = (k, t) => `<tr><td>${k}</td><td>${t}</td></tr>`;
    this.dialog(`<h2>Bedienung und Tastenkürzel</h2><div class="help">
      <h3>Schaltung</h3><table>
      ${row('Ziehen / Doppelklick', 'Bauteil aus der Leiste rechts auf die Werkbank')}
      ${row('Klick auf Anschluss', 'Kabel beginnen, Klick auf das Ziel beendet es. Klicks dazwischen setzen Knickpunkte.')}
      ${row('Esc', 'Kabel abbrechen, Auswahl aufheben')}
      ${row('R', 'Bauteil drehen')}
      ${row('Entf', 'Bauteil oder Kabel löschen')}
      ${row('Strg + D', 'Bauteil verdoppeln')}
      ${row('Strg + Z / Strg + Y', 'Rückgängig / Wiederholen')}
      ${row('Kabel anklicken', 'Farbe wählen. Weiße Punkte an den Enden ziehen = umstecken. Am Kabel ziehen = neuer Knickpunkt, Knickpunkt ziehen = verschieben, Doppelklick auf Knickpunkt = entfernen.')}
      ${row('Mausrad', 'Vergrößern / Verkleinern')}
      ${row('F11 oder ⛶ (unten links)', 'Vollbild ein/aus (im Vollbild auch: Esc gedrückt halten)')}
      ${row('Pos1 oder „Startansicht“', 'Ganze Schaltung ins Fenster einpassen (Knopf unten links)')}
      ${row('Freie Fläche ziehen', 'Ansicht verschieben (⤢ zeigt alles)')}
      </table>
      <h3>Blöcke</h3><table>
      ${row('Strg + C / Strg + V', 'Block kopieren / einfügen')}
      ${row('Entf', 'Block löschen (oder in den Papierkorb ziehen)')}
      ${row('Rechtsklick', 'Duplizieren, Kommentar, Hilfe')}
      ${row('Strg + Z / Strg + Y', 'Rückgängig / Wiederholen')}
      </table>
      <h3>Simulation</h3><table>
      ${row('Taster, Tastenfeld', 'mit der Maus gedrückt halten')}
      ${row('Sensoren', 'Bauteil anklicken und Wert im Eigenschaftsfeld verstellen')}
      ${row('Messwerte speichern', 'im seriellen Monitor: alle Zahlen als Tabelle für Excel (CSV)')}
      </table>
      <h3>Hilfe-Knopf (oben)</h3><table>
      ${row('Hilfe', 'prüft Schaltung und Programm: Fehler (z. B. LED ohne Vorwiderstand), Hinweise (z. B. Block nutzt einen Anschluss, an dem nichts steckt) und Tipps, wie es weitergeht')}
      ${row('Zeigen', 'springt zum betroffenen Bauteil oder Block')}
      </table>
      <h3>Aufgaben</h3><table>
      ${row('Datei › Aufgaben', 'Aufgabe wählen, sie wird als neues Projekt angelegt')}
      ${row('Tipp anzeigen', 'deckt die Tipps nacheinander auf')}
      ${row('Aufgabe prüfen', 'die Simulation testet die Lösung automatisch, gelöste Aufgaben bekommen einen Haken')}
      </table></div><div class="dlg-btns"><button class="btn" type="button" id="tourAgain">Einführungstour starten</button><button class="btn primary" value="ok">Schließen</button></div>`);
    $('#tourAgain').onclick = () => { $('#dlg').close('ok'); Tour.start(this); };
  },

  /* Kommunikationsblöcke im Uno-Projekt mit Hinweis kennzeichnen */
  markBoardBlocks() {
    if (!this.workspace) return;
    for (const b of this.workspace.getAllBlocks(false)) {
      if (!/^com_/.test(b.type)) continue;
      b.setWarningText(BOARD !== 'esp32' ? 'Dieser Block geht nur mit dem ESP32. Beim Arduino Uno wird er übersprungen.'
        : (!hasBT() && /^com_bt_/.test(b.type)) ? 'Der ESP8266 hat kein Bluetooth – dieser Block wird übersprungen.' : null);
    }
  },

  /* „WLAN & Funk“ nur mit ESP32 und eingeschalteter Kommunikation */
  updateCommTab() {
    const on = BOARD === 'esp32' && this.extensions.includes('comm');
    $('#tabComm').hidden = !on;
    $('#tabComm').textContent = hasBT() ? 'WLAN, Funk & Bluetooth' : 'WLAN & Funk';
    $('#btBtn').hidden = is8266(); // der ESP8266 hat kein Bluetooth
    if (!on && $('#tabComm').classList.contains('on')) this.showBottom('msgs');
  },

  onMcuAdded(key, hadOther) {
    if (hadOther) { this.toast('Es kann nur ein Mikrocontroller simuliert werden. Entferne den anderen.'); return; }
    if (key !== boardKey()) this.setBoard(key);
  },

  /* Ältere Projekte: Erweiterungen einschalten, deren Bauteile oder Blöcke schon verwendet werden
     (z. B. Motoren, die es früher ohne Erweiterung gab) */
  autoExtensions() {
    const need = new Set(this.extensions);
    for (const c of this.project.components) if (c.def.ext) need.add(c.def.ext);
    if (this.workspace.getAllBlocks(false).some(b => b.type === 'ard_motor' || b.type === 'ard_stepper' || /^car_/.test(b.type))) need.add('motoren');
    if (need.size > this.extensions.length) this.setExtensions([...need], true);
  },

  setExtensions(list, silent) {
    this.extensions = list.filter(x => EXTENSIONS[x]);
    if (!this.viewer) this.workspace.updateToolbox(buildToolbox(this.extensions));
    this.updateCommTab();
    this.filterParts();
    if (!silent) this.scheduleSave();
  },

  /* Erweiterungen, deren Bauteile in der Schaltung stecken */
  extensionsInCircuit() {
    return [...new Set(this.project.components.map(c => c.def.ext).filter(x => x && EXTENSIONS[x]))];
  },
  /* Steckt ein Bauteil einer ausgeschalteten Erweiterung in der Schaltung (z. B. geladen oder eingefügt),
     wird die Erweiterung eingeschaltet – sonst fehlen Bauteil in der Leiste und Blöcke im Werkzeugkasten. */
  ensureExtensions(quiet) {
    const missing = this.extensionsInCircuit().filter(x => !this.extensions.includes(x));
    if (!missing.length) return;
    this.setExtensions(this.extensions.concat(missing), this.loading);
    if (!quiet) this.toast(`Erweiterung ${missing.map(x => '„' + EXTENSIONS[x].name + '“').join(', ')} eingeschaltet – passend zu den Bauteilen in der Schaltung.`);
  },

  extensionDialog() {
    const off = e => e.esp && BOARD !== 'esp32';
    const used = this.extensionsInCircuit();
    const parts = k => Object.values(COMPONENTS).filter(c => c.ext === k && !c.hidden).map(c => c.name);
    const items = Object.entries(EXTENSIONS).map(([k, e]) => {
      const p = parts(k);
      return `<label class="${off(e) ? 'off' : ''}"><input type="checkbox" name="${k}" ${this.extensions.includes(k) ? 'checked' : ''} ${off(e) ? 'disabled' : ''}><span><b>${esc(e.name)}${off(e) ? ' (nur mit ESP32)' : ''}</b><small>${esc(e.desc)}${p.length ? `<br>Bauteile: ${esc(p.join(', '))}` : ''}</small></span></label>`;
    }).join('');
    this.dialog(`<h2>Erweiterungen</h2><p>Zusätzliche Bauteile und Blöcke für dieses Projekt:</p><div class="extlist">${items}</div><div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary" value="ok">Übernehmen</button></div>`,
      (rv, f) => {
        if (rv !== 'ok') return;
        let list = Object.keys(EXTENSIONS).filter(k => f.elements[k].checked || (f.elements[k].disabled && this.extensions.includes(k)));
        // Erweiterungen, deren Bauteile noch in der Schaltung stecken, bleiben an
        const kept = used.filter(k => !list.includes(k));
        if (kept.length) {
          list = list.concat(kept);
          this.toast(`${kept.map(k => '„' + EXTENSIONS[k].name + '“').join(', ')} bleibt eingeschaltet, solange das Bauteil in der Schaltung steckt.`);
        }
        this.setExtensions(list);
      });
  },

  resizeBlockly() {
    requestAnimationFrame(() => {
      Blockly.svgResize(this.workspace);
      if (this.needCenter && $('#main').classList.contains('mode-code') && this.codeView !== 'text') { this.needCenter = false; const m = this.workspace.getMetrics(); this.workspace.scroll(-m.contentLeft + 24, -m.contentTop + 24); }
    });
  },

  toast(t) {
    const el = $('#toast');
    el.textContent = t; el.classList.add('show');
    // Anzeigedauer nach Textlänge: mindestens 6 s, längere Hinweise bis 15 s; Klick schließt sie sofort
    const ms = Math.min(15000, Math.max(6000, String(t).length * 70));
    const hide = () => { clearTimeout(this.toastTimer); el.classList.remove('show'); };
    el.onclick = hide;
    el.title = 'Klicken zum Schließen';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(hide, ms);
  },

  hint(t) { const h = $('#hint'); if (t) { h.textContent = t; h.classList.add('show'); } else h.classList.remove('show'); },

  /* Jeder Dialog bekommt ein frisches Formular, damit keine alten Ereignisse daran hängen */
  freshForm() {
    const d = $('#dlg'), old = $('#dlgForm');
    const f = old.cloneNode(false);
    old.replaceWith(f);
    d.oncancel = null; d.onclose = null; d.returnValue = '';
    return f;
  },
  dialog(html, onSubmit) {
    const d = $('#dlg');
    if (d.open) d.close();
    this.freshForm().innerHTML = html;
    d.showModal();
    d.onclose = () => { if (d.open) return; if (onSubmit) onSubmit(d.returnValue, $('#dlgForm')); }; // verspätetes Ereignis eines vorherigen Dialogs ignorieren
  },

  async fileAction(act) {
    $('#fileMenu').hidden = true;
    if (School.exam() && act !== 'settings' && act !== 'image' && act !== 'print') { this.toast('Während der Prüfung ist das gesperrt.'); return; }
    if (act === 'new') {
      await this.refreshFiles();
      this.dialog(`<h2>Neues Projekt</h2>${this.nameFields()}<div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary" value="ok">Anlegen</button></div>`,
        (rv, f) => { if (rv === 'ok' && f.n.value) { this.loadProject(this.blankProject(f.n.value)); this.fileName = null; this.save(); } });
      this.guardNameFields($('#dlgForm'));
    } else if (act === 'open') {
      if (!this.launcher) { $('#fileInput').click(); return; }
      let list = [];
      try { list = await (await this.api('list')).json(); } catch (e) { this.toast('Projektliste konnte nicht geladen werden.'); return; }
      const items = list.length ? list.map(p => `<li data-file="${esc(p.file)}"><span>${esc(p.file.replace(/\.awp$/, ''))}</span><span class="d">${new Date(p.modified).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span></li>`).join('') : '<li>Noch keine Projekte im Ordner „Projekte“.</li>';
      this.dialog(`<h2>Projekt öffnen</h2><p>Projekte im Ordner „Projekte“:</p><ul class="plist">${items}</ul><div class="dlg-btns"><button class="btn" value="file" type="submit">Andere Datei …</button><button class="btn" value="cancel">Abbrechen</button></div>`,
        rv => { if (rv === 'file') { this.opening = true; $('#fileInput').click(); } });
      $('#dlgForm .plist').addEventListener('click', async e => {
        const li = e.target.closest('li[data-file]'); if (!li) return;
        this.opening = true;
        $('#dlg').close('cancel');
        try { const data = await (await this.api('load?file=' + encodeURIComponent(li.dataset.file))).json(); this.loadProject(data); this.fileName = li.dataset.file; } catch (err) { this.toast('Öffnen fehlgeschlagen: ' + err.message); }
        this.opening = false;
      });
    } else if (act === 'duplicate') {
      await this.refreshFiles();
      const cur = this.nameParts($('#projName').value);
      this.dialog(`<h2>Kopie speichern unter</h2>${this.nameFields({ tisch: cur.tisch, vor: cur.vor, proj: cur.proj ? cur.proj + ' (Kopie)' : '' })}<div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary" value="ok">Speichern</button></div>`,
        (rv, f) => { if (rv === 'ok' && f.n.value) { $('#projName').value = f.n.value; this.fileName = null; this.save(); } });
      this.guardNameFields($('#dlgForm'));
    } else if (act === 'export') {
      const data = this.projectData();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      a.download = this.fileFor(data.name);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (act === 'import') $('#fileInput').click();
    else if (act === 'settings') Settings.open(this);
    else if (act === 'image') Export.saveImage();
    else if (act === 'print') Export.print();
    else if (act === 'examples') this.examplesDialog();
    else if (act === 'tasks') TaskUi.dialog();
    else if (act === 'backups') this.backupsDialog();
  },

  bindUi() {
    $('#modeParts').onclick = () => this.setMode('parts');
    $('#modeCode').onclick = () => this.setMode('code');
    $('#simBtn').onclick = () => this.toggleSim();
    $('#undoBtn').onclick = () => (this.focusArea === 'code' ? this.workspace.undo(false) : this.undo());
    $('#redoBtn').onclick = () => (this.focusArea === 'code' ? this.workspace.undo(true) : this.redo());
    $('#zoomFit').onclick = () => this.circuit.fitView();
    const zoom = f => { const r = $('#circuit').getBoundingClientRect(); const v = this.circuit.view; const k = Math.max(0.3, Math.min(5, v.k * f)); v.x = r.width / 2 - (r.width / 2 - v.x) * k / v.k; v.y = r.height / 2 - (r.height / 2 - v.y) * k / v.k; v.k = k; this.circuit.applyView(); };
    $('#zoomIn').onclick = () => zoom(1.25);
    $('#zoomOut').onclick = () => zoom(0.8);
    $('#tabBlocks').onclick = () => this.setCodeView('blocks');
    $('#tabBoth').onclick = () => this.setCodeView('both');
    $('#tabText').onclick = () => this.setCodeView('text');
    $('#extBtn').onclick = () => this.extensionDialog();
    $('#extBtnParts').onclick = () => this.extensionDialog();
    $('#copyCode').onclick = () => { navigator.clipboard.writeText($('#textcode').textContent).then(() => this.toast('Code kopiert.')); };
    $('#tabMsgs').onclick = () => this.showBottom('msgs');
    $('#tabSerial').onclick = () => this.showBottom('serial');
    $('#tabComm').onclick = () => this.showBottom('comm');
    CommPanel.init(this);
    SerialLink.init(this);
    this.initCodeSplit();
    this.makeMovable($('#props'), 'h3');
    this.makeMovable($('#taskPanel'), '.tp-head');
    TaskUi.init(this);
    $('#bottomToggle').onclick = () => { $('#bottom').classList.toggle('collapsed'); $('#bottomToggle').textContent = $('#bottom').classList.contains('collapsed') ? '▴' : '▾'; this.resizeBlockly(); };
    $('#boardSel').addEventListener('change', e => { if (this.sim.running) this.stopSim(); this.setBoard(e.target.value); });
    $('#projName').addEventListener('focus', e => { this.nameBefore = e.target.value; });
    $('#projName').addEventListener('change', async e => {
      const ok = this.checkName(e.target.value);
      if (!ok) { e.target.value = this.nameBefore || e.target.value; this.toast('Der Name braucht Tisch-Nr., Vorname und Projekt, z. B. 11 – Lena – Ampelschaltung.'); return; }
      await this.refreshFiles();
      if (this.nameTaken(ok)) { e.target.value = this.nameBefore || e.target.value; this.toast(`Ein Projekt „${ok}“ gibt es schon. Bitte einen anderen Namen wählen.`); return; }
      e.target.value = ok;
      if (!(await this.renameFile(ok))) { e.target.value = this.nameBefore; this.toast('Umbenennen fehlgeschlagen.'); return; }
      this.nameBefore = ok; this.scheduleSave();
    });
    $('#setBtn').onclick = () => Settings.open(this);
    $('#adviceBtn').onclick = () => { if (School.exam()) this.toast('Während der Prüfung ist der Hilfe-Knopf gesperrt.'); else Advisor.open(this); };
    $('#examBtn').onclick = () => School.submit();
    $('#schoolLogout').onclick = () => School.logout();
    $('#fileBtn').onclick = e => { e.stopPropagation(); $('#fileMenu').hidden = !$('#fileMenu').hidden; };
    document.addEventListener('click', e => { if (!e.target.closest('.menu')) $('#fileMenu').hidden = true; });
    $('#fileMenu').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.fileAction(b.dataset.act); });
    $('#fileInput').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.format !== FORMAT) throw new Error('Keine Arduino-Werkstatt-Datei');
        // Gleichnamiges Projekt nicht überschreiben: dann „(2)“, „(3)“ … anhängen
        await this.refreshFiles(); this.fileName = null;
        const base = data.name || 'Neues Projekt'; let name = base;
        for (let k = 2; this.nameTaken(name, true); k++) name = `${base} (${k})`;
        data.name = name;
        this.loadProject(data); this.fileName = null; this.save();
      } catch (err) { this.toast('Datei konnte nicht geöffnet werden: ' + err.message); }
      e.target.value = '';
    });
    $('#uploadBtn').onclick = () => Uploader.openUsb(this);
    $('#btBtn').onclick = () => { if (is8266()) { this.toast('Der ESP8266 hat kein Bluetooth. Bitte per USB-Kabel hochladen.'); return; } if (BOARD !== 'esp32') { this.toast('Übertragen per Bluetooth geht nur mit dem ESP32.'); return; } Uploader.mode = 'bt'; Uploader.open(this); };
    this.bindProps();
    window.addEventListener('resize', () => this.resizeBlockly());
    // Hilfe: Tastenkürzel und Bedienung (Knopf „?“, Taste F1 oder ?)
    $('#helpBtn').onclick = () => this.helpDialog();
    $('#fullBtn').onclick = () => this.toggleFull();
    const fullIcon = () => { const f = this.isFull(); $('#fullBtn').classList.toggle('on', f); $('#fullBtn').title = f ? 'Vollbild beenden (F11)' : 'Vollbild (F11)'; };
    document.addEventListener('fullscreenchange', fullIcon); window.addEventListener('resize', fullIcon); fullIcon();
    window.addEventListener('keydown', e => {
      if ((e.key === 'F1' || (e.key === '?' && !(e.target.closest && e.target.closest('input, textarea, .blocklyHtmlInput')))) && !$('#dlg').open) { e.preventDefault(); this.helpDialog(); }
    });
    window.addEventListener('keydown', e => {
      const inField = e.target.closest && e.target.closest('input, select, textarea, .blocklyHtmlInput');
      if (inField || this.focusArea !== 'circuit' || this.viewer) return;
      if (e.key === 'Home' && !$('#dlg').open) { e.preventDefault(); this.circuit.fitView(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); e.shiftKey ? this.redo() : this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); e.stopImmediatePropagation(); this.redo(); return; }
      if (this.sim.running) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); e.stopImmediatePropagation(); this.circuit.duplicateSelection(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); this.circuit.deleteSelection(); }
      else if (e.key === 'r' || e.key === 'R') { this.circuit.rotateSelection(); }
      else if (e.key === 'Escape') { this.circuit.cancelWire(); this.circuit.select(null); }
    }, true);
    const stage = $('#circuit');
    stage.addEventListener('pointermove', () => {
      if (this.circuit.wiring) this.hint('Klicke auf einen Anschluss oder ein Loch. Klicks dazwischen setzen Knickpunkte. Esc bricht ab.');
      else this.hint(null);
    });
  },
};

function highlightCpp(code) {
  return esc(code)
    .replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>')
    .replace(/(&quot;.*?&quot;)/g, '<span class="s">$1</span>')
    .replace(/^(#include)/gm, '<span class="k">$1</span>')
    .replace(/\b(void|int|for|if|else|while|return|true|false)\b/g, '<span class="k">$1</span>')
    .replace(/\b(HIGH|LOW|OUTPUT|INPUT|LED_BUILTIN)\b/g, '<span class="n">$1</span>');
}

window.addEventListener('DOMContentLoaded', () => App.init());
