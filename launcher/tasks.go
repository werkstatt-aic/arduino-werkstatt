package main

// Aufgabenkarten: eigene Aufgaben der Lehrkraft liegen als .aufgabe-Dateien (JSON) im Ordner
// "Aufgaben" neben "Projekte". Welche Aufgaben gelöst sind, steht in "Projekte/.geloest.json".
// Beim Update bleiben beide Ordner unberührt.

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var taskDir string

func initTasks(mux *http.ServeMux) {
	taskDir = filepath.Join(baseDir, "Aufgaben")
	mux.HandleFunc("/api/tasks", apiTasks)
	mux.HandleFunc("/api/task-save", apiTaskSave)
	mux.HandleFunc("/api/task-delete", apiTaskDelete)
	mux.HandleFunc("/api/solved", apiSolved)
}

// Nur einfache Dateinamen mit Endung .aufgabe zulassen.
func safeTaskFile(name string) (string, bool) {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "" || name == "." || strings.ContainsAny(name, `\/:*?"<>|`) || !strings.HasSuffix(strings.ToLower(name), ".aufgabe") {
		return "", false
	}
	return filepath.Join(taskDir, name), true
}

// Liefert alle eigenen Aufgaben als Liste; jede bekommt ihren Dateinamen im Feld "file".
func apiTasks(w http.ResponseWriter, r *http.Request) {
	list := []json.RawMessage{}
	entries, _ := os.ReadDir(taskDir)
	names := []string{}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".aufgabe") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	for _, n := range names {
		b, err := os.ReadFile(filepath.Join(taskDir, n))
		if err != nil {
			continue
		}
		var m map[string]any
		if json.Unmarshal(b, &m) != nil {
			continue // beschädigte Datei überspringen
		}
		m["file"] = n
		out, _ := json.Marshal(m)
		list = append(list, out)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func apiTaskSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	p, ok := safeTaskFile(r.URL.Query().Get("file"))
	if !ok {
		http.Error(w, "Ungültiger Dateiname", 400)
		return
	}
	b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	if err != nil || !json.Valid(b) {
		http.Error(w, "Ungültige Daten", 400)
		return
	}
	if err := os.MkdirAll(taskDir, 0o755); err != nil {
		http.Error(w, "Ordner „Aufgaben“ kann nicht angelegt werden: "+err.Error(), 500)
		return
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		http.Error(w, "Schreiben fehlgeschlagen: "+err.Error(), 500)
		return
	}
	os.Remove(p)
	if err := os.Rename(tmp, p); err != nil {
		http.Error(w, "Speichern fehlgeschlagen: "+err.Error(), 500)
		return
	}
	w.Write([]byte("ok"))
}

func apiTaskDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	p, ok := safeTaskFile(r.URL.Query().Get("file"))
	if !ok {
		http.Error(w, "Ungültiger Dateiname", 400)
		return
	}
	if err := os.Remove(p); err != nil {
		http.Error(w, "Löschen fehlgeschlagen", 404)
		return
	}
	w.Write([]byte("ok"))
}

// GET: gelöste Aufgaben {id: Datum}; POST: ersetzt die Liste.
func apiSolved(w http.ResponseWriter, r *http.Request) {
	p := filepath.Join(projectDir, ".geloest.json")
	if r.Method == http.MethodPost {
		b, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil || !json.Valid(b) {
			http.Error(w, "Ungültige Daten", 400)
			return
		}
		if err := os.WriteFile(p, b, 0o644); err != nil {
			http.Error(w, "Speichern fehlgeschlagen", 500)
			return
		}
		w.Write([]byte("ok"))
		return
	}
	b, err := os.ReadFile(p)
	if err != nil || !json.Valid(b) {
		b = []byte("{}")
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(b)
}
