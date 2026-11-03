// Schulversion: Steht in der werkstatt.ini „Schulserver = http://<Server>:8650“, meldet sich der
// Schüler mit Stundencode, Tisch und Vorname an. Projekte, gelöste Aufgaben, Prüfungsmodus,
// Abgabe, Aufgaben und Beispiele laufen dann über den Schulserver. Übersetzen und Hochladen
// bleiben auf diesem Rechner. Die Oberfläche spricht weiterhin nur mit diesem Startprogramm;
// es reicht die Anfragen mit dem Schüler-Token an den Server weiter (keine fremden Adressen im Browser).
package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	schoolURL   string // leer = keine Schulversion
	schoolMu    sync.Mutex
	schoolToken string
	schoolWho   json.RawMessage // Anmeldedaten (Klasse, Tisch, Vorname) für die Oberfläche
	schoolHTTP  = &http.Client{Timeout: 20 * time.Second}
)

func setupSchool() {
	u := strings.TrimRight(strings.TrimSpace(iniValues["schulserver"]), "/")
	if u != "" && !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "http://" + u
	}
	schoolURL = u
}

func schoolTok() string {
	schoolMu.Lock()
	defer schoolMu.Unlock()
	return schoolToken
}

// Leitet eine Anfrage an den Schulserver weiter und gibt die Antwort unverändert zurück.
func forward(w http.ResponseWriter, r *http.Request, path string) {
	tok := schoolTok()
	if tok == "" {
		http.Error(w, "Nicht angemeldet – bitte mit dem Stundencode anmelden.", 401)
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	target := schoolURL + path
	if r.URL.RawQuery != "" {
		target += "?" + r.URL.RawQuery
	}
	req, err := http.NewRequest(r.Method, target, bytes.NewReader(body))
	if err != nil {
		http.Error(w, "Ungültige Anfrage", 400)
		return
	}
	req.Header.Set("X-Werkstatt-Token", tok)
	req.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	resp, err := schoolHTTP.Do(req)
	if err != nil {
		http.Error(w, "Keine Verbindung zum Schulserver ("+schoolURL+"). Ist das Schulnetz erreichbar?", 502)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 { // Sitzung abgelaufen (z. B. Klasse gelöscht)
		schoolMu.Lock()
		schoolToken = ""
		schoolMu.Unlock()
	}
	if ct := resp.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, io.LimitReader(resp.Body, 20<<20))
}

// Ist kein Werkstatt-Fenster mehr offen (kein Lebenszeichen), wird der Schüler abgemeldet –
// so übernimmt auf einem Gastkonto der nächste Schüler nicht die Anmeldung des vorigen.
func schoolAutoLogout() {
	for {
		time.Sleep(5 * time.Second)
		pingMu.Lock()
		idle := time.Since(lastPing)
		pingMu.Unlock()
		if idle > 3*time.Minute {
			schoolMu.Lock()
			schoolToken, schoolWho = "", nil
			schoolMu.Unlock()
		}
	}
}

func registerSchool(mux *http.ServeMux) {
	if schoolURL != "" {
		go schoolAutoLogout()
	}
	mux.HandleFunc("/api/schule/info", func(w http.ResponseWriter, r *http.Request) {
		schoolMu.Lock()
		defer schoolMu.Unlock()
		out := map[string]any{"schule": schoolURL != "", "server": schoolURL, "angemeldet": schoolToken != ""}
		if schoolToken != "" {
			out["wer"] = schoolWho
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})
	mux.HandleFunc("/api/schule/join", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || schoolURL == "" {
			http.Error(w, "Nicht verfügbar", 405)
			return
		}
		body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
		resp, err := schoolHTTP.Post(schoolURL+"/api/s/join", "application/json", bytes.NewReader(body))
		if err != nil {
			http.Error(w, "Keine Verbindung zum Schulserver ("+schoolURL+"). Ist das Schulnetz erreichbar?", 502)
			return
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		if resp.StatusCode != 200 {
			w.WriteHeader(resp.StatusCode)
			w.Write(b)
			return
		}
		var m map[string]any
		if json.Unmarshal(b, &m) != nil || m["token"] == nil {
			http.Error(w, "Unerwartete Antwort vom Schulserver", 502)
			return
		}
		schoolMu.Lock()
		schoolToken, _ = m["token"].(string)
		delete(m, "token") // das Token bleibt im Startprogramm
		schoolWho, _ = json.Marshal(m)
		schoolMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Write(schoolWho)
	})
	mux.HandleFunc("/api/schule/abmelden", func(w http.ResponseWriter, r *http.Request) {
		schoolMu.Lock()
		schoolToken, schoolWho = "", nil
		schoolMu.Unlock()
		w.Write([]byte("ok"))
	})
	for _, op := range []string{"state", "event", "abgabe", "beispiele", "beispiel"} {
		op := op
		mux.HandleFunc("/api/schule/"+op, func(w http.ResponseWriter, r *http.Request) { forward(w, r, "/api/s/"+op) })
	}
}

// Projekt-Schnittstelle: in der Schulversion an den Server weiterreichen, sonst lokal.
func schoolOr(op string, local http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if schoolURL == "" {
			local(w, r)
			return
		}
		forward(w, r, "/api/s/"+op)
	}
}

// Aufgaben: eigene Aufgaben im Ordner „Aufgaben“ und – in der Schulversion – die vom Server
func tasksWithSchool(local http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if schoolURL == "" || schoolTok() == "" {
			local(w, r)
			return
		}
		rec := &bufWriter{h: http.Header{}}
		local(rec, r)
		var list []json.RawMessage
		json.Unmarshal(rec.buf.Bytes(), &list)
		req, _ := http.NewRequest("GET", schoolURL+"/api/s/aufgaben", nil)
		req.Header.Set("X-Werkstatt-Token", schoolTok())
		if resp, err := schoolHTTP.Do(req); err == nil {
			var srv []json.RawMessage
			if resp.StatusCode == 200 && json.NewDecoder(resp.Body).Decode(&srv) == nil {
				list = append(list, srv...)
			}
			resp.Body.Close()
		}
		if list == nil {
			list = []json.RawMessage{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(list)
	}
}

type bufWriter struct {
	h   http.Header
	buf bytes.Buffer
}

func (b *bufWriter) Header() http.Header         { return b.h }
func (b *bufWriter) Write(p []byte) (int, error) { return b.buf.Write(p) }
func (b *bufWriter) WriteHeader(int)             {}
