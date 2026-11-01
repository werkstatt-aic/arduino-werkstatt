/* Aufgabenkarten: Ziel, benötigte Bauteile, gestufte Tipps, Startvorlage und automatische Prüfung
   in der Simulation. Eigene Aufgaben der Lehrkraft liegen im Ordner „Aufgaben“ (über das Startprogramm),
   ohne Startprogramm im Browser. Gelöste Aufgaben werden abgehakt. */
'use strict';

const TASK_LEVELS = ['Grundlagen', 'Sensoren', 'Motoren', 'Kommunikation'];

/* Bauteilgruppen: „ein Taster“ darf jeder Taster sein usw. */
const PART_GROUPS = {
  button: { name: 'Taster', types: ['button', 'button2', 'pushbutton', 'touch'] },
  motor: { name: 'Motor (Lüfter oder Getriebemotor)', types: ['motor', 'gearmotor'] },
  driver: { name: 'Motortreiber', types: ['mdriver', 'l298n'] },
  moist: { name: 'Feuchtesensor', types: ['moisture', 'soil'] },
  temp: { name: 'Temperatursensor', types: ['dht', 'tmp36', 'ntc'] },
};
const partTypes = t => PART_GROUPS[t] ? PART_GROUPS[t].types : [t];
const partName = t => PART_GROUPS[t] ? PART_GROUPS[t].name : (COMPONENTS[t] ? COMPONENTS[t].name : t);

/* Sensoren, die die Prüfung verstellen kann: Eigenschaft, Name, Einheit, zwei Prüfwerte */
const TASK_SENSORS = {
  ldr: { prop: 'light', name: 'die Helligkeit', unit: '%', a: 5, b: 90 },
  ntc: { prop: 'temp', name: 'die Temperatur', unit: '°C', a: 10, b: 35 },
  tmp36: { prop: 'temp', name: 'die Temperatur', unit: '°C', a: 10, b: 35 },
  dht: { prop: 'temp', name: 'die Temperatur', unit: '°C', a: 10, b: 35, slow: true },
  poti: { prop: 'position', name: 'die Stellung', unit: '%', a: 5, b: 95 },
  moisture: { prop: 'wet', name: 'die Feuchtigkeit', unit: '%', a: 5, b: 90 },
  soil: { prop: 'wet', name: 'die Feuchtigkeit', unit: '%', a: 5, b: 90 },
  ultrasonic: { prop: 'dist', name: 'der Abstand', unit: 'cm', a: 10, b: 150 },
};
const WATCH_NAMES = { out: 'Ausgänge (LEDs, Summer, Motoren …)', serial: 'serieller Monitor', lcd: 'LCD-Anzeige' };
const CHANNEL_NAMES = { bt: 'Bluetooth', usb: 'USB (serieller Monitor)', radio: 'Funk' };

/* ---------- Prüfungen ----------
   label(p): Text für die Schüler; params: Felder im Aufgaben-Editor; kind: 'static' (ohne Simulation),
   'passive' (Beobachtung nach dem Start) oder 'active' (die Prüfung drückt Taster, verstellt Sensoren …) */
const TASK_CHECKS = {
  part: {
    title: 'Bauteil in der Schaltung', kind: 'static',
    params: [{ key: 'type', label: 'Bauteil', type: 'part' }, { key: 'n', label: 'Anzahl mindestens', type: 'number', def: 1 }],
    label: p => `Die Schaltung enthält ${Number(p.n) > 1 ? `mindestens ${p.n} × ` : ''}${partName(p.type)}.`,
    run(ctx, p) {
      const n = ctx.app.project.components.filter(c => partTypes(p.type).includes(c.type)).length;
      return n >= (Number(p.n) || 1) ? { ok: true } : { ok: false, hint: n ? `Es sind erst ${n} eingebaut.` : 'Das Bauteil fehlt noch.' };
    },
  },
  block: {
    title: 'Block im Programm', kind: 'static',
    params: [{ key: 'type', label: 'Block', type: 'block' }],
    label: p => `Das Programm verwendet den Block „${p.label || p.type}“.`,
    run(ctx, p) {
      const used = ctx.app.workspace.getAllBlocks(false).some(b => b.type === p.type && b.isEnabled());
      return used ? { ok: true } : { ok: false, hint: 'Dieser Block fehlt noch im Programm (oder hängt nirgends an).' };
    },
  },
  light: {
    title: 'LEDs leuchten', kind: 'passive',
    params: [{ key: 'n', label: 'Anzahl LEDs mindestens', type: 'number', def: 1 }],
    label: p => Number(p.n) > 1 ? `Mindestens ${p.n} LEDs leuchten.` : 'Eine LED leuchtet.',
    run(ctx, p) {
      const n = Object.keys(ctx.rec.ledMax).filter(id => ctx.rec.ledMax[id] > 0.3).length;
      return n >= (Number(p.n) || 1) ? { ok: true } : { ok: false, hint: n ? `Es leuchten nur ${n} LEDs.` : 'Keine LED leuchtet. Stimmt die Richtung der LED (langes Bein zu +)? Ist der Anschluss im Programm derselbe wie in der Schaltung?' };
    },
  },
  blink: {
    title: 'LED blinkt im Takt', kind: 'passive', long: true,
    params: [{ key: 'ms', label: 'An- und Aus-Zeit je (ms)', type: 'number', def: 1000 }],
    label: p => `Eine LED blinkt: je etwa ${fmtMs(p.ms)} an und ${fmtMs(p.ms)} aus.`,
    run(ctx, p) {
      const ms = Number(p.ms) || 1000, tol = Math.max(ms * 0.3, 150);
      let best = null;
      for (const id of Object.keys(ctx.rec.ledMax)) {
        const segs = onOffSegments(ctx.rec.samples, s => (s.led[id] || 0) > 0.3);
        if (segs.on.length < 1 || segs.off.length < 1) continue;
        const on = avg(segs.on), off = avg(segs.off);
        const ok = Math.abs(on - ms) <= tol && Math.abs(off - ms) <= tol;
        if (ok) return { ok: true };
        best = best || { on, off };
      }
      if (best) return { ok: false, hint: `Gemessen: etwa ${fmtMs(best.on)} an und ${fmtMs(best.off)} aus.` };
      return { ok: false, hint: 'Keine LED wechselt regelmäßig zwischen an und aus. Denk an das Warten nach dem Ein- und nach dem Ausschalten.' };
    },
    done: (rec, p) => rec.t > 4 * (Number(p.ms) || 1000) + 600,
  },
  sequence: {
    title: 'LEDs leuchten nacheinander', kind: 'passive', long: true,
    params: [{ key: 'n', label: 'Anzahl LEDs', type: 'number', def: 3 }],
    label: p => `${p.n} verschiedene LEDs leuchten nacheinander (nicht alle gleichzeitig).`,
    run(ctx, p) {
      const lit = Object.keys(ctx.rec.ledMax).filter(id => ctx.rec.ledMax[id] > 0.3);
      if (lit.length < (Number(p.n) || 3)) return { ok: false, hint: `Es haben nur ${lit.length} verschiedene LEDs geleuchtet.` };
      if (ctx.rec.maxTogether >= lit.length) return { ok: false, hint: 'Die LEDs leuchten immer alle gleichzeitig.' };
      return { ok: true };
    },
    done: (rec, p) => Object.keys(rec.ledMax).filter(id => rec.ledMax[id] > 0.3).length >= (Number(p.n) || 3) && rec.maxTogether < Object.keys(rec.ledMax).filter(id => rec.ledMax[id] > 0.3).length && rec.t > 2500,
  },
  dim: {
    title: 'LED leuchtet gedimmt', kind: 'passive',
    params: [],
    label: () => 'Eine LED leuchtet gedimmt (heller als aus, dunkler als voll).',
    run(ctx) {
      return ctx.rec.dimmed ? { ok: true } : { ok: false, hint: 'Keine LED leuchtet halb hell. Dafür braucht man „PWM-Ausgang … auf … einstellen“ an einem Anschluss mit ~.' };
    },
  },
  servo: {
    title: 'Servo bewegt sich', kind: 'passive',
    params: [],
    label: () => 'Der Servo dreht sich.',
    run(ctx) { return ctx.rec.servoRange >= 20 ? { ok: true } : { ok: false, hint: 'Der Servo hat sich nicht bewegt. Stimmt der Anschluss im Block?' }; },
  },
  motor: {
    title: 'Motor dreht sich', kind: 'passive',
    params: [],
    label: () => 'Ein Motor dreht sich.',
    run(ctx) { return ctx.rec.motorRan ? { ok: true } : { ok: false, hint: 'Kein Motor hat sich gedreht. Prüfe Treiber, Versorgung und die Anschlüsse im Block.' }; },
  },
  tone: {
    title: 'Summer ertönt', kind: 'passive',
    params: [],
    label: () => 'Der Summer gibt einen Ton aus.',
    run(ctx) { return ctx.rec.tone ? { ok: true } : { ok: false, hint: 'Der Summer war nicht zu hören.' }; },
  },
  serial: {
    title: 'Text im seriellen Monitor', kind: 'passive',
    params: [{ key: 'text', label: 'Text (leer = irgendeine Ausgabe)', type: 'text', def: '' }],
    label: p => p.text ? `Im seriellen Monitor erscheint „${p.text}“.` : 'Das Programm gibt etwas im seriellen Monitor aus.',
    run(ctx, p) {
      const all = (ctx.app.serialLog || []).map(l => l[1]).join('\n').toLowerCase();
      const ok = p.text ? all.includes(String(p.text).toLowerCase()) : all.trim().length > 0;
      return ok ? { ok: true } : { ok: false, hint: p.text ? 'Dieser Text ist nicht erschienen.' : 'Im seriellen Monitor ist nichts erschienen.' };
    },
  },
  lcd: {
    title: 'Text auf dem LCD', kind: 'passive',
    params: [{ key: 'text', label: 'Text (leer = irgendein Text)', type: 'text', def: '' }],
    label: p => p.text ? `Auf dem LCD steht „${p.text}“.` : 'Auf dem LCD erscheint ein Text.',
    run(ctx, p) {
      const all = ctx.rec.lcdTexts.join('\n').toLowerCase();
      const ok = p.text ? all.includes(String(p.text).toLowerCase()) : all.trim().length > 0;
      return ok ? { ok: true } : { ok: false, hint: 'Auf dem LCD ist das nicht erschienen. Stimmen SDA und SCL?' };
    },
  },
  button: {
    title: 'Taster bewirkt etwas', kind: 'active',
    params: [{ key: 'watch', label: 'Beobachten', type: 'watch', def: 'out' }],
    label: p => `Ein Tastendruck verändert etwas${p.watch && p.watch !== 'out' ? ` im Bereich ${WATCH_NAMES[p.watch]}` : ''}.`,
    async run(ctx, p) {
      const btns = ctx.app.project.components.filter(c => c.def.pressable || c.type === 'pir');
      if (!btns.length) return { ok: false, hint: 'Es ist kein Taster eingebaut.' };
      for (const b of btns) {
        const a = await ctx.window(p.watch, 1200);
        ctx.press(b, true);
        const m = await ctx.window(p.watch, 1200);
        ctx.press(b, false);
        const z = await ctx.window(p.watch, 1200);
        if (!sameSet(a, m) || !sameSet(m, z)) return { ok: true };
      }
      return { ok: false, hint: 'Beim Drücken hat sich nichts verändert. Prüfe Anschluss, Pull-down-Widerstand und die Abfrage im Programm.' };
    },
  },
  sensor: {
    title: 'Sensor bewirkt etwas', kind: 'active',
    params: [{ key: 'type', label: 'Sensor', type: 'sensor', def: 'ldr' }, { key: 'a', label: 'erster Wert', type: 'number' }, { key: 'b', label: 'zweiter Wert', type: 'number' }, { key: 'watch', label: 'Beobachten', type: 'watch', def: 'out' }],
    label: p => { const s = TASK_SENSORS[p.type] || {}; return `Wenn sich ${s.name ? `${s.name} am ${partName(p.type)}` : partName(p.type)} ändert (${p.a} → ${p.b} ${s.unit || ''}), ändert sich: ${WATCH_NAMES[p.watch || 'out']}.`; },
    async run(ctx, p) {
      const s = TASK_SENSORS[p.type];
      // verwandte Sensoren zählen auch (z. B. Feuchtefühler statt kapazitivem Feuchtesensor)
      const fam = Object.values(PART_GROUPS).find(g => g.types.includes(p.type));
      const types = fam ? fam.types.filter(t => TASK_SENSORS[t] && s && TASK_SENSORS[t].prop === s.prop) : [p.type];
      const comps = ctx.app.project.components.filter(c => types.includes(c.type));
      if (!s || !comps.length) return { ok: false, hint: `Der Sensor (${partName(p.type)}) fehlt.` };
      const w = comps.some(c => TASK_SENSORS[c.type].slow) ? 2600 : 1400;
      comps.forEach(c => ctx.setProp(c, s.prop, Number(p.a)));
      await ctx.wait(400);
      const A = await ctx.window(p.watch, w);
      comps.forEach(c => ctx.setProp(c, s.prop, Number(p.b)));
      await ctx.wait(400);
      const B = await ctx.window(p.watch, w);
      return !sameSet(A, B) ? { ok: true } : { ok: false, hint: `Bei ${p.a} und bei ${p.b} ${s.unit} passiert dasselbe. Liest das Programm den richtigen Anschluss? Passt die Schwelle?` };
    },
  },
  message: {
    title: 'Nachricht bewirkt etwas', kind: 'active',
    params: [{ key: 'ch', label: 'Weg', type: 'channel', def: 'bt' }, { key: 'a', label: 'erste Nachricht', type: 'text', def: 'an' }, { key: 'b', label: 'zweite Nachricht', type: 'text', def: 'aus' }, { key: 'watch', label: 'Beobachten', type: 'watch', def: 'out' }],
    label: p => `Die Nachrichten „${p.a}“ und „${p.b}“ per ${CHANNEL_NAMES[p.ch] || p.ch} bewirken Unterschiedliches.`,
    async run(ctx, p) {
      const S = ctx.app.sim;
      if (p.ch === 'bt' && !S.bt) return { ok: false, hint: 'Bluetooth wurde nicht eingerichtet (Block „Bluetooth einrichten“).' };
      if (p.ch === 'radio' && !S.radio) return { ok: false, hint: 'Funk wurde nicht eingerichtet.' };
      const send = t => { if (p.ch === 'bt') { S.btQ.push(t); S.btLog.push({ out: false, text: t }); } else if (p.ch === 'radio') { S.radioQ.push(t); S.radioLog.push({ out: false, text: t }); } else S.usbQ.push(t); };
      send(p.a); await ctx.wait(500);
      const A = await ctx.window(p.watch, 1200);
      send(p.b); await ctx.wait(500);
      const B = await ctx.window(p.watch, 1200);
      return !sameSet(A, B) ? { ok: true } : { ok: false, hint: 'Beide Nachrichten bewirken dasselbe. Vergleicht das Programm den empfangenen Text richtig?' };
    },
  },
  noerror: {
    title: 'Keine Fehler in der Prüfung', kind: 'final',
    params: [],
    label: () => 'Die Prüfung meldet keine Fehler oder Warnungen.',
    run(ctx) {
      const bad = [...ctx.app.sim.messages.values()].filter(m => m.level === 'error' || m.level === 'warn');
      return bad.length ? { ok: false, hint: bad[0].text } : { ok: true };
    },
  },
};

function firstSentence(g) { const m = g.match(/^.*?(?<!(?:^|\s)\p{L})[.!?](?=\s+\p{Lu}|\s*$)/su); return m ? m[0] : g; }
function fmtMs(ms) { ms = Number(ms) || 0; return ms >= 1000 ? (Math.round(ms / 100) / 10).toString().replace('.', ',') + ' s' : Math.round(ms) + ' ms'; }
function avg(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function sameSet(a, b) { if (a.size !== b.size) return false; for (const x of a) if (!b.has(x)) return false; return true; }
/* Dauer der vollständigen An- und Aus-Abschnitte (der erste und letzte Abschnitt sind abgeschnitten) */
function onOffSegments(samples, isOn) {
  const on = [], off = [];
  let state = null, since = null;
  for (const s of samples) {
    const v = isOn(s);
    if (state === null) { state = v; continue; }
    if (v !== state) {
      if (since !== null) (state ? on : off).push(s.t - since);
      state = v; since = s.t;
    }
  }
  return { on, off };
}

/* ---------- Mitgelieferte Aufgaben ---------- */
const BUILTIN_TASKS = [
  { id: 'g1', level: 'Grundlagen', board: 'uno', start: 'vorlage', title: 'LED einschalten',
    goal: 'Baue eine LED mit Vorwiderstand auf die Steckplatine und verbinde sie mit einem digitalen Anschluss. Schalte die LED im Programm ein.',
    tips: ['Die LED hat ein langes Bein (+, Anode) und ein kurzes (–, Kathode). Das kurze Bein zeigt Richtung GND.', 'Ohne Vorwiderstand geht die LED kaputt. 220 Ω passen gut.', 'Programm: In „beim Start“ den Block „Anschluss … auf HOCH setzen“ mit dem richtigen Anschluss.'],
    checks: [{ k: 'part', type: 'led', n: 1 }, { k: 'part', type: 'resistor', n: 1 }, { k: 'light', n: 1 }, { k: 'noerror' }] },
  { id: 'g2', level: 'Grundlagen', board: 'uno', start: 'vorlage', title: 'Blinklicht',
    goal: 'Eine LED soll immer wieder 1 Sekunde leuchten und 1 Sekunde aus sein.',
    tips: ['Was immer wieder passieren soll, gehört in „wiederhole fortlaufend“.', 'Nach dem Einschalten UND nach dem Ausschalten muss gewartet werden.', '1 Sekunde = 1000 Millisekunden.'],
    checks: [{ k: 'part', type: 'led', n: 1 }, { k: 'blink', ms: 1000 }, { k: 'noerror' }] },
  { id: 'g3', level: 'Grundlagen', board: 'uno', start: 'vorlage', title: 'Ampel',
    goal: 'Baue eine Verkehrsampel mit einer roten, einer gelben und einer grünen LED. Sie soll die Ampelphasen nacheinander durchlaufen: Rot – Rot+Gelb – Grün – Gelb – Rot …',
    tips: ['Jede LED braucht einen eigenen Anschluss und einen eigenen Vorwiderstand.', 'Die Farbe der LED stellst du bei der LED selbst ein (anklicken).', 'Schreibe die Phasen nacheinander: LEDs setzen, dann warten.'],
    checks: [{ k: 'part', type: 'led', n: 3 }, { k: 'sequence', n: 3 }, { k: 'noerror' }] },
  { id: 'g4', level: 'Grundlagen', board: 'uno', start: 'vorlage', title: 'Taster schaltet LED',
    goal: 'Solange der Taster gedrückt ist, leuchtet die LED. Lässt man los, geht sie aus.',
    tips: ['Ein Tastereingang braucht einen Pull-down-Widerstand (10 kΩ nach GND), sonst „schwebt“ er.', 'Der Taster verbindet den Eingang mit 5 V.', 'Programm: „wenn … dann … sonst“ mit „Anschluss … ist HOCH“.'],
    checks: [{ k: 'part', type: 'button', n: 1 }, { k: 'part', type: 'led', n: 1 }, { k: 'button', watch: 'out' }, { k: 'noerror' }] },
  { id: 'g5', level: 'Grundlagen', board: 'uno', start: 'vorlage', title: 'Lauflicht',
    goal: 'Mindestens 4 LEDs leuchten nacheinander auf – wie ein Lauflicht.',
    tips: ['Immer nur eine LED einschalten, kurz warten, wieder ausschalten, dann die nächste.', 'Mit „zähle … von … bis …“ und einer Liste der Anschlüsse geht es kürzer.'],
    checks: [{ k: 'part', type: 'led', n: 4 }, { k: 'sequence', n: 4 }, { k: 'noerror' }] },
  { id: 'g6', level: 'Grundlagen', board: 'uno', start: 'vorlage', title: 'LED dimmen (PWM)',
    goal: 'Eine LED soll nur halb hell leuchten.',
    tips: ['Halb hell geht mit dem Block „PWM-Ausgang … auf … einstellen“ (0 = aus, 255 = voll).', 'Nicht jeder Anschluss kann PWM. Schau auf den Arduino: Die PWM-Anschlüsse sind mit ~ gekennzeichnet.', 'Beim Arduino Uno sind das D3, D5, D6, D9, D10 und D11.'],
    checks: [{ k: 'part', type: 'led', n: 1 }, { k: 'dim' }, { k: 'noerror' }] },
  { id: 's1', level: 'Sensoren', board: 'uno', start: 'vorlage', title: 'Nachtlicht',
    goal: 'Wenn es dunkel wird, geht eine LED an. Ist es hell, bleibt sie aus.',
    tips: ['Der Fotowiderstand (LDR) bildet mit einem 10-kΩ-Widerstand einen Spannungsteiler. Die Mitte kommt an A0.', 'Lies den Wert mit „analogen Eingang A0 lesen“ und lass ihn dir im seriellen Monitor anzeigen.', 'Vergleiche den Wert mit einer Schwelle: „wenn Wert < … dann LED an, sonst aus“.'],
    checks: [{ k: 'part', type: 'ldr', n: 1 }, { k: 'part', type: 'led', n: 1 }, { k: 'sensor', type: 'ldr', a: 5, b: 90, watch: 'out' }, { k: 'noerror' }] },
  { id: 's2', level: 'Sensoren', board: 'uno', start: 'vorlage', title: 'Thermometer',
    goal: 'Miss mit dem Sensor DHT11 die Temperatur und zeige sie jede Sekunde im seriellen Monitor an, z. B. „Temperatur: 22 °C“.',
    tips: ['Der DHT11 hat drei Anschlüsse: + an 5 V, – an GND, out an einen digitalen Anschluss.', 'Den Block „Sensor DHT … lesen“ findest du unter „Eingang“.', 'Stelle im Block dieselbe Bauart (11 oder 22) ein wie in der Schaltung.'],
    checks: [{ k: 'part', type: 'dht', n: 1 }, { k: 'serial', text: '' }, { k: 'sensor', type: 'dht', a: 10, b: 35, watch: 'serial' }, { k: 'noerror' }] },
  { id: 's3', level: 'Sensoren', board: 'uno', start: 'vorlage', title: 'Abstandswarner',
    goal: 'Kommt etwas näher als 20 cm an den Ultraschallsensor, warnt die Schaltung mit einer LED oder dem Summer.',
    tips: ['Trig und Echo kommen an zwei digitale Anschlüsse, VCC an 5 V, GND an GND.', 'Der Block „Ultraschall-Abstandssensor …“ liefert den Abstand in cm.', '„wenn Abstand < 20 dann warnen, sonst aus“.'],
    checks: [{ k: 'part', type: 'ultrasonic', n: 1 }, { k: 'sensor', type: 'ultrasonic', a: 10, b: 150, watch: 'out' }, { k: 'noerror' }] },
  { id: 's4', level: 'Sensoren', board: 'uno', start: 'vorlage', title: 'Messreihe mit Mittelwert',
    goal: 'Miss die Helligkeit mit einem Fotowiderstand zweimal pro Sekunde. Speichere die letzten 10 Messwerte in einer Liste und gib den Mittelwert im seriellen Monitor aus. Speichere die Messreihe danach mit „Messwerte speichern“ als Tabelle.',
    tips: ['Lege die Liste in „beim Start“ an: „Liste … mit 10 Einträgen anlegen“.', 'Neue Messwerte mit „neuen Wert … hinten in Liste … nachschieben“ hineinschreiben.', 'Den Mittelwert liefert der Block „Mittelwert der Liste …“.'],
    checks: [{ k: 'part', type: 'ldr', n: 1 }, { k: 'block', type: 'list_push', label: 'neuen Wert hinten in Liste nachschieben' }, { k: 'block', type: 'list_stat', label: 'Mittelwert der Liste' }, { k: 'sensor', type: 'ldr', a: 10, b: 90, watch: 'serial' }, { k: 'noerror' }] },
  { id: 'm1', level: 'Motoren', board: 'uno', start: 'vorlage', title: 'Servo-Schranke',
    goal: 'Eine Schranke (Servo) öffnet sich auf 90°, wenn der Taster gedrückt wird, und schließt sich nach 3 Sekunden wieder (0°).',
    tips: ['Der Servo hat drei Kabel: braun = GND, rot = 5 V, orange = Signal.', 'Block „Servo an … auf … Grad drehen“.', 'Wenn Taster gedrückt: auf 90 drehen, 3000 ms warten, auf 0 drehen.'],
    checks: [{ k: 'part', type: 'servo', n: 1 }, { k: 'part', type: 'button', n: 1 }, { k: 'button', watch: 'out' }, { k: 'noerror' }] },
  { id: 'm2', level: 'Motoren', board: 'uno', start: 'vorlage', ext: ['motoren'], title: 'Lüfter mit Motortreiber',
    goal: 'Ein Lüfter soll über einen Motortreiber laufen: 3 Sekunden an, 2 Sekunden aus, immer wieder.',
    tips: ['Ein Motor braucht zu viel Strom für den Arduino-Anschluss. Darum kommt ein Motortreiber (L9110S oder L298N) dazwischen.', 'Der Treiber bekommt die Versorgung, der Arduino gibt nur die Steuersignale.', 'Block „Motor … drehen“ mit der Geschwindigkeit in %.'],
    checks: [{ k: 'part', type: 'motor', n: 1 }, { k: 'part', type: 'driver', n: 1 }, { k: 'motor' }, { k: 'noerror' }] },
  { id: 'm3', level: 'Motoren', board: 'uno', start: 'vorlage', ext: ['motoren'], title: 'Schrittmotor-Zeiger',
    goal: 'Ein Schrittmotor dreht einen Zeiger um 90° vor, wartet 1 Sekunde und dreht wieder zurück.',
    tips: ['Die Treiberplatine ULN2003 braucht IN1 bis IN4 an vier digitalen Anschlüssen und eine eigene Versorgung (+ und –).', 'Block „Schrittmotor … um … Grad drehen“.', 'Zurück geht es mit „gegen den Uhrzeigersinn“.'],
    checks: [{ k: 'part', type: 'stepper', n: 1 }, { k: 'motor' }, { k: 'noerror' }] },
  { id: 'm4', level: 'Motoren', board: 'uno', start: 'vorlage', ext: ['motoren'], title: 'Bewässerung mit Relais',
    goal: 'Ist die Erde zu trocken, schaltet ein Relais die Pumpe ein. Ist sie feucht genug, schaltet es wieder aus.',
    tips: ['Der Feuchtesensor liefert einen analogen Wert (A0).', 'Das Relais wird wie eine LED geschaltet: IN an einen digitalen Anschluss.', 'Den Pumpenstromkreis (eigene Spannungsquelle) schaltet das Relais über COM und NO.'],
    checks: [{ k: 'part', type: 'relay', n: 1 }, { k: 'part', type: 'moist', n: 1 }, { k: 'sensor', type: 'moisture', a: 5, b: 90, watch: 'out' }, { k: 'noerror' }] },
  { id: 'k1', level: 'Kommunikation', board: 'esp32', start: 'vorlage', title: 'Handy schaltet LED (Bluetooth)',
    goal: 'Schicke vom Handy „an“ oder „aus“ per Bluetooth an den ESP32. Die LED geht entsprechend an oder aus.',
    tips: ['In „beim Start“: „Bluetooth einrichten“.', 'In „wiederhole fortlaufend“: „wenn Bluetooth-Nachricht empfangen“, dann den empfangenen Text vergleichen.', 'In der Simulation schickst du Nachrichten im Reiter „WLAN, Funk & Bluetooth“.'],
    checks: [{ k: 'part', type: 'led', n: 1 }, { k: 'message', ch: 'bt', a: 'an', b: 'aus', watch: 'out' }, { k: 'noerror' }] },
  { id: 'k2', level: 'Kommunikation', board: 'esp32', start: 'vorlage', title: 'Befehle über USB',
    goal: 'Tippe im seriellen Monitor „an“ oder „aus“. Der ESP32 schaltet damit eine LED und antwortet mit „LED ist an“ bzw. „LED ist aus“.',
    tips: ['Unter „Kommunikation“ findest du „wenn USB-Nachricht empfangen“.', 'Vergleiche den empfangenen Text mit „an“ und „aus“.'],
    checks: [{ k: 'part', type: 'led', n: 1 }, { k: 'message', ch: 'usb', a: 'an', b: 'aus', watch: 'out' }, { k: 'serial', text: 'LED ist' }, { k: 'noerror' }] },
  { id: 'k3', level: 'Kommunikation', board: 'esp32', start: 'vorlage', title: 'Messwert auf der Webseite',
    goal: 'Der ESP32 öffnet ein eigenes WLAN und zeigt auf einer Webseite die Helligkeit eines Fotowiderstands an.',
    tips: ['„WLAN öffnen“ und „Webseite starten“ gehören in „beim Start“.', '„auf der Webseite anzeigen“ zeigt einen Wert mit Namen an.', 'In der Simulation siehst du die Webseite im Reiter „WLAN, Funk & Bluetooth“.'],
    checks: [{ k: 'part', type: 'ldr', n: 1 }, { k: 'block', type: 'com_web_start', label: 'Webseite starten' }, { k: 'block', type: 'com_web_show', label: 'auf der Webseite anzeigen' }, { k: 'noerror' }] },
];

/* ---------- Ablage: eigene Aufgaben und gelöste Aufgaben ---------- */
const TaskStore = {
  own: [], solved: {},
  async load(app) {
    this.app = app;
    if (app.launcher) {
      try { this.own = await (await app.api('tasks')).json(); } catch (e) { this.own = []; }
      try { this.solved = await (await app.api('solved')).json(); } catch (e) { this.solved = {}; }
    } else {
      try { this.own = JSON.parse(localStorage.getItem('werkstatt.aufgaben') || '[]'); } catch (e) { this.own = []; }
      try { this.solved = JSON.parse(localStorage.getItem('werkstatt.geloest') || '{}'); } catch (e) { this.solved = {}; }
    }
    this.own.forEach(t => { t.own = true; });
  },
  all() { return BUILTIN_TASKS.concat(this.own); },
  get(id) { return this.all().find(t => t.id === id); },
  async markSolved(id) {
    this.solved[id] = new Date().toISOString();
    try { localStorage.setItem('werkstatt.geloest', JSON.stringify(this.solved)); } catch (e) { /* ohne Speicher */ }
    if (this.app.launcher) { try { await this.app.api('solved', { method: 'POST', body: JSON.stringify(this.solved) }); } catch (e) { /* nicht schlimm */ } }
  },
  fileFor(t) { return (String(t.title).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Aufgabe') + '.aufgabe'; },
  clean(t) { const c = JSON.parse(JSON.stringify(t)); delete c.own; delete c.file; return c; },
  async save(t) {
    const data = this.clean(t);
    if (this.app.launcher) {
      const file = t.file || this.fileFor(t);
      if (!t.file && this.own.some(o => o.file === file)) throw new Error(`Eine Aufgabe „${t.title}“ gibt es schon. Bitte einen anderen Titel wählen.`);
      await this.app.api('task-save?file=' + encodeURIComponent(file), { method: 'POST', body: JSON.stringify(data, null, 1) });
      t.file = file;
    }
    t.own = true;
    const i = this.own.findIndex(o => o.id === t.id);
    if (i >= 0) this.own[i] = t; else this.own.push(t);
    if (!this.app.launcher) localStorage.setItem('werkstatt.aufgaben', JSON.stringify(this.own.map(o => this.clean(o))));
  },
  async remove(t) {
    if (this.app.launcher && t.file) await this.app.api('task-delete?file=' + encodeURIComponent(t.file), { method: 'POST' });
    this.own = this.own.filter(o => o.id !== t.id);
    if (!this.app.launcher) localStorage.setItem('werkstatt.aufgaben', JSON.stringify(this.own.map(o => this.clean(o))));
  },
};

/* ---------- Prüfen in der Simulation ---------- */
const TaskChecker = {
  running: false,

  /* Beobachtbarer Zustand als kurzer Text (für Vergleiche „hat sich etwas verändert?“) */
  signature(app, watch) {
    if (watch === 'serial') {
      const log = app.serialLog || [];
      const last = log.length ? log[log.length - 1][1] : '';
      return (last.match(/-?\d+(?:[.,]\d+)?/g) || [last]).join(' ');
    }
    const st = app.circuit.states, out = [];
    for (const c of app.project.components) {
      const s = st[c.id];
      if (watch === 'lcd') { if (c.type === 'lcd' && s) out.push(s.lines.join('/')); continue; }
      if (!s) continue;
      const q = b => b < 0.05 ? 0 : b < 0.85 ? 1 : 2;
      switch (c.type) {
        case 'led': out.push(q(s.brightness)); break;
        case 'uno': case 'esp32': case 'esp32exp': out.push(s.led ? 'L1' : 'L0'); break;
        case 'rgbled': out.push(s.rgb.map(q).join('')); break;
        case 'servo': out.push('s' + Math.round(s.angle / 15)); break;
        case 'motor': case 'gearmotor': out.push(s.running ? 'm' + s.dir : 'm0'); break;
        case 'stepper': out.push('st' + Math.round(s.angle / 20)); break;
        case 'piezo': out.push(s.sounding ? 'p1' : 'p0'); break;
        case 'relay': out.push(s.on ? 'r1' : 'r0'); break;
        case 'strip': case 'ring': out.push('n' + (s.pixels ? s.pixels.filter(p => p[0] + p[1] + p[2] > 20).length : 0)); break;
      }
    }
    return out.join('|');
  },

  async run(app, task, onProgress) {
    if (this.running) return null;
    this.running = true;
    const restore = [], results = [];
    const checks = (task.checks || []).filter(c => TASK_CHECKS[c.k]);
    const ctx = {
      app,
      wait: ms => new Promise(r => setTimeout(r, ms)),
      press(c, down) { app.sim.pressButton(c.id, down); },
      setProp(c, prop, v) {
        if (!restore.some(r => r.c === c && r.prop === prop)) restore.push({ c, prop, v: c.props[prop] });
        c.props[prop] = v; app.circuit.renderComp(c); if (app.sim.running) app.sim.update();
      },
      async window(watch, ms) {
        const set = new Set(), t0 = performance.now();
        while (performance.now() - t0 < ms) { set.add(TaskChecker.signature(app, watch)); await ctx.wait(60); }
        return set;
      },
      rec: null,
    };
    try {
      for (const c of checks.filter(c => TASK_CHECKS[c.k].kind === 'static')) results.push({ c, r: TASK_CHECKS[c.k].run(ctx, c) });
      const dyn = checks.filter(c => TASK_CHECKS[c.k].kind !== 'static');
      if (dyn.length) {
        onProgress && onProgress('Simulation läuft …');
        app.startSim();
        if (!app.sim.running) {
          for (const c of dyn) results.push({ c, r: { ok: false, hint: 'Die Simulation konnte nicht starten. Steckt ein Mikrocontroller in der Schaltung, der zur Auswahl oben passt?' } });
        } else {
          // 1) beobachten
          const passive = dyn.filter(c => TASK_CHECKS[c.k].kind === 'passive');
          const longest = passive.some(c => TASK_CHECKS[c.k].long) ? 12000 : 3000;
          ctx.rec = await this.record(app, ctx, passive, longest);
          const late = c => c.k === 'serial' && dyn.some(d => TASK_CHECKS[d.k].kind === 'active');
          for (const c of passive.filter(c => !late(c))) results.push({ c, r: crashed(app) || TASK_CHECKS[c.k].run(ctx, c) });
          // 2) ausprobieren
          for (const c of dyn.filter(c => TASK_CHECKS[c.k].kind === 'active')) {
            onProgress && onProgress(TASK_CHECKS[c.k].title + ' …');
            let r = crashed(app);
            if (!r) { try { r = await TASK_CHECKS[c.k].run(ctx, c); } catch (e) { r = { ok: false, hint: 'Prüfung nicht möglich: ' + e.message }; } }
            results.push({ c, r: crashed(app) || r });
          }
          for (const c of passive.filter(late)) results.push({ c, r: crashed(app) || TASK_CHECKS[c.k].run(ctx, c) });
          for (const c of dyn.filter(c => TASK_CHECKS[c.k].kind === 'final')) results.push({ c, r: crashed(app) || TASK_CHECKS[c.k].run(ctx, c) });
        }
      }
    } finally {
      for (const r of restore) { r.c.props[r.prop] = r.v; app.circuit.renderComp(r.c); }
      for (const c of app.project.components) if (app.sim.pressed && app.sim.pressed.has(c.id)) app.sim.pressButton(c.id, false);
      if (app.sim.running) app.stopSim();
      this.running = false;
    }
    // Reihenfolge wie in der Aufgabe
    return checks.map(c => ({ check: c, ...results.find(x => x.c === c).r }));
  },

  /* Beobachtet die Simulation, bis alle beobachtenden Prüfungen erfüllt sind (höchstens maxMs) */
  async record(app, ctx, passive, maxMs) {
    const rec = { t: 0, samples: [], ledMax: {}, maxTogether: 0, dimmed: false, servoMin: {}, servoMax: {}, servoRange: 0, motorRan: false, stepper0: {}, tone: false, lcdTexts: [] };
    const t0 = performance.now();
    while (app.sim.running) {
      rec.t = performance.now() - t0;
      const st = app.circuit.states, s = { t: rec.t, led: {} };
      let together = 0;
      for (const c of app.project.components) {
        const x = st[c.id]; if (!x) continue;
        if (c.type === 'led') {
          s.led[c.id] = x.brightness; rec.ledMax[c.id] = Math.max(rec.ledMax[c.id] || 0, x.brightness);
          if (x.brightness > 0.3) together++;
          if (x.brightness > 0.06 && x.brightness < 0.8) rec.dimmed = true;
        } else if (c.type === 'rgbled') {
          x.rgb.forEach(b => { if (b > 0.06 && b < 0.8) rec.dimmed = true; });
        } else if (c.type === 'servo') {
          rec.servoMin[c.id] = Math.min(rec.servoMin[c.id] ?? 0, x.angle); rec.servoMax[c.id] = Math.max(rec.servoMax[c.id] ?? 0, x.angle);
          rec.servoRange = Math.max(rec.servoRange, rec.servoMax[c.id] - rec.servoMin[c.id]);
        } else if (c.type === 'motor' || c.type === 'gearmotor') { if (x.running) rec.motorRan = true; }
        else if (c.type === 'stepper') { if (!(c.id in rec.stepper0)) rec.stepper0[c.id] = x.angle; else if (Math.abs(x.angle - rec.stepper0[c.id]) > 5) rec.motorRan = true; }
        else if (c.type === 'piezo') { if (x.sounding) rec.tone = true; }
        else if (c.type === 'lcd') { const l = x.lines.join('\n'); if (!rec.lcdTexts.includes(l)) rec.lcdTexts.push(l); }
      }
      rec.maxTogether = Math.max(rec.maxTogether, together);
      rec.samples.push(s);
      if (rec.t > maxMs) break;
      // früher fertig, wenn alles erfüllt ist
      if (rec.t > 1500 && passive.every(c => { const d = TASK_CHECKS[c.k]; return d.done ? d.done(rec, c) : (rec.t > 2500 && d.run({ app, rec }, c).ok); })) break;
      await ctx.wait(25);
    }
    return rec;
  },
};
function crashed(app) { return app.sim.running ? null : { ok: false, hint: 'Die Simulation wurde beendet – vermutlich ein Programmfehler (siehe Prüfung).' }; }

/* ---------- Oberfläche ---------- */
const TaskUi = {
  init(app) {
    this.app = app;
    this.panel = document.querySelector('#taskPanel');
    this.panel.addEventListener('click', e => this.onPanelClick(e));
  },

  /* Aufgabe des aktuellen Projekts (aus der Projektdatei) */
  get task() { return this.app.task; },

  render() {
    const t = this.task, p = this.panel;
    if (!t) { p.hidden = true; return; }
    p.hidden = false;
    p.classList.toggle('min', !!t.min);
    const solved = t.solved || !!TaskStore.solved[t.id];
    const shown = t.tipsShown || 0, tips = t.tips || [];
    const parts = (t.checks || []).filter(c => c.k === 'part').map(c => `${Number(c.n) > 1 ? c.n + ' × ' : ''}${esc(partName(c.type))}`);
    let h = `<div class="tp-head"><span class="tp-tag">${t.preview ? 'Testlauf' : 'Aufgabe'}</span><b>${esc(t.title)}</b>${solved && !t.preview ? '<span class="tp-solved" title="gelöst">✓</span>' : ''}<button class="tp-min" data-act="min" title="${t.min ? 'Aufgabe aufklappen' : 'Aufgabe einklappen'}">${t.min ? '▸' : '▾'}</button></div>`;
    if (!t.min) {
      h += `<div class="tp-body"><p class="tp-goal">${esc(t.goal || '').replace(/\n/g, '<br>')}</p>`;
      if (parts.length) h += `<div class="tp-sub">Du brauchst</div><ul class="tp-parts">${parts.map(x => `<li>${x}</li>`).join('')}</ul>`;
      if (tips.length) {
        h += `<div class="tp-sub">Tipps</div><ol class="tp-tips">${tips.slice(0, shown).map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
        if (shown < tips.length) h += `<button class="btn small ghost" data-act="tip">Tipp ${shown + 1} von ${tips.length} anzeigen</button>`;
      }
      if (t.results) {
        h += `<ul class="tp-res">${t.results.map(r => `<li class="${r.ok ? 'ok' : 'no'}"><span>${r.ok ? '✓' : '✗'}</span><div>${esc(TASK_CHECKS[r.check.k].label(r.check))}${r.ok || !r.hint ? '' : `<small>${esc(r.hint)}</small>`}</div></li>`).join('')}</ul>`;
        if (t.results.length && t.results.every(r => r.ok)) h += `<div class="tp-done">${t.preview ? 'Alle Prüfungen erfüllt.' : 'Geschafft! Die Aufgabe ist gelöst.'}</div>`;
      }
      h += `<div class="tp-btns"><button class="btn small primary" data-act="check" ${TaskChecker.running ? 'disabled' : ''}>${TaskChecker.running ? (this.progress || 'Prüfe …') : 'Aufgabe prüfen'}</button>`;
      if (t.preview) h += `<button class="btn small" data-act="back">Zurück zum Aufgaben-Editor</button>`;
      h += `</div></div>`;
    }
    p.innerHTML = h;
  },

  async onPanelClick(e) {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const t = this.task;
    if (a.dataset.act === 'min') { t.min = !t.min; this.render(); if (!t.preview) this.app.scheduleSave(); }
    else if (a.dataset.act === 'tip') { t.tipsShown = (t.tipsShown || 0) + 1; this.render(); if (!t.preview) this.app.scheduleSave(); }
    else if (a.dataset.act === 'back') { const d = t.preview; this.app.task = this.savedTask; this.render(); TaskEditor.open(this.app, d); }
    else if (a.dataset.act === 'check') {
      this.progress = 'Prüfe …';
      t.results = null; this.render();
      const res = await TaskChecker.run(this.app, t, msg => { this.progress = msg; this.render(); });
      if (!res) return;
      t.results = res; this.progress = '';
      if (!res.length) { this.progress = ''; this.render(); this.app.toast('Diese Aufgabe hat keine automatische Prüfung. Frag deine Lehrkraft.'); return; }
      if (!t.preview && res.every(r => r.ok)) { t.solved = true; await TaskStore.markSolved(t.id); this.app.toast('Geschafft! Die Aufgabe ist gelöst.'); }
      this.render();
      if (!t.preview) this.app.scheduleSave();
    }
  },

  /* Auswahl der Aufgaben, nach Stufen sortiert */
  async dialog() {
    const app = this.app;
    await TaskStore.load(app);
    const teacher = TaskEditor.teacherMode();
    const card = t => {
      const done = !!TaskStore.solved[t.id];
      return `<div class="tcard ${done ? 'done' : ''}"><button type="button" class="tcard-main" data-task="${esc(t.id)}"><span class="tcard-t"><b>${esc(t.title)}</b>${done ? '<span class="tp-solved">✓</span>' : ''}</span><small>${esc(firstSentence(t.goal || ''))}</small><span class="tcard-b">${t.board === 'esp32' ? 'ESP32' : 'Arduino Uno'}${t.own ? ' · eigene Aufgabe' : ''}</span></button>${teacher && t.own ? `<span class="tcard-tools"><button type="button" class="btn small ghost" data-edit="${esc(t.id)}">Bearbeiten</button><button type="button" class="btn small ghost" data-export="${esc(t.id)}">Exportieren</button><button type="button" class="btn small ghost danger" data-del="${esc(t.id)}">Löschen</button></span>` : ''}</div>`;
    };
    const all = TaskStore.all();
    const levels = TASK_LEVELS.concat([...new Set(all.map(t => t.level))].filter(l => !TASK_LEVELS.includes(l)));
    let h = `<h2>Aufgaben</h2><p>Wähle eine Aufgabe. Sie wird als <b>neues Projekt</b> angelegt. Mit „Aufgabe prüfen“ testet die Werkstatt in der Simulation, ob alles stimmt.</p>`;
    if (teacher) h += `<div class="tdlg-teacher"><button type="button" class="btn small" data-new="1">Neue Aufgabe aus dem aktuellen Projekt …</button><button type="button" class="btn small" data-import="1">Aufgabe importieren …</button><input type="file" id="taskImport" accept=".aufgabe,.json" hidden></div>`;
    for (const l of levels) {
      const list = all.filter(t => t.level === l);
      if (!list.length) continue;
      const n = list.filter(t => TaskStore.solved[t.id]).length;
      h += `<div class="start-sec">${esc(l)} <span class="tcount">${n} von ${list.length} gelöst</span></div><div class="tcards">${list.map(card).join('')}</div>`;
    }
    h += `<div class="dlg-btns"><button class="btn" value="cancel">Schließen</button></div>`;
    app.dialog(h);
    $('#dlg').classList.add('wide');
    const f = $('#dlgForm');
    $('#dlg').addEventListener('close', () => $('#dlg').classList.remove('wide'), { once: true });
    f.addEventListener('click', async e => {
      const q = k => e.target.closest('[data-' + k + ']');
      if (q('task')) this.start(TaskStore.get(q('task').dataset.task));
      else if (q('new')) TaskEditor.open(app, null);
      else if (q('edit')) TaskEditor.open(app, JSON.parse(JSON.stringify(TaskStore.get(q('edit').dataset.edit))));
      else if (q('export')) { const t = TaskStore.get(q('export').dataset.export); Export.download(new Blob([JSON.stringify(TaskStore.clean(t), null, 1)], { type: 'application/json' }), TaskStore.fileFor(t)); }
      else if (q('del')) {
        const t = TaskStore.get(q('del').dataset.del);
        if (!confirmInline(q('del'))) return;
        try { await TaskStore.remove(t); app.toast(`Aufgabe „${t.title}“ gelöscht.`); this.dialog(); } catch (er) { app.toast('Löschen fehlgeschlagen: ' + er.message); }
      } else if (q('import')) $('#taskImport').click();
    });
    const imp = $('#taskImport');
    if (imp) imp.addEventListener('change', async () => {
      const file = imp.files[0]; if (!file) return;
      try {
        const t = JSON.parse(await file.text());
        if (!t.title || !Array.isArray(t.checks)) throw new Error('Das ist keine Aufgabendatei.');
        t.id = 'eigen-' + Date.now().toString(36);
        delete t.file;
        await TaskStore.save(t);
        app.toast(`Aufgabe „${t.title}“ importiert.`);
        this.dialog();
      } catch (er) { app.toast('Import fehlgeschlagen: ' + er.message); }
    });
  },

  /* Aufgabe als neues Projekt anlegen */
  start(t) {
    const app = this.app;
    app.dialog(`<h2>${esc(t.title)}</h2><p>Wie soll dein Projekt heißen?</p>${app.nameFields({ proj: t.title })}<div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary" value="ok">Aufgabe beginnen</button></div>`,
      (rv, f) => {
        if (rv !== 'ok' || !f.n.value) return;
        const pr = t.project || {};
        const own = t.start === 'schaltung' || t.start === 'alles';
        app.loadProject({ format: FORMAT, version: 1, name: f.n.value, board: t.board === 'esp32' ? 'esp32' : 'uno', extensions: (own && pr.extensions) || t.ext || [],
          circuit: own && pr.circuit ? JSON.parse(JSON.stringify(pr.circuit)) : { components: [], wires: [] },
          blocks: t.start === 'alles' && pr.blocks ? pr.blocks : DEFAULT_BLOCKS_XML,
          task: { ...TaskStore.clean(t), tipsShown: 0 } });
        if (t.start === 'vorlage' || t.start === 'vorlage-lcd') {
          app.circuit.addTemplate(420, 330, t.start === 'vorlage-lcd');
          app.undoStack = []; app.redoStack = [];
          requestAnimationFrame(() => app.circuit.fitView());
        }
        app.fileName = null; app.save();
        app.toast(`Aufgabe „${t.title}“ begonnen.`);
      });
    app.guardNameFields($('#dlgForm'));
  },
};

/* Allgemeiner Name eines Blocks ohne eingestellte Werte, z. B. „Anschluss … auf … einstellen“ */
function blockLabel(b) {
  const words = [];
  for (const inp of b.inputList) {
    if (inp.type === Blockly.NEXT_STATEMENT) continue;
    for (const f of inp.fieldRow) words.push(f instanceof Blockly.FieldLabel && !(f instanceof Blockly.FieldVariable) ? f.getText() : '…');
    if (inp.type === Blockly.INPUT_VALUE) words.push('…');
  }
  return words.join(' ').replace(/\s+/g, ' ').replace(/…(\s*…)+/g, '…').trim().slice(0, 70) || b.type;
}

/* Zweiter Klick bestätigt das Löschen */
function confirmInline(btn) {
  if (btn.dataset.sure) return true;
  btn.dataset.sure = '1'; btn.textContent = 'Wirklich löschen?';
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = 'Löschen'; } }, 3000);
  return false;
}

/* ---------- Aufgaben-Editor für Lehrkräfte ---------- */
const TaskEditor = {
  teacherMode() { try { return localStorage.getItem('werkstatt.lehrkraft') === '1'; } catch (e) { return false; } },

  /* draft = null: neue Aufgabe aus dem aktuellen Projekt */
  open(app, draft) {
    this.app = app;
    const isNew = !draft;
    if (isNew) {
      const parts = {};
      for (const c of app.project.components) if (!c.def.mcu && !c.def.isBreadboard && !['resistor', 'source'].includes(c.type)) parts[c.type] = (parts[c.type] || 0) + 1;
      draft = { id: 'eigen-' + Date.now().toString(36), title: '', level: 'Grundlagen', board: BOARD, goal: '', tips: [], start: 'vorlage',
        checks: Object.entries(parts).map(([type, n]) => ({ k: 'part', type, n })).concat([{ k: 'noerror' }]) };
    }
    this.draft = draft;
    const opt = (v, cur, txt) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(txt)}</option>`;
    const h = `<h2>${isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}</h2>
      <p class="te-note">Baue am besten zuerst die Lösung als Projekt. Mit „Prüfungen testen“ siehst du, ob die Prüfungen die Lösung erkennen. Die Schüler bekommen die Startvorlage, nicht die Lösung.</p>
      <div class="te-grid">
        <label class="wide">Titel<input name="title" value="${esc(draft.title)}" placeholder="z. B. Lichtschranke"></label>
        <label>Stufe<input name="level" list="teLevels" value="${esc(draft.level)}"><datalist id="teLevels">${TASK_LEVELS.map(l => `<option value="${l}">`).join('')}</datalist></label>
        <label>Mikrocontroller<select name="board">${opt('uno', draft.board, 'Arduino Uno')}${opt('esp32', draft.board, 'ESP32')}</select></label>
        <label class="wide">Ziel der Aufgabe<textarea name="goal" rows="3">${esc(draft.goal)}</textarea></label>
        <label class="wide">Tipps (einer pro Zeile, werden nacheinander aufgedeckt)<textarea name="tips" rows="3">${esc((draft.tips || []).join('\n'))}</textarea></label>
        <label class="wide">Startvorlage für die Schüler<select name="start">
          ${opt('leer', draft.start, 'leere Werkbank')}${opt('vorlage', draft.start, 'Mikrocontroller + Steckplatine')}${opt('vorlage-lcd', draft.start, 'Mikrocontroller + Steckplatine + LCD')}
          ${opt('schaltung', draft.start, 'Schaltung des aktuellen Projekts (Programm leer)')}${opt('alles', draft.start, 'Schaltung und Programm des aktuellen Projekts (z. B. Fehlersuche)')}</select></label>
      </div>
      <div class="tp-sub">Prüfungen</div>
      <div class="te-checks" id="teChecks"></div>
      <div class="te-add"><select id="teKind">${Object.entries(TASK_CHECKS).map(([k, d]) => `<option value="${k}">${esc(d.title)}</option>`).join('')}</select><button type="button" class="btn small" id="teAdd">Prüfung hinzufügen</button></div>
      <div class="field-err" id="teErr" hidden></div>
      <div class="dlg-btns"><button class="btn" value="cancel">Abbrechen</button><button class="btn" value="test">Prüfungen testen</button><button class="btn primary" value="ok">Speichern</button></div>`;
    app.dialog(h, async (rv, f) => {
      if (rv === 'cancel' || !rv) return;
      this.read(f);
      if (rv === 'test') { this.preview(); return; }
      if (rv === 'ok') {
        this.draft.ext = app.extensions.slice(); // Erweiterungen der Lösung auch für die Schüler
        if (this.draft.start === 'schaltung' || this.draft.start === 'alles') {
          const pd = app.projectData();
          this.draft.project = { circuit: pd.circuit, blocks: pd.blocks, extensions: pd.extensions };
        } else delete this.draft.project;
        try { await TaskStore.save(this.draft); app.toast(`Aufgabe „${this.draft.title}“ gespeichert.`); TaskUi.dialog(); }
        catch (e) { app.toast('Speichern fehlgeschlagen: ' + e.message); this.open(app, this.draft); }
      }
    });
    $('#dlg').classList.add('wide');
    $('#dlg').addEventListener('close', () => $('#dlg').classList.remove('wide'), { once: true });
    const f = $('#dlgForm');
    this.renderChecks();
    $('#teAdd').onclick = () => {
      const k = $('#teKind').value, d = TASK_CHECKS[k], c = { k };
      for (const p of d.params) c[p.key] = p.def != null ? p.def : (p.type === 'part' ? 'led' : p.type === 'sensor' ? 'ldr' : '');
      if (k === 'sensor') { c.a = TASK_SENSORS[c.type].a; c.b = TASK_SENSORS[c.type].b; }
      if (k === 'block') { const b = this.blockOptions()[0]; if (b) { c.type = b[0]; c.label = b[1]; } }
      this.syncChecks(); this.draft.checks.push(c); this.renderChecks();
    };
    f.addEventListener('submit', e => {
      const btn = e.submitter;
      if (btn && btn.value !== 'cancel' && !f.elements.title.value.trim()) { e.preventDefault(); const er = $('#teErr'); er.textContent = 'Bitte einen Titel eingeben.'; er.hidden = false; f.elements.title.focus(); }
    });
  },

  blockOptions() {
    const seen = new Map();
    for (const b of this.app.workspace.getAllBlocks(false)) {
      if (seen.has(b.type) || /^ard_(setup|loop)$/.test(b.type) || /^(math_number|text|logic_boolean)$/.test(b.type)) continue;
      seen.set(b.type, blockLabel(b));
    }
    for (const c of this.draft.checks) if (c.k === 'block' && c.type && !seen.has(c.type)) seen.set(c.type, c.label || c.type);
    return [...seen.entries()];
  },

  renderChecks() {
    const box = $('#teChecks'), d = this.draft;
    const field = (c, i, p) => {
      const v = c[p.key] != null ? c[p.key] : '';
      const sel = (opts) => `<select data-i="${i}" data-key="${p.key}">${opts.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      let inp;
      if (p.type === 'part') inp = sel(Object.keys(PART_GROUPS).map(k => [k, PART_GROUPS[k].name + ' (beliebig)']).concat(Object.keys(COMPONENTS).filter(k => !COMPONENTS[k].isBreadboard && !COMPONENTS[k].mcu).map(k => [k, COMPONENTS[k].name])));
      else if (p.type === 'sensor') inp = sel(Object.keys(TASK_SENSORS).map(k => [k, `${COMPONENTS[k] ? COMPONENTS[k].name : k} (${TASK_SENSORS[k].name.replace(/^\S+ /, '')})`]));
      else if (p.type === 'watch') inp = sel(Object.entries(WATCH_NAMES));
      else if (p.type === 'channel') inp = sel(Object.entries(CHANNEL_NAMES));
      else if (p.type === 'block') { const o = this.blockOptions(); inp = o.length ? sel(o) : '<i>Das aktuelle Projekt enthält noch keine Blöcke.</i>'; }
      else inp = `<input data-i="${i}" data-key="${p.key}" type="${p.type === 'number' ? 'number' : 'text'}" value="${esc(v)}">`;
      return `<label>${esc(p.label)}${inp}</label>`;
    };
    box.innerHTML = d.checks.length ? d.checks.map((c, i) => {
      const def = TASK_CHECKS[c.k];
      return `<div class="te-check"><div class="te-ct"><b>${esc(def.title)}</b><span>${esc(def.label(c))}</span><button type="button" class="btn small ghost" data-rm="${i}" title="Prüfung entfernen">✕</button></div>${def.params.length ? `<div class="te-cp">${def.params.map(p => field(c, i, p)).join('')}</div>` : ''}</div>`;
    }).join('') : '<p class="te-note">Noch keine Prüfung. Ohne Prüfung kann die Aufgabe nicht automatisch abgehakt werden.</p>';
    box.onclick = e => { const r = e.target.closest('[data-rm]'); if (r) { this.syncChecks(); d.checks.splice(Number(r.dataset.rm), 1); this.renderChecks(); } };
    box.onchange = e => {
      this.syncChecks();
      const t = e.target;
      if (t.dataset.key === 'type' && d.checks[t.dataset.i].k === 'sensor') { const c = d.checks[t.dataset.i], s = TASK_SENSORS[c.type]; c.a = s.a; c.b = s.b; }
      this.renderChecks();
    };
  },

  syncChecks() {
    for (const el of document.querySelectorAll('#teChecks [data-key]')) {
      const c = this.draft.checks[el.dataset.i];
      c[el.dataset.key] = el.type === 'number' ? Number(el.value) : el.value;
      if (el.dataset.key === 'type' && c.k === 'block') c.label = el.selectedOptions[0] ? el.selectedOptions[0].textContent : c.type;
    }
  },

  read(f) {
    this.syncChecks();
    const d = this.draft;
    const v = n => f.elements[n].value;
    d.title = v('title').trim(); d.level = v('level').trim() || 'Grundlagen'; d.board = v('board');
    d.goal = v('goal').trim(); d.tips = v('tips').split('\n').map(s => s.trim()).filter(Boolean); d.start = v('start');
  },

  /* Prüfungen am aktuellen Projekt ausprobieren, ohne die Aufgabe zu speichern */
  preview() {
    TaskUi.savedTask = this.app.task;
    this.app.task = { ...this.draft, preview: this.draft, tipsShown: (this.draft.tips || []).length, results: null };
    TaskUi.render();
    TaskUi.onPanelClick({ target: TaskUi.panel.querySelector('[data-act=check]') });
  },
};
