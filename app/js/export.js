/* Schaltung als Bild speichern und Projekt drucken (Schaltung, Blöcke, C++-Code) */
'use strict';

const Export = {
  /* Alle Stilregeln der Seite, damit die Bilder auch außerhalb der Werkstatt richtig aussehen */
  css() {
    let t = '';
    for (const sh of document.styleSheets) {
      try { for (const r of sh.cssRules) t += r.cssText + '\n'; } catch (e) { /* fremde Datei */ }
    }
    return t;
  },

  svgFrom(el, bbox, inner, extraClass) {
    const pad = 20, w = Math.ceil(bbox.width + 2 * pad), h = Math.ceil(bbox.height + 2 * pad);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="${extraClass || ''}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<style>${this.css().replace(/<\/style/gi, '')}</style><rect width="100%" height="100%" fill="#fff"/>` +
      `<g transform="translate(${pad - bbox.x} ${pad - bbox.y})">${inner}</g></svg>`;
  },

  /* Inhalt eines Elements als gültiges XML (innerHTML würde z. B. &nbsp; erzeugen) */
  xml(el) { const x = new XMLSerializer(); return [...el.childNodes].map(n => x.serializeToString(n)).join(''); },

  circuitSvg() {
    const C = App.circuit;
    if (!C.project.components.length) return null;
    const box = C.world.getBBox();
    let inner = '';
    for (const k of ['bb', 'comp', 'wire']) inner += `<g class="l-${k}">${this.xml(C.L[k])}</g>`;
    return this.svgFrom(C.world, box, `<g class="world-print">${inner}</g>`, 'circuit');
  },

  blocksSvg() {
    const ws = App.workspace;
    if (!ws.getTopBlocks(false).length) return null;
    const canvas = ws.getCanvas();
    const box = canvas.getBBox();
    const svgRoot = ws.getParentSvg();
    return this.svgFrom(canvas, box, `<g class="${svgRoot.getAttribute('class') || ''}">${this.xml(canvas)}</g>`, 'blocklySvg');
  },

  async toPng(svg, scale) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width * scale; cv.height = img.height * scale;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    return new Promise(r => cv.toBlob(r, 'image/png'));
  },

  download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  async saveImage() {
    const svg = this.circuitSvg();
    if (!svg) { App.toast('Die Werkbank ist leer.'); return; }
    try {
      const blob = await this.toPng(svg, 2);
      this.download(blob, `${$('#projName').value.trim() || 'Schaltung'} – Schaltung.png`);
      App.toast('Bild gespeichert (Ordner „Downloads“).');
    } catch (e) { App.toast('Das Bild konnte nicht erstellt werden.'); }
  },

  print() {
    const name = $('#projName').value.trim();
    const circ = this.circuitSvg(), blocks = this.blocksSvg();
    let code = '';
    try { code = generateArduinoCode(App.workspace); } catch (e) { code = ''; }
    const img = s => s ? `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}">` : '<p class="leer">– leer –</p>';
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${esc(name)}</title><style>
      body{font-family:system-ui,"Segoe UI",sans-serif;margin:24px;color:#222} h1{font-size:20px;margin:0 0 4px} .meta{color:#666;font-size:12px;margin-bottom:16px}
      h2{font-size:15px;margin:18px 0 8px;border-bottom:1px solid #ccc;padding-bottom:3px} img{max-width:100%;max-height:85vh;display:block}
      pre{font:11px/1.45 Consolas,monospace;white-space:pre-wrap;background:#f6f6f6;padding:10px;border-radius:6px} .leer{color:#888}
      .seite{break-before:page} @media print{body{margin:0}}</style></head><body>
      <h1>${esc(name)}</h1><div class="meta">Arduino-Werkstatt · ${boardName()} · ${new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      <h2>Schaltung</h2>${img(circ)}
      <h2 class="seite">Programm (Blöcke)</h2>${img(blocks)}
      <h2 class="seite">Programm (C++)</h2><pre>${esc(code)}</pre>
      <script>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))).then(()=>setTimeout(()=>window.print(),200));<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { App.toast('Das Druckfenster wurde blockiert.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  },
};
