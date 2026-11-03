/* Lehrer-Oberfläche des Werkstatt-Schulservers */
'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#main');

async function api(path, body, opts) {
  const o = Object.assign({ cache: 'no-store' }, opts || {});
  if (body !== undefined) {
    o.method = 'POST';
    o.headers = Object.assign({ 'X-Werkstatt': '1' }, o.headers || {});
    if (body instanceof Blob || typeof body === 'string') o.body = body;
    else { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; }
  }
  const r = await fetch('lehrer/api/' + path, o);
  if (r.status === 401 && path !== 'anmelden') { UI.loginScreen(); throw new Error('Bitte anmelden.'); }
  if (!r.ok) throw new Error((await r.text()).trim() || 'Fehler ' + r.status);
  const t = r.headers.get('Content-Type') || '';
  return t.includes('json') ? r.json() : r.text();
}

function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(toast.tm); toast.tm = setTimeout(() => el.classList.remove('show'), Math.min(12000, Math.max(4000, t.length * 70)));
}

function dialog(html, onOk) {
  const d = $('#dlg'), f = $('#dlgForm');
  f.innerHTML = html;
  d.showModal();
  const first = f.querySelector('input, textarea, select'); if (first) setTimeout(() => first.focus(), 0);
  f.onsubmit = async e => {
    const v = e.submitter && e.submitter.value;
    if (v !== 'ok') return;
    e.preventDefault();
    const err = f.querySelector('.err');
    try { if (onOk) await onOk(f); d.close(); } catch (er) { if (err) err.textContent = er.message; else toast(er.message); }
  };
}
const btns = (ok, cancel) => `<div class="err"></div><div class="dlg-btns"><button class="btn" value="cancel" formnovalidate>${cancel || 'Abbrechen'}</button><button class="btn primary" value="ok">${ok}</button></div>`;

function ago(t, now) {
  const d = new Date(t);
  if (!t || d.getFullYear() < 2000) return '–';
  const s = Math.max(0, Math.round(((now ? new Date(now) : new Date()) - d) / 1000));
  if (s < 60) return `vor ${s} s`;
  if (s < 3600) return `vor ${Math.round(s / 60)} min`;
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}
const clock = t => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const valid = t => t && new Date(t).getFullYear() > 2000;

const UI = {
  me: null,
  timer: null,

  async start() {
    let st;
    try { st = await api('status'); } catch (e) { main.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (st.setup) return this.setupScreen();
    if (!st.lehrer) return this.loginScreen();
    this.loggedIn(st.lehrer);
  },

  stopTimer() { clearInterval(this.timer); this.timer = null; },

  setupScreen() {
    this.stopTimer();
    main.innerHTML = `<div class="card login form"><h1>Erster Start</h1>
      <p class="note">Lege den <b>Verwalter-Zugang</b> an. Damit legst du später die Zugänge der anderen Lehrkräfte an und kannst Passwörter zurücksetzen.</p>
      <form id="f"><label>Name</label><input name="name" placeholder="z. B. Uli Aichler" required>
      <label>Anmeldename</label><input name="login" placeholder="z. B. aichler" autocomplete="username" required>
      <label>Passwort (mindestens 8 Zeichen)</label><input name="passwort" type="password" autocomplete="new-password" required>
      <label>Passwort wiederholen</label><input name="p2" type="password" autocomplete="new-password" required>
      <div class="err" id="err"></div><button class="btn primary" style="margin-top:12px">Verwalter-Zugang anlegen</button></form></div>`;
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      if (f.passwort.value !== f.p2.value) { $('#err').textContent = 'Die beiden Passwörter sind verschieden.'; return; }
      try { this.loggedIn(await api('setup', { name: f.name.value, login: f.login.value, passwort: f.passwort.value })); }
      catch (er) { $('#err').textContent = er.message; }
    };
  },

  loginScreen() {
    this.stopTimer();
    this.me = null;
    $('#nav').hidden = $('#me').hidden = true;
    main.innerHTML = `<div class="card login form"><h1>Anmelden</h1>
      <form id="f"><label>Anmeldename</label><input name="login" autocomplete="username" required>
      <label>Passwort</label><input name="passwort" type="password" autocomplete="current-password" required>
      <div class="err" id="err"></div><button class="btn primary" style="margin-top:12px">Anmelden</button></form>
      <p class="note">Passwort vergessen? Der Verwalter-Zugang kann es zurücksetzen.</p></div>`;
    $('#f').login.focus();
    $('#f').onsubmit = async e => {
      e.preventDefault();
      try { this.loggedIn(await api('anmelden', { login: e.target.login.value, passwort: e.target.passwort.value })); }
      catch (er) { $('#err').textContent = er.message; }
    };
  },

  loggedIn(me) {
    this.me = me;
    $('#nav').hidden = $('#me').hidden = false;
    $('#navLehrer').hidden = !me.verwalter;
    $('#meName').textContent = me.name + (me.verwalter ? ' (Verwalter)' : '');
    if (me.neu) { this.passwordDialog(true); }
    this.show('klassen');
  },

  show(view, arg) {
    this.stopTimer();
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === view || (view !== 'inhalte' && view !== 'lehrer' && b.dataset.view === 'klassen')));
    ({ klassen: () => this.classes(), raum: () => this.room(arg), projekte: () => this.projects(arg), abgaben: () => this.submissions(arg), inhalte: () => this.contents(), lehrer: () => this.teachers() })[view]();
  },

  passwordDialog(force) {
    dialog(`<h2>Passwort ändern</h2>${force ? '<p class="note">Bitte lege ein eigenes Passwort fest.</p>' : ''}<div class="form">
      <label>Bisheriges Passwort</label><input name="alt" type="password" autocomplete="current-password" required>
      <label>Neues Passwort (mindestens 8 Zeichen)</label><input name="neu" type="password" autocomplete="new-password" required>
      <label>Neues Passwort wiederholen</label><input name="neu2" type="password" autocomplete="new-password" required></div>${btns('Speichern', force ? 'Später' : '')}`, async f => {
      if (f.neu.value !== f.neu2.value) throw new Error('Die beiden neuen Passwörter sind verschieden.');
      await api('passwort', { alt: f.alt.value, neu: f.neu.value });
      toast('Passwort geändert.');
    });
  },

  /* ---------- Klassen ---------- */
  async classes() {
    const list = await api('klassen');
    main.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Meine Klassen</h1><button class="btn primary" id="newCls">+ Neue Klasse</button></div>
      ${list.length ? '' : '<p class="note">Noch keine Klasse. Lege zuerst eine Klasse an, z. B. „8a“ oder „WPU Technik“.</p>'}
      <div class="classes">${list.map(c => `<div class="card cls"><h3>${esc(c.name)}</h3>
        <div class="state">${c.code ? (c.modus === 'pruefung' ? `<span class="badge exam">Prüfung läuft</span> <span class="badge open">Code ${esc(c.code)}</span>` : `<span class="badge open">Klassenzimmer offen · Code ${esc(c.code)}</span>`) : '<span class="badge">geschlossen</span>'}</div>
        <div class="row"><button class="btn primary small" data-act="raum" data-id="${c.id}">${c.code ? 'Klassenzimmer anzeigen' : 'Klassenzimmer öffnen'}</button>
        <button class="btn small" data-act="projekte" data-id="${c.id}">Projekte</button><button class="btn small" data-act="abgaben" data-id="${c.id}">Abgaben</button>
        <button class="btn small" data-act="umbenennen" data-id="${c.id}" data-name="${esc(c.name)}">Umbenennen</button><button class="btn small danger" data-act="loeschen" data-id="${c.id}" data-name="${esc(c.name)}">Löschen</button></div></div>`).join('')}</div>
      <p class="note" style="margin-top:20px">Zu Beginn der Stunde das Klassenzimmer öffnen und den Stundencode an die Tafel schreiben. Die Schüler melden sich in der Werkstatt mit Code, Tisch-Nummer und Vorname an. Die Projekte bleiben der Klasse zugeordnet.</p>`;
    $('#newCls').onclick = () => dialog(`<h2>Neue Klasse</h2><div class="form"><label>Name der Klasse</label><input name="name" placeholder="z. B. 8a" required></div>${btns('Anlegen')}`, async f => { await api('klasse-neu', { name: f.name.value }); this.classes(); });
    main.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, name = b.dataset.name;
      if (b.dataset.act === 'raum') { await api('raum-oeffnen', { klasse: id }); this.show('raum', id); }
      else if (b.dataset.act === 'projekte') this.show('projekte', id);
      else if (b.dataset.act === 'abgaben') this.show('abgaben', id);
      else if (b.dataset.act === 'umbenennen') dialog(`<h2>Klasse umbenennen</h2><div class="form"><label>Neuer Name</label><input name="name" value="${esc(name)}" required></div>${btns('Speichern')}`, async f => { await api('klasse-umbenennen', { id, name: f.name.value }); this.classes(); });
      else if (b.dataset.act === 'loeschen') dialog(`<h2>Klasse „${esc(name)}“ löschen?</h2><p>Die Klasse mit allen Projekten und Abgaben wird in den Papierkorb-Ordner des Servers verschoben (nur der Admin kann sie dort wiederherstellen).</p><div class="form"><label>Zur Bestätigung den Namen der Klasse eintippen</label><input name="b" required></div>${btns('Endgültig löschen')}`, async f => { await api('klasse-loeschen', { id, bestaetigung: f.b.value }); this.classes(); });
    });
  },

  /* ---------- Klassenzimmer ---------- */
  async room(id) {
    this.roomId = id;
    main.innerHTML = '<p class="note">Lade …</p>';
    const draw = async () => {
      let r;
      try { r = await api('raum?klasse=' + encodeURIComponent(id)); } catch (e) { this.stopTimer(); main.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
      if (!r.offen) { this.stopTimer(); this.show('klassen'); return; }
      this.lastRoom = r;
      const exam = r.modus === 'pruefung';
      if (!$('#roomRoot')) {
        main.innerHTML = `<div id="roomRoot" class="room"><div class="row" style="justify-content:space-between"><h1 id="rTitle"></h1>
          <div class="row"><button class="btn small" id="toClasses">← Klassen</button><button class="btn small" id="toProj">Projekte</button><button class="btn small" id="toSub">Abgaben</button><button class="btn small danger" id="close">Klassenzimmer schließen</button></div></div>
          <div class="room-head"><div class="code" id="code" title="Groß anzeigen (für den Beamer)"><small>Stundencode</small><b id="codeNr"></b></div>
          <div class="card modebox" id="modebox"></div></div><div class="tiles" id="tiles"></div>
          <p class="note">Klick auf einen Namen: Projekt groß ansehen (Schaltung und Programm, aktualisiert sich laufend). Rot blinkend: hat die Werkstatt gerade verlassen.</p></div>`;
        $('#toClasses').onclick = () => this.show('klassen');
        $('#toProj').onclick = () => this.show('projekte', id);
        $('#toSub').onclick = () => this.show('abgaben', id);
        $('#close').onclick = () => dialog(`<h2>Klassenzimmer schließen?</h2><p>Der Stundencode wird ungültig. Die Arbeit der Schüler ist gespeichert; angemeldete Schüler können weiter speichern.${exam ? ' <b>Achtung: Die Prüfung läuft noch.</b>' : ''}</p>${btns('Schließen')}`, async () => { await api('raum-schliessen', { klasse: id }); this.show('klassen'); });
        $('#code').onclick = () => { const d = document.createElement('div'); d.className = 'bigcode'; d.innerHTML = `<div>Stundencode für ${esc(this.lastRoom.klasse)}</div><b>${esc(this.lastRoom.code)}</b><div>Klicken zum Schließen</div>`; d.onclick = () => d.remove(); document.body.append(d); };
      }
      $('#rTitle').textContent = 'Klassenzimmer ' + r.klasse;
      $('#codeNr').textContent = r.code;
      $('#roomRoot').classList.toggle('exam', exam);
      const mb = $('#modebox');
      if (mb.dataset.modus !== r.modus) {
        mb.dataset.modus = r.modus;
        const done = r.schueler.filter(s => valid(s.abgegeben)).length;
        mb.innerHTML = exam
          ? `<div class="row" style="justify-content:space-between"><b><span class="badge exam">Prüfungsmodus</span> seit ${clock(r.pruefung)}</b><button class="btn warn" id="modeBtn">Prüfung beenden</button></div>
             <p class="note">Gesperrt: Beispiele, Aufgaben, Hilfe, ältere Projekte, Einfügen von außen. Hochladen bleibt erlaubt.</p>
             <label class="note">Aufgabenstellung (erscheint bei den Schülern)</label><textarea id="task">${esc(r.aufgabe)}</textarea><div class="row" style="margin-top:6px"><button class="btn small" id="taskBtn">Aufgabenstellung aktualisieren</button><span class="note" id="doneCnt"></span></div>`
          : `<div class="row" style="justify-content:space-between"><b><span class="badge open">Normalmodus</span></b><button class="btn primary" id="modeBtn">Prüfung starten …</button></div>
             <p class="note">Die Schüler arbeiten wie gewohnt mit Beispielen, Aufgaben und Hilfe-Knopf.</p>`;
        $('#modeBtn').onclick = () => exam
          ? dialog(`<h2>Prüfung beenden?</h2><p>Die Werkstatt ist für alle Schüler wieder normal benutzbar. Die Abgaben bleiben unter „Abgaben“ gespeichert.</p>${btns('Prüfung beenden')}`, async () => { await api('raum-modus', { klasse: id, modus: 'normal', aufgabe: '' }); delete mb.dataset.modus; draw(); })
          : dialog(`<h2>Prüfung starten</h2><p>Jeder Schüler bekommt ein neues, leeres Prüfungsprojekt. Gesperrt sind Beispiele, Aufgaben, Hilfe, ältere Projekte und Einfügen von außen. Verlässt jemand die Werkstatt, siehst du es auf der Kachel.</p>
              <div class="form"><label>Aufgabenstellung (optional, erscheint in der Werkstatt)</label><textarea name="aufgabe" placeholder="z. B. Baue eine Ampel mit Fußgängertaster …"></textarea></div>${btns('Prüfung starten')}`,
            async f => { await api('raum-modus', { klasse: id, modus: 'pruefung', aufgabe: f.aufgabe.value }); delete mb.dataset.modus; draw(); });
        if (exam) $('#taskBtn').onclick = async () => { await api('raum-modus', { klasse: id, modus: 'pruefung', aufgabe: $('#task').value }); toast('Aufgabenstellung aktualisiert.'); };
      }
      if (exam && $('#doneCnt')) $('#doneCnt').textContent = `Abgegeben: ${r.schueler.filter(s => valid(s.abgegeben)).length} von ${r.schueler.length}`;
      const byT = {};
      r.schueler.forEach(s => { (byT[parseInt(s.tisch, 10)] = byT[parseInt(s.tisch, 10)] || []).push(s); });
      $('#tiles').innerHTML = Array.from({ length: 18 }, (_, i) => i + 1).map(n => {
        const list = (byT[n] || []).sort((a, b) => a.vorname.localeCompare(b.vorname));
        return `<div class="tile ${list.length ? '' : 'empty'}"><div class="nr">Tisch ${n}</div>${list.map(s => {
          const left = (s.ereignisse || []).filter(e => e.art === 'verlassen');
          const last = (s.ereignisse || []).filter(e => e.art === 'zurueck').slice(-1)[0];
          const done = exam && valid(s.abgegeben);
          return `<div class="stu ${s.draussen ? 'out' : ''} ${done ? 'done' : ''}" data-key="${esc(s.key)}">
            <div class="n"><span class="dot ${s.online ? 'on' : ''}" title="${s.online ? 'Werkstatt geöffnet' : 'nicht verbunden'}"></span>${esc(s.vorname)}</div>
            <div class="p" title="${esc(s.projekt)}">${esc((s.projekt || '').split(' – ').slice(2).join(' – ') || s.projekt || '–')}</div>
            <div class="t">geändert ${ago(s.geaendert, r.jetzt)}</div>
            ${done ? `<div class="t"><span class="badge ok">abgegeben ${clock(s.abgegeben)}</span></div>` : ''}
            ${left.length ? `<div class="ev">${s.draussen ? 'ist gerade außerhalb!' : `${left.length}× verlassen${last ? `, zuletzt ${clock(last.zeit)} (${last.dauer} s)` : ''}`}</div>` : ''}</div>`;
        }).join('')}</div>`;
      }).join('');
      $('#tiles').querySelectorAll('.stu').forEach(el => el.onclick = () => this.viewStudent(id, el.dataset.key));
      if (this.viewerKey) this.updateViewerSide();
    };
    await draw();
    this.timer = setInterval(draw, 3000);
  },

  /* Großansicht eines Schülerprojekts (Werkstatt im Ansichtsmodus) */
  viewer(url, side) {
    this.closeViewer();
    const v = document.createElement('div');
    v.className = 'viewer'; v.id = 'viewer';
    v.innerHTML = `<div class="box"><iframe src="app/index.html?ansicht=${encodeURIComponent(new URL(url, location.href).href)}"></iframe><div class="side">${side}<button class="btn" id="vClose">Schließen</button></div></div>`;
    document.body.append(v);
    v.addEventListener('click', e => { if (e.target === v) this.closeViewer(); });
    $('#vClose').onclick = () => this.closeViewer();
    this.escH = e => { if (e.key === 'Escape') this.closeViewer(); };
    document.addEventListener('keydown', this.escH);
    return v;
  },
  closeViewer() { const v = $('#viewer'); if (v) v.remove(); this.viewerKey = null; if (this.escH) document.removeEventListener('keydown', this.escH); },

  async viewStudent(klasse, key, file) {
    const s = (this.lastRoom.schueler || []).find(x => x.key === key) || { vorname: key, tisch: '' };
    let projs = [];
    try { projs = (await api('schueler?klasse=' + encodeURIComponent(klasse))).find(x => x.key === key)?.projekte || []; } catch (e) { projs = []; }
    const cur = file || (projs[0] && projs[0].file) || '';
    const url = `lehrer/api/projekt?klasse=${encodeURIComponent(klasse)}&schueler=${encodeURIComponent(key)}&file=${encodeURIComponent(cur)}`;
    this.viewer(url, `<h3>${esc(s.vorname)} · Tisch ${esc(parseInt(s.tisch, 10) || '')}</h3>
      <label class="note">Projekt</label><select id="vProj">${projs.map(p => `<option ${p.file === cur ? 'selected' : ''} value="${esc(p.file)}">${esc(p.file.replace(/\.awp$/, ''))}</option>`).join('') || '<option>noch keins gespeichert</option>'}</select>
      <div id="vInfo"></div>
      <a class="btn" href="${url}&download=1">Herunterladen (.awp)</a>
      <button class="btn" id="vEx">Als Beispiel speichern …</button>
      <button class="btn small" id="vRemove" title="Kachel entfernen (z. B. falscher Tisch). Die Projekte bleiben erhalten.">Von der Kachel entfernen</button>`);
    this.viewerKey = key; this.viewerClass = klasse;
    $('#vProj').onchange = e => this.viewStudent(klasse, key, e.target.value);
    $('#vEx').onclick = () => this.exampleDialog({ klasse, schueler: key, file: cur });
    $('#vRemove').onclick = async () => { await api('schueler-entfernen', { klasse, schueler: key }); this.closeViewer(); };
    this.updateViewerSide();
  },
  updateViewerSide() {
    const box = $('#vInfo'); if (!box || !this.lastRoom) return;
    const s = (this.lastRoom.schueler || []).find(x => x.key === this.viewerKey);
    if (!s) { box.innerHTML = ''; return; }
    const exam = this.lastRoom.modus === 'pruefung';
    const ev = (s.ereignisse || []);
    box.innerHTML = `<p class="note">${s.online ? '● Werkstatt geöffnet' : '○ nicht verbunden'} · geändert ${ago(s.geaendert, this.lastRoom.jetzt)}</p>
      ${exam ? (valid(s.abgegeben) ? `<p><span class="badge ok">abgegeben um ${clock(s.abgegeben)}</span></p><button class="btn small" id="vUnsub">Abgabe zurücknehmen</button>` : '<p class="note">noch nicht abgegeben</p>') : ''}
      ${ev.length ? `<p class="note" style="margin-bottom:2px">Werkstatt verlassen:</p><ul class="evlist">${ev.filter(e => e.art === 'zurueck' || e.art === 'verlassen').map(e => `<li>${clock(e.zeit)} ${e.art === 'verlassen' ? 'verlassen' : `zurück (${e.dauer} s außerhalb)`}</li>`).join('')}</ul>` : ''}`;
    const u = $('#vUnsub');
    if (u) u.onclick = async () => { await api('abgabe-zuruecknehmen', { klasse: this.viewerClass, schueler: this.viewerKey }); toast('Abgabe zurückgenommen – der Schüler kann weiterarbeiten.'); };
  },

  exampleDialog(src) {
    dialog(`<h2>Als Beispiel speichern</h2><div class="form"><label>Titel</label><input name="titel" value="${esc((src.file || '').replace(/\.awp$/, '').split(' – ').slice(2).join(' – '))}" required>
      <label>Kurze Beschreibung</label><input name="beschreibung" placeholder="Was zeigt das Beispiel?">
      <label><input type="checkbox" name="alle" style="width:auto"> für alle Lehrkräfte freigeben (sonst nur für meine Klassen)</label></div>${btns('Speichern')}`,
      async f => { await api('beispiel-aus-projekt', Object.assign({}, src, { titel: f.titel.value, beschreibung: f.beschreibung.value, alle: f.alle.checked })); toast('Beispiel gespeichert. Die Schüler finden es unter „Beispiel öffnen“.'); });
  },

  /* ---------- Projekte einer Klasse ---------- */
  async projects(id) {
    const [classes, list] = await Promise.all([api('klassen'), api('schueler?klasse=' + encodeURIComponent(id))]);
    const c = classes.find(x => x.id === id) || { name: '' };
    list.sort((a, b) => a.tisch.localeCompare(b.tisch) || String(a.vorname).localeCompare(String(b.vorname)));
    main.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Projekte ${esc(c.name)}</h1><div class="row"><button class="btn small" id="back">← Klassen</button>${c.code ? '<button class="btn small" id="toRoom">Klassenzimmer</button>' : ''}</div></div>
      ${list.length ? `<table class="list"><tr><th>Tisch</th><th>Vorname</th><th>Projekte</th></tr>${list.map(s => `<tr><td>${parseInt(s.tisch, 10)}</td><td>${esc(s.vorname)}</td><td>${s.projekte.map(p => `<div class="row" style="margin:2px 0"><button class="link" data-k="${esc(s.key)}" data-f="${esc(p.file)}">${esc(p.file.replace(/\.awp$/, ''))}</button><span class="note">${ago(p.modified)}</span></div>`).join('') || '<span class="note">–</span>'}</td></tr>`).join('')}</table>` : '<p class="note">Noch keine Projekte in dieser Klasse.</p>'}`;
    $('#back').onclick = () => this.show('klassen');
    if ($('#toRoom')) $('#toRoom').onclick = () => this.show('raum', id);
    main.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
      const url = `lehrer/api/projekt?klasse=${encodeURIComponent(id)}&schueler=${encodeURIComponent(b.dataset.k)}&file=${encodeURIComponent(b.dataset.f)}`;
      this.viewer(url, `<h3>${esc(b.dataset.f.replace(/\.awp$/, ''))}</h3><a class="btn" href="${url}&download=1">Herunterladen (.awp)</a><button class="btn" id="vEx">Als Beispiel speichern …</button>`);
      $('#vEx').onclick = () => this.exampleDialog({ klasse: id, schueler: b.dataset.k, file: b.dataset.f });
    });
  },

  /* ---------- Abgaben ---------- */
  async submissions(id) {
    const [classes, list] = await Promise.all([api('klassen'), api('abgaben?klasse=' + encodeURIComponent(id))]);
    const c = classes.find(x => x.id === id) || { name: '' };
    const label = o => { const m = /^(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)$/.exec(o); return m ? `Prüfung vom ${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]} Uhr` : o; };
    main.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Abgaben ${esc(c.name)}</h1><button class="btn small" id="back">← Klassen</button></div>
      ${list.length ? list.map(a => `<h2>${esc(label(a.ordner))} <a class="btn small" href="lehrer/api/abgaben-zip?klasse=${encodeURIComponent(id)}&ordner=${encodeURIComponent(a.ordner)}">Alle als ZIP herunterladen</a></h2>
        <table class="list"><tr><th>Schüler</th><th>abgegeben</th><th></th></tr>${a.dateien.map(f => `<tr><td>${esc(f.file.replace(/\.awp$/, '').replace(/^(\d+)-/, 'Tisch $1 · '))}</td><td>${new Date(f.modified).toLocaleTimeString('de-DE')}</td>
        <td><button class="link" data-o="${esc(a.ordner)}" data-f="${esc(f.file)}">ansehen</button> · <a class="link" href="lehrer/api/abgabe?klasse=${encodeURIComponent(id)}&ordner=${encodeURIComponent(a.ordner)}&file=${encodeURIComponent(f.file)}&download=1">herunterladen</a></td></tr>`).join('')}</table>`).join('')
      : '<p class="note">Noch keine Abgaben. Im Prüfungsmodus geben die Schüler mit dem Knopf „Abgeben“ ab.</p>'}`;
    $('#back').onclick = () => this.show('klassen');
    main.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
      const url = `lehrer/api/abgabe?klasse=${encodeURIComponent(id)}&ordner=${encodeURIComponent(b.dataset.o)}&file=${encodeURIComponent(b.dataset.f)}`;
      this.viewer(url, `<h3>${esc(b.dataset.f.replace(/\.awp$/, ''))}</h3><p class="note">${esc(label(b.dataset.o))}</p><a class="btn" href="${url}&download=1">Herunterladen (.awp)</a><button class="btn" id="vEx">Als Beispiel speichern …</button>`);
      $('#vEx').onclick = () => this.exampleDialog({ klasse: id, ordner: b.dataset.o, file: b.dataset.f });
    });
  },

  /* ---------- Aufgaben und Beispiele ---------- */
  async contents() {
    const [tasks, ex] = await Promise.all([api('aufgaben'), api('beispiele')]);
    const share = (x, kind) => x.eigen || this.me.verwalter ? `<label><input type="checkbox" data-share="${kind}" data-id="${x.id}" ${x.alle ? 'checked' : ''}> für alle</label>` : (x.alle ? 'für alle' : '');
    main.innerHTML = `<h1>Aufgaben &amp; Beispiele</h1>
      <p class="note">Was hier liegt, sehen die Schüler deiner Klassen in der Werkstatt unter „Aufgabe wählen“ bzw. „Beispiel öffnen“ – zusätzlich zu den mitgelieferten. Mit „für alle“ sehen es auch die Klassen der anderen Lehrkräfte. Im Prüfungsmodus ist beides gesperrt.</p>
      <h2>Aufgaben <button class="btn small primary" id="upTask">+ Aufgabe hochladen (.aufgabe)</button></h2>
      ${tasks.length ? `<table class="list"><tr><th>Titel</th><th>von</th><th>Freigabe</th><th></th></tr>${tasks.map(t => `<tr><td>${esc(t.titel)}</td><td>${esc(t.von)}</td><td>${share(t, 'aufgabe')}</td><td><a class="link" href="lehrer/api/aufgabe?id=${t.id}">herunterladen</a>${t.eigen || this.me.verwalter ? ` · <button class="link" data-del="aufgabe" data-id="${t.id}" data-t="${esc(t.titel)}">löschen</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="note">Noch keine eigenen Aufgaben. Aufgaben erstellt man in der Werkstatt im Lehrkraft-Modus (Datei › Aufgaben) und lädt die .aufgabe-Datei hier hoch.</p>'}
      <h2>Beispiele <button class="btn small primary" id="upEx">+ Beispiel hochladen (.awp)</button></h2>
      ${ex.length ? `<table class="list"><tr><th>Titel</th><th>Beschreibung</th><th>Board</th><th>von</th><th>Freigabe</th><th></th></tr>${ex.map(e => `<tr><td>${esc(e.titel)}</td><td>${esc(e.beschreibung)}</td><td>${e.board === 'esp32' ? 'ESP32' : 'Uno'}</td><td>${esc(e.von)}</td><td>${share(e, 'beispiel')}</td>
        <td><button class="link" data-view="${e.id}" data-t="${esc(e.titel)}">ansehen</button> · <a class="link" href="lehrer/api/beispiel?id=${e.id}&download=1">herunterladen</a>${e.eigen || this.me.verwalter ? ` · <button class="link" data-del="beispiel" data-id="${e.id}" data-t="${esc(e.titel)}">löschen</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="note">Noch keine eigenen Beispiele. Ein Beispiel speichert man aus einem Schülerprojekt („Als Beispiel speichern“) oder lädt eine .awp-Datei hoch.</p>'}`;
    const pick = (accept, cb) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => i.files[0] && cb(i.files[0]); i.click(); };
    $('#upTask').onclick = () => pick('.aufgabe,.json', file => dialog(`<h2>Aufgabe hochladen</h2><p>${esc(file.name)}</p><div class="form"><label><input type="checkbox" name="alle" style="width:auto"> für alle Lehrkräfte freigeben</label></div>${btns('Hochladen')}`,
      async f => { await api('aufgabe-hochladen' + (f.alle.checked ? '?alle=1' : ''), file); this.contents(); }));
    $('#upEx').onclick = () => pick('.awp,.json', file => dialog(`<h2>Beispiel hochladen</h2><p>${esc(file.name)}</p><div class="form"><label>Titel</label><input name="titel" value="${esc(file.name.replace(/\.awp$/i, '').split(' – ').slice(2).join(' – ') || file.name.replace(/\.awp$/i, ''))}" required>
      <label>Kurze Beschreibung</label><input name="beschreibung"><label><input type="checkbox" name="alle" style="width:auto"> für alle Lehrkräfte freigeben</label></div>${btns('Hochladen')}`,
      async f => { await api(`beispiel-hochladen?titel=${encodeURIComponent(f.titel.value)}&beschreibung=${encodeURIComponent(f.beschreibung.value)}${f.alle.checked ? '&alle=1' : ''}`, file); this.contents(); }));
    main.querySelectorAll('[data-share]').forEach(cb => cb.onchange = async () => { try { await api(cb.dataset.share + '-freigabe', { id: cb.dataset.id, alle: cb.checked }); } catch (e) { toast(e.message); cb.checked = !cb.checked; } });
    main.querySelectorAll('[data-del]').forEach(b => b.onclick = () => dialog(`<h2>„${esc(b.dataset.t)}“ löschen?</h2>${btns('Löschen')}`, async () => { await api(b.dataset.del + '-loeschen', { id: b.dataset.id }); this.contents(); }));
    main.querySelectorAll('[data-view]').forEach(b => b.onclick = () => this.viewer('lehrer/api/beispiel?id=' + b.dataset.view, `<h3>${esc(b.dataset.t)}</h3>`));
  },

  /* ---------- Lehrkräfte (Verwalter) ---------- */
  async teachers() {
    const list = await api('lehrer');
    main.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Lehrkräfte</h1><button class="btn primary" id="newT">+ Lehrkraft anlegen</button></div>
      <table class="list"><tr><th>Name</th><th>Anmeldename</th><th>Klassen</th><th></th></tr>${list.map(t => `<tr><td>${esc(t.name)}${t.verwalter ? ' <span class="badge open">Verwalter</span>' : ''}${t.neu ? ' <span class="badge">Erstpasswort</span>' : ''}</td><td>${esc(t.login)}</td><td>${t.klassen}</td>
        <td><button class="link" data-pw="${t.id}" data-n="${esc(t.name)}">Passwort zurücksetzen</button>${t.id !== this.me.id ? ` · <button class="link" data-del="${t.id}" data-n="${esc(t.name)}">löschen</button>` : ''}</td></tr>`).join('')}</table>
      <p class="note">Neue Lehrkräfte bekommen ein Erstpasswort und werden beim ersten Anmelden gebeten, ein eigenes festzulegen. Jede Lehrkraft sieht nur ihre eigenen Klassen.</p>`;
    $('#newT').onclick = () => dialog(`<h2>Lehrkraft anlegen</h2><div class="form"><label>Name</label><input name="name" required><label>Anmeldename (klein, ohne Leerzeichen)</label><input name="login" required>
      <label>Erstpasswort (mindestens 8 Zeichen)</label><input name="passwort" required><label><input type="checkbox" name="verwalter" style="width:auto"> darf ebenfalls Lehrkräfte verwalten</label></div>${btns('Anlegen')}`,
      async f => { await api('lehrer-neu', { name: f.name.value, login: f.login.value, passwort: f.passwort.value, verwalter: f.verwalter.checked }); this.teachers(); });
    main.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => dialog(`<h2>Passwort für ${esc(b.dataset.n)} zurücksetzen</h2><div class="form"><label>Neues Erstpasswort (mindestens 8 Zeichen)</label><input name="p" required></div>${btns('Zurücksetzen')}`,
      async f => { await api('lehrer-passwort', { id: b.dataset.pw, passwort: f.p.value }); toast('Passwort zurückgesetzt.'); this.teachers(); }));
    main.querySelectorAll('[data-del]').forEach(b => b.onclick = () => dialog(`<h2>${esc(b.dataset.n)} löschen?</h2>${btns('Löschen')}`, async () => { await api('lehrer-loeschen', { id: b.dataset.del }); this.teachers(); }));
  },
};

document.querySelectorAll('#nav button').forEach(b => b.onclick = () => UI.show(b.dataset.view));
$('#btnLogout').onclick = async () => { await fetch('lehrer/api/abmelden', { method: 'POST' }); UI.loginScreen(); };
$('#btnPw').onclick = () => UI.passwordDialog(false);
UI.start();
