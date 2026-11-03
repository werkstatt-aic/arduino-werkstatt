package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const cookieName = "ws_lehrer"

type handler func(w http.ResponseWriter, r *http.Request, t *Teacher)

func registerTeacher(mux *http.ServeMux) {
	mux.HandleFunc("/lehrer/api/status", apiStatus)
	mux.HandleFunc("/lehrer/api/setup", apiSetup)
	mux.HandleFunc("/lehrer/api/anmelden", apiLogin)
	mux.HandleFunc("/lehrer/api/abmelden", apiLogout)
	for path, h := range map[string]handler{
		"passwort":             apiOwnPassword,
		"lehrer":               adminOnly(apiTeachers),
		"lehrer-neu":           adminOnly(apiTeacherNew),
		"lehrer-passwort":      adminOnly(apiTeacherPassword),
		"lehrer-loeschen":      adminOnly(apiTeacherDelete),
		"klassen":              apiClasses,
		"klasse-neu":           apiClassNew,
		"klasse-umbenennen":    apiClassRename,
		"klasse-loeschen":      apiClassDelete,
		"raum-oeffnen":         apiRoomOpen,
		"raum-schliessen":      apiRoomClose,
		"raum-modus":           apiRoomMode,
		"raum":                 apiRoom,
		"schueler":             apiStudents,
		"projekt":              apiProject,
		"abgabe-zuruecknehmen": apiUnsubmit,
		"schueler-entfernen":   apiRemoveTile,
		"abgaben":              apiSubmissions,
		"abgabe":               apiSubmission,
		"abgaben-zip":          apiSubmissionsZip,
		"aufgaben":             apiTaskList,
		"aufgabe":              apiTaskGet,
		"aufgabe-hochladen":    apiTaskUpload,
		"aufgabe-freigabe":     apiTaskShare,
		"aufgabe-loeschen":     apiTaskDelete,
		"beispiele":            apiExampleList,
		"beispiel":             apiExampleGet,
		"beispiel-aus-projekt": apiExampleFromProject,
		"beispiel-hochladen":   apiExampleUpload,
		"beispiel-freigabe":    apiExampleShare,
		"beispiel-loeschen":    apiExampleDelete,
	} {
		mux.HandleFunc("/lehrer/api/"+path, auth(h))
	}
}

func currentTeacher(r *http.Request) *Teacher {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	ts := s.teachers[c.Value]
	if ts == nil || time.Now().After(ts.Bis) {
		return nil
	}
	ts.Bis = time.Now().Add(12 * time.Hour)
	return s.teacher(ts.Lehrer)
}

func auth(h handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t := currentTeacher(r)
		if t == nil {
			http.Error(w, "Bitte anmelden.", 401)
			return
		}
		if r.Method == http.MethodPost && r.Header.Get("X-Werkstatt") != "1" { // Schutz vor fremden Webseiten
			http.Error(w, "Ungültige Anfrage", 403)
			return
		}
		h(w, r, t)
	}
}

func adminOnly(h handler) handler {
	return func(w http.ResponseWriter, r *http.Request, t *Teacher) {
		if !t.Verwalter {
			http.Error(w, "Nur für den Verwalter-Zugang.", 403)
			return
		}
		h(w, r, t)
	}
}

func teacherView(t *Teacher) map[string]any {
	return map[string]any{"id": t.ID, "name": t.Name, "login": t.Login, "verwalter": t.Verwalter, "neu": t.Neu}
}

func apiStatus(w http.ResponseWriter, r *http.Request) {
	store.mu.Lock()
	setup := len(store.Lehrer) == 0
	store.mu.Unlock()
	out := map[string]any{"setup": setup, "version": version}
	if t := currentTeacher(r); t != nil {
		out["lehrer"] = teacherView(t)
	}
	writeJSONResp(w, out)
}

var loginRe = regexp.MustCompile(`^[a-z0-9._-]{2,30}$`)

func startSession(w http.ResponseWriter, t *Teacher) {
	tok := token(32)
	store.teachers[tok] = &teacherSession{Lehrer: t.ID, Bis: time.Now().Add(12 * time.Hour)}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: tok, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode})
}

// Erster Start: Verwalter-Zugang anlegen
func apiSetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	var in struct{ Name, Login, Passwort string }
	if readBody(r, &in) != nil {
		http.Error(w, "Ungültige Anfrage", 400)
		return
	}
	in.Login = strings.ToLower(strings.TrimSpace(in.Login))
	if msg := checkNew(in.Name, in.Login, in.Passwort); msg != "" {
		http.Error(w, msg, 400)
		return
	}
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.Lehrer) > 0 {
		http.Error(w, "Es gibt schon einen Verwalter-Zugang.", 409)
		return
	}
	t := &Teacher{ID: newID("l"), Name: cleanName(in.Name, 60), Login: in.Login, Verwalter: true}
	setPassword(t, in.Passwort)
	s.Lehrer = append(s.Lehrer, t)
	if err := s.saveMeta(); err != nil {
		http.Error(w, "Speichern fehlgeschlagen: "+err.Error(), 500)
		return
	}
	startSession(w, t)
	writeJSONResp(w, teacherView(t))
}

func checkNew(name, login, pass string) string {
	if strings.TrimSpace(name) == "" {
		return "Bitte einen Namen angeben."
	}
	if !loginRe.MatchString(login) {
		return "Der Anmeldename darf nur Kleinbuchstaben, Ziffern, Punkt, - und _ enthalten (2–30 Zeichen)."
	}
	if len([]rune(pass)) < 8 {
		return "Das Passwort muss mindestens 8 Zeichen lang sein."
	}
	return ""
}

var loginFails = map[string][]time.Time{}

func apiLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	var in struct{ Login, Passwort string }
	if readBody(r, &in) != nil {
		http.Error(w, "Ungültige Anfrage", 400)
		return
	}
	login := strings.ToLower(strings.TrimSpace(in.Login))
	s := store
	s.mu.Lock()
	// Bremse gegen Ausprobieren: höchstens 10 Fehlversuche in 10 Minuten je Anmeldename
	recent := []time.Time{}
	for _, t := range loginFails[login] {
		if time.Since(t) < 10*time.Minute {
			recent = append(recent, t)
		}
	}
	loginFails[login] = recent
	if len(recent) >= 10 {
		s.mu.Unlock()
		http.Error(w, "Zu viele Fehlversuche. Bitte in einigen Minuten erneut versuchen.", 429)
		return
	}
	var t *Teacher
	for _, x := range s.Lehrer {
		if x.Login == login {
			t = x
		}
	}
	s.mu.Unlock()
	if t == nil || !checkPassword(t, in.Passwort) {
		s.mu.Lock()
		loginFails[login] = append(loginFails[login], time.Now())
		s.mu.Unlock()
		http.Error(w, "Anmeldename oder Passwort stimmt nicht.", 401)
		return
	}
	s.mu.Lock()
	startSession(w, t)
	s.mu.Unlock()
	writeJSONResp(w, teacherView(t))
}

func apiLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(cookieName); err == nil {
		store.mu.Lock()
		delete(store.teachers, c.Value)
		store.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: "", Path: "/", MaxAge: -1})
	w.Write([]byte("ok"))
}

func apiOwnPassword(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ Alt, Neu string }
	if readBody(r, &in) != nil {
		http.Error(w, "Ungültige Anfrage", 400)
		return
	}
	if !checkPassword(t, in.Alt) {
		http.Error(w, "Das bisherige Passwort stimmt nicht.", 400)
		return
	}
	if len([]rune(in.Neu)) < 8 {
		http.Error(w, "Das neue Passwort muss mindestens 8 Zeichen lang sein.", 400)
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	setPassword(t, in.Neu)
	t.Neu = false
	store.saveMeta()
	w.Write([]byte("ok"))
}

/* ---------- Verwaltung der Lehrkräfte ---------- */

func apiTeachers(w http.ResponseWriter, r *http.Request, _ *Teacher) {
	store.mu.Lock()
	defer store.mu.Unlock()
	out := []map[string]any{}
	for _, t := range store.Lehrer {
		n := 0
		for _, c := range store.Klassen {
			if c.Lehrer == t.ID {
				n++
			}
		}
		v := teacherView(t)
		v["klassen"] = n
		out = append(out, v)
	}
	writeJSONResp(w, out)
}

func apiTeacherNew(w http.ResponseWriter, r *http.Request, _ *Teacher) {
	var in struct {
		Name, Login, Passwort string
		Verwalter             bool
	}
	if readBody(r, &in) != nil {
		http.Error(w, "Ungültige Anfrage", 400)
		return
	}
	in.Login = strings.ToLower(strings.TrimSpace(in.Login))
	if msg := checkNew(in.Name, in.Login, in.Passwort); msg != "" {
		http.Error(w, msg, 400)
		return
	}
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, x := range s.Lehrer {
		if x.Login == in.Login {
			http.Error(w, "Diesen Anmeldenamen gibt es schon.", 409)
			return
		}
	}
	t := &Teacher{ID: newID("l"), Name: cleanName(in.Name, 60), Login: in.Login, Verwalter: in.Verwalter, Neu: true}
	setPassword(t, in.Passwort)
	s.Lehrer = append(s.Lehrer, t)
	s.saveMeta()
	writeJSONResp(w, teacherView(t))
}

func apiTeacherPassword(w http.ResponseWriter, r *http.Request, _ *Teacher) {
	var in struct{ ID, Passwort string }
	if readBody(r, &in) != nil || len([]rune(in.Passwort)) < 8 {
		http.Error(w, "Das Passwort muss mindestens 8 Zeichen lang sein.", 400)
		return
	}
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.teacher(in.ID)
	if t == nil {
		http.Error(w, "Unbekannt", 404)
		return
	}
	setPassword(t, in.Passwort)
	t.Neu = true
	for k, ts := range s.teachers { // laufende Anmeldungen beenden
		if ts.Lehrer == t.ID {
			delete(s.teachers, k)
		}
	}
	s.saveMeta()
	w.Write([]byte("ok"))
}

func apiTeacherDelete(w http.ResponseWriter, r *http.Request, me *Teacher) {
	var in struct{ ID string }
	readBody(r, &in)
	if in.ID == me.ID {
		http.Error(w, "Den eigenen Zugang kann man nicht löschen.", 400)
		return
	}
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.Klassen {
		if c.Lehrer == in.ID {
			http.Error(w, "Diese Lehrkraft hat noch Klassen. Erst die Klassen löschen.", 409)
			return
		}
	}
	out := s.Lehrer[:0]
	for _, t := range s.Lehrer {
		if t.ID != in.ID {
			out = append(out, t)
		}
	}
	s.Lehrer = out
	s.saveMeta()
	w.Write([]byte("ok"))
}

/* ---------- Klassen und Klassenzimmer ---------- */

// Klasse der Lehrkraft (fremde Klassen sind unsichtbar)
func ownClass(t *Teacher, id string) *Class {
	c := store.class(id)
	if c == nil || c.Lehrer != t.ID {
		return nil
	}
	return c
}

func apiClasses(w http.ResponseWriter, r *http.Request, t *Teacher) {
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []map[string]any{}
	for _, c := range s.Klassen {
		if c.Lehrer != t.ID {
			continue
		}
		v := map[string]any{"id": c.ID, "name": c.Name}
		if rm := s.Raeume[c.ID]; rm != nil {
			v["code"], v["modus"] = rm.Code, rm.Modus
		}
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i]["name"].(string)) < strings.ToLower(out[j]["name"].(string))
	})
	writeJSONResp(w, out)
}

func apiClassNew(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ Name string }
	readBody(r, &in)
	name := cleanName(in.Name, 40)
	if name == "" {
		http.Error(w, "Bitte einen Namen für die Klasse angeben, z. B. 8a.", 400)
		return
	}
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.Klassen {
		if c.Lehrer == t.ID && strings.EqualFold(c.Name, name) {
			http.Error(w, "Diese Klasse gibt es schon.", 409)
			return
		}
	}
	c := &Class{ID: newID("k"), Name: name, Lehrer: t.ID, Created: time.Now()}
	s.Klassen = append(s.Klassen, c)
	os.MkdirAll(classDir(c.ID), 0o755)
	s.saveMeta()
	writeJSONResp(w, c)
}

func apiClassRename(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ ID, Name string }
	readBody(r, &in)
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	c := ownClass(t, in.ID)
	if c == nil || cleanName(in.Name, 40) == "" {
		http.Error(w, "Ungültig", 400)
		return
	}
	c.Name = cleanName(in.Name, 40)
	s.saveMeta()
	w.Write([]byte("ok"))
}

func apiClassDelete(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ ID, Bestaetigung string }
	readBody(r, &in)
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	c := ownClass(t, in.ID)
	if c == nil {
		http.Error(w, "Unbekannte Klasse", 404)
		return
	}
	if in.Bestaetigung != c.Name {
		http.Error(w, "Zur Bestätigung den Namen der Klasse genau eintippen.", 400)
		return
	}
	// Daten nicht sofort vernichten: in den Papierkorb verschieben
	bin := filepath.Join(dataDir, "papierkorb")
	os.MkdirAll(bin, 0o755)
	os.Rename(classDir(c.ID), filepath.Join(bin, time.Now().Format("2006-01-02_15-04-05")+"_"+unsafeChars.ReplaceAllString(c.Name, "_")+"_"+c.ID))
	delete(s.Raeume, c.ID)
	for k, ss := range s.Sitzungen {
		if ss.Klasse == c.ID {
			delete(s.Sitzungen, k)
		}
	}
	out := s.Klassen[:0]
	for _, x := range s.Klassen {
		if x.ID != c.ID {
			out = append(out, x)
		}
	}
	s.Klassen = out
	s.saveMeta()
	w.Write([]byte("ok"))
}

func apiRoomOpen(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ Klasse string }
	readBody(r, &in)
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	if ownClass(t, in.Klasse) == nil {
		http.Error(w, "Unbekannte Klasse", 404)
		return
	}
	rm := s.Raeume[in.Klasse]
	if rm == nil {
		rm = &Room{Klasse: in.Klasse, Code: s.newCode(), Modus: "normal", Geoeffnet: time.Now(), Schueler: map[string]*Live{}}
		s.Raeume[in.Klasse] = rm
	}
	s.saveRooms()
	writeJSONResp(w, map[string]any{"code": rm.Code})
}

func apiRoomClose(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ Klasse string }
	readBody(r, &in)
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	if ownClass(t, in.Klasse) == nil {
		http.Error(w, "Unbekannte Klasse", 404)
		return
	}
	delete(s.Raeume, in.Klasse)
	s.saveRooms()
	w.Write([]byte("ok"))
}

func apiRoomMode(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ Klasse, Modus, Aufgabe string }
	readBody(r, &in)
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	rm := s.Raeume[in.Klasse]
	if ownClass(t, in.Klasse) == nil || rm == nil {
		http.Error(w, "Das Klassenzimmer ist nicht geöffnet.", 404)
		return
	}
	switch in.Modus {
	case "pruefung":
		if rm.Modus != "pruefung" { // neue Prüfung: Abgaben und Ereignisse zurücksetzen
			rm.Pruefung = time.Now().UTC().Format(time.RFC3339)
			for _, lv := range rm.Schueler {
				lv.Abgegeben = time.Time{}
				lv.Ereignisse = nil
				lv.Draussen = false
			}
		}
		rm.Modus = "pruefung"
	case "normal":
		rm.Modus = "normal"
	default:
		http.Error(w, "Ungültiger Modus", 400)
		return
	}
	rm.Aufgabe = cleanName(in.Aufgabe, 4000)
	s.saveRooms()
	w.Write([]byte("ok"))
}

func apiRoom(w http.ResponseWriter, r *http.Request, t *Teacher) {
	k := r.URL.Query().Get("klasse")
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	c := ownClass(t, k)
	if c == nil {
		http.Error(w, "Unbekannte Klasse", 404)
		return
	}
	rm := s.Raeume[k]
	if rm == nil {
		writeJSONResp(w, map[string]any{"offen": false, "klasse": c.Name})
		return
	}
	list := []map[string]any{}
	for key, lv := range rm.Schueler {
		list = append(list, map[string]any{
			"key": key, "tisch": lv.Tisch, "vorname": lv.Vorname, "projekt": lv.Projekt,
			"gesehen": lv.Gesehen, "geaendert": lv.Geaendert, "online": time.Since(lv.Gesehen) < 15*time.Second,
			"abgegeben": lv.Abgegeben, "ereignisse": lv.Ereignisse, "draussen": lv.Draussen,
		})
	}
	writeJSONResp(w, map[string]any{"offen": true, "klasse": c.Name, "code": rm.Code, "modus": rm.Modus, "aufgabe": rm.Aufgabe, "pruefung": rm.Pruefung, "schueler": list, "jetzt": time.Now()})
}

// Alle Schüler einer Klasse mit ihren Projekten (auch ohne geöffnetes Klassenzimmer)
func apiStudents(w http.ResponseWriter, r *http.Request, t *Teacher) {
	k := r.URL.Query().Get("klasse")
	store.mu.Lock()
	ok := ownClass(t, k) != nil
	store.mu.Unlock()
	if !ok {
		http.Error(w, "Unbekannte Klasse", 404)
		return
	}
	out := []map[string]any{}
	entries, _ := os.ReadDir(filepath.Join(classDir(k), "schueler"))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		parts := strings.SplitN(e.Name(), "-", 2)
		v := map[string]any{"key": e.Name(), "tisch": parts[0], "projekte": listProjects(studentDir(k, e.Name()))}
		if len(parts) > 1 {
			v["vorname"] = parts[1]
		}
		out = append(out, v)
	}
	writeJSONResp(w, out)
}

func safeKey(k string) bool {
	return k != "" && !strings.ContainsAny(k, `\/:.`) && k != ".."
}

// Projekt eines Schülers (für die Großansicht oder zum Herunterladen mit download=1)
func apiProject(w http.ResponseWriter, r *http.Request, t *Teacher) {
	q := r.URL.Query()
	store.mu.Lock()
	ok := ownClass(t, q.Get("klasse")) != nil
	store.mu.Unlock()
	if !ok || !safeKey(q.Get("schueler")) {
		http.Error(w, "Unbekannt", 404)
		return
	}
	dir := studentDir(q.Get("klasse"), q.Get("schueler"))
	file := q.Get("file")
	if file == "" { // zuletzt bearbeitetes Projekt
		b, _ := os.ReadFile(filepath.Join(dir, ".zuletzt"))
		file = strings.TrimSpace(string(b))
	}
	p, ok := safeIn(dir, file)
	b, err := os.ReadFile(p)
	if !ok || err != nil {
		http.Error(w, "Noch kein gespeichertes Projekt.", 404)
		return
	}
	sendProject(w, q.Get("download") == "1", file, b)
}

func sendProject(w http.ResponseWriter, download bool, file string, b []byte) {
	w.Header().Set("Content-Type", "application/json")
	if download {
		w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(file))
	}
	w.Write(b)
}

func apiUnsubmit(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ Klasse, Schueler string }
	readBody(r, &in)
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	rm := s.Raeume[in.Klasse]
	if ownClass(t, in.Klasse) == nil || rm == nil || rm.Schueler[in.Schueler] == nil {
		http.Error(w, "Unbekannt", 404)
		return
	}
	rm.Schueler[in.Schueler].Abgegeben = time.Time{}
	s.saveRooms()
	w.Write([]byte("ok"))
}

func apiRemoveTile(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ Klasse, Schueler string }
	readBody(r, &in)
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	if rm := s.Raeume[in.Klasse]; ownClass(t, in.Klasse) != nil && rm != nil {
		delete(rm.Schueler, in.Schueler)
		s.saveRooms()
	}
	w.Write([]byte("ok"))
}

/* ---------- Abgaben ---------- */

func apiSubmissions(w http.ResponseWriter, r *http.Request, t *Teacher) {
	k := r.URL.Query().Get("klasse")
	store.mu.Lock()
	ok := ownClass(t, k) != nil
	store.mu.Unlock()
	if !ok {
		http.Error(w, "Unbekannte Klasse", 404)
		return
	}
	out := []map[string]any{}
	base := filepath.Join(classDir(k), "abgaben")
	entries, _ := os.ReadDir(base)
	for i := len(entries) - 1; i >= 0; i-- {
		e := entries[i]
		if e.IsDir() {
			out = append(out, map[string]any{"ordner": e.Name(), "dateien": listProjects(filepath.Join(base, e.Name()))})
		}
	}
	writeJSONResp(w, out)
}

func apiSubmission(w http.ResponseWriter, r *http.Request, t *Teacher) {
	q := r.URL.Query()
	store.mu.Lock()
	ok := ownClass(t, q.Get("klasse")) != nil
	store.mu.Unlock()
	if !ok || !safeKey(q.Get("ordner")) {
		http.Error(w, "Unbekannt", 404)
		return
	}
	p, ok := safeIn(filepath.Join(classDir(q.Get("klasse")), "abgaben", q.Get("ordner")), q.Get("file"))
	b, err := os.ReadFile(p)
	if !ok || err != nil {
		http.Error(w, "Nicht gefunden", 404)
		return
	}
	sendProject(w, q.Get("download") == "1", q.Get("file"), b)
}

func apiSubmissionsZip(w http.ResponseWriter, r *http.Request, t *Teacher) {
	q := r.URL.Query()
	store.mu.Lock()
	c := ownClass(t, q.Get("klasse"))
	store.mu.Unlock()
	if c == nil || !safeKey(q.Get("ordner")) {
		http.Error(w, "Unbekannt", 404)
		return
	}
	dir := filepath.Join(classDir(c.ID), "abgaben", q.Get("ordner"))
	name := fmt.Sprintf("Abgaben %s %s.zip", c.Name, q.Get("ordner"))
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(name))
	zw := zip.NewWriter(w)
	for _, f := range listProjects(dir) {
		b, err := os.ReadFile(filepath.Join(dir, f.File))
		if err != nil {
			continue
		}
		fw, err := zw.CreateHeader(&zip.FileHeader{Name: f.File, Method: zip.Deflate, Modified: f.Modified, Flags: 0x800})
		if err == nil {
			fw.Write(b)
		}
	}
	zw.Close()
}

/* ---------- Aufgaben ---------- */

func canSee(t *Teacher, owner string, all bool) bool { return all || owner == t.ID }

func apiTaskList(w http.ResponseWriter, r *http.Request, t *Teacher) {
	store.mu.Lock()
	defer store.mu.Unlock()
	out := []map[string]any{}
	for _, m := range store.Aufgaben {
		if !canSee(t, m.Lehrer, m.Alle) {
			continue
		}
		owner := ""
		if o := store.teacher(m.Lehrer); o != nil {
			owner = o.Name
		}
		out = append(out, map[string]any{"id": m.ID, "titel": m.Titel, "alle": m.Alle, "eigen": m.Lehrer == t.ID, "von": owner, "datum": m.Datum})
	}
	writeJSONResp(w, out)
}

func apiTaskGet(w http.ResponseWriter, r *http.Request, t *Teacher) {
	id := r.URL.Query().Get("id")
	store.mu.Lock()
	var m *TaskMeta
	for _, x := range store.Aufgaben {
		if x.ID == id && canSee(t, x.Lehrer, x.Alle) {
			m = x
		}
	}
	store.mu.Unlock()
	if m == nil {
		http.Error(w, "Nicht gefunden", 404)
		return
	}
	b, err := os.ReadFile(filepath.Join(dataDir, "aufgaben", m.ID+".aufgabe"))
	if err != nil {
		http.Error(w, "Nicht gefunden", 404)
		return
	}
	sendProject(w, true, m.Titel+".aufgabe", b)
}

// Aufgabe hochladen: .aufgabe-Datei aus dem Aufgaben-Editor der Werkstatt (Lehrkraft-Modus)
func apiTaskUpload(w http.ResponseWriter, r *http.Request, t *Teacher) {
	b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	var task map[string]any
	if err != nil || json.Unmarshal(b, &task) != nil {
		http.Error(w, "Das ist keine gültige Aufgaben-Datei (.aufgabe).", 400)
		return
	}
	title, _ := task["title"].(string)
	if _, ok := task["checks"].([]any); !ok || strings.TrimSpace(title) == "" {
		http.Error(w, "Das ist keine gültige Aufgaben-Datei (.aufgabe).", 400)
		return
	}
	id := newID("a")
	task["id"] = "srv-" + id // eindeutige Kennung in der Werkstatt
	task["file"] = "srv-" + id
	delete(task, "own")
	out, _ := json.Marshal(task)
	os.MkdirAll(filepath.Join(dataDir, "aufgaben"), 0o755)
	if err := writeAtomic(filepath.Join(dataDir, "aufgaben", id+".aufgabe"), out); err != nil {
		http.Error(w, "Speichern fehlgeschlagen", 500)
		return
	}
	store.mu.Lock()
	store.Aufgaben = append(store.Aufgaben, &TaskMeta{ID: id, Titel: cleanName(title, 120), Lehrer: t.ID, Alle: r.URL.Query().Get("alle") == "1", Datum: time.Now()})
	store.saveMeta()
	store.mu.Unlock()
	w.Write([]byte("ok"))
}

func apiTaskShare(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct {
		ID   string
		Alle bool
	}
	readBody(r, &in)
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, m := range store.Aufgaben {
		if m.ID == in.ID && (m.Lehrer == t.ID || t.Verwalter) {
			m.Alle = in.Alle
			store.saveMeta()
			w.Write([]byte("ok"))
			return
		}
	}
	http.Error(w, "Nur eigene Aufgaben lassen sich ändern.", 403)
}

func apiTaskDelete(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ ID string }
	readBody(r, &in)
	store.mu.Lock()
	defer store.mu.Unlock()
	for i, m := range store.Aufgaben {
		if m.ID == in.ID && (m.Lehrer == t.ID || t.Verwalter) {
			store.Aufgaben = append(store.Aufgaben[:i], store.Aufgaben[i+1:]...)
			os.Remove(filepath.Join(dataDir, "aufgaben", m.ID+".aufgabe"))
			store.saveMeta()
			w.Write([]byte("ok"))
			return
		}
	}
	http.Error(w, "Nur eigene Aufgaben lassen sich löschen.", 403)
}

/* ---------- Beispiele ---------- */

func apiExampleList(w http.ResponseWriter, r *http.Request, t *Teacher) {
	store.mu.Lock()
	defer store.mu.Unlock()
	out := []map[string]any{}
	for _, m := range store.Beispiele {
		if !canSee(t, m.Lehrer, m.Alle) {
			continue
		}
		owner := ""
		if o := store.teacher(m.Lehrer); o != nil {
			owner = o.Name
		}
		out = append(out, map[string]any{"id": m.ID, "titel": m.Titel, "beschreibung": m.Beschreibung, "board": m.Board, "alle": m.Alle, "eigen": m.Lehrer == t.ID, "von": owner, "datum": m.Datum})
	}
	writeJSONResp(w, out)
}

func apiExampleGet(w http.ResponseWriter, r *http.Request, t *Teacher) {
	id := r.URL.Query().Get("id")
	store.mu.Lock()
	var m *ExampleMeta
	for _, x := range store.Beispiele {
		if x.ID == id && canSee(t, x.Lehrer, x.Alle) {
			m = x
		}
	}
	store.mu.Unlock()
	if m == nil {
		http.Error(w, "Nicht gefunden", 404)
		return
	}
	b, err := os.ReadFile(filepath.Join(dataDir, "beispiele", m.ID+".awp"))
	if err != nil {
		http.Error(w, "Nicht gefunden", 404)
		return
	}
	sendProject(w, r.URL.Query().Get("download") == "1", m.Titel+".awp", b)
}

func addExample(t *Teacher, b []byte, titel, beschreibung string, alle bool) error {
	var p map[string]any
	if json.Unmarshal(b, &p) != nil || p["format"] != "arduino-werkstatt" {
		return fmt.Errorf("Das ist keine Werkstatt-Projektdatei (.awp).")
	}
	board, _ := p["board"].(string)
	titel = cleanName(titel, 80)
	if titel == "" {
		titel, _ = p["name"].(string)
	}
	id := newID("b")
	os.MkdirAll(filepath.Join(dataDir, "beispiele"), 0o755)
	if err := writeAtomic(filepath.Join(dataDir, "beispiele", id+".awp"), b); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.Beispiele = append(store.Beispiele, &ExampleMeta{ID: id, Titel: titel, Beschreibung: cleanName(beschreibung, 300), Board: board, Lehrer: t.ID, Alle: alle, Datum: time.Now()})
	return store.saveMeta()
}

func apiExampleFromProject(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct {
		Klasse, Schueler, File, Ordner, Titel, Beschreibung string
		Alle                                                bool
	}
	if readBody(r, &in) != nil {
		http.Error(w, "Ungültige Anfrage", 400)
		return
	}
	store.mu.Lock()
	ok := ownClass(t, in.Klasse) != nil
	store.mu.Unlock()
	dir := studentDir(in.Klasse, in.Schueler)
	if in.Ordner != "" { // aus einer Abgabe
		dir = filepath.Join(classDir(in.Klasse), "abgaben", in.Ordner)
		ok = ok && safeKey(in.Ordner)
	}
	p, ok2 := safeIn(dir, in.File)
	b, err := os.ReadFile(p)
	if !ok || !ok2 || (in.Ordner == "" && !safeKey(in.Schueler)) || err != nil {
		http.Error(w, "Projekt nicht gefunden", 404)
		return
	}
	if err := addExample(t, b, in.Titel, in.Beschreibung, in.Alle); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	w.Write([]byte("ok"))
}

func apiExampleUpload(w http.ResponseWriter, r *http.Request, t *Teacher) {
	b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	if err != nil {
		http.Error(w, "Ungültige Datei", 400)
		return
	}
	q := r.URL.Query()
	if err := addExample(t, b, q.Get("titel"), q.Get("beschreibung"), q.Get("alle") == "1"); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	w.Write([]byte("ok"))
}

func apiExampleShare(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct {
		ID   string
		Alle bool
	}
	readBody(r, &in)
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, m := range store.Beispiele {
		if m.ID == in.ID && (m.Lehrer == t.ID || t.Verwalter) {
			m.Alle = in.Alle
			store.saveMeta()
			w.Write([]byte("ok"))
			return
		}
	}
	http.Error(w, "Nur eigene Beispiele lassen sich ändern.", 403)
}

func apiExampleDelete(w http.ResponseWriter, r *http.Request, t *Teacher) {
	var in struct{ ID string }
	readBody(r, &in)
	store.mu.Lock()
	defer store.mu.Unlock()
	for i, m := range store.Beispiele {
		if m.ID == in.ID && (m.Lehrer == t.ID || t.Verwalter) {
			store.Beispiele = append(store.Beispiele[:i], store.Beispiele[i+1:]...)
			os.Remove(filepath.Join(dataDir, "beispiele", m.ID+".awp"))
			store.saveMeta()
			w.Write([]byte("ok"))
			return
		}
	}
	http.Error(w, "Nur eigene Beispiele lassen sich löschen.", 403)
}
