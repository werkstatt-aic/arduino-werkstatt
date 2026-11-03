"""Schulserver: Verwalter legt Lehrkraft an, Erstpasswort, Trennung der Klassen, Rechte"""
import json, urllib.request, http.cookiejar
S = 'http://127.0.0.1:8650'
def client():
    cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    def L(path, body=None, hdr=True):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(S + '/lehrer/api/' + path, data=data, method='POST' if data is not None else 'GET')
        if hdr: req.add_header('X-Werkstatt', '1')
        req.add_header('Content-Type', 'application/json')
        try: r = op.open(req).read().decode()
        except urllib.error.HTTPError as e: return 'HTTP %d %s' % (e.code, e.read().decode().strip())
        return json.loads(r) if r[:1] in '[{' else r
    return L
A = client()
print('Verwalter anmelden:', A('anmelden', {'login': 'aichler', 'passwort': 'geheim123'}).get('name'))
print('Lehrkraft anlegen:', A('lehrer-neu', {'name': 'Eva Muster', 'login': 'muster', 'passwort': 'start1234', 'verwalter': False}).get('login'))
print('doppelt:', A('lehrer-neu', {'name': 'X', 'login': 'muster', 'passwort': 'start1234'}))
B = client()
print('falsches Passwort:', B('anmelden', {'login': 'muster', 'passwort': 'falsch123'}))
me = B('anmelden', {'login': 'muster', 'passwort': 'start1234'}); print('Lehrkraft angemeldet, Erstpasswort:', me.get('neu'))
print('Passwort ändern:', B('passwort', {'alt': 'start1234', 'neu': 'neu-geheim1'}))
print('Klassen der Lehrkraft:', B('klassen'), '| Verwalter-Bereich:', B('lehrer'))
k8a = A('klassen')[0]['id']
print('fremde Klasse öffnen:', B('raum?klasse=' + k8a), '|', B('schueler?klasse=' + k8a))
print('Beispiele sichtbar (nur freigegebene):', [x['titel'] for x in B('beispiele')])
ex = A('beispiele')[0]; A('beispiel-freigabe', {'id': ex['id'], 'alle': True})
print('nach Freigabe:', [x['titel'] for x in B('beispiele')], '| fremdes löschen:', B('beispiel-loeschen', {'id': ex['id']}))
print('ohne X-Werkstatt-Kopfzeile:', B('klasse-neu', {'name': '9b'}, hdr=False))
print('Passwort zurücksetzen:', A('lehrer-passwort', {'id': me['id'], 'passwort': 'reset1234'}), '| alte Sitzung:', B('klassen'))
print('Verwalter löscht sich selbst:', A('lehrer-loeschen', {'id': A('status')['lehrer']['id']}))
