'use strict';
// Grafica del gioco, stile "Atlante": le terre viste dall'alto, come tavole di un atlante in carta ritagliata.
// Ogni disegno è SVG generato una volta all'avvio e usato come immagine di sfondo (rasterizzata una sola volta).
const ATL = (() => {
  const L = ['W', 'U', 'B', 'R', 'G'];
  const COL = { W: '#e0a92e', U: '#1f8fb8', B: '#7557a6', R: '#d9482f', G: '#23855a', T: '#5d7480' };
  const PAPER = '#f4eddd', INK = '#17262d';

  // ---------- geometria ----------
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // curva chiusa morbida e irregolare: una "curva di livello"
  function blob(cx, cy, R, seed, wob = 0.12, harm = [2, 3, 4, 5]) {
    const r = rng(seed), ks = harm.map((k) => [k, ((r() - 0.5) * 2 * wob) / Math.sqrt(k - 1), r() * 6.283]);
    const n = 44, p = [];
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 6.283; let rr = 1;
      for (const [k, a, ph] of ks) rr += a * Math.sin(k * th + ph);
      p.push([cx + Math.cos(th) * R * rr, cy + Math.sin(th) * R * rr]);
    }
    const m = (a, b) => [((a[0] + b[0]) / 2).toFixed(2), ((a[1] + b[1]) / 2).toFixed(2)];
    let d = `M${m(p[n - 1], p[0])}`;
    for (let i = 0; i < n; i++) d += `Q${p[i][0].toFixed(2)} ${p[i][1].toFixed(2)} ${m(p[i], p[(i + 1) % n])}`;
    return d + 'Z';
  }
  // strato di carta ritagliata: ombra netta + riempimento + filo chiaro sul bordo
  const cut = (d, fill, sh = 0.2) => `<path d="${d}" transform="translate(.7 1.1)" fill="#0a1418" opacity="${sh}"/><path d="${d}" fill="${fill}" stroke="#fff" stroke-opacity=".16" stroke-width=".3"/>`;
  const uri = (inner, vb, extra = '') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}>${inner}</svg>`)}")`;

  // ---------- le cinque tavole ----------
  const MAPS = {
    W() { // campi coltivati, una strada bianca, covoni
      const r = rng(7); let s = `<rect width="100" height="92" fill="#f4d98a"/>`;
      s += cut(blob(18, 20, 58, 11, 0.1), '#eecb66') + cut(blob(88, 70, 52, 12, 0.12), '#e6b84a') + cut(blob(26, 98, 40, 13, 0.1), '#d9a238') + cut(blob(98, 4, 22, 14, 0.14), '#f0d27a');
      s += `<path d="M-4 84C10 74 22 86 34 78S52 70 60 96" fill="none" stroke="#0a1418" stroke-opacity=".16" stroke-width="3.400" transform="translate(.5 1)"/><path d="M-4 84C10 74 22 86 34 78S52 70 60 96" fill="none" stroke="#6fb9d6" stroke-width="2.600" stroke-linecap="round"/>`;
      for (const [x, y] of [[78, 40], [82, 43], [86, 39], [20, 34], [24, 37], [70, 84], [74, 81]]) s += `<circle cx="${x + 0.5}" cy="${y + 0.8}" r="2.200" fill="#0a1418" opacity=".2"/><circle cx="${x}" cy="${y}" r="2.200" fill="#7fae52"/>`;
      for (const [x, y, a, n, w] of [[10, 12, -18, 7, 26], [56, 16, 24, 6, 22], [62, 58, -32, 8, 28], [8, 60, 12, 6, 24], [36, 78, -8, 5, 20]]) {
        s += `<g transform="translate(${x} ${y}) rotate(${a})" stroke="#a8751c" stroke-width=".55" opacity=".55" stroke-linecap="round">`;
        for (let i = 0; i < n; i++) s += `<path d="M0 ${i * 2.6}h${w - (i % 2) * 3}"/>`;
        s += '</g>';
      }
      s += `<path d="M-4 46C18 36 30 58 52 44S82 22 106 30" fill="none" stroke="#0a1418" stroke-opacity=".18" stroke-width="2.6" transform="translate(.5 1)"/><path d="M-4 46C18 36 30 58 52 44S82 22 106 30" fill="none" stroke="#fff6dc" stroke-width="2"/>`;
      for (let i = 0; i < 9; i++) { const x = 8 + r() * 84, y = 8 + r() * 76; s += `<circle cx="${x + 0.5}" cy="${y + 0.8}" r="1.5" fill="#0a1418" opacity=".22"/><circle cx="${x}" cy="${y}" r="1.5" fill="#b9801f"/><circle cx="${x - 0.4}" cy="${y - 0.4}" r=".6" fill="#f4d98a"/>`; }
      return s;
    },
    U() { // batimetria: dal blu profondo alla sabbia, al verde dell'isola
      let s = `<rect width="100" height="92" fill="#103a5c"/>`;
      const lv = [[47, '#15517c'], [39, '#1c75a3'], [32, '#3aaecb'], [26, '#97dfd8'], [21, '#f2e2b3'], [17, '#86c97c'], [11.5, '#55aa69'], [5.5, '#2f8a57']];
      lv.forEach(([R, f], i) => { s += cut(blob(50 - i * 0.3, 46 - i * 0.2, R, 21, 0.11), f, i < 4 ? 0.14 : 0.24); });
      s += cut(blob(86, 80, 8.5, 22, 0.14), '#3aaecb', 0.12) + cut(blob(86, 80, 5.6, 22, 0.14), '#f2e2b3') + cut(blob(86, 80, 3, 22, 0.14), '#55aa69');
      s += `<g fill="none" stroke="#8fd0ea" stroke-width=".5" stroke-linecap="round" opacity=".55">${[[8, 10], [20, 82], [84, 14], [90, 46], [6, 50], [70, 6], [10, 30], [60, 88]].map(([x, y]) => `<path d="M${x} ${y}q1.500-1.300 3 0t3 0"/>`).join('')}</g>`;
      return s;
    },
    B() { // stagni scuri, chiazze di muschio, canneti, fuochi fatui
      const r = rng(31); let s = `<rect width="100" height="92" fill="#43345f"/>`;
      s += cut(blob(20, 24, 34, 32, 0.2), '#372a52', 0.12) + cut(blob(84, 70, 36, 33, 0.2), '#372a52', 0.12);
      for (const [x, y, R, sd] of [[30, 66, 15, 34], [72, 22, 13, 35], [56, 50, 9, 36], [12, 44, 8, 37], [92, 40, 7, 38]]) s += cut(blob(x, y, R, sd, 0.22), '#6f8f55') + cut(blob(x - 1, y - 1, R * 0.55, sd + 9, 0.25), '#8aab69', 0.12);
      for (const [x, y, R, sd] of [[46, 26, 12, 41], [78, 54, 11, 42], [20, 82, 9, 43], [58, 76, 8, 44], [14, 14, 7, 45], [90, 12, 6, 46]]) {
        s += cut(blob(x, y, R, sd, 0.2), '#2f5f6c') + cut(blob(x, y, R - 1.8, sd, 0.2), '#1c2c42', 0.3) + `<path d="${blob(x - R * 0.25, y - R * 0.3, R * 0.22, sd + 5, 0.3)}" fill="#5fa3a8" opacity=".5"/>`;
      }
      s += `<g fill="none" stroke="#d3e2a8" stroke-width=".5" stroke-linecap="round" opacity=".8">`;
      for (let i = 0; i < 11; i++) { const x = 6 + r() * 86, y = 8 + r() * 80; s += `<path d="M${x} ${y}h5M${x + 1} ${y}l-.8-3M${x + 2.5} ${y}v-3.800M${x + 4} ${y}l.8-3"/>`; }
      s += '</g>';
      for (const [x, y] of [[34, 44], [66, 38], [50, 88], [88, 86]]) s += `<circle cx="${x}" cy="${y}" r="3.200" fill="#b6ffd6" opacity=".22"/><circle cx="${x}" cy="${y}" r="1" fill="#e4fff0"/>`;
      return s;
    },
    R() { // curve di livello fitte fino al cratere, una colata
      let s = `<rect width="100" height="92" fill="#35202a"/>`;
      const lv = [[49, '#49282e'], [42, '#633233'], [35, '#823b34'], [28.5, '#a84634'], [22.5, '#cb5535'], [17, '#e6733b'], [12, '#f49a45'], [7.5, '#fcc55c']];
      lv.forEach(([R, f], i) => { s += cut(blob(50 + i * 0.5, 46 - i * 0.4, R, 61, 0.2, [2, 3, 5, 7, 9]), f, 0.24); });
      s += `<path d="${blob(53.5, 43.2, 3.4, 62, 0.2)}" fill="#3a1a18"/><path d="${blob(53.5, 43.2, 1.7, 63, 0.2)}" fill="#ff8a3c"/>`;
      const lava = 'M55 46C62 54 56 64 64 72S70 86 80 96';
      s += `<path d="${lava}" fill="none" stroke="#0a1418" stroke-opacity=".28" stroke-width="3.400" stroke-linecap="round" transform="translate(.7 1.1)"/><path d="${lava}" fill="none" stroke="#ff9a3c" stroke-width="3" stroke-linecap="round"/><path d="${lava}" fill="none" stroke="#ffe08a" stroke-width="1" stroke-linecap="round"/>`;
      for (const [x, y, a] of [[10, 12, 20], [88, 22, -30], [14, 78, 40], [92, 70, 10], [30, 6, 0]]) s += `<path d="M0 -2.400L2.400 2H-2.400Z" transform="translate(${x} ${y}) rotate(${a})" fill="#1f1218" opacity=".7"/>`;
      return s;
    },
    G() { // le chiome viste dall'alto, una radura con uno stagno
      const r = rng(51); let s = `<rect width="100" height="92" fill="#1b5846"/>`;
      s += cut(blob(22, 70, 40, 52, 0.15), '#174a3c', 0.12) + cut(blob(58, 40, 17, 53, 0.16), '#cfe39a') + cut(blob(57, 39, 9, 54, 0.2), '#e3f0b8', 0.1) + cut(blob(61, 43, 4.200, 55, 0.2), '#4fb3c9', 0.25);
      const tones = ['#2f9e6a', '#268a5c', '#3fae72', '#1f7a52', '#57bf7f'], trees = [];
      for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 10; gx++) {
        const x = gx * 11 + (gy % 2) * 5.5 - 2 + (r() - 0.5) * 6, y = gy * 11.5 + (r() - 0.5) * 6, rad = 4.6 + r() * 2.6;
        if (Math.hypot(x - 58, y - 40) < 15 + rad) continue;
        trees.push([x, y, rad, tones[(r() * 5) | 0]]);
      }
      trees.sort((a, b) => a[1] - b[1]);
      for (const [x, y, rad, f] of trees) s += `<circle cx="${(x + 0.9).toFixed(1)}" cy="${(y + 1.4).toFixed(1)}" r="${rad.toFixed(1)}" fill="#0a1418" opacity=".28"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${f}"/><circle cx="${(x - rad * 0.28).toFixed(1)}" cy="${(y - rad * 0.3).toFixed(1)}" r="${(rad * 0.45).toFixed(1)}" fill="#fff" opacity=".13"/>`;
      s += `<path d="M38 96C42 78 46 66 52 54" fill="none" stroke="${PAPER}" stroke-width=".8" stroke-dasharray="1.600 1.600" stroke-linecap="round" opacity=".8"/>`;
      return s;
    },
  };

  // ---------- simboli da legenda (disco colorato + segno) ----------
  const SIGN = {
    W: `<path d="M12 21V4"/><path d="M12 16.500c-3.200 0-4.800-2-4.800-4.200 3.200 0 4.800 2 4.800 4.200zm0 0c3.200 0 4.800-2 4.800-4.200-3.200 0-4.800 2-4.800 4.200zM12 10.800c-2.600 0-3.800-1.600-3.800-3.400 2.600 0 3.800 1.600 3.800 3.400zm0 0c2.600 0 3.800-1.600 3.800-3.400-2.600 0-3.800 1.600-3.800 3.400z" fill="#fffaf0" stroke="none"/>`,
    U: `<path d="M3 9.500q2.250-3 4.500 0t4.500 0 4.500 0 4.500 0M3 15.500q2.250-3 4.500 0t4.500 0 4.500 0 4.500 0"/>`,
    B: `<path d="M4 19.500h16M12 19.500V5M8 19.500L6.200 9M16 19.500L17.800 9"/>`,
    R: `<path d="M2.500 19.500L9.500 6l3.800 6.500L16 9l5.500 10.500z"/>`,
    G: `<circle cx="12" cy="9.500" r="6"/><path d="M12 15.500V21M8.500 21h7"/>`,
    T: `<path d="M12 4v16.500M7 9.500h10"/>`,
  };
  const icon = (l) => `<circle cx="12" cy="12" r="12" fill="${COL[l]}"/><g transform="translate(12 12) scale(.6) translate(-12 -12.500)" fill="none" stroke="#fffaf0" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round">${SIGN[l]}</g>`;

  // ---------- rosa dei venti (l'altare) e fondo a curve di livello ----------
  function rose(c) {
    let s = `<g fill="none" stroke="${c}"><circle cx="100" cy="100" r="96" stroke-width=".7" opacity=".55"/><circle cx="100" cy="100" r="88" stroke-width=".4" opacity=".4"/><circle cx="100" cy="100" r="58" stroke-width=".4" opacity=".3"/>`;
    for (let i = 0; i < 72; i++) { const a = (i / 72) * 6.283, r0 = i % 9 === 0 ? 86 : i % 3 === 0 ? 90 : 92.5; s += `<path d="M${100 + Math.cos(a) * r0} ${100 + Math.sin(a) * r0}L${100 + Math.cos(a) * 96} ${100 + Math.sin(a) * 96}" stroke-width=".5" opacity=".5"/>`; }
    s += '</g>';
    const spike = (ang, len, w, op) => { const a = (ang * Math.PI) / 180, tip = [100 + Math.cos(a) * len, 100 + Math.sin(a) * len], l = [100 + Math.cos(a - 1.571) * w, 100 + Math.sin(a - 1.571) * w], r = [100 + Math.cos(a + 1.571) * w, 100 + Math.sin(a + 1.571) * w];
      return `<path d="M${tip}L${l}L100 100Z" fill="${c}" opacity="${op}"/><path d="M${tip}L${r}L100 100Z" fill="none" stroke="${c}" stroke-width=".6" opacity="${op * 1.6}"/>`; };
    for (let i = 0; i < 8; i++) s += spike(i * 45 + 22.5, 44, 5, 0.16);
    for (let i = 0; i < 4; i++) s += spike(i * 90 + 45, 64, 7, 0.22);
    for (let i = 0; i < 4; i++) s += spike(i * 90, 84, 9, 0.34);
    return s + `<circle cx="100" cy="100" r="3" fill="${c}" opacity=".6"/>`;
  }
  function topo(c, op) {
    let s = `<g fill="none" stroke="${c}" stroke-width=".8" opacity="${op}">`;
    for (const [x, y, R, sd, n] of [[60, 120, 150, 71, 7], [340, 520, 190, 72, 8], [80, 700, 120, 73, 5], [380, 90, 110, 74, 5]]) for (let i = 0; i < n; i++) s += `<path d="${blob(x, y, R * (1 - i / (n + 0.6)), sd, 0.18)}"/>`;
    return s + '</g>';
  }
  // ---------- dorsi delle carte (si scelgono nella Collezione) ----------
  const BACKS = [
    { id: 'bussola', name: 'Bussola', svg() { let s = `<rect width="100" height="140" fill="#0d2a33"/><g fill="none" stroke="#d6e8e0" stroke-width=".5" opacity=".28">`; for (let i = 0; i < 7; i++) s += `<path d="${blob(20, 30, 70 * (1 - i / 7.6), 81, 0.2)}"/><path d="${blob(84, 118, 60 * (1 - i / 7.6), 82, 0.2)}"/>`; return s + `</g><g transform="translate(22 42) scale(.28)">${rose('#f4eddd')}</g>`; } },
    // un globo a meridiani e paralleli, con la stella polare al centro
    { id: 'meridiani', name: 'Meridiani', svg() {
      let s = `<rect width="100" height="140" fill="#1b2340"/><g fill="none" stroke="#e9dcb8" stroke-width=".55" opacity=".5"><circle cx="50" cy="70" r="38"/>`;
      for (let i = 1; i < 6; i++) s += `<ellipse cx="50" cy="70" rx="${38 * Math.cos((i * Math.PI) / 12)}" ry="38"/>`;
      for (let i = -3; i <= 3; i++) { const y = 70 + i * 11, w = Math.sqrt(Math.max(0, 38 * 38 - (i * 11) ** 2)); s += `<path d="M${50 - w} ${y}h${2 * w}"/>`; }
      s += `</g><g fill="none" stroke="#e9dcb8" stroke-width=".35" opacity=".22">`;
      for (let x = 6; x < 100; x += 8) s += `<path d="M${x} 4v132"/>`;
      return s + `</g><path d="M50 58l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#f6c453"/><circle cx="50" cy="70" r="1.6" fill="#1b2340"/>`; } },
    // linee di livello parallele, come la sponda di un fiume vista dall'alto
    { id: 'correnti', name: 'Correnti', svg() {
      let s = `<rect width="100" height="140" fill="#123a35"/><g fill="none" stroke="#bfe3d2" stroke-width=".6" stroke-linecap="round">`;
      for (let i = 0; i < 17; i++) { const y = 6 + i * 8; let d = `M-4 ${y}`; for (let x = -4; x <= 104; x += 6) d += `L${x} ${(y + Math.sin(x / 13 + i * 0.55) * 3.2).toFixed(2)}`; s += `<path d="${d}" opacity="${(0.18 + 0.3 * Math.abs(Math.sin(i * 0.7))).toFixed(2)}"/>`; }
      return s + `</g><circle cx="50" cy="70" r="15" fill="#123a35" stroke="#f4eddd" stroke-width=".8"/><g transform="translate(36.5 56.5) scale(.135)">${rose('#f4eddd')}</g>`; } },
    // --- dorsi da sbloccare con gli obiettivi ---
    // un sestante: arco graduato e due specchi
    { id: 'sestante', name: 'Sestante', lock: 'prima', svg() {
      let s = `<rect width="100" height="140" fill="#2a2433"/><g fill="none" stroke="#f0d79a" stroke-linecap="round">`;
      s += `<path d="M18 100 A38 38 0 0 1 82 100" stroke-width="1.2" opacity=".8"/><path d="M24 98 A32 32 0 0 1 76 98" stroke-width=".5" opacity=".5"/>`;
      for (let i = 0; i <= 24; i++) { const a = Math.PI * (1.12 + (i / 24) * 0.76), r0 = i % 6 ? 34 : 30; s += `<path d="M${50 + Math.cos(a) * r0} ${118 + Math.sin(a) * r0 - 18}L${50 + Math.cos(a) * 38} ${118 + Math.sin(a) * 38 - 18}" stroke-width=".5" opacity=".6"/>`; }
      s += `<path d="M50 40L22 98M50 40L78 98M50 40L58 92" stroke-width="1" opacity=".75"/><circle cx="50" cy="40" r="4" stroke-width="1"/>`;
      const q = rng(301);
      for (let i = 0; i < 26; i++) s += `<circle cx="${(q() * 100).toFixed(1)}" cy="${(q() * 34 + 4).toFixed(1)}" r="${(q() * 0.7 + 0.25).toFixed(2)}" fill="#f0d79a" stroke="none" opacity=".7"/>`;
      return s + `</g>`; } },
    // anelli di un tronco, come curve di livello di un bosco
    { id: 'radici', name: 'Radici', lock: 'cinqueforeste', svg() {
      let s = `<rect width="100" height="140" fill="#163a2a"/><g fill="none" stroke="#b9dfa8" stroke-width=".7">`;
      for (let i = 0; i < 11; i++) s += `<path d="${blob(50, 70, 46 * (1 - i / 11.5), 90 + i, 0.12)}" opacity="${(0.25 + (i % 3) * 0.12).toFixed(2)}"/>`;
      return s + `</g><circle cx="50" cy="70" r="4" fill="#e9c46a"/>`; } },
    // onde sotto la luna
    { id: 'maree', name: 'Maree', lock: 'controcontrasto', svg() {
      let s = `<rect width="100" height="140" fill="#0f2b4a"/><circle cx="50" cy="44" r="14" fill="#f4eddd" opacity=".9"/><circle cx="56" cy="40" r="12" fill="#0f2b4a"/><g fill="none" stroke="#9fd0ea" stroke-width=".8" stroke-linecap="round">`;
      for (let i = 0; i < 9; i++) { const y = 74 + i * 7.5; let d = `M-4 ${y}`; for (let x = -4; x <= 104; x += 4) d += `L${x} ${(y + Math.sin(x / 7 + i) * 2).toFixed(2)}`; s += `<path d="${d}" opacity="${(0.25 + i * 0.07).toFixed(2)}"/>`; }
      return s + `</g>`; } },
    // costellazioni su una carta celeste
    { id: 'stelle', name: 'Stelle', lock: 'vittorie10', svg() {
      let s = `<rect width="100" height="140" fill="#14182e"/><g fill="#f4eddd">`;
      const q = rng(707);
      for (let i = 0; i < 70; i++) s += `<circle cx="${(q() * 100).toFixed(1)}" cy="${(q() * 140).toFixed(1)}" r="${(q() * 0.6 + 0.2).toFixed(2)}" opacity="${(0.3 + q() * 0.6).toFixed(2)}"/>`;
      const pts = [[22, 30], [36, 42], [48, 36], [62, 52], [74, 46], [58, 74], [44, 92], [30, 104], [52, 114], [72, 108]];
      s += `</g><path d="M${pts.slice(0, 5).join('L')}M62 52L58 74L44 92L30 104M44 92L52 114L72 108" fill="none" stroke="#f6c453" stroke-width=".6" opacity=".7"/>`;
      return s + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#f6c453"/>`).join(''); } },
  ];

  const root = document.documentElement.style, ICO = {};
  for (const l of L) root.setProperty('--art-' + l, uri(MAPS[l](), '0 0 100 92', 'preserveAspectRatio="xMidYMid slice"'));
  for (const l of [...L, 'T']) { ICO[l] = uri(icon(l), '0 0 24 24'); root.setProperty('--ico-' + l, ICO[l]); }
  root.setProperty('--rose-n', uri(rose('#e3efe8'), '0 0 200 200')); root.setProperty('--rose-d', uri(rose('#17262d'), '0 0 200 200'));
  // tavoli da sbloccare: pergamena antica e carta nautica rossa
  root.setProperty('--rose-p', uri(rose('#5a3e22'), '0 0 200 200')); root.setProperty('--rose-c', uri(rose('#f4d9cc'), '0 0 200 200'));
  root.setProperty('--topo-p', uri(topo('#5a3e22', 0.09), '0 0 440 800', 'preserveAspectRatio="xMidYMid slice"')); root.setProperty('--topo-c', uri(topo('#f4d9cc', 0.08), '0 0 440 800', 'preserveAspectRatio="xMidYMid slice"'));
  root.setProperty('--topo-n', uri(topo('#d6e8e0', 0.07), '0 0 440 800', 'preserveAspectRatio="xMidYMid slice"')); root.setProperty('--topo-d', uri(topo('#17262d', 0.07), '0 0 440 800', 'preserveAspectRatio="xMidYMid slice"'));
  for (const b of BACKS) root.setProperty('--bk-' + b.id, uri(b.svg(), '0 0 100 140', 'preserveAspectRatio="xMidYMid slice"'));
  root.setProperty('--bk', 'var(--bk-bussola)');

  return { L, COL, ICO, PAPER, INK, blob, uri, rng, BACKS: BACKS.map(({ id, name, lock }) => ({ id, name, lock: lock || null })) };
})();
