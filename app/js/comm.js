/* Anzeige „WLAN & Funk“ in der Simulation: WLAN-Status, die eigene Webseite (wie auf dem Handy)
   und Funk-Nachrichten. Außerdem die Eingabezeile des seriellen Monitors. */
'use strict';

const CommPanel = {
  sim: null,
  dragging: false,
  pending: false,

  init(app) {
    this.app = app;
    const box = document.querySelector('#comm');
    // Knöpfe und Schieberegler der simulierten Webseite
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-knopf]');
      if (b && this.sim && this.sim.web) { this.sim.web.buttons.set(b.dataset.knopf, true); b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 200); }
    });
    box.addEventListener('change', e => {
      if (e.target.matches('.bt-conn') && this.sim && this.sim.bt) { this.sim.bt.connected = e.target.checked; this.render(this.sim); }
    });
    box.addEventListener('pointerdown', e => { if (e.target.matches('input[type=range]')) this.dragging = true; });
    window.addEventListener('pointerup', () => { if (this.dragging) { this.dragging = false; if (this.pending) this.render(this.sim); } });
    box.addEventListener('input', e => {
      const r = e.target.closest('[data-regler]');
      if (r && this.sim && this.sim.web) { this.sim.web.sliders.set(r.dataset.regler, Number(r.value)); r.previousElementSibling.querySelector('b').textContent = r.value; }
    });
    // Funk: Nachricht eines anderen ESP32 vortäuschen
    box.addEventListener('submit', e => {
      e.preventDefault();
      const inp = e.target.querySelector('input');
      const t = inp.value.trim();
      if (!t || !this.sim || !this.sim.running) return;
      if (e.target.classList.contains('bt-in')) {
        if (!this.sim.bt || !this.sim.bt.connected) return;
        this.sim.btQ.push(t); this.sim.btLog.push({ out: false, text: t });
      } else {
        if (!this.sim.radio) return;
        this.sim.radioQ.push(t); this.sim.radioLog.push({ out: false, text: t });
      }
      inp.value = '';
      this.render(this.sim);
      inp.focus();
    });
    // Serieller Monitor: Text über USB an das Programm senden
    document.querySelector('#serialIn').addEventListener('submit', e => {
      e.preventDefault();
      const inp = document.querySelector('#serialText');
      const t = inp.value;
      if (!t) return;
      if (typeof SerialLink !== 'undefined' && SerialLink.connected) SerialLink.send(t).catch(() => app.toast('Senden fehlgeschlagen.'));
      else if (app.sim.running) app.sim.usbQ.push(t);
      else { app.toast('Starte die Simulation oder verbinde einen echten Mikrocontroller.'); return; }
      inp.value = '';
    });
  },

  render(sim) {
    this.sim = sim;
    const box = document.querySelector('#comm');
    if (!box) return;
    if (this.dragging) { this.pending = true; return; }
    this.pending = false;
    if (!sim || !sim.running) { box.innerHTML = '<p class="comm-idle">Starte die Simulation. Hier erscheinen dann WLAN, die eigene Webseite des ESP32 und Funk-Nachrichten.</p>'; return; }
    const w = sim.wifi;
    let wifi = '<p class="comm-off">Kein WLAN</p>';
    if (w && w.mode === 'sta') wifi = `<p>Verbunden mit <b>${esc(w.ssid)}</b><br>IP-Adresse: <b>${w.ip}</b></p>`;
    if (w && w.mode === 'ap') wifi = `<p>Eigenes WLAN <b>${esc(w.ssid)}</b> ist offen${w.pw ? '' : ' (ohne Passwort)'}<br>IP-Adresse: <b>${w.ip}</b></p>`;

    let web = '<p class="comm-off">Noch keine Webseite gestartet.</p>';
    if (sim.web) {
      const v = [...sim.web.values].map(([k, x]) => `<div class="ph-row"><span>${esc(k)}</span><b>${esc(x)}</b></div>`).join('');
      const b = [...sim.web.buttons.keys()].map(k => `<button type="button" class="ph-btn" data-knopf="${esc(k)}">${esc(k)}</button>`).join('');
      const s = [...sim.web.sliders].map(([k, x]) => `<div class="ph-row"><span>${esc(k)}</span><b>${x}</b></div><input type="range" min="0" max="100" value="${x}" data-regler="${esc(k)}">`).join('');
      web = `<div class="phone"><div class="ph-url">${w ? 'http://' + w.ip : 'kein WLAN – Seite nicht erreichbar'}</div><div class="ph-title">${esc(sim.web.title)}</div><div class="ph-body">${v}${b}${s || ''}</div></div>`;
    }
    let radio = '<p class="comm-off">Funk ist nicht eingerichtet.</p>';
    if (sim.radio) {
      const log = sim.radioLog.slice(-8).map(m => `<li class="${m.out ? 'out' : 'in'}">${m.out ? 'gesendet' : 'empfangen'}: ${esc(m.text)}</li>`).join('') || '<li class="comm-off">Noch keine Nachrichten.</li>';
      radio = `<ul class="radio-log">${log}</ul><form class="radio-in"><input type="text" placeholder="Nachricht eines anderen ESP32 …" spellcheck="false"><button class="btn small">empfangen</button></form>`;
    }
    let bt = '<p class="comm-off">Bluetooth ist nicht eingerichtet.</p>';
    if (sim.bt) {
      const log = sim.btLog.slice(-8).map(m => `<li class="${m.out ? 'out' : 'in'}">${m.out ? 'an Handy' : 'vom Handy'}: ${esc(m.text)}</li>`).join('') || '<li class="comm-off">Noch keine Nachrichten.</li>';
      bt = `<label class="bt-c"><input type="checkbox" class="bt-conn" ${sim.bt.connected ? 'checked' : ''}> Handy verbunden</label><ul class="radio-log">${log}</ul><form class="radio-in bt-in"><input type="text" placeholder="Nachricht vom Handy …" spellcheck="false"><button class="btn small">senden</button></form>`;
    }
    // Eingaben beim Neuzeichnen erhalten
    const keep = [...box.querySelectorAll('.radio-in input')].map(i => ({ bt: i.closest('.bt-in') !== null, v: i.value, f: document.activeElement === i }));
    box.innerHTML = `<div class="comm-grid">
      <section><h4>WLAN</h4>${wifi}</section>
      <section><h4>Webseite <small>(so sieht sie im Browser aus)</small></h4>${web}</section>
      <section><h4>Funk${sim.radio ? ' – Gruppe ' + sim.radio.group : ''}</h4>${radio}</section>
      <section><h4>Bluetooth${sim.bt ? ' – ' + esc(sim.bt.name) : ''}</h4>${bt}</section>
    </div>`;
    for (const k of keep) {
      const nu = box.querySelector(k.bt ? '.bt-in input' : '.radio-in:not(.bt-in) input');
      if (nu) { nu.value = k.v; if (k.f) nu.focus(); }
    }
  },
};
