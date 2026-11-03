//go:build windows

package main

import (
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

// Liegt der Ordner auf einem Netzwerklaufwerk (\\Server\Freigabe oder verbundenes Laufwerk)?
func onNetworkDrive(dir string) bool {
	if strings.HasPrefix(dir, `\\`) {
		return true
	}
	vol := filepath.VolumeName(dir)
	if vol == "" {
		return false
	}
	root, err := syscall.UTF16PtrFromString(vol + `\`)
	if err != nil {
		return false
	}
	r, _, _ := syscall.NewLazyDLL("kernel32.dll").NewProc("GetDriveTypeW").Call(uintptr(unsafe.Pointer(root)))
	return r == 4 // DRIVE_REMOTE
}

// Ordner „Dokumente“ über SHGetKnownFolderPath – berücksichtigt Umleitungen (z. B. auf H:).
func documentsDir() string {
	type guid struct {
		d1     uint32
		d2, d3 uint16
		d4     [8]byte
	}
	folderDocuments := guid{0xFDD39AD0, 0x238F, 0x46AF, [8]byte{0xAD, 0xB4, 0x6C, 0x85, 0x48, 0x03, 0x69, 0xC7}}
	shell32 := syscall.NewLazyDLL("shell32.dll")
	ole32 := syscall.NewLazyDLL("ole32.dll")
	proc := shell32.NewProc("SHGetKnownFolderPath")
	if proc.Find() != nil {
		return ""
	}
	var p *uint16
	r, _, _ := proc.Call(uintptr(unsafe.Pointer(&folderDocuments)), 0, 0, uintptr(unsafe.Pointer(&p)))
	if r != 0 || p == nil {
		return ""
	}
	defer ole32.NewProc("CoTaskMemFree").Call(uintptr(unsafe.Pointer(p)))
	n := 0
	for ptr := unsafe.Pointer(p); *(*uint16)(ptr) != 0; n++ {
		ptr = unsafe.Pointer(uintptr(ptr) + 2)
	}
	return syscall.UTF16ToString(unsafe.Slice(p, n))
}
