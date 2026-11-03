// Werkstatt-Schulserver: verwaltet Lehrkräfte, Klassen und virtuelle Klassenzimmer der
// Arduino-Werkstatt. Die Schüler arbeiten mit der Werkstatt (Netzwerk-Version) auf ihren
// Rechnern; Projekte, Prüfungsmodus, Abgaben, Aufgaben und Beispiele laufen über diesen Server.
// Die Lehrkräfte bedienen ihn im Browser: http://<Server>:8650/
//
// Einstellungen in „schulserver.ini“ neben dem Programm (optional):
//
//	Port         = 8650
//	Datenordner  = daten          (relativ zum Programm oder absoluter Pfad)
//	App-Ordner   = app            (Werkstatt-Oberfläche für die Großansicht)
package main

import (
	"bufio"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const version = "0.1.0"

//go:embed web
var webFiles embed.FS

var (
	baseDir string
	dataDir string
	appDir  string
	port    = "8650"
)

func readIni() map[string]string {
	m := map[string]string{}
	f, err := os.Open(filepath.Join(baseDir, "schulserver.ini"))
	if err != nil {
		return m
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		l := strings.TrimSpace(strings.TrimPrefix(sc.Text(), "\ufeff"))
		if l == "" || strings.HasPrefix(l, "#") || strings.HasPrefix(l, ";") || strings.HasPrefix(l, "[") {
			continue
		}
		if i := strings.Index(l, "="); i > 0 {
			m[strings.ToLower(strings.TrimSpace(l[:i]))] = strings.TrimSpace(l[i+1:])
		}
	}
	return m
}

func abs(p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	return filepath.Join(baseDir, p)
}

func main() {
	exe, _ := os.Executable()
	baseDir = filepath.Dir(exe)
	args := os.Args[1:]
	for i := 0; i+1 < len(args); i++ { // für Tests: --dir <Ordner>
		if args[i] == "--dir" {
			baseDir = args[i+1]
		}
	}
	ini := readIni()
	if v := ini["port"]; v != "" {
		port = v
	}
	dataDir = abs(firstNonEmpty(ini["datenordner"], "daten"))
	appDir = abs(firstNonEmpty(ini["app-ordner"], "app"))
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatalf("Datenordner %s kann nicht angelegt werden: %v", dataDir, err)
	}
	if err := store.load(); err != nil {
		log.Fatalf("Daten können nicht gelesen werden: %v", err)
	}

	mux := http.NewServeMux()
	web, _ := fs.Sub(webFiles, "web")
	mux.Handle("/", noCache(http.FileServer(http.FS(web))))
	mux.Handle("/app/", noCache(http.StripPrefix("/app/", http.FileServer(http.Dir(appDir)))))
	registerTeacher(mux)
	registerStudent(mux)
	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"ok":true,"schulserver":true,"version":%q}`, version)
	})

	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("Port %s ist belegt oder gesperrt: %v", port, err)
	}
	fmt.Printf("Werkstatt-Schulserver %s\n", version)
	fmt.Printf("Daten: %s\n\n", dataDir)
	fmt.Println("Lehrer-Oberfläche im Browser öffnen:")
	for _, ip := range localIPs() {
		fmt.Printf("   http://%s:%s/\n", ip, port)
	}
	fmt.Println("\nIn der werkstatt.ini der Schüler-Werkstatt eintragen (eine der Adressen):")
	for _, ip := range localIPs() {
		fmt.Printf("   Schulserver = http://%s:%s\n", ip, port)
	}
	fmt.Println("\nDieses Fenster offen lassen, solange der Server laufen soll.")
	go store.saveLoop()
	srv := &http.Server{Handler: logRequests(mux), ReadHeaderTimeout: 10 * time.Second}
	log.Fatal(srv.Serve(ln))
}

func firstNonEmpty(a ...string) string {
	for _, s := range a {
		if s != "" {
			return s
		}
	}
	return ""
}

func localIPs() []string {
	out := []string{}
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		if n, ok := a.(*net.IPNet); ok && !n.IP.IsLoopback() && n.IP.To4() != nil {
			out = append(out, n.IP.String())
		}
	}
	if len(out) == 0 {
		out = append(out, "localhost")
	}
	return out
}

func noCache(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h.ServeHTTP(w, r)
	})
}

// Fehler und Anmeldungen ins Fenster schreiben (keine Inhalte)
func logRequests(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.ServeHTTP(w, r)
	})
}
