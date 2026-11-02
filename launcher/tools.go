// Werkzeuge zum Übersetzen und Hochladen (arduino-cli) im Ordner "Werkzeuge".
// Einmalige Einrichtung lädt arduino-cli, das AVR-Paket und die Bibliotheken.
package main

import (
	"archive/zip"
	"bufio"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

var (
	toolsMu      sync.Mutex
	toolsBusy    bool
	toolsKind    string // "pre" = Vorübersetzen im Hintergrund
	withEspIndex bool   // ESP32-Paketliste nur während der ESP32-Einrichtung verwenden
)

// Bibliotheken, die die Blöcke benötigen (Abhängigkeiten installiert arduino-cli selbst).
var libraries = []string{
	"LiquidCrystal I2C", "Servo", "Adafruit NeoPixel", "Keypad",
	"Adafruit ADS1X15", "Adafruit INA219", "Adafruit SSD1306", "Adafruit GFX Library",
	"DHT sensor library",
}

// Bibliotheken, die erst später dazugekommen sind: werden beim ersten Gebrauch nachinstalliert
// (Kopfdatei im Programm → Bibliothek, Ordnername im Bibliotheksordner).
var lateLibraries = []struct{ header, lib, dir, what string }{
	{"<DHT.h>", "DHT sensor library", "DHT_sensor_library", "Baustein für den Sensor DHT"},
}

func libInstalled(dir string) bool {
	_, err := os.Stat(filepath.Join(toolsDir(), "bibliotheken", "libraries", dir, "library.properties"))
	return err == nil
}

const esp32Index = "https://espressif.github.io/arduino-esp32/package_esp32_index.json"

// Marker-Datei je Mikrocontroller: "uno" oder "esp32"
func markerFile(board string) string {
	if board == "esp32" {
		return filepath.Join(toolsDir(), "bereit-esp32.txt")
	}
	return filepath.Join(toolsDir(), "bereit.txt")
}

func boardOf(fqbn string) string {
	if strings.HasPrefix(fqbn, "esp32:") {
		return "esp32"
	}
	return "uno"
}

func toolsDir() string { return filepath.Join(baseDir, "Werkzeuge") }

// Zwischendateien beim Übersetzen auf der Festplatte (Temp-Ordner) statt auf dem USB-Stick:
// Sticks sind bei vielen kleinen Dateien sehr langsam. Pro Werkstatt-Ordner ein eigener Unterordner.
func workDir() string {
	h := fnv.New32a()
	h.Write([]byte(strings.ToLower(baseDir)))
	d := filepath.Join(os.TempDir(), "arduino-werkstatt", fmt.Sprintf("%08x", h.Sum32()))
	if err := os.MkdirAll(d, 0o755); err != nil {
		return toolsDir()
	}
	return d
}

func cliPath() string {
	name := "arduino-cli"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(toolsDir(), "arduino-cli", name)
}

func cliURL() string {
	if u := os.Getenv("WERKSTATT_CLI_URL"); u != "" { // nur für Tests
		return u
	}
	switch runtime.GOOS {
	case "windows":
		return "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip"
	case "darwin":
		return "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_macOS_64bit.tar.gz"
	default:
		return "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz"
	}
}

func boardManager() string {
	if withEspIndex {
		return "board_manager:\n  additional_urls:\n    - " + esp32Index + "\n"
	}
	return "board_manager:\n  additional_urls: []\n"
}

// Die Konfiguration wird bei jedem Start neu geschrieben, weil der Stick
// auf jedem Rechner einen anderen Laufwerksbuchstaben haben kann.
func configPath() string {
	d := toolsDir()
	p := filepath.Join(d, "arduino-cli.yaml")
	q := func(s string) string { return `"` + filepath.ToSlash(s) + `"` }
	cfg := "directories:\n" +
		"  data: " + q(filepath.Join(d, "arduino15")) + "\n" +
		"  downloads: " + q(filepath.Join(d, "downloads")) + "\n" +
		"  user: " + q(filepath.Join(d, "bibliotheken")) + "\n" +
		boardManager() +
		"updater:\n  enable_notification: false\n" +
		"metrics:\n  enabled: false\n"
	_ = os.MkdirAll(d, 0o755)
	_ = os.WriteFile(p, []byte(cfg), 0o644)
	return p
}

func toolsReady() bool { return toolsReadyFor("uno") }

func toolsReadyFor(board string) bool {
	_, err1 := os.Stat(cliPath())
	_, err2 := os.Stat(markerFile(board))
	return err1 == nil && err2 == nil
}

// Schlanke Bluetooth-Bibliothek für den Empfänger (feste Version, damit die
// Werkstatt und der Empfänger auf dem ESP32 sicher zusammenpassen).
const nimbleLib = "NimBLE-Arduino@2.5.2"

func nimbleInstalled() bool {
	_, err := os.Stat(filepath.Join(toolsDir(), "bibliotheken", "libraries", "NimBLE-Arduino", "library.properties"))
	return err == nil
}

func registerTools(mux *http.ServeMux) {
	mux.HandleFunc("/api/tools", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ready": toolsReady(), "readyEsp32": toolsReadyFor("esp32"), "os": runtime.GOOS})
	})
	mux.HandleFunc("/api/tools/install", apiInstall)
	mux.HandleFunc("/api/ports", apiPorts)
	mux.HandleFunc("/api/upload", apiUpload)
	mux.HandleFunc("/api/firmware", apiFirmware)
}

/* ---------- Ausgabe Zeile für Zeile an den Browser ---------- */

type stream struct {
	w  http.ResponseWriter
	f  http.Flusher
	mu sync.Mutex
}

func newStream(w http.ResponseWriter) *stream {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	f, _ := w.(http.Flusher)
	return &stream{w: w, f: f}
}

func (s *stream) line(format string, a ...any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	fmt.Fprintf(s.w, format+"\n", a...)
	if s.f != nil {
		s.f.Flush()
	}
	touch()
}

// Sperre für arduino-cli-Vorgänge. Ein laufendes Vorübersetzen im Hintergrund wird abgewartet.
func lock(s *stream) bool { return lockWait(s, false) }

func unlock() { toolsMu.Lock(); toolsBusy = false; toolsMu.Unlock() }

// Führt arduino-cli aus und reicht die Ausgabe weiter. Liefert den Fehler zurück.
func runCLI(s *stream, args ...string) error { return runCLIx(s, nil, args...) }

// Zusätzliche Umgebungsvariablen für den nächsten runCLIx-Aufruf (nur unter lock()).
var cliExtraEnv []string

// runCLIx: wie runCLI, aber jede Zeile geht zuerst an keep; nur wenn keep true
// liefert (oder nil ist), wird sie angezeigt.
func runCLIx(s *stream, keep func(string) bool, args ...string) error {
	full := append([]string{"--config-file", configPath()}, args...)
	env := append([]string{"ARDUINO_UPDATER_ENABLE_NOTIFICATION=false"}, cliExtraEnv...)
	return runExe(s, keep, env, cliPath(), full...)
}

func runExe(s *stream, keep func(string) bool, env []string, exe string, full ...string) error {
	cmd := exec.Command(exe, full...)
	hideWindow(cmd)
	cmd.Env = append(os.Environ(), env...)
	pr, pw := io.Pipe()
	cmd.Stdout = pw
	cmd.Stderr = pw
	if err := cmd.Start(); err != nil {
		return err
	}
	done := make(chan struct{})
	go func() {
		sc := bufio.NewScanner(pr)
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		for sc.Scan() {
			t := strings.TrimRight(sc.Text(), "\r")
			if t != "" && (keep == nil || keep(t)) {
				s.line("%s", t)
			}
		}
		close(done)
	}()
	err := cmd.Wait()
	pw.Close()
	<-done
	return err
}

/* ---------- Einrichtung ---------- */

func apiInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	s := newStream(w)
	if !lock(s) {
		return
	}
	defer unlock()
	fail := func(msg string, err error) {
		if err != nil {
			msg += ": " + err.Error()
		}
		s.line("##FEHLER %s", msg)
	}

	if _, err := os.Stat(cliPath()); err != nil {
		s.line("##SCHRITT 1 Arduino-Werkzeug herunterladen")
		if err := downloadCLI(s); err != nil {
			fail("Herunterladen fehlgeschlagen. Besteht eine Internetverbindung?", err)
			return
		}
	}
	board := r.URL.Query().Get("board")
	withEspIndex = board == "esp32"
	defer func() { withEspIndex = false }()
	s.line("##SCHRITT 2 Liste der Arduino-Pakete laden")
	if err := runCLI(s, "core", "update-index"); err != nil {
		fail("Die Paketliste konnte nicht geladen werden. Besteht eine Internetverbindung?", nil)
		return
	}
	libs := libraries
	if board == "esp32" {
		s.line("##SCHRITT 3 Paket für den ESP32 installieren (groß, dauert einige Minuten)")
		if err := runCLI(s, "core", "install", "esp32:esp32"); err != nil {
			fail("Das ESP32-Paket konnte nicht installiert werden.", nil)
			return
		}
		libs = append(append([]string{}, libraries...), "ESP32Servo", nimbleLib)
	} else {
		s.line("##SCHRITT 3 Paket für Arduino Uno installieren (dauert etwas)")
		if err := runCLI(s, "core", "install", "arduino:avr"); err != nil {
			fail("Das Arduino-Paket konnte nicht installiert werden.", nil)
			return
		}
	}
	s.line("##SCHRITT 4 Bibliotheken installieren (LCD, Servo, NeoPixel, Tastenfeld, Messmodule, OLED, DHT)")
	if err := runCLI(s, append([]string{"lib", "install"}, libs...)...); err != nil {
		fail("Die Bibliotheken konnten nicht installiert werden.", nil)
		return
	}
	fqbnCache = map[string]string{}
	lastBuild = ""
	// Nach dem (Neu-)Einrichten alles einmal frisch übersetzen.
	_ = os.Remove(filepath.Join(workDir(), "export-"+board, stampName))
	_ = os.WriteFile(markerFile(board), []byte("Eingerichtet am "+time.Now().Format("02.01.2006 15:04")+"\r\n"), 0o644)
	s.line("##OK Die Werkzeuge sind eingerichtet.")
}

type progressReader struct {
	r     io.Reader
	n     int64
	total int64
	last  time.Time
	s     *stream
}

func (p *progressReader) Read(b []byte) (int, error) {
	n, err := p.r.Read(b)
	p.n += int64(n)
	if time.Since(p.last) > 400*time.Millisecond {
		p.last = time.Now()
		if p.total > 0 {
			p.s.line("##FORTSCHRITT %d", p.n*100/p.total)
		}
		p.s.line("%.1f MB geladen", float64(p.n)/1e6)
	}
	return n, err
}

func downloadCLI(s *stream) error {
	dir := filepath.Join(toolsDir(), "arduino-cli")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	url := cliURL()
	s.line("Lade %s", url)
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("Server antwortet mit %s", resp.Status)
	}
	tmp := filepath.Join(dir, "download.tmp")
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, &progressReader{r: resp.Body, total: resp.ContentLength, s: s})
	f.Close()
	if err != nil {
		return err
	}
	defer os.Remove(tmp)
	s.line("Entpacken …")
	if strings.HasSuffix(url, ".zip") {
		return unzipCLI(tmp, dir)
	}
	cmd := exec.Command("tar", "-xzf", tmp, "-C", dir)
	return cmd.Run()
}

func unzipCLI(src, dir string) error {
	zr, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer zr.Close()
	for _, f := range zr.File {
		name := filepath.Base(f.Name)
		if f.FileInfo().IsDir() || !strings.HasPrefix(strings.ToLower(name), "arduino-cli") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	if _, err := os.Stat(cliPath()); err != nil {
		return fmt.Errorf("arduino-cli nicht im Archiv gefunden")
	}
	return nil
}

/* ---------- Anschlüsse ---------- */

type portInfo struct {
	Port  string `json:"port"`
	Label string `json:"label"`
	Board string `json:"board"`
	Fqbn  string `json:"fqbn"`
}

func apiPorts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if _, err := os.Stat(cliPath()); err != nil {
		w.Write([]byte("[]"))
		return
	}
	cmd := exec.Command(cliPath(), "--config-file", configPath(), "board", "list", "--format", "json")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		w.Write([]byte("[]"))
		return
	}
	json.NewEncoder(w).Encode(parsePorts(out))
}

func parsePorts(out []byte) []portInfo {
	type board struct {
		Name string `json:"name"`
		Fqbn string `json:"fqbn"`
	}
	type entry struct {
		Port struct {
			Address  string            `json:"address"`
			Protocol string            `json:"protocol"`
			Label    string            `json:"protocol_label"`
			Props    map[string]string `json:"properties"`
		} `json:"port"`
		Boards []board `json:"matching_boards"`
	}
	var entries []entry
	var wrapped struct {
		Ports []entry `json:"detected_ports"`
	}
	if json.Unmarshal(out, &wrapped) == nil && wrapped.Ports != nil {
		entries = wrapped.Ports
	} else {
		_ = json.Unmarshal(out, &entries)
	}
	res := []portInfo{}
	for _, e := range entries {
		if e.Port.Protocol != "" && e.Port.Protocol != "serial" {
			continue
		}
		p := portInfo{Port: e.Port.Address}
		if len(e.Boards) > 0 {
			p.Board, p.Fqbn = e.Boards[0].Name, e.Boards[0].Fqbn
		}
		vid := strings.ToLower(e.Port.Props["vid"])
		switch {
		case p.Board != "":
			p.Label = p.Board
		case vid == "0x1a86":
			p.Label = "Arduino-Nachbau (CH340)"
		case vid == "0x10c4":
			p.Label = "ESP32 (CP2102)"
		case vid == "0x0403":
			p.Label = "FTDI-Adapter"
		case vid == "0x2341" || vid == "0x2a03":
			p.Label = "Arduino"
		case vid != "" || strings.Contains(strings.ToUpper(e.Port.Label), "USB"):
			p.Label = "USB-Gerät"
		default:
			p.Label = "Serieller Anschluss (kein USB)"
		}
		res = append(res, p)
	}
	return res
}

/* ---------- Zusatzeinstellungen prüfen ---------- */

// Prüft Zusatzeinstellungen wie "PartitionScheme=min_spiffs" gegen das installierte
// Paket und lässt unbekannte weg, statt dass das Übersetzen abbricht.
var fqbnCache = map[string]string{} // nur unter lock() verwenden

func sanitizeFQBN(s *stream, fqbn string) string {
	if v, ok := fqbnCache[fqbn]; ok {
		return v
	}
	v, ok := sanitizeFQBNUncached(s, fqbn)
	if ok {
		fqbnCache[fqbn] = v
	}
	return v
}

func sanitizeFQBNUncached(s *stream, fqbn string) (string, bool) {
	parts := strings.SplitN(fqbn, ":", 4)
	if len(parts) < 4 {
		return fqbn, true
	}
	base := strings.Join(parts[:3], ":")
	cmd := exec.Command(cliPath(), "--config-file", configPath(), "board", "details", "-b", base, "--format", "json")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		s.line("Hinweis: Zusatzeinstellungen konnten nicht geprüft werden, es gelten die Standardwerte.")
		return base, false
	}
	var det struct {
		Options []struct {
			Option string `json:"option"`
			Values []struct {
				Value string `json:"value"`
			} `json:"values"`
		} `json:"config_options"`
	}
	_ = json.Unmarshal(out, &det)
	valid := map[string]map[string]bool{}
	for _, o := range det.Options {
		valid[o.Option] = map[string]bool{}
		for _, v := range o.Values {
			valid[o.Option][v.Value] = true
		}
	}
	keep := []string{}
	for _, kv := range strings.Split(parts[3], ",") {
		k, v, _ := strings.Cut(kv, "=")
		if valid[k] != nil && valid[k][v] {
			keep = append(keep, kv)
		} else {
			s.line("Hinweis: Einstellung %s wird von diesem Paket nicht unterstützt und weggelassen.", kv)
		}
	}
	if len(keep) == 0 {
		return base, true
	}
	return base + ":" + strings.Join(keep, ","), true
}

// Liefert das zuletzt übersetzte Programm als .bin-Datei (für die Übertragung per Bluetooth).
func apiFirmware(w http.ResponseWriter, r *http.Request) {
	dir := filepath.Join(workDir(), "export-"+boardOf(r.URL.Query().Get("fqbn")))
	p := filepath.Join(dir, "werkstatt.ino.bin")
	b, err := os.ReadFile(p)
	if err != nil {
		http.Error(w, "Keine übersetzte Datei gefunden", 404)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-MD5", fmt.Sprintf("%x", md5.Sum(b)))
	w.Write(b)
}

/* ---------- Übersetzen und Hochladen ---------- */

// Übersetzt (und überträgt, wenn ein Anschluss angegeben ist) ein Programm.
// Mit ?pre=1 wird nur im Hintergrund vorübersetzt: Das Ergebnis wird gemerkt,
// und ein späteres Hochladen desselben Programms überspringt das Übersetzen.
func apiUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Nur POST", 405)
		return
	}
	s := newStream(w)
	q := r.URL.Query()
	port := strings.TrimSpace(q.Get("port"))
	pre := q.Get("pre") == "1"
	fqbn := q.Get("fqbn")
	if fqbn == "" {
		fqbn = "arduino:avr:uno"
	}
	if !toolsReadyFor(boardOf(fqbn)) {
		s.line("##FEHLER Die Werkzeuge für diesen Mikrocontroller sind noch nicht eingerichtet.")
		return
	}
	code, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil || len(code) == 0 {
		s.line("##FEHLER Kein Programm erhalten.")
		return
	}
	sum := sha256.Sum256(append([]byte(fqbn+"\n"), code...))
	hash := hex.EncodeToString(sum[:])

	stepShown := false
	if pre {
		preMu.Lock()
		preLatest = hash
		preMu.Unlock()
	} else if busyWithPre() {
		s.line("##SCHRITT 1 Programm übersetzen")
		s.line("##INFO Das Übersetzen läuft schon im Hintergrund – einen Moment …")
		stepShown = true
	}
	if !lockWait(s, pre) {
		return
	}
	defer unlock()
	if pre {
		preMu.Lock()
		stale := preLatest != hash
		preMu.Unlock()
		if stale { // inzwischen wurde ein neueres Programm angefordert
			s.line("##OK Übersprungen.")
			return
		}
	}

	fqbn = sanitizeFQBN(s, fqbn)
	withBT := strings.Contains(string(code), "NimBLEDevice.h")
	// Eigener Zwischenordner für Programme mit Bluetooth: Beim Wechsel zwischen
	// mit/ohne Bluetooth muss so nicht jedes Mal alles neu übersetzt werden.
	name := "build-" + boardOf(fqbn)
	if withBT {
		name += "-bt"
	}
	if strings.Contains(string(code), "<WiFi.h>") { // Kommunikation (WLAN, Webseite, Funk)
		name += "-net"
	}
	build := filepath.Join(workDir(), name)
	export := filepath.Join(workDir(), "export-"+boardOf(fqbn))
	sketch := filepath.Join(toolsDir(), "sketch", "werkstatt")

	if builtAlready(build, export, hash) {
		if !stepShown {
			s.line("##SCHRITT 1 Programm übersetzen")
		}
		if lastBuild == hash {
			s.line("##INFO Schon beim Öffnen des Fensters im Hintergrund übersetzt.")
			if q.Get("details") == "1" && lastSummary != "" {
				s.line("##INFO %s (im Hintergrund)", lastSummary)
			}
		} else {
			s.line("##INFO Das Programm ist unverändert – es wird das schon übersetzte verwendet.")
			lastBuild = hash
			lastSummary = ""
		}
	} else {
		lastSummary = ""
		lastBuild = ""
		_ = os.MkdirAll(sketch, 0o755)
		if err := os.WriteFile(filepath.Join(sketch, "werkstatt.ino"), code, 0o644); err != nil {
			s.line("##FEHLER Das Programm konnte nicht gespeichert werden: %s", err)
			return
		}
		for _, l := range lateLibraries {
			if strings.Contains(string(code), l.header) && !libInstalled(l.dir) {
				s.line("##SCHRITT 1 %s einrichten (nur einmal nötig)", l.what)
				if err := runCLI(s, "lib", "install", l.lib); err != nil {
					s.line("##FEHLER Der %s konnte nicht installiert werden. Besteht eine Internetverbindung?", l.what)
					return
				}
				stepShown = false
			}
		}
		if withBT && !nimbleInstalled() {
			s.line("##SCHRITT 1 Bluetooth-Baustein einrichten (nur einmal nötig)")
			if err := runCLI(s, "lib", "install", nimbleLib); err != nil {
				s.line("##FEHLER Der Bluetooth-Baustein konnte nicht installiert werden. Besteht eine Internetverbindung?")
				return
			}
			stepShown = false
		}
		_ = os.RemoveAll(export)
		if !stepShown {
			s.line("##SCHRITT 1 Programm übersetzen")
		}
		args := []string{"compile", "--fqbn", fqbn, "--build-path", build, "--output-dir", export}
		if boardOf(fqbn) == "esp32" {
			// Die 4-MB-Gesamtdatei (merged.bin) wird zum Hochladen nicht gebraucht.
			args = append(args, "--build-property", "recipe.hooks.objcopy.postobjcopy.3.pattern=")
		}
		var keep func(string) bool
		var tm *phaseTimer
		if q.Get("details") == "1" {
			tm = newPhaseTimer()
			keep = tm.line
			args = append(args, "-v")
			cliExtraEnv = []string{"ARDUINO_LOCALE=en"} // Phasen-Meldungen in fester Sprache
		}
		args = append(args, sketch)
		err = runCLIx(s, keep, args...)
		cliExtraEnv = nil
		if tm != nil {
			lastSummary = tm.summary()
			if !pre {
				s.line("##INFO %s", lastSummary)
			}
		}
		if err != nil {
			s.line("##FEHLER Das Programm konnte nicht übersetzt werden.")
			return
		}
		lastBuild = hash
		_ = os.WriteFile(filepath.Join(export, stampName), []byte(hash), 0o644)
	}
	if port == "" {
		s.line("##OK Das Programm wurde übersetzt.")
		return
	}
	s.line("##SCHRITT 2 Übertragen (%s)", port)
	tUp := time.Now()
	if err := runCLI(s, "upload", "--fqbn", fqbn, "--port", port, "--input-dir", build, sketch); err != nil {
		s.line("##FEHLER Das Übertragen ist fehlgeschlagen.")
		return
	}
	if q.Get("details") == "1" {
		s.line("##INFO Zeitmessung Übertragen: %s", secs(time.Since(tUp)))
	}
	s.line("##OK Fertig! Das Programm läuft jetzt auf dem Mikrocontroller.")
}

// Vorübersetzen: Merkt sich, welches Programm zuletzt erfolgreich übersetzt wurde.
var (
	preMu       sync.Mutex
	preLatest   string
	lastBuild   string // nur unter lock() verwenden
	lastSummary string // Zeitmessung des letzten Übersetzens (auch im Hintergrund)
)

// Merkzettel im Ausgabeordner: Prüfsumme des zuletzt übersetzten Programms.
// Bleibt über einen Neustart der Werkstatt erhalten, sodass ein unverändertes
// Programm nicht erneut übersetzt und zusammengefügt werden muss.
const stampName = "werkstatt.pruefsumme"

func builtAlready(build, export, hash string) bool {
	b, err := os.ReadFile(filepath.Join(export, stampName))
	if err != nil || strings.TrimSpace(string(b)) != hash {
		return false
	}
	for _, f := range []string{"werkstatt.ino.bin", "werkstatt.ino.hex"} {
		if fileExists(filepath.Join(export, f)) && fileExists(filepath.Join(build, f)) {
			return true
		}
	}
	return false
}

func fileExists(p string) bool { _, err := os.Stat(p); return err == nil }

func busyWithPre() bool {
	toolsMu.Lock()
	defer toolsMu.Unlock()
	return toolsBusy && toolsKind == "pre"
}

// Wie lock(), wartet aber, solange nur ein Vorübersetzen läuft.
func lockWait(s *stream, pre bool) bool {
	kind := ""
	if pre {
		kind = "pre"
	}
	deadline := time.Now().Add(15 * time.Minute)
	for {
		toolsMu.Lock()
		if !toolsBusy {
			toolsBusy, toolsKind = true, kind
			toolsMu.Unlock()
			return true
		}
		waitable := toolsKind == "pre"
		toolsMu.Unlock()
		if !waitable || time.Now().After(deadline) {
			s.line("##FEHLER Es läuft bereits ein Vorgang. Bitte warten.")
			return false
		}
		touch()
		time.Sleep(200 * time.Millisecond)
	}
}
