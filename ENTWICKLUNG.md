# Arduino-Werkstatt – Hinweise für die Weiterentwicklung

Blockbasierte Arduino-Lernumgebung (Uno und ESP32) mit Simulation und Hochladen ohne Arduino IDE.

## Ordner

| Ordner / Datei | Inhalt |
|---|---|
| `app/` | Die Oberfläche (läuft im Browser). Kein Build nötig. |
| `app/js/components.js` | Alle Bauteile: Zeichnung (SVG), Anschlüsse, Kategorien, Mikrocontroller-Daten |
| `app/js/solver.js` | Elektrik: Netzliste und Knotenspannungsverfahren (Ströme, Spannungen) |
| `app/js/sim.js` | Simulation: führt den Blockcode aus und steuert die Bauteile |
| `app/js/blocks.js` | Alle Blöcke, Werkzeugkasten, Code-Erzeugung für Simulation (JS) und Arduino (C++), Bluetooth-Empfänger |
| `app/js/circuit.js` | Schaltungseditor (Ziehen, Verdrahten, Vorlagen) |
| `app/js/bitmap.js`, `font5x7.js` | Grafikeditor für OLED-Bilder, Pixelschrift |
| `app/js/upload.js` | Hochladen per USB und Bluetooth (Web Bluetooth) |
| `app/js/settings.js` | Einstellungen (Updates, Werkzeuge, ESP32 löschen, Zeitmessung) |
| `app/js/comm.js` | Anzeige „WLAN & Funk“ in der Simulation, Eingabezeile des seriellen Monitors |
| `app/js/serial.js` | Serieller Monitor für echte Hardware (Web Serial) |
| `app/js/examples.js` | Beispielprojekte (erzeugt mit `tests/ex_build.py` + `ex_build.js`) |
| `app/js/export.js` | Schaltung als Bild, Drucken |
| `app/js/app.js` | Zusammenspiel der Oberfläche, Speichern, Projektverwaltung |
| `app/lib/blockly/` | Blockly (Apache-Lizenz 2.0), unverändert |
| `launcher/` | Startprogramm in Go: kleiner Webserver nur für diesen PC, Speichern, arduino-cli, Updates |
| `paket/` | LIESMICH und Notstart-Datei für das ZIP-Paket |
| `tests/` | Automatische Tests (Python + Playwright), Ersatz-arduino-cli, C++-Ersatzköpfe |
| `bauen.sh` | Baut das ZIP-Paket für Windows |

## Neue Version veröffentlichen

1. In `launcher/main.go` die Konstante `version` erhöhen (z. B. `0.9.3`).
2. `./bauen.sh` ausführen → `Arduino-Werkstatt-0.9.3.zip`.
3. Bei GitHub ein Release mit dem Tag `v0.9.3` anlegen und die ZIP-Datei anhängen.
   Die Werkstatt findet es über „Einstellungen › Nach Updates suchen“ (Ablage in `launcher/settings.go`, `updateRepo`).

## Testen

Die Tests starten das Startprogramm mit einem Ersatz für arduino-cli (`tests/fake/arduino-cli`, wird per
`WERKSTATT_CLI_URL` geladen) und steuern die Oberfläche mit Playwright (Chromium). Die Pfade in den
Testskripten zeigen noch auf die ursprüngliche Arbeitsumgebung und müssen ggf. angepasst werden.

Umgebungsvariablen nur für Tests: `WERKSTATT_CLI_URL`, `WERKSTATT_UPDATE_API`, `WERKSTATT_EXE`, `WERKSTATT_NO_RESTART`.

## Wichtige Entscheidungen

- **ESP32-Übersetzen:** Es werden immer dieselben Bibliotheken eingebunden (`ESP_FIXED_INCLUDES` in `upload.js`),
  damit arduino-cli seinen Zwischenspeicher behält. Programme mit/ohne Bluetooth haben eigene Zwischenordner.
- **Vorübersetzen:** Beim Öffnen des Hochladen-Fensters wird im Hintergrund übersetzt (`?pre=1`); das Ergebnis
  wird per SHA-256 des Programms wiedererkannt.
- **Bluetooth-Empfänger:** NimBLE-Arduino 2.5.2 (fest), Protokoll `START <Größe> <MD5>` / Daten / `ENDE`,
  Dienst-UUIDs `8e4f000x-6a1b-4c5e-9d2a-7765726b7374`.
- **Sicherheit:** Das Startprogramm nimmt nur Anfragen von der eigenen Seite an (Host-/Origin-Prüfung),
  damit fremde Webseiten im selben Browser nichts auslösen können.
- **Projektnamen:** „Tisch-Nr – Nachname – Projekt“ (Tisch 01–19); vorhandene Projekte werden nie überschrieben.
- **Sicherungen:** `Projekte/.sicherungen/<Projekt>/`, höchstens alle 5 Minuten, die letzten 15.
- **Kommunikation:** WLAN/Webseite/ESP-NOW-Funk nur für ESP32; bei eingeschalteter Erweiterung werden
  `WiFi.h`, `WebServer.h`, `esp_now.h` fest eingebunden (eigener Zwischenordner `-net`).
