package main

// Datenhaltung in einfachen JSON-Dateien im Datenordner:
//   lehrer.json        Lehrkräfte (Passwörter nur als PBKDF2-Prüfwert)
//   klassen.json       Klassen (gehören einer Lehrkraft)
//   raeume.json        geöffnete Klassenzimmer, Schüler-Sitzungen, Live-Stand (übersteht Neustart)
//   aufgaben.json      Aufgaben auf dem Server (Inhalt in aufgaben/<id>.aufgabe)
//   beispiele.json     Beispiele auf dem Server (Inhalt in beispiele/<id>.awp)
//   klassen/<id>/schueler/<Tisch>-<Vorname>/   Projekte (*.awp), .sicherungen, .geloest.json
//   klassen/<id>/abgaben/<Prüfung>/<Tisch>-<Vorname>.awp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"
)

type Teacher struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Login     string `json:"login"`
	Salt      string `json:"salt"`
	Hash      string `json:"hash"`
	Verwalter bool   `json:"verwalter"`
	Neu       bool   `json:"neu,omitempty"` // Passwort muss beim nächsten Anmelden geändert werden
}

type Class struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Lehrer  string    `json:"lehrer"`
	Created time.Time `json:"erstellt"`
}

type Event struct {
	Zeit  time.Time `json:"zeit"`
	Art   string    `json:"art"`             // "verlassen" | "zurueck"
	Dauer int       `json:"dauer,omitempty"` // Sekunden außerhalb (bei „zurueck“)
}

// Live-Stand eines Schülers im Klassenzimmer
type Live struct {
	Tisch      string    `json:"tisch"`
	Vorname    string    `json:"vorname"`
	Projekt    string    `json:"projekt"`
	Gesehen    time.Time `json:"gesehen"`
	Geaendert  time.Time `json:"geaendert"`
	Ereignisse []Event   `json:"ereignisse"`
	Abgegeben  time.Time `json:"abgegeben"`
	Draussen   bool      `json:"draussen"` // hat das Fenster gerade verlassen
}

type Room struct {
	Klasse    string           `json:"klasse"`
	Code      string           `json:"code"`
	Modus     string           `json:"modus"` // "normal" | "pruefung"
	Aufgabe   string           `json:"aufgabe"`
	Pruefung  string           `json:"pruefung"` // Kennung der laufenden Prüfung (Startzeit)
	Geoeffnet time.Time        `json:"geoeffnet"`
	Schueler  map[string]*Live `json:"schueler"` // Schlüssel: Schülerordner
}

type StudentSession struct {
	Klasse  string    `json:"klasse"`
	Tisch   string    `json:"tisch"`
	Vorname string    `json:"vorname"`
	Seit    time.Time `json:"seit"`
}

type TaskMeta struct {
	ID     string    `json:"id"`
	Titel  string    `json:"titel"`
	Lehrer string    `json:"lehrer"`
	Alle   bool      `json:"alle"` // für alle Lehrkräfte sichtbar
	Datum  time.Time `json:"datum"`
}

type ExampleMeta struct {
	ID           string    `json:"id"`
	Titel        string    `json:"titel"`
	Beschreibung string    `json:"beschreibung"`
	Board        string    `json:"board"`
	Lehrer       string    `json:"lehrer"`
	Alle         bool      `json:"alle"`
	Datum        time.Time `json:"datum"`
}

type teacherSession struct {
	Lehrer string
	Bis    time.Time
}

type Store struct {
	mu        sync.Mutex
	Lehrer    []*Teacher
	Klassen   []*Class
	Raeume    map[string]*Room           // Klassen-ID → Klassenzimmer
	Sitzungen map[string]*StudentSession // Schüler-Token → Sitzung
	Aufgaben  []*TaskMeta
	Beispiele []*ExampleMeta
	teachers  map[string]*teacherSession // Cookie → Lehrkraft
	dirty     bool
}

var store = &Store{Raeume: map[string]*Room{}, Sitzungen: map[string]*StudentSession{}, teachers: map[string]*teacherSession{}}

func readJSON(name string, v any) error {
	b, err := os.ReadFile(filepath.Join(dataDir, name))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func writeJSON(name string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	p := filepath.Join(dataDir, name)
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

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var raeume struct {
		Raeume    map[string]*Room           `json:"raeume"`
		Sitzungen map[string]*StudentSession `json:"sitzungen"`
	}
	for _, x := range []struct {
		n string
		v any
	}{{"lehrer.json", &s.Lehrer}, {"klassen.json", &s.Klassen}, {"raeume.json", &raeume}, {"aufgaben.json", &s.Aufgaben}, {"beispiele.json", &s.Beispiele}} {
		if err := readJSON(x.n, x.v); err != nil {
			return fmt.Errorf("%s: %w", x.n, err)
		}
	}
	if raeume.Raeume != nil {
		s.Raeume = raeume.Raeume
	}
	if raeume.Sitzungen != nil {
		s.Sitzungen = raeume.Sitzungen
	}
	for _, r := range s.Raeume {
		if r.Schueler == nil {
			r.Schueler = map[string]*Live{}
		}
	}
	return nil
}

// Speichert Lehrkräfte, Klassen, Aufgaben und Beispiele sofort (selten geändert).
func (s *Store) saveMeta() error {
	for _, x := range []struct {
		n string
		v any
	}{{"lehrer.json", s.Lehrer}, {"klassen.json", s.Klassen}, {"aufgaben.json", s.Aufgaben}, {"beispiele.json", s.Beispiele}} {
		if err := writeJSON(x.n, x.v); err != nil {
			return err
		}
	}
	return s.saveRooms()
}

func (s *Store) saveRooms() error {
	s.dirty = false
	return writeJSON("raeume.json", map[string]any{"raeume": s.Raeume, "sitzungen": s.Sitzungen})
}

// Klassenzimmer-Stand (Live-Daten ändern sich oft) alle paar Sekunden sichern
func (s *Store) saveLoop() {
	for {
		time.Sleep(3 * time.Second)
		s.mu.Lock()
		if s.dirty {
			if err := s.saveRooms(); err != nil {
				fmt.Println("Fehler beim Sichern:", err)
			}
		}
		// abgelaufene Lehrer-Sitzungen entfernen
		for k, t := range s.teachers {
			if time.Now().After(t.Bis) {
				delete(s.teachers, k)
			}
		}
		s.mu.Unlock()
	}
}

/* ---------- Hilfen ---------- */

func token(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func newID(prefix string) string {
	b := make([]byte, 5)
	rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

// Stundencode: vierstellig, unter den geöffneten Klassenzimmern eindeutig
func (s *Store) newCode() string {
	for {
		n, _ := rand.Int(rand.Reader, big.NewInt(9000))
		c := fmt.Sprint(1000 + n.Int64())
		used := false
		for _, r := range s.Raeume {
			used = used || r.Code == c
		}
		if !used {
			return c
		}
	}
}

// PBKDF2-HMAC-SHA256
func pbkdf2(pass, salt []byte, iter, keyLen int) []byte {
	prf := hmac.New(sha256.New, pass)
	var out []byte
	for block := 1; len(out) < keyLen; block++ {
		prf.Reset()
		prf.Write(salt)
		prf.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := prf.Sum(nil)
		t := append([]byte{}, u...)
		for i := 1; i < iter; i++ {
			prf.Reset()
			prf.Write(u)
			u = prf.Sum(u[:0])
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:keyLen]
}

const pbkdfIter = 120000

func setPassword(t *Teacher, pass string) {
	salt := make([]byte, 16)
	rand.Read(salt)
	t.Salt = hex.EncodeToString(salt)
	t.Hash = hex.EncodeToString(pbkdf2([]byte(pass), salt, pbkdfIter, 32))
}

func checkPassword(t *Teacher, pass string) bool {
	salt, err := hex.DecodeString(t.Salt)
	if err != nil {
		return false
	}
	want, _ := hex.DecodeString(t.Hash)
	return subtle.ConstantTimeCompare(pbkdf2([]byte(pass), salt, pbkdfIter, 32), want) == 1
}

// Ordnername eines Schülers: „03-Lena“ (nur Buchstaben, Ziffern, - und _)
var unsafeChars = regexp.MustCompile(`[^\p{L}\p{N}_-]+`)

func studentKey(tisch, vorname string) string {
	v := unsafeChars.ReplaceAllString(strings.TrimSpace(vorname), "_")
	return padTisch(tisch) + "-" + v
}

func padTisch(t string) string {
	t = strings.TrimLeft(strings.TrimSpace(t), "0")
	if len(t) < 2 {
		t = strings.Repeat("0", 2-len(t)) + t
	}
	return t
}

func cleanName(s string, max int) string {
	s = strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s))
	if r := []rune(s); len(r) > max {
		s = string(r[:max])
	}
	return s
}

func classDir(id string) string { return filepath.Join(dataDir, "klassen", id) }

func studentDir(klasse, key string) string {
	return filepath.Join(classDir(klasse), "schueler", key)
}

func (s *Store) teacher(id string) *Teacher {
	for _, t := range s.Lehrer {
		if t.ID == id {
			return t
		}
	}
	return nil
}

func (s *Store) class(id string) *Class {
	for _, c := range s.Klassen {
		if c.ID == id {
			return c
		}
	}
	return nil
}
