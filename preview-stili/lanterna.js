'use strict';
// Stile 4 · Lanterna di carta
// Ogni carta è una scatola luminosa di carta ritagliata: strati dal più chiaro (in fondo, vicino alla luce)
// al più scuro (davanti), ognuno con la sua ombra. Le illustrazioni sono SVG rasterizzati una sola volta.
const RAMP = {
  W: ['#fffbe6', '#ffe9a6', '#ffc862', '#f29a3a', '#c96a2a', '#8f4420', '#5a2a16'],
  U: ['#f2ffff', '#b9eef6', '#6cc4e2', '#3a8fc8', '#285fa6', '#1b3c7c', '#13265a'],
  B: ['#f4ffe0', '#cfe6b4', '#a3ad9e', '#84789f', '#62508a', '#44336c', '#2e2250'],
  R: ['#fff7c0', '#ffd45e', '#ff9838', '#ee5a2c', '#b82f2c', '#7a1c2c', '#4f1226'],
  G: ['#f8fff0', '#c4f5c0', '#7fdc9c', '#3fb583', '#208868', '#125e50', '#0c403c'],
};
const FRAME = { W: '#3d1c10', U: '#0d1a44', B: '#1f1638', R: '#360c1c', G: '#082c2c' };

window.STYLE_X = (() => {
  const uri = (inner, vb, extra = '') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra}>${inner}</svg>`)}")`;
  const DEFS = `<filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#0a0820" flood-opacity=".5"/></filter>
    <filter id="f" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1.8" stdDeviation="2.2" flood-color="#05040f" flood-opacity=".7"/></filter>`;
  const P = (d, col, more = '') => `<path d="${d}" fill="${col}" filter="url(#s)" ${more}/>`;
  const glow = (cx, cy, r, st) => `<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${st.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient><rect width="100" height="140" fill="url(#g)"/>`;
  const hill = (y, a, ph, f = 1) => { let d = 'M-5 145'; for (let x = -5; x <= 105; x += 2.5) d += `L${x} ${(y + Math.sin(x * 0.06 * f + ph) * a + Math.sin(x * 0.13 * f + ph * 2.3) * a * 0.4).toFixed(1)}`; return d + 'L105 145Z'; };
  const wave = (y, r, off) => { let d = `M${-12 - off} 145V${y}`; for (let x = -12 - off; x < 112; x += r * 2) d += `a${r} ${(r * 0.72).toFixed(1)} 0 0 1 ${r * 2} 0`; return d + 'V145Z'; };
  const cloud = (x, y, w) => `M${x} ${y}a${w * 0.17} ${w * 0.17} 0 0 1 ${w * 0.3} ${-w * 0.1}a${w * 0.22} ${w * 0.22} 0 0 1 ${w * 0.4} 0a${w * 0.16} ${w * 0.16} 0 0 1 ${w * 0.3} ${w * 0.1}Z`;
  const pine = (x, y, h, w) => `M${x} ${y - h}L${x + w * 0.28} ${y - h * 0.7}H${x + w * 0.16}L${x + w * 0.4} ${y - h * 0.38}H${x + w * 0.26}L${x + w * 0.52} ${y}H${x - w * 0.52}L${x - w * 0.26} ${y - h * 0.38}H${x - w * 0.4}L${x - w * 0.16} ${y - h * 0.7}H${x - w * 0.28}Z`;
  const pineRow = (y, h, w, step, off) => { let d = `M-5 ${y - 1}H105V145H-5Z`; for (let x = off - step, i = 0; x < 110; x += step, i++) d += pine(x, y, h * (0.82 + ((i * 37) % 10) / 28), w); return d; };
  const dots = (pts, r, col, halo) => pts.map(([x, y]) => (halo ? `<circle cx="${x}" cy="${y}" r="${r * 3}" fill="${col}" opacity=".22"/>` : '') + `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`).join('');
  const frame = (l) => `<path fill-rule="evenodd" d="M-3 -3H103V143H-3ZM11 106V45A39 39 0 0 1 89 45V106Z" fill="${FRAME[l]}" filter="url(#f)"/><path d="M11 106V45A39 39 0 0 1 89 45V106Z" fill="none" stroke="${RAMP[l][4]}" stroke-width=".7" opacity=".7"/>`;

  const SCENES = {
    W: (c) => glow(50, 70, 80, [[0, c[0]], [0.3, c[1]], [0.7, c[2]], [1, c[3]]]) +
      `<circle cx="50" cy="70" r="25" fill="${c[0]}" opacity=".45"/><circle cx="50" cy="70" r="15" fill="#fffdf2"/>` +
      P(cloud(14, 44, 30), c[1]) + P(cloud(56, 32, 34), c[1]) +
      `<path d="M30 24l3 2 3-2M38 30l2.500 1.600 2.500-1.600M66 52l2.500 1.600 2.500-1.600" fill="none" stroke="${c[5]}" stroke-width="1" stroke-linecap="round"/>` +
      P(hill(80, 3, 0.4), c[2]) + P(hill(86, 3.5, 1.9) + 'M70 86v-9h1.600v9Z', c[3]) + `<circle cx="70.800" cy="74" r="5.500" fill="${c[3]}" filter="url(#s)"/>` +
      P(hill(93, 3, 3.1, 1.4), c[4]) +
      `<g filter="url(#s)" fill="${c[5]}"><path d="${hill(100, 2.500, 4.4)}"/>${[8, 17, 27, 38, 61, 73, 84, 93].map((x, i) => `<path d="M${x} 101v-${7 + (i % 3) * 2}h.900v${7 + (i % 3) * 2}Z"/><ellipse cx="${x + 0.45}" cy="${93 - (i % 3) * 2}" rx="1.300" ry="3"/>`).join('')}</g>`,
    U: (c) => glow(62, 40, 85, [[0, c[0]], [0.22, c[1]], [0.55, c[2]], [1, c[3]]]) +
      `<circle cx="62" cy="40" r="23" fill="${c[0]}" opacity=".4"/><circle cx="62" cy="40" r="13" fill="#fbffff"/>` + dots([[22, 26], [34, 44], [80, 22], [84, 58], [18, 60], [44, 20]], 0.7, '#ffffff') +
      P(cloud(18, 36, 34), c[1]) + P(cloud(60, 58, 28), c[2]) +
      P(wave(72, 5, 0), c[2]) +
      `<g filter="url(#s)" fill="${c[3]}" stroke="${c[3]}" stroke-linecap="round"><path stroke="none" d="M16 84Q22 70 40 70T60 84Z"/><path fill="none" stroke-width="1.800" d="M36 72Q34 60 38 50M46 72Q47 64 44 57"/><path fill="none" stroke-width="2" d="M38 50q-8-4-12 2M38 50q-3-8-10-7M38 50q5-7 11-4M38 50q8-2 10 5M44 57q-6-3-9 2M44 57q5-5 10-1"/></g>` +
      P(wave(82, 6, 4), c[4]) + P(wave(91, 7, 0), c[5]) + P(wave(100, 8, 6), c[6]),
    B: (c) => glow(40, 58, 85, [[0, c[0]], [0.25, c[1]], [0.6, c[2]], [1, c[3]]]) +
      `<circle cx="40" cy="58" r="24" fill="${c[0]}" opacity=".4"/><circle cx="40" cy="58" r="14" fill="#fbfff0"/>` +
      `<path d="${wave(50, 9, 3)}" fill="${c[1]}" opacity=".5"/>` +
      `<g filter="url(#s)" fill="${c[2]}" stroke="${c[2]}" stroke-linecap="round"><path stroke="none" d="${hill(72, 1.500, 1)}"/><path fill="none" stroke-width="1.400" d="M22 73V52M22 62l-5-6M22 58l4-5M84 73V56M84 64l4-5M84 60l-3-4"/></g>` +
      `<g filter="url(#s)" fill="${c[3]}" stroke="${c[3]}" stroke-linecap="round"><path stroke="none" d="${hill(82, 1.800, 2)}"/><path fill="none" stroke-width="2.600" d="M68 84Q66 62 70 34"/><path fill="none" stroke-width="1.600" d="M69 60q-9-4-13-13M69 48q8-3 12-11M70 40q-5-4-6-11M68 70q8-2 12-9M61 53l-5 1M77 41l4 2"/></g>` +
      `<path d="M-5 90H105V145H-5Z" fill="${c[4]}" filter="url(#s)"/><path d="M30 93h20M36 97h10M62 95h14" stroke="${c[1]}" stroke-width="1" stroke-linecap="round" opacity=".5"/>` +
      `<g filter="url(#s)" fill="${c[6]}"><path d="${hill(100, 1.500, 0)}"/>${[10, 16, 24, 82, 90, 95].map((x, i) => `<path d="M${x} 101v-${12 + (i % 3) * 3}h.900v${12 + (i % 3) * 3}Z"/><rect x="${x - 0.7}" y="${86 - (i % 3) * 3}" width="2.300" height="5" rx="1.100"/>`).join('')}</g>` +
      dots([[54, 76], [30, 86], [86, 80]], 1.2, '#fbfff0', true),
    R: (c) => glow(50, 52, 80, [[0, c[0]], [0.2, c[1]], [0.48, c[2]], [0.8, c[3]], [1, c[4]]]) +
      `<circle cx="50" cy="50" r="13" fill="${c[0]}" opacity=".6"/>` +
      P(cloud(26, 30, 36), c[4]) + P(cloud(46, 20, 34), c[5]) +
      P('M-5 145V84L8 68L18 80L30 62L40 76L60 74L72 60L84 78L94 66L105 80V145Z', c[3]) +
      P('M6 145V108L40 54L45 58L50 54L55 59L60 54L94 108V145Z', c[5]) +
      `<path d="M50 57Q45 68 52 76T47 92T54 110" fill="none" stroke="${c[2]}" stroke-width="5" stroke-linecap="round" opacity=".55"/><path d="M50 57Q45 68 52 76T47 92T54 110" fill="none" stroke="${c[0]}" stroke-width="2" stroke-linecap="round"/>` +
      dots([[34, 42], [66, 38], [58, 30], [40, 26], [72, 50], [28, 54]], 0.9, c[1]) +
      P('M-5 145V98L6 92L14 100L24 94L32 104L68 104L78 95L88 101L96 93L105 99V145Z', c[6]),
    G: (c) => glow(50, 56, 80, [[0, c[0]], [0.25, c[1]], [0.6, c[2]], [1, c[3]]]) +
      `<circle cx="50" cy="54" r="20" fill="${c[0]}" opacity=".45"/><circle cx="50" cy="54" r="10" fill="#fcfff6"/>` +
      `<path d="M46 20L30 110H40L50 20ZM54 20L62 110H74L58 20Z" fill="#fff" opacity=".16"/>` +
      P(pineRow(76, 24, 12, 11, 3), c[2]) + P(pineRow(86, 32, 15, 15, 10), c[3]) + P(pineRow(96, 42, 19, 21, 4), c[4]) +
      P(pine(8, 108, 78, 34) + pine(94, 110, 84, 36), c[5]) +
      `<g filter="url(#s)" fill="${c[6]}"><path d="${hill(101, 1.500, 0.5)}"/>${[20, 28, 36, 60, 70, 78].map((x, i) => `<path d="M${x} 102q${i % 2 ? 3 : -3}-6 ${i % 2 ? 6 : -6}-7q-2 3-${i % 2 ? 4 : -4} 7Z"/>`).join('')}</g>` +
      dots([[40, 70], [58, 78], [48, 88], [64, 64], [36, 82]], 1, '#fcfff6', true),
  };
  // icone: sagome di carta a tinta unita
  const IC = {
    W: (c) => `<g fill="${c}">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path transform="rotate(${i * 45} 12 12)" d="M12 1l1.800 4.500h-3.600Z"/>`).join('')}<circle cx="12" cy="12" r="5.200"/></g>`,
    U: (c) => `<path d="M12 2C7.500 9 5 12.500 5 16a7 7 0 0 0 14 0c0-3.500-2.500-7-7-14z" fill="${c}"/>`,
    B: (c, d) => `<path d="M12 3a8 8 0 0 0-8 8c0 3 1.500 5 3.500 6v3.500h9V17c2-1 3.500-3 3.500-6a8 8 0 0 0-8-8z" fill="${c}"/><circle cx="9" cy="11.200" r="2.100" fill="${d}"/><circle cx="15" cy="11.200" r="2.100" fill="${d}"/><path d="M10.900 16h2.200L12 13.800z" fill="${d}"/>`,
    R: (c, d) => `<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2.500-7 1.500 1 2 2 2 3 1-2 1.500-5 1.500-8z" fill="${c}"/><path d="M12 13c1.800 1.800 2.600 2.800 2.600 4.400a2.600 2.600 0 0 1-5.200 0c0-1.600 1.700-2.600 2.600-4.400z" fill="${d}"/>`,
    G: (c) => `<path d="M12 2L17 9H14.500L19 15H13.300V21.500H10.700V15H5L9.500 9H7Z" fill="${c}"/>`,
  };
  const TOMB = `<path d="M6 21V10a6 6 0 0 1 12 0v11z" fill="#c9c6e6"/><path d="M12 8v8M9 11h6" stroke="#262b55" stroke-width="2"/><path d="M3 20h18v2.500H3z" fill="#8f8cb8"/>`;
  // dorso: una luna dietro le nuvole di carta
  const BACK = `<defs>${DEFS}</defs><rect width="100" height="140" fill="#fff3d6"/><circle cx="50" cy="62" r="40" fill="#ffe2a8" opacity=".5"/>` +
    `<path d="${wave(70, 9, 2)}" fill="#8a86c8" filter="url(#s)"/><path d="${wave(82, 11, 9)}" fill="#5a5aa6" filter="url(#s)"/><path d="${wave(96, 13, 0)}" fill="#3a3c80" filter="url(#s)"/>` +
    `<path fill-rule="evenodd" d="M-3 -3H103V143H-3ZM50 28A34 34 0 1 0 50 96A34 34 0 1 0 50 28Z" fill="#1c2048" filter="url(#f)"/><circle cx="50" cy="62" r="34" fill="none" stroke="#6a6eb0" stroke-width=".7"/>` +
    ['W', 'U', 'B', 'R', 'G'].map((l, i) => `<circle cx="${22 + i * 14}" cy="118" r="3.600" fill="${RAMP[l][2]}"/>`).join('');
  // tavolo: crepuscolo con colline di carta
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hill2 = (y, a, ph) => { let d = 'M-10 410'; for (let x = -10; x <= 410; x += 8) d += `L${x} ${(y + Math.sin(x * 0.014 + ph) * a + Math.sin(x * 0.033 + ph * 2.1) * a * 0.45).toFixed(1)}`; return d + 'L410 410Z'; };
  const TABLE = `<defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a3a"/><stop offset=".42" stop-color="#2c2e63"/><stop offset=".66" stop-color="#5d457c"/><stop offset=".8" stop-color="#9a5c7e"/></linearGradient>
    <filter id="s" x="-5%" y="-20%" width="110%" height="140%"><feDropShadow dx="0" dy="-3" stdDeviation="5" flood-color="#0a0820" flood-opacity=".5"/></filter></defs><rect width="400" height="400" fill="url(#k)"/>` +
    Array.from({ length: 46 }, () => `<circle cx="${(rnd() * 400).toFixed(0)}" cy="${(rnd() * 210).toFixed(0)}" r="${(0.5 + rnd() * 0.9).toFixed(1)}" fill="#fff" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`).join('') +
    `<path d="${hill2(292, 14, 0.5)}" fill="#6a4a80" filter="url(#s)"/><path d="${hill2(318, 16, 2.2)}" fill="#47386e" filter="url(#s)"/><path d="${hill2(346, 12, 4)}" fill="#2c2957" filter="url(#s)"/><path d="${hill2(374, 10, 5.6)}" fill="#1b1c42" filter="url(#s)"/>`;

  const vars = {};
  for (const l of ['W', 'U', 'B', 'R', 'G']) {
    vars['--art-' + l] = uri(`<defs>${DEFS}</defs>` + SCENES[l](RAMP[l]) + frame(l), '0 0 100 140', 'preserveAspectRatio="xMidYMid slice"');
    vars['--ico-' + l] = uri(IC[l](RAMP[l][1], FRAME[l]), '0 0 24 24');
  }
  vars['--ico-T'] = uri(TOMB, '0 0 24 24');
  vars['--bk'] = uri(BACK, '0 0 100 140', 'preserveAspectRatio="xMidYMid slice"');
  vars['--table'] = uri(TABLE, '0 0 400 400', 'preserveAspectRatio="xMidYMax slice"');
  return { title: 'Stile 4 · Lanterna di carta', tone: { s: 1, l: 1, ol: 0, olc: 'none' }, vars };
})();

// =====================================================================
//  Effetti: ritagli di carta (DOM, solo transform e opacity) + pulviscolo di luce su canvas a bassa risoluzione
// =====================================================================
const FXP = (() => {
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const MAX = 160;
  let cv, ctx, S = COARSE ? 4 : 3, parts = [], run = false, last = 0;
  const stats = { frames: 0, slow: 0, worst: 0, peak: 0 };
  const R = (a, b) => a + Math.random() * (b - a);
  const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  function init() {
    cv = document.getElementById('fx'); ctx = cv.getContext('2d');
    const rs = () => { cv.width = Math.ceil(innerWidth / S); cv.height = Math.ceil(innerHeight / S); };
    rs(); addEventListener('resize', rs);
  }
  function kick() { if (!run) { run = true; last = performance.now(); cv.classList.add('on'); requestAnimationFrame(loop); } }
  function motes(n, fn) { for (let i = 0; i < n && parts.length < MAX; i++) { const o = fn(i, n); o.age = 0; parts.push(o); } if (parts.length > stats.peak) stats.peak = parts.length; kick(); }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stats.frames++; if (dt > 0.02) stats.slow++; if (dt > stats.worst) stats.worst = dt;
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (p.delay > 0) { p.delay -= dt; p.age -= dt; continue; }
      p.vy += (p.g || 0) * dt; if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt + Math.sin(p.age * 3 + p.w) * 0.3; p.y += p.vy * dt;
      const t = p.age / p.life, a = t < 0.15 ? t / 0.15 : t > 0.6 ? (1 - t) / 0.4 : 1, s = p.size / S;
      ctx.fillStyle = p.col;
      ctx.globalAlpha = a * 0.25; ctx.fillRect(p.x / S - s * 1.5, p.y / S - s * 1.5, s * 3, s * 3); // alone
      ctx.globalAlpha = a; ctx.fillRect(p.x / S - s / 2, p.y / S - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(loop); else { run = false; ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
  }

  // un ritaglio di carta: nasce in (x,y) e segue i fotogrammi dati (solo transform e opacity)
  function bit(x, y, w, h, css, frames, opt) {
    const d = document.createElement('div'); d.className = 'bit';
    d.style.cssText = `width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;${css}`;
    document.body.appendChild(d);
    const pre = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) `;
    d.animate(frames.map((f) => ({ ...f, transform: pre + (f.transform || '') })), { fill: 'both', easing: 'ease-out', ...opt }).finished.then(() => d.remove());
    return d;
  }
  const SHAPE = {
    W: 'clip-path:polygon(50% 0,100% 100%,0 100%)', U: 'border-radius:0 55% 55% 55%', B: 'border-radius:50%',
    R: 'clip-path:polygon(50% 0,100% 62%,50% 100%,0 62%)', G: 'border-radius:0 100% 0 100%',
  };
  function bloom(r, col, k = 1.7, ms = 750) { // la lanterna si accende
    const c = mid(r), s = Math.max(r.width, r.height) * k;
    bit(c.x, c.y, s, s, `border-radius:50%;background:radial-gradient(circle,${col} 0,${col}88 28%,transparent 68%)`, [{ transform: 'scale(.35)', opacity: 0.95 }, { transform: 'scale(1)', opacity: 0 }], { duration: ms });
  }
  function ripple(x, y, w, col, delay = 0) {
    bit(x, y, w, w * 0.3, `border-radius:50%;border:2px solid ${col}`, [{ transform: 'scale(.15)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }], { duration: 800, delay });
  }
  function label(text, r, col) {
    const c = mid(r), d = document.createElement('div'); d.className = 'fnum'; d.textContent = text;
    Object.assign(d.style, { left: Math.max(90, Math.min(innerWidth - 90, c.x)) + 'px', top: r.top - 6 + 'px', color: col });
    document.body.appendChild(d);
    d.animate([{ opacity: 0, transform: 'translate(-50%,-60%)' }, { opacity: 1, transform: 'translate(-50%,-100%)', offset: 0.2 }, { opacity: 1, transform: 'translate(-50%,-120%)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-150%)' }], { duration: 1300, easing: 'ease-out' }).finished.then(() => d.remove());
  }
  function shake(p = 4, ms = 240) {
    const k = []; for (let i = 0; i < 6; i++) k.push({ transform: `translate(${R(-p, p).toFixed(1)}px,${R(-p, p).toFixed(1)}px)` });
    k.push({ transform: 'none' }); document.querySelector('.board').animate(k, { duration: ms });
  }
  function moon(l) { const m = document.querySelector('.center .ring'); if (m) { m.style.setProperty('--tint', RAMP[l][2]); m.classList.add('t'); } }

  // ritagli a tema, uno per terra
  function cutouts(l, r) {
    const c = mid(r), col = RAMP[l];
    if (l === 'W') for (let i = 0; i < 12; i++) { // raggi di sole che si aprono a ventaglio
      const a = i * 30, len = r.height * 0.75;
      bit(c.x, c.y, 13, len, `${SHAPE.W};background:${col[i % 2 ? 1 : 2]};transform-origin:50% 100%;margin-top:${-len}px`,
        [{ transform: `rotate(${a - 40}deg) scaleY(.2)`, opacity: 0 }, { transform: `rotate(${a}deg) scaleY(1)`, opacity: 0.9, offset: 0.35 }, { transform: `rotate(${a + 25}deg) scaleY(1.15)`, opacity: 0 }], { duration: 1100, delay: i * 12 });
    }
    if (l === 'U') {
      ripple(c.x, r.bottom - 4, r.width * 1.5, col[1]); ripple(c.x, r.bottom - 4, r.width * 2.1, col[2], 160); ripple(c.x, r.bottom - 4, r.width * 2.7, col[2], 320);
      for (let i = 0; i < 10; i++) { const dx = R(-1, 1) * r.width * 0.9, up = R(0.5, 1.1) * r.height, s = R(7, 12);
        bit(c.x + dx * 0.2, r.bottom - 6, s, s, `${SHAPE.U};background:${col[1 + (i % 3)]}`,
          [{ transform: 'rotate(45deg) scale(.4)', opacity: 0 }, { transform: `translate(${dx * 0.6}px,${-up}px) rotate(45deg) scale(1)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px,${-up * 0.2}px) rotate(45deg) scale(.8)`, opacity: 0 }], { duration: R(750, 1050), delay: i * 25 }); }
    }
    if (l === 'B') for (let i = 0; i < 11; i++) { // fuochi fatui che girano a spirale verso la carta
      const a = R(0, 6.28), d = r.width * R(1, 1.6), s = i < 4 ? R(26, 40) : R(6, 10), mist = i < 4;
      bit(c.x, c.y, s, s, `border-radius:50%;background:${mist ? `radial-gradient(circle,${col[5]}cc,transparent 70%)` : col[i % 2 ? 0 : 1]};${mist ? '' : `box-shadow:0 0 10px ${col[1]}`}`,
        [{ transform: `rotate(${a}rad) translateX(${d}px) scale(.6)`, opacity: 0 }, { transform: `rotate(${a + 1.6}rad) translateX(${d * 0.6}px) scale(1)`, opacity: mist ? 0.8 : 1, offset: 0.4 }, { transform: `rotate(${a + 3.6}rad) translateX(0px) scale(.3)`, opacity: 0 }], { duration: R(900, 1300), delay: i * 30, easing: 'ease-in-out' });
    }
    if (l === 'R') { shake(4, 260);
      for (let i = 0; i < 12; i++) { const x = r.left + R(0.05, 0.95) * r.width, s = R(9, 17), up = R(0.7, 1.5) * r.height;
        bit(x, r.bottom - 4, s, s * 1.5, `${SHAPE.R};background:${col[i % 3]}`,
          [{ transform: 'scale(.3)', opacity: 0 }, { transform: `translateY(${-up * 0.45}px) rotate(${R(-20, 20)}deg) scale(1.1)`, opacity: 1, offset: 0.3 }, { transform: `translate(${R(-14, 14)}px,${-up}px) rotate(${R(-50, 50)}deg) scale(.4)`, opacity: 0 }], { duration: R(650, 1000), delay: i * 22 }); }
    }
    if (l === 'G') for (let i = 0; i < 12; i++) { // foglie che si staccano e scendono piano
      const a = i * 0.52 + R(-0.2, 0.2), d = r.width * R(0.7, 1.3), s = R(9, 15), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
      bit(c.x, c.y, s, s, `${SHAPE.G};background:${col[1 + (i % 3)]}`,
        [{ transform: 'scale(.2)', opacity: 0 }, { transform: `translate(${x}px,${y - 14}px) rotate(${R(60, 200)}deg) scale(1)`, opacity: 1, offset: 0.35 }, { transform: `translate(${x * 1.15 + R(-10, 10)}px,${y + 46}px) rotate(${R(260, 420)}deg) scale(.9)`, opacity: 0 }], { duration: R(1100, 1500), delay: i * 28 });
    }
  }

  const NAMES = { W: 'Pianura', U: 'Isola', B: 'Palude', R: 'Montagna', G: 'Foresta' };
  return {
    init, stats, MAX,
    enter(l, el) {
      const r = el.getBoundingClientRect();
      moon(l); bloom(r, RAMP[l][1]);
      el.animate([{ transform: 'scale(1.16)' }, { transform: 'scale(.97)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
      cutouts(l, r);
      motes(26, () => ({ x: R(r.left - 12, r.right + 12), y: R(r.top, r.bottom), vx: R(-8, 8), vy: R(-46, -12), life: R(0.9, 1.8), size: R(3, 5), col: RAMP[l][Math.random() < 0.5 ? 0 : 1], w: R(0, 6), delay: R(0, 0.5) }));
    },
    // la carta viene strappata in pezzi
    destroy(el) {
      const r = el.getBoundingClientRect(), cx = 50 + R(-12, 12), cy = 50 + R(-12, 12);
      const per = [[0, 0], [55, 0], [100, 0], [100, 45], [100, 100], [48, 100], [0, 100], [0, 52]];
      per.forEach((a, i) => {
        const b = per[(i + 1) % 8], k = el.cloneNode(true);
        k.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;margin:0;z-index:21;pointer-events:none;--w:${r.width}px;clip-path:polygon(${cx}% ${cy}%,${a[0]}% ${a[1]}%,${b[0]}% ${b[1]}%)`;
        document.body.appendChild(k);
        const dx = ((a[0] + b[0]) / 2 - cx) / 50, dy = ((a[1] + b[1]) / 2 - cy) / 50;
        k.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * R(30, 60)}px,${dy * R(30, 60)}px) rotate(${R(-25, 25)}deg)`, opacity: 1, offset: 0.35 }, { transform: `translate(${dx * R(60, 110)}px,${dy * 70 + R(60, 120)}px) rotate(${R(-80, 80)}deg)`, opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.2,.7,.4,1)' }).finished.then(() => k.remove());
      });
      el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: 1900 });
      bloom(r, '#fff3d6', 2, 500); shake(8, 340); label('Distrutta', r, RAMP.R[1]);
      const c = mid(r);
      motes(40, () => { const a = R(0, 6.28), v = R(30, 200); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.4, g: 60, life: R(0.5, 1.1), size: R(3, 6), col: RAMP.R[(Math.random() * 3) | 0], w: R(0, 6) }; });
    },
    // la carta si richiude come un foglio piegato, travolta da strisce d'acqua
    counter(el) {
      const r = el.getBoundingClientRect(), c = mid(r);
      el.animate([{ transform: 'none', opacity: 1 }, { transform: 'perspective(500px) rotateY(82deg) scale(.92)', opacity: 1, offset: 0.3 }, { transform: 'perspective(500px) rotateY(88deg) scale(.9)', opacity: 0, offset: 0.36 }, { transform: 'none', opacity: 0, offset: 0.85 }, { transform: 'none', opacity: 1 }], { duration: 1900, easing: 'ease-in-out' });
      for (let i = 0; i < 4; i++) bit(c.x, r.top + r.height * (0.2 + i * 0.2), r.width * 1.9, 12, `border-radius:6px;background:${RAMP.U[1 + (i % 3)]}`,
        [{ transform: `translateX(${-r.width * 2}px) scaleX(.3)`, opacity: 0 }, { transform: 'translateX(0) scaleX(1)', opacity: 0.95, offset: 0.45 }, { transform: `translateX(${r.width * 2}px) scaleX(.3)`, opacity: 0 }], { duration: 720, delay: i * 70, easing: 'ease-in-out' });
      ripple(c.x, c.y, r.width * 2.2, RAMP.U[1], 250); ripple(c.x, c.y, r.width * 3, RAMP.U[2], 400);
      label('Annullata', r, RAMP.U[0]);
      motes(30, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(60, 220), vy: R(-40, 40), drag: 2, life: R(0.5, 1), size: R(3, 5), col: RAMP.U[1], w: R(0, 6), delay: R(0.15, 0.4) }));
    },
    // lanterne di carta che salgono nel cielo
    win() {
      const b = document.querySelector('.board'), m = document.querySelector('.center .ring');
      const d = document.createElement('div'); d.className = 'winb'; d.textContent = 'Vittoria'; b.appendChild(d);
      d.animate([{ opacity: 0, transform: 'translate(-50%,-30%) scale(.9)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.18 }, { opacity: 1, transform: 'translate(-50%,-52%) scale(1)', offset: 0.85 }, { opacity: 0, transform: 'translate(-50%,-70%) scale(1)' }], { duration: 3400, easing: 'ease-out' }).finished.then(() => d.remove());
      if (m) m.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.14)', offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 2400, easing: 'ease-in-out' });
      const order = 'WUBRGWUBRG';
      for (let i = 0; i < 10; i++) { const l = order[i], col = RAMP[l], x = innerWidth * (0.08 + 0.84 * ((i * 0.37) % 1)), s = R(22, 34), sway = R(14, 30) * (i % 2 ? 1 : -1);
        bit(x, innerHeight + 30, s, s * 1.3, `border-radius:42% 42% 46% 46%;background:radial-gradient(circle at 50% 62%,${col[0]},${col[1]} 45%,${col[3]});box-shadow:0 0 22px ${col[2]}`,
          [{ transform: 'scale(.8)', opacity: 0 }, { transform: `translate(${sway}px,${-innerHeight * 0.35}px)`, opacity: 1, offset: 0.25 }, { transform: `translate(${-sway}px,${-innerHeight * 0.75}px)`, opacity: 1, offset: 0.7 }, { transform: `translate(${sway * 0.5}px,${-innerHeight * 1.1}px) scale(.7)`, opacity: 0 }], { duration: R(3000, 3800), delay: i * 140, easing: 'linear' }); }
      let n = 0; const iv = setInterval(() => { if (n++ > 9) return clearInterval(iv);
        motes(14, () => ({ x: R(0, innerWidth), y: R(innerHeight * 0.4, innerHeight), vx: R(-6, 6), vy: R(-70, -25), life: R(1.4, 2.4), size: R(3, 5), col: '#fff3d6', w: R(0, 6) })); }, 260);
    },
  };
})();
