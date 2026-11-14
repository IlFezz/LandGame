'use strict';
// Anteprima degli stili: stessi contenuti nei tre stili. Tutta la grafica è SVG generato una volta
// e usato come immagine di sfondo (viene rasterizzato una sola volta, non ridisegnato dal vivo).
(() => {
  const ST = document.documentElement.dataset.style;
  const TITLE = { spire: 'Stile 1 · scuro e dipinto', hearth: 'Stile 2 · legno e metallo', bazaar: 'Stile 3 · cartoon' }[ST];
  const L = ['W', 'U', 'B', 'R', 'G'];
  const NAME = { W: 'Pianura', U: 'Isola', B: 'Palude', R: 'Montagna', G: 'Foresta' };
  const TX = { W: 'Riattiva una tua terra', U: 'Pesca 1 · Contrasta', B: 'Fai scartare una terra', R: 'Distruggi una terra', G: 'Recupera dal cimitero' };
  const TIER = { W: 'oro', U: 'diamante', B: 'argento', R: 'bronzo', G: 'oro' };
  // tono per stile: saturazione, luminosità, contorno
  const T = { spire: { s: 0.5, l: 0.84, ol: 1.5, olc: '#141216' }, hearth: { s: 0.95, l: 1, ol: 0, olc: 'none' }, bazaar: { s: 1.3, l: 1.1, ol: 2, olc: '#1b1030' } }[ST];
  const c = (h, s, l) => `hsl(${h} ${Math.min(100, s * T.s).toFixed(0)}% ${Math.min(96, l * T.l).toFixed(0)}%)`;
  const K = T.ol ? `stroke="${T.olc}" stroke-width="${T.ol}" stroke-linejoin="round"` : '';
  const lg = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('')}</linearGradient>`;
  const pine = (x, b, h, w, f) => [0, 1, 2].map((i) => { const top = b - h + i * h * 0.24, bot = top + h * 0.5, hw = w * (0.3 + 0.18 * i); return `<path d="M${x} ${top}L${x + hw} ${bot}H${x - hw}Z" fill="${f}" ${K}/>`; }).join('') + `<rect x="${x - 1}" y="${b - h * 0.04}" width="2" height="${h * 0.08}" fill="${c(25, 40, 18)}"/>`;
  // pennellate: solo nello stile dipinto
  const BRUSH = ST === 'spire' ? `<g fill="none" stroke-linecap="round" stroke-width="3.5"><path d="M4 10q22-5 44 0M52 18q20-4 42 1M8 30q30 4 52-2" stroke="#fff" opacity=".07"/><path d="M0 58q30-5 60 1M40 70q30-5 60 0M6 76q20-3 40 0" stroke="#000" opacity=".16"/></g>` : '';

  const SCENES = {
    W: () => `<defs>${lg('a', [[0, c(265, 50, 22)], [0.55, c(20, 80, 52)], [1, c(42, 95, 70)]])}</defs><rect width="100" height="80" fill="url(#a)"/>
      ${T.ol === 0 || ST === 'bazaar' ? `<g fill="${c(48, 100, 80)}" opacity=".18">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M50 50L${50 + Math.cos(-0.2 - i * 0.46) * 80} ${50 + Math.sin(-0.2 - i * 0.46) * 80}L${50 + Math.cos(-0.32 - i * 0.46) * 80} ${50 + Math.sin(-0.32 - i * 0.46) * 80}Z"/>`).join('')}</g><circle cx="50" cy="50" r="22" fill="${c(48, 100, 80)}" opacity=".3"/>` : ''}
      <circle cx="50" cy="50" r="13" fill="${c(48, 100, 80)}" ${K}/><circle cx="46" cy="46" r="4" fill="#fff" opacity=".5"/>
      <path d="M0 52Q20 44 40 50T80 48T100 50V80H0Z" fill="${c(25, 45, 34)}" ${K}/>
      <path d="M0 60Q30 50 55 58T100 56V80H0Z" fill="${c(40, 72, 48)}" ${K}/>
      <path d="M0 70Q25 62 50 68T100 64V80H0Z" fill="${c(46, 82, 60)}" ${K}/>
      <g stroke="${c(50, 95, 76)}" stroke-width="1.2" stroke-linecap="round">${[6, 14, 23, 31, 44, 58, 67, 76, 88, 95].map((x, i) => `<path d="M${x} ${78 - (i % 3)}v-${5 + (i % 4)}"/>`).join('')}</g>`,
    U: () => `<defs>${lg('a', [[0, c(228, 60, 10)], [1, c(214, 65, 34)]])}${lg('b', [[0, c(212, 68, 32)], [1, c(222, 70, 12)]])}</defs><rect width="100" height="80" fill="url(#a)"/>
      <g fill="#fff">${[[10, 8], [24, 20], [38, 6], [52, 14], [86, 9], [92, 30], [14, 34], [44, 30]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.6 : 1}"/>`).join('')}</g>
      <circle cx="70" cy="20" r="16" fill="${c(210, 60, 80)}" opacity=".18"/><circle cx="70" cy="20" r="9" fill="${c(210, 40, 93)}" ${K}/><circle cx="73" cy="22" r="2" fill="${c(214, 30, 78)}"/><circle cx="67" cy="17" r="1.4" fill="${c(214, 30, 78)}"/>
      <rect y="50" width="100" height="30" fill="url(#b)"/><path d="M0 50H100" stroke="${c(208, 70, 68)}" stroke-width="1"/>
      <g stroke="${c(208, 70, 78)}" stroke-width="1.3" stroke-linecap="round" opacity=".8"><path d="M66 55h8M64 60h12M67 65h7M63 71h13"/></g>
      <path d="M10 52Q14 40 32 40T54 52Z" fill="${c(142, 48, 28)}" ${K}/><path d="M8 52Q32 46 56 52Q32 56 8 52Z" fill="${c(44, 60, 72)}" ${K}/>
      <path d="M30 44Q29 34 33 24" fill="none" stroke="${c(28, 40, 26)}" stroke-width="2.4" stroke-linecap="round"/>
      <g fill="none" stroke="${c(135, 55, 40)}" stroke-width="2.2" stroke-linecap="round"><path d="M33 24q-8-5-13 1M33 24q-4-8-11-6M33 24q4-8 11-5M33 24q8-4 12 3M33 24q1 5-3 9"/></g>
      <g stroke="${c(210, 60, 50)}" stroke-width="1" stroke-linecap="round" opacity=".7"><path d="M6 62h10M24 70h12M84 64h9M44 76h10"/></g>`,
    B: () => `<defs>${lg('a', [[0, c(275, 38, 9)], [1, c(282, 26, 28)]])}${lg('b', [[0, c(150, 22, 20)], [1, c(160, 25, 7)]])}</defs><rect width="100" height="80" fill="url(#a)"/>
      <circle cx="28" cy="22" r="17" fill="${c(95, 35, 60)}" opacity=".16"/><circle cx="28" cy="22" r="9" fill="${c(92, 28, 68)}" ${K}/><circle cx="25" cy="20" r="2" fill="${c(92, 22, 54)}"/>
      <path d="M0 50Q8 42 16 47T34 44T52 48T70 42T88 47T100 44V58H0Z" fill="${c(276, 32, 13)}"/>
      <rect y="56" width="100" height="24" fill="url(#b)"/>
      <g fill="none" stroke="${c(272, 30, 6)}" stroke-linecap="round" stroke-width="3"><path d="M66 66Q64 44 68 20"/><path stroke-width="1.8" d="M67 44q-9-4-14-12M67 34q8-3 13-10M68 26q-5-4-6-10M66 52q8-2 12-8"/></g>
      <g fill="none" stroke="${c(272, 28, 9)}" stroke-linecap="round" stroke-width="2"><path d="M12 62Q11 48 14 36M13 46q-5-3-7-8M13 42q5-2 7-7"/></g>
      <g fill="#cfd6e6" opacity=".13"><ellipse cx="30" cy="55" rx="34" ry="3.5"/><ellipse cx="72" cy="59" rx="30" ry="3"/><ellipse cx="46" cy="64" rx="40" ry="2.5"/></g>
      ${[[20, 68], [48, 72], [84, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c(140, 80, 62)}" opacity=".25"/><circle cx="${x}" cy="${y}" r="1.6" fill="${c(140, 90, 82)}"/>`).join('')}`,
    R: () => `<defs>${lg('a', [[0, c(350, 70, 8)], [0.6, c(14, 85, 36)], [1, c(34, 95, 56)]])}</defs><rect width="100" height="80" fill="url(#a)"/>
      <g fill="${c(340, 16, 15)}"><circle cx="48" cy="12" r="9"/><circle cx="58" cy="8" r="7"/><circle cx="38" cy="7" r="6"/><circle cx="64" cy="16" r="5"/></g>
      <path d="M-6 80L12 44L30 80ZM64 80L84 40L106 80Z" fill="${c(350, 45, 15)}" ${K}/>
      <path d="M18 80L43 25H57L84 80Z" fill="${c(345, 26, 15)}" ${K}/><path d="M18 80L43 25H49L40 80Z" fill="${c(350, 34, 23)}"/>
      <circle cx="50" cy="24" r="12" fill="${c(34, 100, 60)}" opacity=".3"/><ellipse cx="50" cy="26" rx="7" ry="2.2" fill="${c(34, 100, 62)}" ${K}/>
      <path d="M49 27Q44 38 51 46T46 62T52 80" fill="none" stroke="${c(22, 100, 52)}" stroke-width="4" stroke-linecap="round"/><path d="M49 27Q44 38 51 46T46 62T52 80" fill="none" stroke="${c(48, 100, 76)}" stroke-width="1.4" stroke-linecap="round"/>
      <g fill="${c(40, 100, 66)}">${[[30, 14], [70, 22], [24, 30], [78, 10], [62, 32], [36, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join('')}</g>
      <path d="M0 80V72L8 66L16 74L26 70L34 80ZM66 80L74 71L82 75L92 66L100 72V80Z" fill="${c(340, 30, 6)}" ${K}/>`,
    G: () => `<defs><radialGradient id="a" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${c(105, 72, 66)}"/><stop offset=".45" stop-color="${c(140, 60, 28)}"/><stop offset="1" stop-color="${c(155, 60, 8)}"/></radialGradient></defs><rect width="100" height="80" fill="url(#a)"/>
      <g fill="${c(95, 90, 82)}" opacity=".16"><path d="M44 0L30 80H40L50 0ZM56 0L58 80H70L62 0Z"/></g>
      ${[14, 28, 42, 56, 70, 86].map((x, i) => pine(x, 62 - (i % 2) * 3, 30 + (i % 3) * 4, 16, c(146, 46, 25))).join('')}
      <rect y="56" width="100" height="10" fill="${c(120, 50, 55)}" opacity=".12"/>
      ${pine(6, 78, 62, 30, c(150, 52, 12))}${pine(93, 80, 68, 32, c(150, 52, 11))}${pine(24, 80, 40, 20, c(150, 50, 15))}
      <path d="M0 80V72Q30 66 50 71T100 70V80Z" fill="${c(150, 50, 8)}" ${K}/>
      ${[[40, 44], [58, 52], [48, 62], [66, 40], [34, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${c(70, 100, 75)}" opacity=".25"/><circle cx="${x}" cy="${y}" r="1" fill="${c(65, 100, 88)}"/>`).join('')}`,
  };
  const ICONS = {
    W: `<g stroke="#f2a53a" stroke-width="2.4" stroke-linecap="round">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${12 + Math.cos(i * 0.785) * 8} ${12 + Math.sin(i * 0.785) * 8}L${12 + Math.cos(i * 0.785) * 10.5} ${12 + Math.sin(i * 0.785) * 10.5}"/>`).join('')}</g><circle cx="12" cy="12" r="5.5" fill="#ffd24a" ${K}/>`,
    U: `<path d="M12 2C7 10 5 13 5 16a7 7 0 0 0 14 0c0-3-2-6-7-14z" fill="#4aa8ff" ${K}/><path d="M9 15a3 3 0 0 0 3 4" stroke="#fff" fill="none" stroke-width="1.4" opacity=".8"/>`,
    B: `<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v3h9v-3c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8z" fill="#d9cfe6" ${K}/><circle cx="9" cy="11" r="2.2" fill="#2a1840"/><circle cx="15" cy="11" r="2.2" fill="#2a1840"/><path d="M11 15.5h2l-1-2z" fill="#2a1840"/>`,
    R: `<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2.500-7 1.500 1 2 2 2 3 1-2 1.500-5 1.500-8z" fill="#ff6a2a" ${K}/><path d="M12 12c2 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5z" fill="#ffd24a"/>`,
    G: `<rect x="10.5" y="15" width="3" height="6" fill="#7a4a22" ${K}/><path d="M12 2L17 9H14.5L19 15H5L9.500 9H7Z" fill="#3fbf5a" ${K}/>`,
    T: `<path d="M6 21V10a6 6 0 0 1 12 0v11z" fill="#9a94ac" ${K}/><path d="M12 8v8M9 11h6" stroke="#2a2438" stroke-width="2"/><rect x="3" y="20" width="18" height="2.500" fill="#5a5470"/>`,
  };
  const BKCOL = ['#ffd24a', '#4aa8ff', '#b98cff', '#ff6a2a', '#3fbf5a'];
  const BK = `<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="3" opacity=".55"/><circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".35"/>
    <path d="${[0, 2, 4, 1, 3].map((i, k) => `${k ? 'L' : 'M'}${50 + Math.cos(-1.571 + i * 1.2566) * 40} ${50 + Math.sin(-1.571 + i * 1.2566) * 40}`).join('')}Z" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".4"/>
    ${BKCOL.map((col, i) => `<circle cx="${50 + Math.cos(-1.571 + i * 1.2566) * 40}" cy="${50 + Math.sin(-1.571 + i * 1.2566) * 40}" r="7" fill="${col}" stroke="#111" stroke-width="2"/>`).join('')}`;
  const uri = (inner, vb, extra = '') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}>${inner}</svg>`)}")`;
  const root = document.documentElement.style;
  for (const l of L) { root.setProperty('--art-' + l, uri(SCENES[l]() + BRUSH, '0 0 100 80', 'preserveAspectRatio="xMidYMid slice"')); root.setProperty('--ico-' + l, uri(ICONS[l], '0 0 24 24')); }
  root.setProperty('--ico-T', uri(ICONS.T, '0 0 24 24'));
  root.setProperty('--bk', uri(BK, '0 0 100 100', `color="${{ spire: '#b9ad90', hearth: '#e8c66a', bazaar: '#ffffff' }[ST]}"`));

  const ico = (l) => `<i class="ico ico-${l}"></i>`;
  const card = (l, cls = '', style = '') => `<div class="card k-${l} t-${TIER[l]} ${cls}" data-l="${l}" style="${style}"><div class="art"></div><div class="gem">${ico(l)}</div><div class="nm">${NAME[l]}</div><div class="tx">${TX[l]}</div><div class="bk"></div></div>`;
  const slot = (who, l, n) => `<div class="slot" id="s-${who}-${l}" data-l="${l}"><div class="em">${ico(l)}</div>${n ? card(l, 'mini') + (n > 1 ? `<div class="n">${n}</div>` : '') : ''}</div>`;
  const gy = (items) => `<span class="gy">${ico('T')}<b>${items.reduce((s, [, n]) => s + n, 0)}</b><span class="chips">${items.map(([l, n]) => `${ico(l)}×${n}`).join(' ')}</span></span>`;
  const seg = (opts, on) => `<div class="seg">${opts.map((o, i) => `<span class="${i === on ? 'on' : ''}">${o}</span>`).join('')}</div>`;

  const HAND = ['W', 'U', 'U', 'B', 'R', 'G'];
  const hand = HAND.map((l, i) => { const off = i - 2.5; return card(l, i === 4 ? 'sel' : i === 3 ? 'off' : '', `--rot:${off * 4}deg;--dy:calc(var(--hw) * ${(off * off * 0.014).toFixed(3)})`); }).join('');

  document.body.innerHTML = `
  <div class="bar"><a href="index.html">‹ Stili</a><b>${TITLE}</b>${['carte', 'plancia', 'effetti', 'menu'].map((t) => `<button class="tab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>

  <div class="view" id="v-carte">
    <h2>Normale</h2><div class="crow">${L.map((l) => card(l)).join('')}</div>
    <h2>Selezionata</h2><div class="crow">${L.map((l) => card(l, 'sel')).join('')}</div>
    <h2>Non giocabile</h2><div class="crow">${L.map((l) => card(l, 'off')).join('')}</div>
    <h2>Dorso</h2><div class="crow">${card('W', 'back')}</div>
  </div>

  <div class="view" id="v-plancia">
    <div class="fxbar">${L.map((l) => `<button class="btn" data-fx="${l}">${ico(l)} ${NAME[l]}</button>`).join('')}<button class="btn" data-fx="destroy">Distruzione</button><button class="btn" data-fx="counter">Contrasto</button><button class="btn primary" data-fx="win">Vittoria</button></div>
    <div class="board">
      <div class="zone opp">
        <div class="info"><span class="pn">Avversario</span><span class="cnt"><i class="minib"></i>5</span><span class="cnt">Mazzo 38</span>${gy([['U', 1], ['G', 2]])}</div>
        <div class="field">${slot('opp', 'W', 0)}${slot('opp', 'U', 1)}${slot('opp', 'B', 0)}${slot('opp', 'R', 2)}${slot('opp', 'G', 1)}</div>
      </div>
      <div class="center"><div class="ring"></div><div id="stack">${card('B', 'mini')}</div><button class="btn pass">Passa il turno</button></div>
      <div class="zone me">
        <div class="info"><span class="pn">Claudio</span><span class="cnt">Mazzo 36</span>${gy([['W', 1], ['R', 1], ['B', 2]])}</div>
        <div class="field">${slot('me', 'W', 1)}${slot('me', 'U', 2)}${slot('me', 'B', 0)}${slot('me', 'R', 1)}${slot('me', 'G', 0)}</div>
      </div>
      <div class="hand">${hand}</div>
    </div>
  </div>

  <div class="view" id="v-menu"><div class="screens">
    <div class="screen" id="m-home"><h2>Home</h2><div class="panel">
      <div class="pips">${L.map(ico).join('')}</div><h1>Basic Land Game</h1><p class="sub">Cinque terre, un altare.</p>
      <div class="field2"><label>Il tuo nome</label><input class="inp" value="Claudio" readonly></div>
      <button class="btn primary">Contro il computer</button><button class="btn">Con un amico</button><button class="btn ghost">Regole del gioco</button>
    </div></div>
    <div class="screen" id="m-menu"><h2>Menu in partita</h2><div class="panel">
      <h3>Menu</h3>
      <div class="mrow col"><span>Comandi</span>${seg(['Trascina', 'Tocca'], 0)}</div>
      <div class="mrow col"><span>Velocità animazioni</span>${seg(['Lenta', 'Media', 'Veloce'], 1)}</div>
      <div class="mrow">Musica <i class="tog on"></i></div><div class="mrow">Effetti sonori <i class="tog on"></i></div><div class="mrow">Vibrazione <i class="tog"></i></div>
      <button class="btn">Regole</button><button class="btn danger">Esci dalla partita</button>
    </div></div>
    <div class="screen" id="m-regole"><h2>Regole</h2><div class="panel">
      <h3>Regole</h3><p>Vinci con una terra di ogni tipo in gioco, oppure cinque dello stesso tipo. Giochi una terra per turno.</p>
      <ul>${L.map((l) => `<li>${ico(l)} <b>${NAME[l]}</b> · ${TX[l].toLowerCase()}</li>`).join('')}</ul>
      <button class="btn primary">Chiudi</button>
    </div></div>
    <div class="screen" id="m-stanza"><h2>Scelta della stanza</h2><div class="panel">
      <p class="sub">Condividi questo codice con l'avversario</p><div class="code">K7QF</div>
      <button class="btn primary">Condividi link</button>
      <div class="field2"><label>Tempo per turno</label>${seg(['30s', '45s', '60s', '90s', '∞'], 2)}</div>
      <div class="or">oppure entra con un codice</div>
      <div class="row"><input class="inp" value="" placeholder="CODICE" readonly><button class="btn">Entra</button></div>
    </div></div>
  </div></div>
  <canvas id="fx"></canvas>`;

  // schede
  const setTab = (t) => { document.body.dataset.tab = t; document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); history.replaceState(null, '', '#' + t); };
  document.querySelectorAll('.tab').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });
  setTab(['carte', 'plancia', 'effetti', 'menu'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'carte');

  // effetti
  FXP.init();
  window.playFx = (k) => {
    if (L.includes(k)) {
      const s = document.getElementById('s-me-' + k);
      let el = s.querySelector('.card'); let temp = false;
      if (!el) { s.insertAdjacentHTML('beforeend', card(k, 'mini')); el = s.querySelector('.card'); temp = true; }
      FXP.enter(k, el);
      if (temp) setTimeout(() => el.remove(), 2400);
    } else if (k === 'destroy') FXP.destroy(document.querySelector('#s-opp-R .card'));
    else if (k === 'counter') FXP.counter(document.querySelector('#stack .card'));
    else FXP.win();
  };
  document.querySelector('.fxbar').onclick = (e) => { const b = e.target.closest('[data-fx]'); if (b) window.playFx(b.dataset.fx); };
})();
