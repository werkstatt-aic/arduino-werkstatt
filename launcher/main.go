// Startprogramm für die Arduino-Werkstatt (Stick-Version).
// Startet einen kleinen Webserver nur für diesen Rechner, öffnet Chrome als
// App-Fenster und speichert Projekte im Ordner "Projekte" neben dieser Datei.
// Beendet sich selbst, sobald das Fenster geschlossen wurde.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

const version = "0.15.2"

var (
	baseDir    string
	projectDir string
	lastPing   time.Time
	pingMu     sync.Mutex
)

func main() {
	exe, _ := os.Executable()
	baseDir = filepath.Dir(exe)
	if len(os.Args) > 1 && os.Args[1] == "--dir" && len(os.Args) > 2 {
		baseDir = os.Args[2]
	}
	setupMode()
	setupSchool()
	cleanupAfterUpdate()
	// Läuft die Werkstatt aus diesem Ordner schon? Dann nur ein weiteres Fenster öffnen,
	// statt ein zweites Startprogramm zu starten (sonst überschreiben sich die Speicherstände).
	afterUpdate := false
	for _, a := range os.Args[1:] {
		afterUpdate = afterUpdate || a == "--nach-update"
	}
	if afterUpdate {
		time.Sleep(1500 * time.Millisecond) // die alte Version beendet sich gerade
	} else if url := runningInstance(); url != "" {
		openBrowser(url)
		return
	}
	appDir := filepath.Join(baseDir, "app")
	if err := os.MkdirAll(projectDir, 0o755); err != nil && netMode {
		fatal("Der Ordner für die Projekte kann nicht angelegt werden:\n" + projectDir + "\n\n" + err.Error())
	}

	ln, err := listen()
	if err != nil {
		fatal("Es konnte kein freier Anschluss gefunden werden: " + err.Error())
	}
	url := "http://" + ln.Addr().String() + "/"

	mux := http.NewServeMux()
	mux.Handle("/", noCache(http.FileServer(http.Dir(appDir))))
	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		touch()
		fmt.Fprintf(w, `{"ok":true,"version":%q,"folder":%q,"user":%q,"netz":%t,"projekte":%q,"fenster":%q}`, version, baseDir, userName(), netMode, projectDir, windowMode())
	})
	mux.HandleFunc("/api/list", schoolOr("list", apiList))
	mux.HandleFunc("/api/load", schoolOr("load", apiLoad))
	mux.HandleFunc("/api/save", schoolOr("save", apiSave))
	mux.HandleFunc("/api/rename", schoolOr("rename", apiRename))
	mux.HandleFunc("/api/backups", schoolOr("backups", apiBackups))
	mux.HandleFunc("/api/backup", schoolOr("backup", apiBackup))
	initTasks(mux)
	mux.HandleFunc("/api/last", schoolOr("last", func(w http.ResponseWriter, r *http.Request) {
		b, _ := os.ReadFile(filepath.Join(projectDir, ".zuletzt"))
		w.Write(b)
	}))
	registerSchool(mux)
	registerTools(mux)
	registerSettings(mux)

	touch()
	go func() {
		// Beenden, wenn das Fenster längere Zeit nicht mehr "lebt"
		for {
			time.Sleep(5 * time.Second)
			pingMu.Lock()
			idle := time.Since(lastPing)
			pingMu.Unlock()
			if idle > 3*time.Minute {
				os.Exit(0)
			}
		}
	}()
	go openBrowser(url)
	_ = http.Serve(ln, guard(ln.Addr().(*net.TCPAddr).Port, mux))
}

func runningInstance() string {
	c := &http.Client{Timeout: 400 * time.Millisecond}
	for port := 8642; port < 8650; port++ {
		url := fmt.Sprintf("http://127.0.0.1:%d/", port)
		resp, err := c.Get(url + "api/ping")
		if err != nil {
			continue
		}
		var info struct{ Folder, User string }
		json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&info)
		resp.Body.Close()
		// gleicher Ordner UND gleicher Benutzer (auf einem Rechner mit mehreren Anmeldungen nie fremde Werkstatt übernehmen)
		if info.Folder != "" && strings.EqualFold(filepath.Clean(info.Folder), filepath.Clean(baseDir)) && strings.EqualFold(info.User, userName()) {
			return url
		}
	}
	return ""
}

func listen() (net.Listener, error) {
	for port := 8642; port < 8700; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			return ln, nil
		}
	}
	return net.Listen("tcp", "127.0.0.1:0")
}

// Schutz: Nur die Werkstatt selbst darf das Startprogramm steuern. Fremde Webseiten,
// die im selben Browser geöffnet sind, könnten sonst z. B. Projekte überschreiben
// oder ein „Update“ einspielen (Prüfung von Host- und Origin-Kopfzeilen).
func guard(port int, h http.Handler) http.Handler {
	hosts := map[string]bool{
		fmt.Sprintf("127.0.0.1:%d", port): true,
		fmt.Sprintf("localhost:%d", port): true,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !hosts[strings.ToLower(r.Host)] {
			http.Error(w, "Zugriff verweigert", http.StatusForbidden)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			if o := r.Header.Get("Origin"); o != "" && o != "http://"+r.Host {
				http.Error(w, "Zugriff verweigert", http.StatusForbidden)
				return
			}
			if site := r.Header.Get("Sec-Fetch-Site"); site == "cross-site" || site == "same-site" {
				http.Error(w, "Zugriff verweigert", http.StatusForbidden)
				return
			}
		}
		h.ServeHTTP(w, r)
	})
}

func touch() { pingMu.Lock(); lastPing = time.Now(); pingMu.Unlock() }

func noCache(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h.ServeHTTP(w, r)
	})
}

// Nur einfache Dateinamen mit Endung .awp im Ordner "Projekte" zulassen.
func safeFile(name string) (string, bool) {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "" || name == "." || strings.ContainsAny(name, `\/:*?"<>|`) || !strings.HasSuffix(strings.ToLower(name), ".awp") {
		return "", false
	}
	return filepath.Join(projectDir, name), true
}

func apiList(w http.ResponseWriter, r *http.Request) {
	type item struct {
		File     string    `json:"file"`
		Modified time.Time `json:"modified"`
	}
	list := []item{}
	entries, _ := os.ReadDir(projectDir)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".awp") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, item{e.Name(), info.ModTime()})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Modified.After(list[j].Modified) })
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func apiLoad(w http.ResponseWriter, r *http.Request) {
	p, ok := safeFile(r.URL.Query().Get("file"))
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
}

func apiSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	p, ok := safeFile(r.URL.Query().Get("file"))
	if !ok {
		http.Error(w, "Ungültiger Dateiname", 400)
		return
	}
	b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	if err != nil || !json.Valid(b) {
		http.Error(w, "Ungültige Daten", 400)
		return
	}
	backupBeforeSave(p)
	// Erst in eine Hilfsdatei schreiben, dann umbenennen: so bleibt bei einem
	// Absturz oder abgezogenem Stick die alte Fassung erhalten.
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		http.Error(w, "Schreiben fehlgeschlagen: "+err.Error(), 500)
		return
	}
	if err := os.Rename(tmp, p); err != nil {
		os.Remove(p)
		if err2 := os.Rename(tmp, p); err2 != nil {
			http.Error(w, "Speichern fehlgeschlagen: "+err2.Error(), 500)
			return
		}
	}
	_ = os.WriteFile(filepath.Join(projectDir, ".zuletzt"), []byte(filepath.Base(p)), 0o644)
	w.Write([]byte("ok"))
}

// Benennt ein Projekt um. Ein vorhandenes Projekt mit dem neuen Namen wird nie überschrieben.
func apiRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	from, ok1 := safeFile(r.URL.Query().Get("from"))
	to, ok2 := safeFile(r.URL.Query().Get("to"))
	if !ok1 || !ok2 {
		http.Error(w, "Ungültiger Dateiname", 400)
		return
	}
	if _, err := os.Stat(from); err != nil {
		w.Write([]byte("ok")) // noch nicht gespeichert: nichts zu tun
		return
	}
	if _, err := os.Stat(to); err == nil && !strings.EqualFold(from, to) {
		http.Error(w, "Ein Projekt mit diesem Namen gibt es schon.", 409)
		return
	}
	if err := os.Rename(from, to); err != nil {
		http.Error(w, "Umbenennen fehlgeschlagen: "+err.Error(), 500)
		return
	}
	_ = os.Rename(backupDir(from), backupDir(to)) // Sicherungen mitnehmen
	_ = os.WriteFile(filepath.Join(projectDir, ".zuletzt"), []byte(filepath.Base(to)), 0o644)
	w.Write([]byte("ok"))
}

func openBrowser(url string) {
	if runtime.GOOS == "windows" {
		candidates := []string{
			filepath.Join(os.Getenv("ProgramFiles"), `Google\Chrome\Application\chrome.exe`),
			filepath.Join(os.Getenv("ProgramFiles(x86)"), `Google\Chrome\Application\chrome.exe`),
			filepath.Join(os.Getenv("LocalAppData"), `Google\Chrome\Application\chrome.exe`),
			filepath.Join(os.Getenv("ProgramFiles(x86)"), `Microsoft\Edge\Application\msedge.exe`),
			filepath.Join(os.Getenv("ProgramFiles"), `Microsoft\Edge\Application\msedge.exe`),
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				args := append([]string{"--app=" + url, "--new-window"}, windowArgs()...)
				if exec.Command(c, args...).Start() == nil {
					return
				}
			}
		}
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
		return
	}
	for _, c := range []string{"google-chrome", "chromium", "chromium-browser", "xdg-open", "open"} {
		if p, err := exec.LookPath(c); err == nil {
			args := []string{url}
			if strings.Contains(c, "chrom") {
				args = append([]string{"--app=" + url}, windowArgs()...)
			}
			if exec.Command(p, args...).Start() == nil {
				return
			}
		}
	}
	fmt.Println("Bitte im Browser öffnen:", url)
}

func fatal(msg string) {
	if runtime.GOOS == "windows" {
		_ = exec.Command("mshta", `javascript:alert("`+strings.ReplaceAll(msg, `"`, `'`)+`");close()`).Run()
	}
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}

/* ---------- Sicherungskopien ---------- */
// Vor dem Überschreiben eines Projekts wird höchstens alle 5 Minuten die alte
// Fassung in "Projekte/.sicherungen/<Projekt>/" abgelegt (die letzten 15 bleiben).

const backupEvery = 5 * time.Minute
const backupKeep = 15

func backupDir(projectFile string) string {
	return filepath.Join(projectDir, ".sicherungen", strings.TrimSuffix(filepath.Base(projectFile), filepath.Ext(projectFile)))
}

func backupList(projectFile string) []string {
	entries, _ := os.ReadDir(backupDir(projectFile))
	names := []string{}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".awp") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names) // Dateinamen sind Zeitstempel: alt → neu
	return names
}

func backupBeforeSave(p string) {
	info, err := os.Stat(p)
	if err != nil {
		return // neues Projekt
	}
	dir := backupDir(p)
	names := backupList(p)
	if len(names) > 0 {
		// Zeitpunkt der letzten Sicherung (Änderungsdatum der Sicherungsdatei)
		if bi, err := os.Stat(filepath.Join(dir, names[len(names)-1])); err == nil && time.Since(bi.ModTime()) < backupEvery {
			return
		}
	}
	b, err := os.ReadFile(p)
	if err != nil || os.MkdirAll(dir, 0o755) != nil {
		return
	}
	_ = os.WriteFile(filepath.Join(dir, info.ModTime().Format("2006-01-02_15-04-05")+".awp"), b, 0o644)
	names = backupList(p)
	for len(names) > backupKeep {
		os.Remove(filepath.Join(dir, names[0]))
		names = names[1:]
	}
}

func apiBackups(w http.ResponseWriter, r *http.Request) {
	p, ok := safeFile(r.URL.Query().Get("file"))
	if !ok {
		http.Error(w, "Ungültiger Dateiname", 400)
		return
	}
	names := backupList(p)
	out := []string{}
	for i := len(names) - 1; i >= 0; i-- { // neueste zuerst
		out = append(out, strings.TrimSuffix(names[i], ".awp"))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

func apiBackup(w http.ResponseWriter, r *http.Request) {
	p, ok := safeFile(r.URL.Query().Get("file"))
	v := r.URL.Query().Get("v")
	if !ok || strings.ContainsAny(v, `\/:.`) || v == "" {
		http.Error(w, "Ungültige Angabe", 400)
		return
	}
	b, err := os.ReadFile(filepath.Join(backupDir(p), v+".awp"))
	if err != nil {
		http.Error(w, "Sicherung nicht gefunden", 404)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(b)
}

func userName() string {
	if u := os.Getenv("USERNAME"); u != "" {
		return u
	}
	return os.Getenv("USER")
}
