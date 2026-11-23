#!/usr/bin/env bash
# Nuova versione dell'app Android per chi ha l'APK:
#   bash tools/rilascio.sh 0.4 "Cosa c'è di nuovo, in una riga"
# 1. alza il numero di versione (godot/scripts/app/version.gd ed export_presets.cfg)
# 2. prepara l'APK (debug, firmato con la stessa chiave di sempre: si installa sopra il vecchio)
# 3. lo pubblica nelle «release» di GitHub (serve `gh auth login` fatto una volta)
# 4. scrive versione.json e fa commit e push: il server su Render lo annuncia alle app, che
#    all'avvio propongono «Aggiorna».
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:?scrivi la versione, per esempio 0.4}"
NOTES="${2:-}"
GODOT="${GODOT:-/f/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe}"
GH="${GH:-gh}"
command -v "$GH" >/dev/null || GH="/c/Program Files/GitHub CLI/gh.exe"

OLD=$(grep -oE 'const CODE := [0-9]+' godot/scripts/app/version.gd | grep -oE '[0-9]+$')
CODE=$((OLD + 1))
echo "Versione $NAME (numero $CODE)"

sed -i -E "s/^const CODE := [0-9]+/const CODE := $CODE/; s/^const NAME := \".*\"/const NAME := \"$NAME\"/" godot/scripts/app/version.gd
sed -i -E "s/^version\/code=[0-9]+/version\/code=$CODE/; s/^version\/name=\".*\"/version\/name=\"$NAME\"/" godot/export_presets.cfg

APK="build/Atlas-$NAME.apk"
mkdir -p build
timeout 600 "$GODOT" --headless --path godot --export-debug "Android" "../$APK"
test -s "$APK"

"$GH" release create "v$NAME" "$APK#Atlas.apk" --title "Atlas $NAME" --notes "${NOTES:-Nuova versione di Atlas.}"
URL="https://github.com/IlFezz/LandGame/releases/download/v$NAME/Atlas-$NAME.apk"

node -e '
const [code, name, url, notes] = process.argv.slice(1);
require("fs").writeFileSync("versione.json", JSON.stringify({ code: +code, name, url, notes }, null, 2) + "\n");
' "$CODE" "$NAME" "$URL" "$NOTES"

git add versione.json godot/scripts/app/version.gd godot/export_presets.cfg
git commit -q -m "Rilascio app Android $NAME

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
echo "Pubblicata: $URL"
