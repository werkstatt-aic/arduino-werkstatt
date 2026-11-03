// Einstellungen: Versionsinfo, Updates, Werkzeuge prüfen, Zwischenspeicher
// leeren, ESP32 komplett löschen, Zeitmessung beim Übersetzen.
package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

// GitHub-Ablage, in der neue Versionen als "Release" mit ZIP-Datei liegen.
// Leer = Update-Suche noch nicht eingerichtet (nur Update aus ZIP-Datei).
const updateRepo = "werkstatt-aic/arduino-werkstatt"

func registerSettings(mux *http.ServeMux) {
	mux.HandleFunc("/api/info", apiInfo)
	mux.HandleFunc("/api/cache/clear", apiCacheClear)
	mux.HandleFunc("/api/tools/check", apiToolsCheck)
	mux.HandleFunc("/api/tools/netprep", apiNetPrep)
	mux.HandleFunc("/api/esp32/erase", apiEspErase)
	mux.HandleFunc("/api/update/check", apiUpdateCheck)
	mux.HandleFunc("/api/update/install", apiUpdateInstall)
}

/* ---------- Info ---------- */

func dirSize(p string) int64 {
	var n int64
	filepath.Walk(p, func(_ string, fi os.FileInfo, err error) error {
		if err == nil && !fi.IsDir() {
			n += fi.Size()
		}
		return nil
	})
	return n
}

func apiInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version":    version,
		"folder":     baseDir,
		"ready":      toolsReadyFor("uno"),
		"readyEsp32": toolsReadyFor("esp32"),
		"cacheMB":    dirSize(workDir()) >> 20,
		"updateRepo": updateRepoName() != "" || os.Getenv("WERKSTATT_UPDATE_API") != "",
		"netz":       netMode,
		"schreibbar": writable,
		"projekte":   projectDir,
	})
}

func updateRepoName() string { return updateRepo }

/* ---------- Zwischenspeicher ---------- */

func apiCacheClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	s := newStream(w)
	if !lock(s) {
		return
	}
	defer unlock()
	s.line("##SCHRITT 1 Zwischenspeicher leeren")
	d := workDir()
	mb := dirSize(d) >> 20
	lastBuild = ""
	if err := os.RemoveAll(d); err != nil {
		s.line("%s", err.Error())
		s.line("##FEHLER Der Zwischenspeicher konnte nicht vollständig gelöscht werden.")
		return
	}
	s.line("##OK Zwischenspeicher geleert (%d MB). Das nächste Übersetzen dauert wieder länger.", mb)
}

/* ---------- Werkzeuge prüfen ---------- */

func apiToolsCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	s := newStream(w)
	if !lock(s) {
		return
	}
	defer unlock()
	if _, err := os.Stat(cliPath()); err != nil {
		s.line("##FEHLER Die Werkzeuge sind noch nicht eingerichtet. Das geschieht automatisch beim ersten Hochladen.")
		return
	}
	s.line("##SCHRITT 1 Übersetzungsprogramm prüfen")
	if err := runCLI(s, "version"); err != nil {
		s.line("##FEHLER Das Übersetzungsprogramm startet nicht. Bitte die Werkzeuge neu einrichten.")
		return
	}
	s.line("##SCHRITT 2 Mikrocontroller-Pakete prüfen")
	out, _ := cliOutput("core", "list", "--format", "json")
	missing := []string{}
	for _, b := range []struct{ id, name, board string }{{"arduino:avr", "Arduino Uno", "uno"}, {"esp32:esp32", "ESP32", "esp32"}} {
		has := bytes.Contains(out, []byte(`"`+b.id+`"`))
		if toolsReadyFor(b.board) && !has {
			missing = append(missing, "Paket "+b.name)
		}
		if has {
			s.line("%s: vorhanden", b.name)
		} else {
			s.line("%s: nicht eingerichtet", b.name)
		}
	}
	s.line("##SCHRITT 3 Bibliotheken prüfen")
	out, _ = cliOutput("lib", "list", "--format", "json")
	want := append([]string{}, libraries...)
	if toolsReadyFor("esp32") {
		want = append(want, "ESP32Servo")
	}
	for _, l := range want {
		if bytes.Contains(out, []byte(`"name": "`+l+`"`)) || bytes.Contains(out, []byte(`"name":"`+l+`"`)) {
			s.line("%s: vorhanden", l)
		} else {
			s.line("%s: FEHLT", l)
			missing = append(missing, l)
		}
	}
	if len(missing) > 0 {
		s.line("##FEHLER Es fehlt: %s. Mit „Neu einrichten“ wird es ergänzt.", strings.Join(missing, ", "))
		return
	}
	s.line("##OK Alle Werkzeuge sind vollständig.")
}

// Für die Netzwerk-Version vorbereiten (Lehrkraft, mit Schreibrechten im Original-Ordner):
// alle Bibliotheken, die sonst erst beim ersten Gebrauch nachgeladen würden, jetzt einrichten.
func apiNetPrep(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	s := newStream(w)
	if !lock(s) {
		return
	}
	defer unlock()
	if !writable {
		s.line("##FEHLER %s", readOnlyMsg)
		return
	}
	if !toolsReadyFor("uno") || !toolsReadyFor("esp32") {
		s.line("##FEHLER Bitte zuerst „Uno neu einrichten“ und „ESP32 neu einrichten“ ausführen (Internet nötig).")
		return
	}
	s.line("##SCHRITT 1 Alle Bibliotheken einrichten (Internet nötig)")
	want := append([]string{}, libraries...)
	want = append(want, "ESP32Servo", nimbleLib)
	for _, l := range lateLibraries {
		want = append(want, l.lib)
	}
	if err := runCLI(s, append([]string{"lib", "install"}, want...)...); err != nil {
		s.line("##FEHLER Einrichten fehlgeschlagen. Besteht eine Internetverbindung?")
		return
	}
	s.line("##SCHRITT 2 Prüfen")
	if err := runCLI(s, "version"); err != nil {
		s.line("##FEHLER Das Übersetzungsprogramm startet nicht.")
		return
	}
	s.line("##OK Fertig. Alle Bibliotheken sind eingerichtet – die Werkstatt kann jetzt schreibgeschützt im Netzwerk laufen (siehe LIESMICH, Abschnitt NETZWERK-VERSION).")
}

func cliOutput(args ...string) ([]byte, error) {
	cmd := exec.Command(cliPath(), append([]string{"--config-file", configPath()}, args...)...)
	hideWindow(cmd)
	return cmd.Output()
}

/* ---------- ESP32 komplett löschen ---------- */

// Sucht das Übertragungsprogramm esptool im ESP32-Paket (neueste Version).
func findEsptool() (path string, major int) {
	base := filepath.Join(toolsDir(), "arduino15", "packages", "esp32", "tools", "esptool_py")
	entries, _ := os.ReadDir(base)
	names := []string{}
	for _, e := range entries {
		if e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Slice(names, func(i, j int) bool { return versionLess(names[i], names[j]) })
	exe := "esptool"
	if runtime.GOOS == "windows" {
		exe += ".exe"
	}
	for i := len(names) - 1; i >= 0; i-- {
		for _, cand := range []string{exe, "esptool.py"} {
			p := filepath.Join(base, names[i], cand)
			if _, err := os.Stat(p); err == nil {
				m, _ := strconv.Atoi(strings.SplitN(names[i], ".", 2)[0])
				return p, m
			}
		}
	}
	return "", 0
}

func apiEspErase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	s := newStream(w)
	if !lock(s) {
		return
	}
	defer unlock()
	port := strings.TrimSpace(r.URL.Query().Get("port"))
	if port == "" {
		s.line("##FEHLER Kein Anschluss gewählt.")
		return
	}
	tool, major := findEsptool()
	if tool == "" {
		s.line("##FEHLER Das ESP32-Paket ist noch nicht eingerichtet. Lade zuerst einmal ein Programm auf den ESP32 hoch.")
		return
	}
	cmdName := "erase-flash" // esptool ab Version 5
	if major > 0 && major < 5 {
		cmdName = "erase_flash"
	}
	s.line("##SCHRITT 1 ESP32 komplett löschen (%s)", port)
	if err := runExe(s, nil, nil, tool, "--chip", "esp32", "--port", port, cmdName); err != nil {
		s.line("##FEHLER Das Löschen hat nicht geklappt.")
		return
	}
	s.line("##OK Der ESP32 ist jetzt leer. Lade als Nächstes ganz normal ein Programm hoch (für Bluetooth mit gesetztem Haken).")
}

/* ---------- Updates ---------- */

var verRe = regexp.MustCompile(`\d+`)

func versionLess(a, b string) bool {
	x, y := verRe.FindAllString(a, -1), verRe.FindAllString(b, -1)
	for i := 0; i < len(x) || i < len(y); i++ {
		var p, q int
		if i < len(x) {
			p, _ = strconv.Atoi(x[i])
		}
		if i < len(y) {
			q, _ = strconv.Atoi(y[i])
		}
		if p != q {
			return p < q
		}
	}
	return false
}

type releaseInfo struct {
	Tag    string `json:"tag_name"`
	Name   string `json:"name"`
	Body   string `json:"body"`
	Assets []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
		Size int64  `json:"size"`
	} `json:"assets"`
}

func releaseAPI() string {
	if u := os.Getenv("WERKSTATT_UPDATE_API"); u != "" { // nur für Tests
		return u
	}
	if updateRepoName() == "" {
		return ""
	}
	return "https://api.github.com/repos/" + updateRepoName() + "/releases/latest"
}

var httpClient = &http.Client{Timeout: 10 * time.Minute, Transport: &http.Transport{Proxy: http.ProxyFromEnvironment}}

// Neueste Version suchen: in der Datei update/version.json der Ablage (schnell, ohne
// Abfrage-Grenze) und unter den GitHub-Releases. Die neuere von beiden gewinnt.
func latestRelease() (*releaseInfo, string, error) {
	r1, u1, e1 := latestFromRepo()
	r2, u2, e2 := latestFromReleases()
	switch {
	case e1 == nil && e2 == nil:
		if versionLess(r2.Tag, r1.Tag) || u2 == "" {
			return r1, u1, nil
		}
		return r2, u2, nil
	case e1 == nil:
		return r1, u1, nil
	case e2 == nil:
		return r2, u2, nil
	}
	return nil, "", e2
}

func repoUpdateURL() string {
	if u := os.Getenv("WERKSTATT_UPDATE_RAW"); u != "" { // nur für Tests
		return u
	}
	if updateRepoName() == "" {
		return ""
	}
	return "https://raw.githubusercontent.com/" + updateRepoName() + "/main/update/version.json"
}

func latestFromRepo() (*releaseInfo, string, error) {
	src := repoUpdateURL()
	if src == "" {
		return nil, "", fmt.Errorf("Die Update-Suche ist noch nicht eingerichtet.")
	}
	// GitHub liefert raw-Dateien bis zu 5 Minuten aus dem Zwischenspeicher: eigene Adresse je Abfrage
	sep := "?"
	if strings.Contains(src, "?") {
		sep = "&"
	}
	req, _ := http.NewRequest("GET", src+sep+"t="+strconv.FormatInt(time.Now().Unix(), 10), nil)
	req.Header.Set("User-Agent", "Arduino-Werkstatt/"+version)
	req.Header.Set("Cache-Control", "no-cache")
	c := *httpClient
	c.Timeout = 15 * time.Second
	resp, err := c.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("Keine Verbindung zum Update-Server. Besteht eine Internetverbindung?")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, "", fmt.Errorf("Keine Update-Datei gefunden (%d).", resp.StatusCode)
	}
	var v struct {
		Version string `json:"version"`
		Zip     string `json:"zip"`
		Notes   string `json:"notes"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&v); err != nil || v.Version == "" || v.Zip == "" {
		return nil, "", fmt.Errorf("Die Update-Datei ist unverständlich.")
	}
	zip := v.Zip
	if !strings.HasPrefix(zip, "https://") && !strings.HasPrefix(zip, "http://") {
		zip = src[:strings.LastIndex(src, "/")+1] + zip // relativ zur version.json
	}
	if strings.Contains(zip, "raw.githubusercontent.com") && !strings.Contains(zip, "?") {
		zip += "?v=" + v.Version // je Version eine eigene Adresse, damit nicht die ZIP der Vorversion kommt
	}
	return &releaseInfo{Tag: v.Version, Body: v.Notes}, zip, nil
}

func latestFromReleases() (*releaseInfo, string, error) {
	api := releaseAPI()
	if api == "" {
		return nil, "", fmt.Errorf("Die Update-Suche ist noch nicht eingerichtet.")
	}
	req, _ := http.NewRequest("GET", api, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "Arduino-Werkstatt/"+version)
	c := *httpClient
	c.Timeout = 15 * time.Second
	resp, err := c.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("Keine Verbindung zum Update-Server. Besteht eine Internetverbindung?")
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, "", fmt.Errorf("Es wurde noch keine Version veröffentlicht.")
	}
	if resp.StatusCode == 403 || resp.StatusCode == 429 {
		return nil, "", fmt.Errorf("Der Update-Server ist gerade ausgelastet oder gesperrt (zu viele Anfragen aus diesem Netz). Bitte später noch einmal versuchen – oder das Update als ZIP-Datei einspielen.")
	}
	if resp.StatusCode != 200 {
		return nil, "", fmt.Errorf("Der Update-Server antwortet nicht wie erwartet (%d).", resp.StatusCode)
	}
	var rel releaseInfo
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&rel); err != nil {
		return nil, "", fmt.Errorf("Die Antwort des Update-Servers ist unverständlich.")
	}
	url := ""
	for _, a := range rel.Assets {
		if strings.HasSuffix(strings.ToLower(a.Name), ".zip") {
			url = a.URL
			break
		}
	}
	return &rel, url, nil
}

func apiUpdateCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	rel, url, err := latestRelease()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": err.Error(), "current": version})
		return
	}
	latest := strings.TrimPrefix(strings.TrimPrefix(rel.Tag, "v"), "V")
	json.NewEncoder(w).Encode(map[string]any{
		"ok": true, "current": version, "latest": latest,
		"newer": versionLess(version, latest) && url != "",
		"notes": rel.Body, "hasZip": url != "",
	})
}

// Installiert ein Update: ?from=github lädt die neueste Version herunter,
// sonst wird die ZIP-Datei im Body erwartet. Ersetzt nur "app", die Startdatei
// sowie LIESMICH und Notstart. "Werkzeuge", "Projekte" und "Aufgaben" bleiben unberührt.
func apiUpdateInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	s := newStream(w)
	if !lock(s) {
		return
	}
	defer unlock()
	if !writable {
		s.line("##FEHLER %s", readOnlyMsg)
		return
	}
	var data []byte
	if r.URL.Query().Get("from") == "github" {
		s.line("##SCHRITT 1 Neue Version herunterladen")
		_, url, err := latestRelease()
		if err == nil && url == "" {
			err = fmt.Errorf("Zur neuesten Version gibt es keine ZIP-Datei.")
		}
		if err != nil {
			s.line("##FEHLER %s", err.Error())
			return
		}
		data, err = download(s, url)
		if err != nil {
			s.line("%s", err.Error())
			s.line("##FEHLER Das Herunterladen hat nicht geklappt.")
			return
		}
	} else {
		s.line("##SCHRITT 1 ZIP-Datei übernehmen")
		var err error
		data, err = io.ReadAll(io.LimitReader(r.Body, 300<<20))
		if err != nil || len(data) == 0 {
			s.line("##FEHLER Keine ZIP-Datei erhalten.")
			return
		}
	}
	s.line("##SCHRITT 2 Neue Version auspacken und prüfen")
	newVer, err := installZip(s, data)
	if err != nil {
		s.line("%s", err.Error())
		s.line("##FEHLER Das Update wurde nicht eingespielt. Die bisherige Version bleibt erhalten.")
		return
	}
	s.line("##OK Version %s ist eingespielt. Die Werkstatt startet jetzt neu …", newVer)
	go restartSoon()
}

func download(s *stream, url string) ([]byte, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Arduino-Werkstatt/"+version)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Antwort %d", resp.StatusCode)
	}
	var buf bytes.Buffer
	total := resp.ContentLength
	chunk := make([]byte, 64<<10)
	last := -1
	for {
		n, err := resp.Body.Read(chunk)
		buf.Write(chunk[:n])
		if buf.Len() > 300<<20 {
			return nil, fmt.Errorf("Datei zu groß")
		}
		if total > 0 {
			if p := int(int64(buf.Len()) * 100 / total); p != last {
				last = p
				s.line("##FORTSCHRITT %d", p)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

func installZip(s *stream, data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("Das ist keine gültige ZIP-Datei.")
	}
	// Wurzel der Werkstatt in der ZIP-Datei finden (dort, wo app/index.html liegt)
	prefix := ""
	found := false
	for _, f := range zr.File {
		n := strings.ReplaceAll(f.Name, `\`, "/")
		if strings.HasSuffix(n, "app/index.html") {
			prefix = strings.TrimSuffix(n, "app/index.html")
			found = true
			break
		}
	}
	if !found {
		return "", fmt.Errorf("In der ZIP-Datei ist keine Arduino-Werkstatt enthalten.")
	}
	exeName := filepath.Base(mustExe())
	stage := filepath.Join(baseDir, ".update-neu")
	os.RemoveAll(stage)
	if err := os.MkdirAll(stage, 0o755); err != nil {
		return "", err
	}
	defer os.RemoveAll(stage)
	gotExe := false
	for _, f := range zr.File {
		n := strings.ReplaceAll(f.Name, `\`, "/")
		if !strings.HasPrefix(n, prefix) || f.FileInfo().IsDir() {
			continue
		}
		rel := strings.TrimPrefix(n, prefix)
		top := strings.SplitN(rel, "/", 2)[0]
		// Nur Programmteile übernehmen – niemals Werkzeuge oder Projekte
		if !(top == "app" || (!strings.Contains(rel, "/") && (strings.HasSuffix(strings.ToLower(rel), ".exe") || strings.HasSuffix(strings.ToLower(rel), ".txt") || strings.HasSuffix(strings.ToLower(rel), ".bat") || strings.EqualFold(rel, "werkstatt-vorlage.ini")))) { // werkstatt.ini selbst bleibt unberührt
			continue
		}
		dst := filepath.Join(stage, filepath.FromSlash(rel))
		if !strings.HasPrefix(dst, stage+string(os.PathSeparator)) {
			continue // Schutz vor "../"-Pfaden
		}
		if strings.HasSuffix(strings.ToLower(rel), ".exe") && !strings.Contains(rel, "/") {
			gotExe = true
			dst = filepath.Join(stage, "neu.exe")
		}
		if err := extractFile(f, dst); err != nil {
			return "", err
		}
	}
	newVer := "?"
	if b, err := os.ReadFile(filepath.Join(stage, "LIESMICH.txt")); err == nil {
		if m := regexp.MustCompile(`Testversion (\d+\.\d+\.\d+)|Version (\d+\.\d+\.\d+)`).FindSubmatch(b); m != nil {
			newVer = string(append(m[1], m[2]...))
		}
	}
	s.line("Gefunden: Version %s", newVer)
	if runtime.GOOS == "windows" && !gotExe {
		return "", fmt.Errorf("In der ZIP-Datei fehlt die Startdatei.")
	}
	s.line("##SCHRITT 3 Alte Version ersetzen")
	old := filepath.Join(baseDir, ".update-alt")
	os.RemoveAll(old)
	os.MkdirAll(old, 0o755)
	appDir := filepath.Join(baseDir, "app")
	if err := os.Rename(appDir, filepath.Join(old, "app")); err != nil {
		return "", fmt.Errorf("Der Ordner „app“ ist gesperrt: %v", err)
	}
	if err := os.Rename(filepath.Join(stage, "app"), appDir); err != nil {
		os.Rename(filepath.Join(old, "app"), appDir) // zurück
		return "", fmt.Errorf("Die neue Version konnte nicht abgelegt werden: %v", err)
	}
	if gotExe {
		exe := mustExe()
		// Eine laufende .exe kann unter Windows umbenannt, aber nicht überschrieben werden.
		if err := os.Rename(exe, exe+".alt"); err != nil {
			s.line("Die Startdatei konnte nicht ersetzt werden: %v", err)
		} else if err := os.Rename(filepath.Join(stage, "neu.exe"), exe); err != nil {
			os.Rename(exe+".alt", exe)
			s.line("Die Startdatei konnte nicht ersetzt werden: %v", err)
		}
	}
	entries, _ := os.ReadDir(stage)
	for _, e := range entries {
		if e.IsDir() || e.Name() == "neu.exe" {
			continue
		}
		os.Rename(filepath.Join(stage, e.Name()), filepath.Join(baseDir, e.Name()))
	}
	_ = exeName
	return newVer, nil
}

func extractFile(f *zip.File, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, io.LimitReader(rc, 200<<20))
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	return err
}

func mustExe() string {
	if p := os.Getenv("WERKSTATT_EXE"); p != "" { // nur für Tests
		return p
	}
	exe, _ := os.Executable()
	return exe
}

// Startet die (neue) Startdatei und beendet diese hier. Die neue öffnet ein
// neues Fenster; das alte Fenster schließt sich selbst.
var restartSoon = func() {
	time.Sleep(1500 * time.Millisecond)
	if os.Getenv("WERKSTATT_NO_RESTART") != "" { // nur für Tests
		return
	}
	cmd := exec.Command(mustExe(), "--nach-update")
	cmd.Dir = baseDir
	_ = cmd.Start()
	os.Exit(0)
}

// Aufräumen nach einem Update (beim nächsten Start)
func cleanupAfterUpdate() {
	os.RemoveAll(filepath.Join(baseDir, ".update-alt"))
	os.RemoveAll(filepath.Join(baseDir, ".update-neu"))
	os.Remove(mustExe() + ".alt")
}

/* ---------- Zeitmessung beim Übersetzen ---------- */

type phaseTimer struct {
	t0, tp          time.Time
	cur             string
	order           []string
	dur             map[string]time.Duration
	reused, compile int
}

func newPhaseTimer() *phaseTimer {
	now := time.Now()
	return &phaseTimer{t0: now, tp: now, cur: "Start", dur: map[string]time.Duration{}}
}

var phases = []struct{ prefix, name string }{
	{"Detecting libraries used", "Bibliotheken suchen"},
	{"Generating function prototypes", "Vorbereiten"},
	{"Compiling sketch", "Programm"},
	{"Compiling libraries", "Bibliotheken"},
	{"Compiling core", "Kern"},
	{"Linking everything together", "Zusammenfügen"},
}

func (t *phaseTimer) switchTo(name string) {
	now := time.Now()
	if _, ok := t.dur[t.cur]; !ok {
		t.order = append(t.order, t.cur)
	}
	t.dur[t.cur] += now.Sub(t.tp)
	t.cur, t.tp = name, now
}

// line wertet eine Zeile der ausführlichen Ausgabe aus und gibt zurück, ob sie
// im Protokoll erscheinen soll (Befehlszeilen werden nur gezählt).
func (t *phaseTimer) line(l string) bool {
	for _, p := range phases {
		if strings.HasPrefix(l, p.prefix) {
			t.switchTo(p.name)
			return false
		}
	}
	if strings.HasPrefix(l, "Using previously compiled file") || strings.HasPrefix(l, "Using precompiled") {
		t.reused++
		return false
	}
	low := strings.ToLower(l)
	isCmd := (strings.Contains(low, "-g++") || strings.Contains(low, "-gcc") || strings.Contains(low, "esptool") ||
		strings.Contains(low, "ctags") || strings.Contains(low, "-ar ") || strings.Contains(low, "-ar\"") ||
		strings.Contains(low, "-objcopy") || strings.Contains(low, "-size")) &&
		(strings.HasPrefix(l, "/") || strings.HasPrefix(l, "\"") || (len(l) > 2 && l[1] == ':'))
	if isCmd {
		if t.cur == "Programm" || t.cur == "Bibliotheken" || t.cur == "Kern" {
			if strings.Contains(l, " -c ") || strings.Contains(l, "-MMD") {
				t.compile++
			}
		}
		return false
	}
	if strings.HasPrefix(l, "Alternatives for") || strings.HasPrefix(l, "ResolveLibrary") || strings.HasPrefix(l, "  -> candidates") ||
		strings.HasPrefix(l, "Using cached library dependencies") || strings.HasPrefix(l, "Using library ") ||
		strings.HasPrefix(l, "Using board ") || strings.HasPrefix(l, "Using core ") || strings.HasPrefix(l, "FQBN:") ||
		strings.HasPrefix(l, "Compiling library") || strings.HasPrefix(l, "/usr/bin/env ") || strings.HasPrefix(strings.ToLower(l), "cmd /c") ||
		strings.HasPrefix(l, "esptool v") || strings.HasPrefix(l, "Creating ESP32 image") || strings.HasPrefix(l, "Merged ") ||
		strings.HasPrefix(l, "Successfully created") || strings.HasPrefix(l, "Wrote 0x") {
		return false
	}
	return true
}

func (t *phaseTimer) summary() string {
	t.switchTo("Ende")
	parts := []string{}
	for _, n := range t.order {
		if n == "Start" {
			n2 := "Starten"
			if d := t.dur[n]; d >= 100*time.Millisecond {
				parts = append(parts, fmt.Sprintf("%s %s", n2, secs(d)))
			}
			continue
		}
		if n == "Zusammenfügen" {
			parts = append(parts, fmt.Sprintf("Zusammenfügen und Abschluss %s", secs(t.dur[n])))
			continue
		}
		parts = append(parts, fmt.Sprintf("%s %s", n, secs(t.dur[n])))
	}
	return fmt.Sprintf("Zeitmessung: %s · neu übersetzt: %d Dateien, wiederverwendet: %d", strings.Join(parts, " · "), t.compile, t.reused)
}

func secs(d time.Duration) string {
	return strings.Replace(fmt.Sprintf("%.1f s", d.Seconds()), ".", ",", 1)
}
