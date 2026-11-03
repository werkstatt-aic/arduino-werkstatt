package main

// Projekte eines Schülers: dieselben Regeln wie im Startprogramm der Werkstatt
// (nur *.awp, Sicherungen höchstens alle 5 Minuten, die letzten 15 bleiben).

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type fileItem struct {
	File     string    `json:"file"`
	Modified time.Time `json:"modified"`
}

func safeIn(dir, name string) (string, bool) {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "" || name == "." || strings.ContainsAny(name, `\/:*?"<>|`) || !strings.HasSuffix(strings.ToLower(name), ".awp") {
		return "", false
	}
	return filepath.Join(dir, name), true
}

func listProjects(dir string) []fileItem {
	list := []fileItem{}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".awp") {
			continue
		}
		if info, err := e.Info(); err == nil {
			list = append(list, fileItem{e.Name(), info.ModTime()})
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Modified.After(list[j].Modified) })
	return list
}

func backupDirIn(dir, p string) string {
	return filepath.Join(dir, ".sicherungen", strings.TrimSuffix(filepath.Base(p), filepath.Ext(p)))
}

func backupNames(dir, p string) []string {
	entries, _ := os.ReadDir(backupDirIn(dir, p))
	names := []string{}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".awp") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

func backupBefore(dir, p string) {
	info, err := os.Stat(p)
	if err != nil {
		return
	}
	bd := backupDirIn(dir, p)
	names := backupNames(dir, p)
	if len(names) > 0 {
		if bi, err := os.Stat(filepath.Join(bd, names[len(names)-1])); err == nil && time.Since(bi.ModTime()) < 5*time.Minute {
			return
		}
	}
	b, err := os.ReadFile(p)
	if err != nil || os.MkdirAll(bd, 0o755) != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(bd, info.ModTime().Format("2006-01-02_15-04-05")+".awp"), b, 0o644)
	names = backupNames(dir, p)
	for len(names) > 15 {
		os.Remove(filepath.Join(bd, names[0]))
		names = names[1:]
	}
}

func writeAtomic(p string, b []byte) error {
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmp, p); err != nil {
		os.Remove(p)
		return os.Rename(tmp, p)
	}
	return nil
}

// Projekt-Schnittstelle für einen Ordner (list, load, save, rename, backups, backup, last, solved).
// onSave wird nach erfolgreichem Speichern aufgerufen (Live-Stand im Klassenzimmer).
func projectAPI(w http.ResponseWriter, r *http.Request, op, dir string, onSave func(file string)) {
	q := r.URL.Query()
	switch op {
	case "list":
		writeJSONResp(w, listProjects(dir))
	case "load":
		p, ok := safeIn(dir, q.Get("file"))
		if !ok {
			http.Error(w, "Ungültiger Dateiname", 400)
			return
		}
		b, err := os.ReadFile(p)
		if err != nil {
			http.Error(w, "Datei nicht gefunden", 404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	case "save":
		if r.Method != http.MethodPost {
			http.Error(w, "Nur POST", 405)
			return
		}
		p, ok := safeIn(dir, q.Get("file"))
		if !ok {
			http.Error(w, "Ungültiger Dateiname", 400)
			return
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
		if err != nil || !json.Valid(b) {
			http.Error(w, "Ungültige Daten", 400)
			return
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			http.Error(w, "Ordner kann nicht angelegt werden", 500)
			return
		}
		backupBefore(dir, p)
		if err := writeAtomic(p, b); err != nil {
			http.Error(w, "Speichern fehlgeschlagen: "+err.Error(), 500)
			return
		}
		_ = os.WriteFile(filepath.Join(dir, ".zuletzt"), []byte(filepath.Base(p)), 0o644)
		if onSave != nil {
			onSave(filepath.Base(p))
		}
		w.Write([]byte("ok"))
	case "rename":
		if r.Method != http.MethodPost {
			http.Error(w, "Nur POST", 405)
			return
		}
		from, ok1 := safeIn(dir, q.Get("from"))
		to, ok2 := safeIn(dir, q.Get("to"))
		if !ok1 || !ok2 {
			http.Error(w, "Ungültiger Dateiname", 400)
			return
		}
		if _, err := os.Stat(from); err != nil {
			w.Write([]byte("ok"))
			return
		}
		if _, err := os.Stat(to); err == nil && !strings.EqualFold(from, to) {
			http.Error(w, "Ein Projekt mit diesem Namen gibt es schon.", 409)
			return
		}
		if err := os.Rename(from, to); err != nil {
			http.Error(w, "Umbenennen fehlgeschlagen", 500)
			return
		}
		_ = os.Rename(backupDirIn(dir, from), backupDirIn(dir, to))
		_ = os.WriteFile(filepath.Join(dir, ".zuletzt"), []byte(filepath.Base(to)), 0o644)
		if onSave != nil {
			onSave(filepath.Base(to))
		}
		w.Write([]byte("ok"))
	case "backups":
		p, ok := safeIn(dir, q.Get("file"))
		if !ok {
			http.Error(w, "Ungültiger Dateiname", 400)
			return
		}
		names := backupNames(dir, p)
		out := []string{}
		for i := len(names) - 1; i >= 0; i-- {
			out = append(out, strings.TrimSuffix(names[i], ".awp"))
		}
		writeJSONResp(w, out)
	case "backup":
		p, ok := safeIn(dir, q.Get("file"))
		v := q.Get("v")
		if !ok || v == "" || strings.ContainsAny(v, `\/:.`) {
			http.Error(w, "Ungültige Angabe", 400)
			return
		}
		b, err := os.ReadFile(filepath.Join(backupDirIn(dir, p), v+".awp"))
		if err != nil {
			http.Error(w, "Sicherung nicht gefunden", 404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	case "last":
		b, _ := os.ReadFile(filepath.Join(dir, ".zuletzt"))
		w.Write(b)
	case "solved":
		p := filepath.Join(dir, ".geloest.json")
		if r.Method == http.MethodPost {
			b, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
			if err != nil || !json.Valid(b) {
				http.Error(w, "Ungültige Daten", 400)
				return
			}
			_ = os.MkdirAll(dir, 0o755)
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
	default:
		http.NotFound(w, r)
	}
}

func writeJSONResp(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func readBody(r *http.Request, v any) error {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}
