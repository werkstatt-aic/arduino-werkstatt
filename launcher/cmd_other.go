//go:build !windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
)

func hideWindow(cmd *exec.Cmd) {}

// Außerhalb von Windows: Netzwerk-Modus nur über werkstatt.ini oder fehlende Schreibrechte
func onNetworkDrive(dir string) bool { return false }

// Ordner „Dokumente“ (außerhalb von Windows: im Benutzerordner)
func documentsDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, "Documents")
}
