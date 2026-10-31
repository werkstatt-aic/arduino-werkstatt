//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

// Kein schwarzes Konsolenfenster beim Aufruf von arduino-cli anzeigen.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
}
