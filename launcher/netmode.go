// Netzwerk-Modus: Die Werkstatt liegt auf einem Tauschlaufwerk, auf dem die Schüler nur
// Leserechte haben. Dann wird nichts in den Werkstatt-Ordner geschrieben:
//   - Projekte (mit Sicherungen und „gelöst“-Liste) liegen im persönlichen Ordner,
//     standardmäßig „Dokumente\Arduino-Werkstatt\Projekte“,
//   - Einstellungen für arduino-cli, das Programm zum Übersetzen und der Zwischenspeicher
//     liegen im TEMP-Ordner des Benutzers,
//   - Werkzeuge, Aufgaben und das Programm selbst werden nur gelesen.
//
// Gesteuert über die Datei „werkstatt.ini“ neben der Startdatei (optional):
//
//	Netzwerkmodus = auto | ja | nein     (auto: ein, wenn der Ordner schreibgeschützt ist oder
//	                                      auf einem Netzwerklaufwerk liegt)
//	Projektordner = H:\Arduino-Werkstatt (Umgebungsvariablen wie %USERPROFILE% erlaubt)
//
// Updates und das Einrichten der Werkzeuge sind möglich, sobald der Ordner beschreibbar ist
// (Lehrkraft mit Schreibrechten); bei den Schülern sind sie gesperrt.
package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	netMode   bool   // Netzwerk-Modus aktiv
	writable  bool   // Werkstatt-Ordner beschreibbar (Werkzeuge einrichten, Updates)
	userBase  string // persönlicher Werkstatt-Ordner (nur im Netzwerk-Modus)
	iniValues = map[string]string{}
)

func readIni() {
	f, err := os.Open(filepath.Join(baseDir, "werkstatt.ini"))
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		l := strings.TrimSpace(strings.TrimPrefix(sc.Text(), "\ufeff"))
		if l == "" || strings.HasPrefix(l, "#") || strings.HasPrefix(l, ";") || strings.HasPrefix(l, "[") {
			continue
		}
		if i := strings.Index(l, "="); i > 0 {
			iniValues[strings.ToLower(strings.TrimSpace(l[:i]))] = strings.TrimSpace(l[i+1:])
		}
	}
}

// Schreibprobe: legt eine kleine Datei an und löscht sie wieder.
func dirWritable(d string) bool {
	p := filepath.Join(d, fmt.Sprintf(".schreibprobe-%d", os.Getpid()))
	f, err := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		return false
	}
	f.Close()
	os.Remove(p)
	return true
}

var winEnv = regexp.MustCompile(`%([A-Za-z0-9_()]+)%`)

func expandPath(s string) string {
	s = winEnv.ReplaceAllStringFunc(s, func(m string) string {
		if v, ok := os.LookupEnv(m[1 : len(m)-1]); ok {
			return v
		}
		return m
	})
	return filepath.Clean(os.ExpandEnv(s))
}

// Persönlicher Werkstatt-Ordner: aus werkstatt.ini, sonst „Dokumente\Arduino-Werkstatt“
// (bei umgeleiteten Dokumenten, z. B. auf das Homelaufwerk, der echte Ort).
func personalDir() string {
	if v := iniValues["projektordner"]; v != "" {
		return expandPath(v)
	}
	if d := documentsDir(); d != "" {
		return filepath.Join(d, "Arduino-Werkstatt")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Documents", "Arduino-Werkstatt")
}

func setupMode() {
	readIni()
	writable = dirWritable(baseDir)
	switch strings.ToLower(iniValues["netzwerkmodus"]) {
	case "ja", "an", "1", "true":
		netMode = true
	case "nein", "aus", "0", "false":
		netMode = false
	default:
		// schreibgeschützt (Schüler) oder auf einem Netzwerklaufwerk (auch Lehrkraft mit Schreibrechten)
		netMode = !writable || onNetworkDrive(baseDir)
	}
	if netMode {
		userBase = personalDir()
		projectDir = filepath.Join(userBase, "Projekte")
	} else {
		projectDir = filepath.Join(baseDir, "Projekte")
	}
}

// Fenstergröße beim Start (werkstatt.ini: Fenster = maximiert | normal | vollbild, Standard maximiert)
func windowMode() string {
	switch strings.ToLower(strings.TrimSpace(iniValues["fenster"])) {
	case "normal":
		return "normal"
	case "vollbild":
		return "vollbild"
	}
	return "maximiert"
}

// Startschalter für Chrome/Edge passend zu windowMode()
func windowArgs() []string {
	switch windowMode() {
	case "normal":
		return []string{"--window-size=1400,900"}
	case "vollbild":
		return []string{"--start-fullscreen"}
	}
	return []string{"--start-maximized"}
}

// Ort für Dateien, die die Werkstatt selbst schreibt (arduino-cli-Einstellungen, Programm zum Übersetzen)
func scratchDir() string {
	if netMode || !writable {
		return workDir()
	}
	return toolsDir()
}

const readOnlyMsg = "Der Werkstatt-Ordner ist schreibgeschützt (Netzwerk-Version). Werkzeuge und Updates richtet die Lehrkraft im Original-Ordner ein – mit Schreibrechten."
