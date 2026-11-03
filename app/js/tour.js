/* Einführungstour: führt beim ersten Start Schritt für Schritt durch die wichtigsten Teile der Werkstatt.
   Wieder aufrufbar über die Bedienhilfe („?“ unten links oder F1). */
'use strict';

const Tour = {
  KEY: 'werkstatt.tour',
  i: 0,
  steps: [
    { sel: null, title: 'Willkommen in der Arduino-Werkstatt!', text: 'Hier baust du Schaltungen, programmierst sie mit Blöcken, probierst sie in der Simulation aus und lädst das Programm auf den echten Arduino oder ESP32.<br><br>Diese kurze Tour zeigt dir in einer Minute das Wichtigste.' },
    { sel: '#projName', title: 'Dein Projekt', text: 'Hier steht der Name deines Projekts: <b>Tisch-Nr – Vorname – Projekt</b>. Alles wird automatisch gespeichert – du musst nie auf „Speichern“ klicken.' },
    { sel: '#parts', title: 'Die Bauteile', text: 'Ziehe Bauteile mit der Maus auf die Werkbank. Am schnellsten geht der Start mit der Vorlage <b>„Arduino + Steckplatine“</b> ganz oben.<br>Weitere Bauteile (z. B. Motoren) schaltest du über <b>„Erweiterungen …“</b> dazu.', place: 'left' },
    { sel: '#stage', title: 'Die Werkbank', text: '<b>Kabel:</b> auf einen Anschluss klicken, dann auf das Ziel.<br><b>Bauteil drehen:</b> anklicken und Taste <b>R</b>.<br><b>Löschen:</b> Taste <b>Entf</b>.<br><b>Eigenschaften</b> (z. B. Farbe der LED, Größe des Widerstands): Bauteil anklicken.', place: 'center' },
    { sel: '#zoomFit', title: 'Startansicht', text: 'Zoomen mit dem Mausrad. Wenn du dich „verirrt“ hast: <b>Startansicht</b> zeigt wieder die ganze Schaltung.', place: 'top' },
    { sel: '#modeCode', title: 'Programmieren', text: 'Mit <b>„Code“</b> wechselst du zum Programmieren, mit <b>„Bauteile“</b> zurück zur Schaltung.', place: 'bottom' },
    { sel: '.blocklyToolboxDiv', mode: 'code', title: 'Blöcke', text: 'Links findest du die Blöcke, nach Farben sortiert. Ziehe sie in <b>„beim Start“</b> (läuft einmal) oder <b>„für immer“</b> (wiederholt sich ständig). Die Blöcke rasten untereinander ein.', place: 'right' },
    { sel: '#tabBoth', mode: 'code', title: 'Auch als Text', text: '<b>„Blöcke + Text“</b> zeigt dir dein Programm zusätzlich als echten Arduino-Code (C++). So lernst du nebenbei, wie „richtige“ Programme aussehen.', place: 'bottom' },
    { sel: '#simBtn', mode: 'parts', title: 'Simulation', text: 'Probiere dein Programm aus, bevor du es hochlädst: LEDs leuchten, Motoren drehen sich, Taster kannst du mit der Maus drücken.', place: 'bottom' },
    { sel: '#bottom', title: 'Prüfung und serieller Monitor', text: 'Unten meldet die Werkstatt Fehler in der Schaltung, z. B. eine LED ohne Vorwiderstand. Im <b>seriellen Monitor</b> erscheinen Ausgaben deines Programms.', place: 'top' },
    { sel: '#adviceBtn', title: 'Hilfe-Knopf', text: 'Du kommst nicht weiter? <b>„Hilfe“</b> prüft Schaltung und Programm und gibt dir Tipps – ohne die Lösung zu verraten.', place: 'bottom' },
    { sel: '#uploadBtn', title: 'Hochladen', text: 'Arduino per USB anstecken und auf <b>„Hochladen“</b> klicken – die Werkstatt findet den Anschluss selbst und überträgt dein Programm.', place: 'bottom' },
    { sel: '#fileBtn', title: 'Datei', text: 'Hier findest du <b>Aufgaben</b> mit Prüfknopf, fertige <b>Beispiele</b>, ältere Fassungen deines Projekts und vieles mehr.', place: 'bottom' },
    { sel: '#helpBtn', title: 'Viel Spaß!', text: 'Alle Tastenkürzel findest du unter <b>„?“</b> (oder Taste F1). Dort kannst du diese Tour auch jederzeit wieder starten.', place: 'top' },
  ],

  done() { try { return localStorage.getItem(this.KEY) === 'fertig'; } catch (e) { return true; } },

  // Beim ersten Start (nachdem ein Projekt geöffnet wurde) – nicht im Ansichts- und Prüfungsmodus
  maybeStart(app) {
    this.app = app;
    if (this.done() || app.viewer || (typeof School !== 'undefined' && School.exam())) return;
    if (navigator.webdriver && !/[?&]tour/.test(location.search)) return; // automatische Tests
    this.start(app);
  },

  start(app) {
    this.app = app || this.app;
    this.stop(true);
    this.mode0 = $('#main').classList.contains('mode-code') ? 'code' : 'parts';
    this.box = document.createElement('div');
    this.box.className = 'tour';
    this.box.innerHTML = '<div class="tour-hole"></div><div class="tour-card" role="dialog" aria-live="polite"></div>';
    document.body.append(this.box);
    this.keyH = e => {
      if (e.key === 'Escape') { e.preventDefault(); this.stop(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); this.go(this.i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.i - 1); }
    };
    document.addEventListener('keydown', this.keyH, true);
    this.resH = () => this.place();
    window.addEventListener('resize', this.resH);
    this.go(0);
  },

  go(n) {
    if (n >= this.steps.length) { this.stop(); return; }
    if (n < 0) return;
    this.i = n;
    const s = this.steps[n];
    if (s.mode) this.app.setMode(s.mode);
    const card = this.box.querySelector('.tour-card');
    card.innerHTML = `<div class="tour-step">${n + 1} / ${this.steps.length}</div><h3>${s.title}</h3><p>${s.text}</p>
      <div class="tour-btns"><button class="btn ghost small" data-t="skip">${n === this.steps.length - 1 ? '' : 'Tour beenden'}</button><span></span>
      ${n ? '<button class="btn small" data-t="back">Zurück</button>' : ''}<button class="btn primary small" data-t="next">${n === this.steps.length - 1 ? 'Los geht’s!' : n ? 'Weiter' : 'Tour starten'}</button></div>`;
    card.querySelector('[data-t=skip]').hidden = n === this.steps.length - 1;
    card.onclick = e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      if (t.dataset.t === 'next') this.go(this.i + 1);
      else if (t.dataset.t === 'back') this.go(this.i - 1);
      else this.stop();
    };
    // Layout erst nach dem Umschalten der Ansicht messen
    requestAnimationFrame(() => requestAnimationFrame(() => { this.place(); card.querySelector('[data-t=next]').focus(); }));
  },

  place() {
    if (!this.box) return;
    const s = this.steps[this.i], hole = this.box.querySelector('.tour-hole'), card = this.box.querySelector('.tour-card');
    const el = s.sel && document.querySelector(s.sel);
    const r = el && el.getBoundingClientRect();
    const W = innerWidth, H = innerHeight, cw = Math.min(360, W - 32);
    card.style.width = cw + 'px';
    if (!r || !r.width) {
      Object.assign(hole.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
      const ch = card.offsetHeight;
      Object.assign(card.style, { left: (W - cw) / 2 + 'px', top: Math.max(16, (H - ch) / 2) + 'px' });
      return;
    }
    const pad = 6;
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px' });
    const ch = card.offsetHeight, gap = 14;
    let x, y;
    const place = s.place || 'bottom';
    if (place === 'center') { x = r.left + (r.width - cw) / 2; y = r.top + (r.height - ch) / 2; }
    else if (place === 'left') { x = r.left - cw - gap; y = r.top + 40; }
    else if (place === 'right') { x = r.right + gap; y = r.top + 40; }
    else if (place === 'top') { x = r.left; y = r.top - ch - gap; }
    else { x = r.left + r.width / 2 - cw / 2; y = r.bottom + gap; }
    x = Math.max(16, Math.min(W - cw - 16, x));
    y = Math.max(16, Math.min(H - ch - 16, y));
    Object.assign(card.style, { left: x + 'px', top: y + 'px' });
  },

  stop(silent) {
    if (!this.box) return;
    this.box.remove(); this.box = null;
    document.removeEventListener('keydown', this.keyH, true);
    window.removeEventListener('resize', this.resH);
    try { localStorage.setItem(this.KEY, 'fertig'); } catch (e) { /* ohne Speicher */ }
    if (this.app && this.mode0) this.app.setMode(this.mode0);
    if (!silent && this.app) this.app.toast('Die Tour findest du jederzeit wieder unter „?“ unten links.');
  },
};
