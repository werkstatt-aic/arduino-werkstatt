# Arduino-Werkstatt – Hinweise für die Weiterentwicklung

Blockbasierte Arduino-Lernumgebung (Uno und ESP32) mit Simulation und Hochladen ohne Arduino IDE.

## Ordner

| Ordner / Datei | Inhalt |
|---|---|
| `app/` | Die Oberfläche (läuft im Browser). Kein Build nötig. |
| `app/js/components.js` | Alle Bauteile: Zeichnung (SVG), Anschlüsse, Kategorien, Mikrocontroller-Daten |
| `app/js/solver.js` | Elektrik: Netzliste und Knotenspannungsverfahren (Ströme, Spannungen) |
| `app/js/sim.js` | Simulation: führt den Blockcode aus und steuert die Bauteile |
| `app/js/blocks.js` | Alle Blöcke, Anschlusslisten, Werkzeugkasten, Erweiterungen |
| `app/js/code_sim.js` | Code-Erzeugung für die Simulation (JavaScript) |
| `app/js/code_cpp.js` | Code-Erzeugung für Arduino/ESP32 (C++): Datentypen, Bluetooth-Empfänger, WLAN/Webseite/Funk |
| `app/js/circuit.js` | Schaltungseditor (Ziehen, Verdrahten, Vorlagen) |
| `app/js/bitmap.js`, `font5x7.js` | Grafikeditor für OLED-Bilder, Pixelschrift |
| `app/js/upload.js` | Hochladen per USB und Bluetooth (Web Bluetooth) |
| `app/js/settings.js` | Einstellungen (Updates, Werkzeuge, ESP32 löschen, Zeitmessung) |
| `app/js/comm.js` | Anzeige „WLAN, Funk & Bluetooth“ in der Simulation, Eingabezeile des seriellen Monitors |
| `app/js/serial.js` | Serieller Monitor für echte Hardware (Web Serial per USB, Web Bluetooth per BLE-UART) |
| `app/js/examples.js` | Beispielprojekte (erzeugt mit `tests/ex_build.py` + `ex_build.js`) |
| `app/js/export.js` | Schaltung als Bild, Drucken |
| `app/js/tasks.js` | Aufgabenkarten: mitgelieferte Aufgaben, Prüf-Engine (Simulation), Aufgabenkarte, Editor für Lehrkräfte |
| `app/js/app.js` | Zusammenspiel der Oberfläche, Speichern, Projektverwaltung |
| `app/lib/blockly/` | Blockly (Apache-Lizenz 2.0), unverändert |
| `launcher/` | Startprogramm in Go: kleiner Webserver nur für diesen PC, Speichern, arduino-cli, Updates, Aufgaben (`tasks.go`) |
| `paket/` | LIESMICH und Notstart-Datei für das ZIP-Paket |
| `tests/` | Automatische Tests (Python + Playwright), Ersatz-arduino-cli, C++-Ersatzköpfe |
| `bauen.sh` | Baut das ZIP-Paket für Windows |

## Neue Version veröffentlichen

1. In `launcher/main.go` die Konstante `version` erhöhen (z. B. `0.9.4`).
2. `./bauen.sh` ausführen → `Arduino-Werkstatt-0.9.4.zip`.
3. Die ZIP-Datei als `update/Arduino-Werkstatt.zip` in die Ablage legen und `update/version.json` anpassen:
   `{"version": "0.9.4", "zip": "Arduino-Werkstatt.zip", "notes": "Was ist neu …"}` – committen und pushen.
4. Optional zusätzlich ein GitHub-Release mit dem Tag `v0.9.4` und der ZIP-Datei anlegen.

Die Werkstatt (ab 0.9.3) prüft unter „Einstellungen › Nach Updates suchen“ beide Quellen und nimmt die neuere
(Ablage in `launcher/settings.go`, `updateRepo`). Version 0.9.1/0.9.2 kennen nur die GitHub-Releases.

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
- **Projektnamen:** „Tisch-Nr – Vorname – Projekt“ (Tisch 01–18); vorhandene Projekte werden nie überschrieben.
- **Sicherungen:** `Projekte/.sicherungen/<Projekt>/`, höchstens alle 5 Minuten, die letzten 15.
- **Kommunikation:** WLAN/Webseite/ESP-NOW-Funk/Bluetooth (BLE-UART) nur für ESP32. Nutzt ein Programm WLAN, Webseite
  oder Funk, werden `WiFi.h`, `WebServer.h`, `esp_now.h` gemeinsam eingebunden (eigener Zwischenordner `-net`);
  Bluetooth (Empfänger oder Blöcke) nutzt NimBLE (Zwischenordner `-bt`). So bleibt der Zwischenspeicher je Kombination erhalten.
- **Aufgaben:** Mitgelieferte Aufgaben in `BUILTIN_TASKS` (`tasks.js`), eigene als JSON-Dateien `Aufgaben/*.aufgabe`
  (Endpunkte `/api/tasks`, `/api/task-save`, `/api/task-delete`), gelöste in `Projekte/.geloest.json` (`/api/solved`).
  Eine Prüfung ist `{k: <Art>, …}` mit den Arten aus `TASK_CHECKS`: statisch (Bauteil, Block), beobachtend (LED leuchtet,
  blinkt, nacheinander, gedimmt, Servo, Motor, Summer, serieller Monitor, LCD), ausprobierend (Taster, Sensor, Nachricht)
  und „keine Fehler“. Die Musterlösungen in `tests/tk5.js` müssen jede mitgelieferte Aufgabe lösen (`tests/tk5.py`).
- **PWM-Auswahl:** Die PWM-Blöcke bieten bewusst alle Anschlüsse an; die Simulation verhält sich an Anschlüssen ohne PWM
  wie der echte Uno (unter 128 aus, sonst an) und meldet einen Hinweis.
