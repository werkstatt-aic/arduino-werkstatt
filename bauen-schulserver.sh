#!/bin/bash
# Baut "Werkstatt-Schulserver-<Version>.zip" (Windows- und Linux-Programm, Werkstatt-Oberfläche für die Großansicht, Texte).
set -e
cd "$(dirname "$0")"
VER=$(grep -o 'const version = "[^"]*"' schulserver/main.go | cut -d'"' -f2)
OUT=$(mktemp -d)
P="$OUT/Werkstatt-Schulserver"
mkdir -p "$P"
(cd schulserver && GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o "$P/Werkstatt-Schulserver.exe" . \
  && GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o "$P/werkstatt-schulserver-linux-amd64" . \
  && GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o "$P/werkstatt-schulserver-linux-arm64" .)
cp -r app "$P/app"
cp schulserver/paket/schulserver.ini "$P/"
sed "1s/(Version VERSION)/(Version $VER)/" schulserver/paket/LIESMICH-Schulserver.txt > "$P/LIESMICH-Schulserver.txt"
rm -f "Werkstatt-Schulserver-$VER.zip"
(cd "$OUT" && zip -qr "$OLDPWD/Werkstatt-Schulserver-$VER.zip" Werkstatt-Schulserver)
rm -rf "$OUT"
echo "Fertig: Werkstatt-Schulserver-$VER.zip"
