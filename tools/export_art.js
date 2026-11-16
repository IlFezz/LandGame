#!/usr/bin/env node
// Esporta i disegni di public/art.js per la versione Godot (godot/scripts/ui/art_data.gd).
// Si rilancia solo se cambia art.js:  node tools/export_art.js
'use strict';
const fs = require('fs');
const path = require('path');
const vars = {};
globalThis.document = { documentElement: { style: { setProperty: (k, v) => { vars[k] = v; } } } };
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'art.js'), 'utf8');
new Function(src + '\nglobalThis.ATL = ATL;')();
const out = path.join(__dirname, '..', 'godot', 'scripts', 'ui', 'art_data.gd');
const lines = [];
for (const [k, v] of Object.entries(vars)) {
  const m = /^url\("data:image\/svg\+xml,(.*)"\)$/.exec(v);
  if (m) lines.push(`\t${JSON.stringify(k.replace(/^--/, ''))}: ${JSON.stringify(decodeURIComponent(m[1]))},`);
}
const head = '## Disegni SVG generati da public/art.js con tools/export_art.js: non modificare a mano.\nextends RefCounted\n\nconst SVG := {\n';
fs.writeFileSync(out, head + lines.join('\n') + '\n}\n');
console.log(`${lines.length} disegni esportati in godot/scripts/ui/art_data.gd`);
