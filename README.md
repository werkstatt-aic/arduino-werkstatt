# Arduino-Werkstatt

Blockbasierte Arduino-Lernumgebung für den Unterricht – als Ersatz für Tinkercad Circuits.

- Programmieren mit Blöcken (Blockly), Text-Ansicht in C++
- Simulation mit realistischen Bauteilen und Prüfung der Schaltung
- Arduino Uno und ESP32 (auch auf dem Expansion Board)
- Hochladen ohne Arduino IDE, per USB oder beim ESP32 per Bluetooth
- WLAN, eigene Webseite und Funk zwischen ESP32
- Läuft vom USB-Stick oder Ordner, ohne Installation (Windows, Chrome/Edge)

## Herunterladen

Die fertige Version gibt es unter **[Releases](../../releases/latest)** als ZIP-Datei
(`Arduino-Werkstatt-<Version>.zip`). Entpacken und „Arduino-Werkstatt starten.exe“ starten.
Hinweise stehen in der Datei `LIESMICH.txt` im Paket.

Vorhandene Installationen finden neue Versionen unter **Einstellungen › Nach Updates suchen**.

## Für Entwickler

Aufbau, Tests und das Bauen neuer Versionen: siehe [ENTWICKLUNG.md](ENTWICKLUNG.md).

Verwendete freie Software: Blockly (Apache-Lizenz 2.0), siehe `app/lib/blockly/LICENSE`.
