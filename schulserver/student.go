package main

// Schnittstelle für die Werkstatt der Schüler (über deren Startprogramm weitergeleitet).
// Anmeldung: Stundencode + Tisch + Vorname → Schüler-Token (Kopfzeile X-Werkstatt-Token).

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

func registerStudent(mux *http.ServeMux) {
	mux.HandleFunc("/api/s/join", apiJoin)
	mux.HandleFunc("/api/s/", apiStudent)
}

var tischRe = regexp.MustCompile(`^\d{1,2}$`)

func apiJoin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	var in struct{ Code, Tisch, Vorname string }
	if readBody(r, &in) != nil {
		http.Error(w, "Ungültige Anfrage", 400)
		return
	}
	in.Code = strings.TrimSpace(in.Code)
	in.Vorname = cleanName(in.Vorname, 30)
	n := 0
	for _, c := range in.Tisch {
		n = n*10 + int(c-'0')
	}
	if !tischRe.MatchString(strings.TrimSpace(in.Tisch)) || n < 1 || n > 18 {
		http.Error(w, "Bitte die Tisch-Nummer (1–18) wählen.", 400)
		return
	}
	if !regexp.MustCompile(`\p{L}`).MatchString(in.Vorname) {
		http.Error(w, "Bitte den Vornamen eingeben.", 400)
		return
	}
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	var room *Room
	for _, rm := range s.Raeume {
		if rm.Code == in.Code {
			room = rm
		}
	}
	if room == nil || s.class(room.Klasse) == nil {
		http.Error(w, "Diesen Stundencode gibt es nicht (mehr). Bitte den Code von der Tafel abschreiben.", 404)
		return
	}
	tisch := padTisch(in.Tisch)
	key := studentKey(tisch, in.Vorname)
	tok := token(24)
	s.Sitzungen[tok] = &StudentSession{Klasse: room.Klasse, Tisch: tisch, Vorname: in.Vorname, Seit: time.Now()}
	lv := room.Schueler[key]
	if lv == nil {
		lv = &Live{Tisch: tisch, Vorname: in.Vorname}
		room.Schueler[key] = lv
	}
	lv.Gesehen = time.Now()
	s.dirty = true
	writeJSONResp(w, map[string]any{"token": tok, "klasse": s.class(room.Klasse).Name, "tisch": tisch, "vorname": in.Vorname, "zustand": stateOf(room, lv)})
}

// Zustand für die Werkstatt des Schülers
func stateOf(room *Room, lv *Live) map[string]any {
	st := map[string]any{"raum": room != nil, "modus": "normal"}
	if room == nil {
		return st
	}
	st["modus"] = room.Modus
	st["aufgabe"] = room.Aufgabe
	st["pruefung"] = room.Pruefung
	if lv != nil && room.Modus == "pruefung" && !lv.Abgegeben.IsZero() {
		st["abgegeben"] = lv.Abgegeben
	}
	return st
}

func apiStudent(w http.ResponseWriter, r *http.Request) {
	op := strings.TrimPrefix(r.URL.Path, "/api/s/")
	s := store
	s.mu.Lock()
	sess := s.Sitzungen[r.Header.Get("X-Werkstatt-Token")]
	if sess == nil || s.class(sess.Klasse) == nil {
		s.mu.Unlock()
		http.Error(w, "Nicht angemeldet – bitte mit dem Stundencode neu anmelden.", 401)
		return
	}
	key := studentKey(sess.Tisch, sess.Vorname)
	room := s.Raeume[sess.Klasse]
	var lv *Live
	if room != nil {
		lv = room.Schueler[key]
		if lv == nil {
			lv = &Live{Tisch: sess.Tisch, Vorname: sess.Vorname}
			room.Schueler[key] = lv
		}
		lv.Gesehen = time.Now()
		s.dirty = true
	}
	exam := room != nil && room.Modus == "pruefung"
	examStart := time.Time{}
	if exam {
		examStart, _ = time.Parse(time.RFC3339, room.Pruefung)
	}
	klasse := sess.Klasse
	s.mu.Unlock()
	dir := studentDir(klasse, key)

	switch op {
	case "state":
		s.mu.Lock()
		if lv != nil {
			if p := r.URL.Query().Get("projekt"); p != "" {
				lv.Projekt = cleanName(p, 120)
			}
		}
		st := stateOf(room, lv)
		s.mu.Unlock()
		writeJSONResp(w, st)
	case "event":
		var in struct {
			Art   string
			Dauer int
		}
		if readBody(r, &in) != nil || (in.Art != "verlassen" && in.Art != "zurueck") {
			http.Error(w, "Ungültig", 400)
			return
		}
		s.mu.Lock()
		if lv != nil {
			lv.Ereignisse = append(lv.Ereignisse, Event{Zeit: time.Now(), Art: in.Art, Dauer: in.Dauer})
			if len(lv.Ereignisse) > 200 {
				lv.Ereignisse = lv.Ereignisse[len(lv.Ereignisse)-200:]
			}
			lv.Draussen = in.Art == "verlassen"
		}
		s.mu.Unlock()
		w.Write([]byte("ok"))
	case "abgabe":
		if r.Method != http.MethodPost || !exam {
			http.Error(w, "Es läuft keine Prüfung.", 409)
			return
		}
		p, ok := safeIn(dir, r.URL.Query().Get("file"))
		b, err := os.ReadFile(p)
		if !ok || err != nil {
			http.Error(w, "Projekt nicht gefunden – bitte zuerst speichern.", 404)
			return
		}
		ad := filepath.Join(classDir(klasse), "abgaben", examFolder(room.Pruefung))
		if os.MkdirAll(ad, 0o755) != nil || writeAtomic(filepath.Join(ad, key+".awp"), b) != nil {
			http.Error(w, "Abgabe konnte nicht gespeichert werden.", 500)
			return
		}
		s.mu.Lock()
		if lv != nil {
			lv.Abgegeben = time.Now()
		}
		s.dirty = true
		s.mu.Unlock()
		w.Write([]byte("ok"))
	case "aufgaben":
		if exam {
			writeJSONResp(w, []any{})
			return
		}
		writeJSONResp(w, visibleTasks(klasse))
	case "beispiele":
		if exam {
			writeJSONResp(w, []any{})
			return
		}
		writeJSONResp(w, visibleExamples(klasse))
	case "beispiel":
		id := r.URL.Query().Get("id")
		if exam || !exampleVisible(klasse, id) {
			http.Error(w, "Nicht verfügbar", 404)
			return
		}
		b, err := os.ReadFile(filepath.Join(dataDir, "beispiele", id+".awp"))
		if err != nil {
			http.Error(w, "Nicht gefunden", 404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	case "list", "load", "backups", "backup", "last":
		if exam {
			// Prüfung: nur Projekte, die seit Beginn der Prüfung gespeichert wurden
			if !examAllowed(dir, op, r, examStart) {
				if op == "list" {
					out := []fileItem{}
					for _, f := range listProjects(dir) {
						if !f.Modified.Before(examStart) {
							out = append(out, f)
						}
					}
					writeJSONResp(w, out)
					return
				}
				if op == "last" {
					return
				}
				http.Error(w, "Während der Prüfung können keine älteren Projekte geöffnet werden.", 403)
				return
			}
		}
		projectAPI(w, r, op, dir, nil)
	case "save", "rename", "solved":
		projectAPI(w, r, op, dir, func(file string) {
			s.mu.Lock()
			if lv != nil {
				lv.Projekt = strings.TrimSuffix(file, ".awp")
				lv.Geaendert = time.Now()
			}
			s.dirty = true
			s.mu.Unlock()
		})
	default:
		http.NotFound(w, r)
	}
}

// Während der Prüfung: nur Projekte (und deren Sicherungen), die nach Prüfungsbeginn gespeichert wurden
func examAllowed(dir, op string, r *http.Request, start time.Time) bool {
	if op == "list" || op == "last" {
		return false // wird gefiltert
	}
	p, ok := safeIn(dir, r.URL.Query().Get("file"))
	if !ok {
		return false
	}
	info, err := os.Stat(p)
	if err != nil || info.ModTime().Before(start) {
		return false
	}
	if op == "backup" { // Sicherungen nur aus der Prüfungszeit
		v := r.URL.Query().Get("v")
		t, err := time.ParseInLocation("2006-01-02_15-04-05", v, time.Local)
		return err == nil && !t.Before(start.Add(-time.Second))
	}
	return true
}

func examFolder(id string) string {
	t, err := time.Parse(time.RFC3339, id)
	if err != nil {
		return "Pruefung"
	}
	return t.Local().Format("2006-01-02_15-04")
}

func visibleTasks(klasse string) []json.RawMessage {
	s := store
	s.mu.Lock()
	c := s.class(klasse)
	metas := append([]*TaskMeta{}, s.Aufgaben...)
	s.mu.Unlock()
	out := []json.RawMessage{}
	for _, m := range metas {
		if c == nil || !(m.Alle || m.Lehrer == c.Lehrer) {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dataDir, "aufgaben", m.ID+".aufgabe"))
		if err != nil || !json.Valid(b) {
			continue
		}
		out = append(out, b)
	}
	return out
}

func exampleVisible(klasse, id string) bool {
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	c := s.class(klasse)
	for _, m := range s.Beispiele {
		if m.ID == id && c != nil && (m.Alle || m.Lehrer == c.Lehrer) {
			return true
		}
	}
	return false
}

func visibleExamples(klasse string) []*ExampleMeta {
	s := store
	s.mu.Lock()
	defer s.mu.Unlock()
	c := s.class(klasse)
	out := []*ExampleMeta{}
	for _, m := range s.Beispiele {
		if c != nil && (m.Alle || m.Lehrer == c.Lehrer) {
			out = append(out, m)
		}
	}
	return out
}
