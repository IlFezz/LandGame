#!/usr/bin/env bash
# Crea l'APK di prova, lo installa sul telefono collegato via USB e avvia Atlas.
#   bash godot/tools/android.sh
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-/f/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe}"
ADB="${ADB:-$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe}"
mkdir -p ../build
"$GODOT" --headless --path . --export-debug "Android" ../build/atlas.apk 2>&1 | grep -E "ERROR" || true
"$ADB" install -r ../build/atlas.apk | tail -1
"$ADB" shell am force-stop it.atlas.gioco
"$ADB" shell monkey -p it.atlas.gioco -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
echo "Atlas avviato sul telefono"
