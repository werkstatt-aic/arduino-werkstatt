#!/bin/bash
# Baut das Paket "Arduino-Werkstatt-<Version>.zip" (Windows-Startdatei + app + Texte).
# Voraussetzung: Go (https://go.dev) und zip. Aufruf im Projektordner: ./bauen.sh
set -e
cd "$(dirname "$0")"
VER=$(grep -o 'const version = "[^"]*"' launcher/main.go | cut -d'"' -f2)
OUT=$(mktemp -d)
P="$OUT/Arduino-Werkstatt"
mkdir -p "$P/Projekte"
(cd launcher && GOOS=windows GOARCH=amd64 go build -ldflags="-H=windowsgui -s -w" -o "$P/Arduino-Werkstatt starten.exe" .)
cp -r app "$P/app"
cp paket/LIESMICH.txt paket/"Notstart ohne Startprogramm.bat" "$P/"
sed -i "1s/Testversion [0-9.]*/Testversion $VER/" "$P/LIESMICH.txt"
rm -f "Arduino-Werkstatt-$VER.zip"
(cd "$OUT" && zip -qr "$OLDPWD/Arduino-Werkstatt-$VER.zip" Arduino-Werkstatt)
rm -rf "$OUT"
echo "Fertig: Arduino-Werkstatt-$VER.zip"
