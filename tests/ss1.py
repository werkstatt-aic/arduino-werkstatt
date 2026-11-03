"""Schulserver: Lehrer-Oberfläche Ende zu Ende (Einrichten, Klasse, Klassenzimmer, Kachel, Großansicht, Prüfung, Abgabe)"""
import json, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright
S = 'http://127.0.0.1:8650'
def sapi(path, body=None, tok=None, raw=False):
    req = urllib.request.Request(S + path, data=(body if isinstance(body, bytes) else json.dumps(body).encode()) if body is not None else None, method='POST' if body is not None else 'GET')
    if tok: req.add_header('X-Werkstatt-Token', tok)
    try:
        r = urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e:
        return 'HTTP %d: %s' % (e.code, e.read().decode().strip())
    return r if raw else json.loads(r) if r.strip().startswith(('{', '[')) else r
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S + '/'); pg.wait_for_timeout(600)
    print('Startseite:', pg.inner_text('main h1'))
    pg.fill('input[name=name]', 'Uli Aichler'); pg.fill('input[name=login]', 'aichler'); pg.fill('input[name=passwort]', 'geheim123'); pg.fill('input[name=p2]', 'geheim123')
    pg.click('main button.primary'); pg.wait_for_timeout(800)
    print('nach Einrichten:', pg.inner_text('main h1'), '|', pg.inner_text('#meName'))
    pg.click('#newCls'); pg.fill('#dlg input[name=name]', '8a'); pg.click('#dlg button[value=ok]'); pg.wait_for_timeout(500)
    pg.click('[data-act=raum]'); pg.wait_for_timeout(1000)
    code = pg.inner_text('#codeNr'); print('Klassenzimmer offen, Code', code)
    # Schüler meldet sich an und speichert die Ampel aus den Beispielen
    j = sapi('/api/s/join', {'code': code, 'tisch': '3', 'vorname': 'Lena'}); tok = j['token']
    j2 = sapi('/api/s/join', {'code': code, 'tisch': '3', 'vorname': 'Tom'}); tok2 = j2['token']
    pg2 = b.new_page(); pg2.goto(S + '/app/index.html?ansicht=x'); pg2.wait_for_timeout(1500)
    ex = pg2.evaluate("()=>{const e=EXAMPLES.find(x=>x.id==='ampel'); return {format:FORMAT,version:1,name:'03 – Lena – Ampel',board:e.board,extensions:e.ext||[],circuit:e.circuit,blocks:e.blocks};}")
    pg2.close()
    f = urllib.parse.quote('03 – Lena – Ampel.awp')
    print('Speichern:', sapi('/api/s/save?file=' + f, json.dumps(ex).encode(), tok))
    pg.wait_for_timeout(3500)
    print('Kacheln:', pg.inner_text('#tiles').replace('\n', ' | ')[:200])
    pg.screenshot(path='ss1_raum.png')
    pg.click('.stu[data-key="03-Lena"]'); pg.wait_for_timeout(3000)
    fr = pg.frame_locator('#viewer iframe')
    print('Großansicht:', fr.locator('#projName').input_value(), '| Bauteile:', [f for f in pg.frames if 'ansicht' in f.url][0].evaluate("()=>App.project.components.length"))
    pg.screenshot(path='ss1_gross.png')
    # Live: Schüler ändert das Projekt → Großansicht aktualisiert sich
    ex['circuit']['components'] = ex['circuit']['components'][:3]
    sapi('/api/s/save?file=' + f, json.dumps(ex).encode(), tok); pg.wait_for_timeout(4000)
    print('nach Änderung, Bauteile:', [f for f in pg.frames if 'ansicht' in f.url][0].evaluate("()=>App.project.components.length"))
    pg.click('#vClose')
    # Prüfung starten
    pg.click('#modeBtn'); pg.fill('#dlg textarea[name=aufgabe]', 'Baue eine Ampel.'); pg.click('#dlg button[value=ok]'); pg.wait_for_timeout(800)
    st = sapi('/api/s/state', None, tok); print('Schüler-Zustand:', st['modus'], '|', st['aufgabe'])
    print('alte Projekte in der Prüfung:', sapi('/api/s/list', None, tok), '| laden:', sapi('/api/s/load?file=' + f, None, tok)[:60])
    print('Aufgaben in der Prüfung:', sapi('/api/s/aufgaben', None, tok))
    fe = urllib.parse.quote('03 – Lena – Prüfung 03.11.awp')
    sapi('/api/s/save?file=' + fe, json.dumps(ex).encode(), tok)
    print('Liste in der Prüfung:', [x['file'] for x in sapi('/api/s/list', None, tok)])
    sapi('/api/s/event', {'art': 'verlassen'}, tok); pg.wait_for_timeout(3500)
    print('Kachel verlassen:', pg.inner_text('.stu[data-key="03-Lena"]').replace('\n', ' | '))
    sapi('/api/s/event', {'art': 'zurueck', 'dauer': 12}, tok)
    print('Abgabe:', sapi('/api/s/abgabe?file=' + fe, b'', tok))
    pg.wait_for_timeout(3500)
    print('Kachel nach Abgabe:', pg.inner_text('.stu[data-key="03-Lena"]').replace('\n', ' | '), '| Zähler:', pg.inner_text('#doneCnt'))
    pg.screenshot(path='ss1_pruefung.png')
    pg.click('#modeBtn'); pg.click('#dlg button[value=ok]'); pg.wait_for_timeout(800)
    print('nach Prüfungsende:', sapi('/api/s/state', None, tok)['modus'])
    pg.click('#toSub'); pg.wait_for_timeout(800)
    print('Abgaben:', pg.inner_text('main').replace('\n', ' | ')[:200])
    pg.click('[data-o]'); pg.wait_for_timeout(1500); pg.click('#vEx'); pg.fill('#dlg input[name=titel]', 'Ampel aus Prüfung'); pg.click('#dlg button[value=ok]'); pg.wait_for_timeout(600); pg.click('#vClose')
    print('Beispiele für Schüler:', [x['titel'] for x in sapi('/api/s/beispiele', None, tok)])
    print('Fehler:', errs)
    b.close()
