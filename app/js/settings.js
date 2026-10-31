/* Einstellungen: Version und Updates, Werkzeuge, ESP32 löschen, Zeitmessung */
'use strict';

const Settings = {
  bindTeacher() {
    const cb = document.querySelector('#setTeacher');
    if (cb) cb.onchange = () => { try { localStorage.setItem('werkstatt.lehrkraft', cb.checked ? '1' : '0'); } catch (e) { /* ohne Speicher */ } };
  },
  async open(app) {
    this.app = app;
    if (!app.launcher) {
      app.dialog(`<h2>Einstellungen</h2><p>Updates und Werkzeuge gibt es nur, wenn die Werkstatt über <b>„Arduino-Werkstatt starten.exe“</b> gestartet wurde.</p><section class="set-sec">
        <h3>Aufgaben</h3>
        <label class="up-check"><input type="checkbox" id="setTeacher" ${TaskEditor.teacherMode() ? 'checked' : ''}> Lehrkraft-Modus: eigene Aufgaben erstellen, bearbeiten, importieren und löschen (unter „Datei › Aufgaben“)</label>
      </section><div class="dlg-btns"><button class="btn primary" value="ok">Schließen</button></div>`);
      this.bindTeacher();
      return;
    }
    let info = {};
    try { info = await (await fetch('api/info', { cache: 'no-store' })).json(); } catch (e) { /* ältere Startdatei */ }
    let details = false;
    try { details = localStorage.getItem('werkstatt.details') === '1'; } catch (e) { /* ohne Speicher */ }
    const yes = ok => ok ? '<span class="set-ok">eingerichtet</span>' : '<span class="set-no">noch nicht eingerichtet</span>';
    app.dialog(`<h2>Einstellungen</h2>
      <section class="set-sec">
        <h3>Programm</h3>
        <p class="set-line">Version <b>${esc(info.version || '?')}</b><span class="set-path" title="${esc(info.folder || '')}">${esc(info.folder || '')}</span></p>
        <div class="set-btns">
          <button class="btn small" type="button" id="setCheck" ${info.updateRepo ? '' : 'disabled title="Die Update-Adresse ist noch nicht eingerichtet."'}>Nach Updates suchen</button>
          <button class="btn small" type="button" id="setZip">Update aus ZIP-Datei …</button>
          <input type="file" id="setZipFile" accept=".zip" hidden>
        </div>
        <div class="set-note" id="setUpd">${info.updateRepo ? '' : 'Die automatische Update-Suche wird noch eingerichtet. Updates lassen sich schon jetzt aus einer ZIP-Datei einspielen.'}</div>
        <div class="set-note">Beim Update werden nur das Programm und die Startdatei ersetzt. Die Ordner „Werkzeuge“, „Projekte“ und „Aufgaben“ bleiben erhalten.</div>
      </section>
      <section class="set-sec">
        <h3>Werkzeuge zum Hochladen</h3>
        <p class="set-line">Arduino Uno: ${yes(info.ready)}<br>ESP32: ${yes(info.readyEsp32)}<br>Zwischenspeicher: ${info.cacheMB != null ? info.cacheMB + ' MB' : '?'}</p>
        <div class="set-btns">
          <button class="btn small" type="button" id="setTools">Werkzeuge prüfen</button>
          <button class="btn small" type="button" data-setup="uno">Uno neu einrichten</button>
          <button class="btn small" type="button" data-setup="esp32">ESP32 neu einrichten</button>
          <button class="btn small" type="button" id="setCache">Zwischenspeicher leeren</button>
        </div>
        <div class="set-note">„Neu einrichten“ ergänzt fehlende Teile (Internet nötig). Den Zwischenspeicher nur leeren, wenn das Übersetzen seltsame Fehler meldet – danach dauert es einmal länger.</div>
      </section>
      <section class="set-sec">
        <h3>ESP32 komplett löschen</h3>
        <div class="up-row">
          <label>Anschluss <select id="setPort"><option value="">wird gesucht …</option></select></label>
          <button class="btn small" type="button" id="setPortRefresh" title="Anschlüsse neu suchen">↻</button>
          <button class="btn small danger" type="button" id="setErase">Komplett löschen</button>
        </div>
        <div class="set-note">Hilft, wenn der ESP32 hängt, sich ständig neu startet oder per Bluetooth nicht mehr erreichbar ist. Löscht das Programm und alle gespeicherten Daten. Danach einfach wieder ein Programm hochladen.</div>
      </section>
      <section class="set-sec">
        <h3>Hochladen</h3>
        <label class="up-check"><input type="checkbox" id="setDetails" ${details ? 'checked' : ''}> Zeitmessung beim Übersetzen anzeigen (welcher Teil wie lange dauert)</label>
      </section>
      <section class="set-sec">
        <h3>Aufgaben</h3>
        <label class="up-check"><input type="checkbox" id="setTeacher" ${TaskEditor.teacherMode() ? 'checked' : ''}> Lehrkraft-Modus: eigene Aufgaben erstellen, bearbeiten, importieren und löschen (unter „Datei › Aufgaben“)</label>
      </section>
      <div class="up-steps" id="upSteps" hidden></div>
      <div class="up-bar" id="upBar" hidden><div></div></div>
      <div class="up-msg" id="upMsg"></div>
      <details class="up-log" id="upLogBox" hidden><summary>Details anzeigen</summary><pre id="upLog"></pre></details>
      <div class="dlg-btns"><button class="btn primary" value="cancel">Schließen</button></div>`);
    const d = document.querySelector('#dlg'), $q = s => document.querySelector(s);
    d.oncancel = e => { if (this.busy) e.preventDefault(); };
    this.bindTeacher();
    Uploader.app = app;

    $q('#setDetails').onchange = e => { try { localStorage.setItem('werkstatt.details', e.target.checked ? '1' : '0'); } catch (err) { /* ohne Speicher */ } };
    $q('#setCheck').onclick = () => this.checkUpdate();
    $q('#setZip').onclick = () => $q('#setZipFile').click();
    $q('#setZipFile').onchange = e => { const f = e.target.files[0]; if (f) this.install(f); };
    $q('#setTools').onclick = () => this.run('api/tools/check');
    $q('#setCache').onclick = () => this.run('api/cache/clear');
    document.querySelectorAll('[data-setup]').forEach(b => { b.onclick = () => { if (!this.busy) Uploader.showSetup(b.dataset.setup); }; });
    $q('#setPortRefresh').onclick = () => this.loadPorts();
    const erase = $q('#setErase');
    erase.onclick = () => {
      if (this.busy) return;
      const port = $q('#setPort').value;
      if (!port) { Uploader.fail('Kein Anschluss gewählt. Stecke den ESP32 direkt per USB an.'); return; }
      if (!erase.dataset.sure) { erase.dataset.sure = '1'; erase.textContent = 'Wirklich löschen?'; setTimeout(() => { delete erase.dataset.sure; erase.textContent = 'Komplett löschen'; }, 4000); return; }
      delete erase.dataset.sure; erase.textContent = 'Komplett löschen';
      this.run('api/esp32/erase?port=' + encodeURIComponent(port));
    };
    this.loadPorts();
  },

  async loadPorts() {
    const sel = document.querySelector('#setPort');
    if (!sel) return;
    let ports = [];
    try { ports = await (await fetch('api/ports', { cache: 'no-store' })).json(); } catch (e) { ports = []; }
    if (!ports.length) { sel.innerHTML = '<option value="">kein Gerät gefunden</option>'; return; }
    sel.innerHTML = ports.map(p => `<option value="${esc(p.port)}">${esc(p.port)} – ${esc(p.label)}</option>`).join('');
    const best = ports.find(p => /esp32|cp210/i.test(p.label)) || ports.find(p => !/kein USB/.test(p.label)) || ports[0];
    sel.value = best.port;
  },

  async run(url, opts) {
    if (this.busy) return { ok: false };
    this.busy = true;
    document.querySelectorAll('.set-btns button, #setErase').forEach(b => { b.disabled = true; });
    const res = await Uploader.runStream(url, Object.assign({ method: 'POST' }, opts || {}), 1);
    this.busy = false;
    document.querySelectorAll('.set-btns button, #setErase').forEach(b => { b.disabled = b.id === 'setCheck' && !!b.title; });
    return res;
  },

  async checkUpdate() {
    const box = document.querySelector('#setUpd');
    box.className = 'set-note'; box.textContent = 'Suche nach Updates …';
    let r;
    try { r = await (await fetch('api/update/check', { cache: 'no-store' })).json(); } catch (e) { r = { ok: false, error: 'Keine Verbindung zum Startprogramm.' }; }
    if (!r.ok) { box.className = 'set-note warn'; box.textContent = r.error; return; }
    if (!r.newer) { box.className = 'set-note good'; box.textContent = `Du hast die neueste Version (${r.current}).`; return; }
    box.className = 'set-note good';
    box.innerHTML = `Neue Version <b>${esc(r.latest)}</b> verfügbar (installiert: ${esc(r.current)}).` +
      (r.notes ? `<div class="set-notes">${esc(r.notes).slice(0, 1500)}</div>` : '') +
      `<div class="set-btns"><button class="btn small primary" type="button" id="setInstall">Jetzt aktualisieren</button></div>`;
    document.querySelector('#setInstall').onclick = () => this.install(null);
  },

  async install(file) {
    try { await this.app.save(); } catch (e) { /* weiter */ }
    const res = await this.run(file ? 'api/update/install' : 'api/update/install?from=github', file ? { body: file } : {});
    if (res.ok) {
      document.querySelectorAll('#dlg button').forEach(b => { b.disabled = true; });
      this.busy = true; // Dialog offen lassen, bis das neue Fenster da ist
      const msg = document.querySelector('#upMsg');
      msg.textContent += ' Gleich öffnet sich ein neues Fenster. Falls sich dieses hier nicht von selbst schließt, bitte schließen.';
      setTimeout(() => { try { window.close(); } catch (e) { /* nicht erlaubt */ } }, 4000);
    }
  },
};
