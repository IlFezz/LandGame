'use strict';
// =====================================================================
//  Effetti, stile "Atlante". Due strumenti soltanto, entrambi leggeri:
//   - figurine DOM (curve di livello, raggi, timbri, frammenti di carta) animate solo con transform e opacity;
//   - un canvas a bassa risoluzione per la polvere, con un tetto al numero di particelle.
// =====================================================================
const FX = (() => {
  const { COL, ICO, PAPER, blob, uri } = ATL;
  const COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches; // telefono o tablet
  const CALM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TINT = { W: ['#fff3c4', '#f1c453', '#d99a22'], U: ['#e3fbff', '#7fd3ea', '#1f8fb8'], B: ['#d9ffe9', '#9fd9a8', '#7557a6'], R: ['#ffe9a8', '#ff9a3c', '#d9482f'], G: ['#e6f7b8', '#63c98a', '#23855a'], N: ['#fffaf0', '#f4eddd', '#cfc3a8'] };
  let layer, cv, ctx, S = COARSE ? 4 : 3, parts = [], run = false, last = 0, live = 0;
  let quality = 1, userQ = 1, autoLevel = 0, MAX = COARSE ? 110 : 160;
  let perfT = 0, perfN = 0, perfSlow = 0;
  const stats = { peak: 0, sprites: 0, frames: 0, ms: 0, max: 0 };
  const R = (a, b) => a + Math.random() * (b - a);
  const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const ok = (r) => r && r.width > 0 && r.height > 0;
  const low = () => quality < 0.7;

  // ---------- figurine precalcolate ----------
  const SP = {};
  for (const l of ATL.L) {
    let s = `<g fill="none" stroke="${COL[l]}" stroke-linecap="round">`;
    [92, 74, 58].forEach((r, i) => { s += `<path d="${blob(100, 100, r, 90 + l.charCodeAt(0), 0.13)}" stroke-width="${2.4 - i * 0.6}" opacity="${1 - i * 0.25}"/>`; });
    SP['c' + l] = uri(s + '</g>', '0 0 200 200');
  }
  { let s = `<g stroke="#f1c453" stroke-linecap="round">`; for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283, r1 = i % 2 ? 78 : 96; s += `<path d="M${100 + Math.cos(a) * 44} ${100 + Math.sin(a) * 44}L${100 + Math.cos(a) * r1} ${100 + Math.sin(a) * r1}" stroke-width="${i % 2 ? 1.2 : 2}"/>`; } SP.burst = uri(s + '</g>', '0 0 200 200'); }
  SP.crack = uri(`<path d="M0 22L14 18 24 26 38 12 52 24 66 16 78 28 92 14 108 24 120 18 134 27 148 15 160 22" fill="none" stroke="#ffb347" stroke-width="3" stroke-linejoin="round"/><path d="M38 12L44 2M92 14L88 4M134 27L140 36M66 16L60 30" stroke="#ffe08a" stroke-width="2" stroke-linecap="round"/>`, '0 0 160 40');
  SP.tree = uri(`<circle cx="13" cy="14" r="10" fill="#0a1418" opacity=".3"/><circle cx="12" cy="12" r="10" fill="#2f9e6a"/><circle cx="9" cy="9" r="4.5" fill="#fff" opacity=".18"/>`, '0 0 24 26');
  SP.wisp = uri(`<circle cx="12" cy="12" r="11" fill="#b6ffd6" opacity=".25"/><circle cx="12" cy="12" r="4" fill="#e4fff0"/>`, '0 0 24 24');

  function init() {
    layer = document.getElementById('fxl'); cv = document.getElementById('fx');
    if (!cv) return;
    ctx = cv.getContext('2d');
    const rs = () => { cv.width = Math.ceil(innerWidth / S); cv.height = Math.ceil(innerHeight / S); };
    rs(); window.addEventListener('resize', rs);
  }
  function sp(bg, x, y, w, h, kf, o = {}) {
    if (CALM || !layer) return null;
    const d = document.createElement('i'); d.className = 'sp' + (o.cls ? ' ' + o.cls : '');
    d.style.cssText = `left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px;` + (bg ? `background-image:${bg}` : '');
    layer.appendChild(d); live++; if (live > stats.sprites) stats.sprites = live;
    d.animate(kf, { duration: o.dur || 800, delay: o.delay || 0, easing: o.ease || 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }).finished.catch(() => {}).then(() => { d.remove(); live--; });
    return d;
  }
  // le curve di livello che si allargano dalla carta: la firma dello stile
  function contours(l, r, n = 3, o = {}) {
    const c = mid(r), size = r.width * (o.size || 2.7);
    if (low()) n = 1;
    for (let i = 0; i < n; i++) sp(SP['c' + l], c.x, c.y, size, size, o.inward
      ? [{ opacity: 0, transform: `scale(1.1) rotate(${i * 25}deg)` }, { opacity: 0.9, offset: 0.4 }, { opacity: 0, transform: `scale(.3) rotate(${i * 25 + 30}deg)` }]
      : [{ opacity: 0, transform: `scale(.3) rotate(${i * 25}deg)` }, { opacity: 0.95, offset: 0.25 }, { opacity: 0, transform: `scale(1) rotate(${i * 25 + (i % 2 ? -14 : 14)}deg)` }],
    { dur: o.dur || 1150, delay: i * (o.gap || 170) });
  }
  function shake(p = 3, ms = 240) {
    const el = document.querySelector('.game');
    if (CALM || low() || !el) return;
    const k = []; for (let i = 0; i < 6; i++) k.push({ transform: `translate(${R(-p, p).toFixed(1)}px,${R(-p, p).toFixed(1)}px)` });
    k.push({ transform: 'none' }); el.animate(k, { duration: ms });
  }

  // ---------- polvere su canvas ----------
  function P(o) {
    if (CALM || !ctx || parts.length >= MAX) return;
    o.age = 0; parts.push(o); if (parts.length > stats.peak) stats.peak = parts.length;
    if (!run && !document.hidden) { run = true; last = performance.now(); cv.classList.add('on'); requestAnimationFrame(loop); }
  }
  const many = (n, fn) => { n = Math.max(1, Math.round(n * quality)); for (let i = 0; i < n; i++) P(fn(i, n)); };
  // se per un secondo e mezzo di effetti i frame superano i 24 ms, la qualità scende da sola (al massimo due volte)
  function watch(dt) {
    if (parts.length < 30 || autoLevel >= 2) return;
    perfT += dt; perfN++; if (dt > 0.024) perfSlow++;
    if (perfT < 1.5) return;
    if (perfSlow / perfN > 0.35) { autoLevel++; quality = Math.max(0.3, quality * 0.55); MAX = Math.round(MAX * 0.6); document.body.classList.add('auto-low'); }
    perfT = 0; perfN = 0; perfSlow = 0;
  }
  function loop(now) {
    const t0 = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    watch(dt);
    ctx.clearRect(0, 0, cv.width, cv.height);
    let lastCol = '', lastA = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (p.delay > 0) { p.delay -= dt; p.age -= dt; continue; }
      p.vy += (p.g || 0) * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += (p.vx + (p.sway ? Math.sin(p.age * 5 + p.sway) * 30 : 0)) * dt; p.y += p.vy * dt;
      const t = p.age / p.life, a = Math.round((t > 0.65 ? (1 - t) / 0.35 : 1) * 8) / 8;
      if (a !== lastA) { ctx.globalAlpha = a; lastA = a; }
      const col = p.cols[Math.min(p.cols.length - 1, (t * p.cols.length) | 0)];
      if (col !== lastCol) { ctx.fillStyle = col; lastCol = col; }
      const s = Math.max(1, (p.size * (p.shrink ? 1 - t * 0.6 : 1)) / S);
      ctx.fillRect(p.x / S - s / 2, p.y / S - s / 2, s, p.flat ? s * 0.5 : s);
    }
    ctx.globalAlpha = 1;
    const ms = performance.now() - t0; stats.frames++; stats.ms += ms; if (ms > stats.max) stats.max = ms;
    if (parts.length) requestAnimationFrame(loop); else { run = false; ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
  }

  // ---------- un ingresso per ogni terra ----------
  const ENTER = {
    W(r, c) { // il sole si apre dietro la tavola, il vento porta via la pula
      contours('W', r);
      sp(SP.burst, c.x, c.y, r.width * 3.2, r.width * 3.2, [{ opacity: 0, transform: 'scale(.5) rotate(0deg)' }, { opacity: 0.85, offset: 0.3 }, { opacity: 0, transform: 'scale(1) rotate(50deg)' }], { dur: 1300 });
      many(26, () => ({ x: R(r.left - 20, r.right), y: R(r.top, r.bottom), vx: R(40, 130), vy: R(-40, -5), drag: 0.6, life: R(0.9, 1.7), size: R(3, 5), cols: TINT.W, delay: R(0, 0.5), sway: R(0, 6) }));
    },
    U(r, c) { // la marea: onde larghe e uno spruzzo
      contours('U', r, 4, { size: 3, gap: 200, dur: 1300 });
      sp('', c.x, c.y, r.width * 2.2, r.width * 2.2, [{ opacity: 0.5, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1)' }], { dur: 700, cls: 'wash' });
      many(34, () => { const a = R(-2.75, -0.4), v = R(120, 320); return { x: c.x + R(-r.width * 0.3, r.width * 0.3), y: r.bottom - 6, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, g: 560, life: R(0.5, 1), size: R(3, 5), cols: TINT.U }; });
    },
    B(r, c) { // il terreno si chiude sulla carta, bolle e fuochi fatui
      contours('B', r, 3, { inward: true, dur: 1200 });
      for (let i = 0; i < (low() ? 2 : 4); i++) { const a = i * 1.57 + 0.6, d = r.width * 0.9;
        sp(SP.wisp, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 22, 22, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: `translate(${-Math.sin(a) * 26}px,${Math.cos(a) * 26}px) scale(1)`, offset: 0.4 }, { opacity: 0, transform: `translate(${-Math.cos(a) * d * 0.7}px,${-Math.sin(a) * d * 0.7}px) scale(.4)` }], { dur: 1400, delay: i * 110, ease: 'ease-in-out' }); }
      many(18, () => ({ x: R(r.left - 12, r.right + 12), y: R(r.top + r.height * 0.5, r.bottom + 10), vx: R(-6, 6), vy: R(-55, -20), life: R(0.9, 1.8), size: R(3, 6), cols: TINT.B, delay: R(0, 0.6), sway: R(0, 6) }));
    },
    R(r, c) { // l'urto: la terra si spacca, faville
      shake(3, 220);
      contours('R', r, 3, { dur: 800, gap: 90, size: 2.4 });
      sp(SP.crack, c.x, r.bottom, r.width * 2.4, r.width * 0.6, [{ opacity: 0, transform: 'scaleX(.15)' }, { opacity: 1, transform: 'scaleX(1)', offset: 0.25 }, { opacity: 0, transform: 'scaleX(1.06)' }], { dur: 700 });
      many(40, () => ({ x: R(r.left, r.right), y: r.bottom - R(0, r.height * 0.3), vx: R(-30, 30), vy: R(-280, -70), g: 120, drag: 0.9, life: R(0.4, 1), size: R(3, 6), shrink: true, cols: TINT.R, delay: R(0, 0.15) }));
    },
    G(r, c) { // il bosco si allarga intorno alla carta
      contours('G', r);
      const n = low() ? 5 : 9;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + 0.3, d = r.width * R(0.72, 0.98), s = r.width * R(0.16, 0.26);
        sp(SP.tree, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 1.15, s, s * 1.08, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.2)', offset: 0.22 }, { opacity: 1, transform: 'scale(1)', offset: 0.34 }, { opacity: 1, transform: 'scale(1)', offset: 0.8 }, { opacity: 0, transform: 'scale(.6)' }], { dur: 1500, delay: 120 + i * 60, ease: 'ease-out' }); }
      many(16, () => ({ x: R(r.left - 10, r.right + 10), y: R(r.top - 10, r.top + r.height * 0.4), vx: R(-10, 10), vy: R(20, 60), life: R(1, 1.8), size: R(4, 6), flat: true, cols: TINT.G, delay: R(0.2, 0.8), sway: R(0, 6) }));
    },
  };
  const burst = (r, cols, n, v = 180) => { const c = mid(r); many(n, () => { const a = R(0, 6.283), s = R(v * 0.25, v); return { x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 2.4, life: R(0.4, 0.8), size: R(3, 5), cols }; }); };

  const api = {
    init, stats,
    // q: 1 = completi, meno di 1 = ridotti
    setQuality(q) { userQ = q; quality = q * (autoLevel ? 0.55 ** autoLevel : 1); },
    get quality() { return quality; },
    enter(l, r) { if (ok(r) && ENTER[l]) ENTER[l](r, mid(r)); },
    // la carta posata al centro
    cast(l, r) { if (!ok(r)) return; contours(l, r, 1, { size: 2.2, dur: 700 }); burst(r, TINT[l] || TINT.N, 10, 150); },
    sparkle(r, l = 'N', n = 8) { if (ok(r)) many(n, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-20, 20), vy: R(-50, -10), life: R(0.4, 0.9), size: R(3, 4), cols: TINT[l] || TINT.N })); },
    // un po' di polvere dietro una carta in volo (la posizione si calcola dal percorso, senza leggere la pagina)
    trail(path, l, ms) {
      if (low() || CALM || !path) return;
      const cols = TINT[l] || TINT.N, t0 = performance.now();
      const iv = setInterval(() => {
        const k = (performance.now() - t0) / ms; if (k >= 1) return clearInterval(iv);
        const e = 1 - (1 - k) * (1 - k);
        P({ x: path.sx + (path.ex - path.sx) * e + R(-path.w / 2, path.w / 2), y: path.sy + (path.ey - path.sy) * e - Math.sin(k * Math.PI) * 30 + R(-path.h / 2, path.h / 2), vx: R(-12, 12), vy: R(-12, 12), life: R(0.25, 0.5), size: R(3, 4), shrink: true, cols });
      }, 60);
    },
    // la tavola si strappa in frammenti di carta. `slot` è la casella sul campo.
    destroy(slot) {
      const el = slot && (slot.querySelector('.card') || slot), r = el && el.getBoundingClientRect();
      if (!ok(r)) return;
      const c = mid(r);
      shake(5, 300);
      sp(SP.crack, c.x, c.y, r.width * 2, r.width * 0.5, [{ opacity: 1, transform: 'rotate(-28deg) scaleX(.2)' }, { opacity: 1, transform: 'rotate(-28deg) scaleX(1)', offset: 0.3 }, { opacity: 0, transform: 'rotate(-28deg) scaleX(1.1)' }], { dur: 420 });
      many(26, () => { const a = R(0, 6.283), v = R(40, 220); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 420, drag: 1.4, life: R(0.5, 1), size: R(3, 6), flat: true, cols: [PAPER, '#e7dcc5', TINT.R[1]], delay: 0.1 }; });
      if (CALM || !layer) return;
      const host = document.createElement('div'); host.className = 'shards';
      host.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      const E = low() ? [[0, 0], [100, 0], [100, 100], [0, 100]] : [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]], k = [50 + R(-10, 10), 46 + R(-10, 10)];
      E.forEach((a, i) => {
        const b = E[(i + 1) % E.length], piece = document.createElement('div'); piece.className = 'shard';
        piece.style.clipPath = `polygon(${k[0]}% ${k[1]}%,${a[0]}% ${a[1]}%,${b[0]}% ${b[1]}%)`;
        const clone = el.cloneNode(true); clone.removeAttribute('id'); clone.className = clone.className.replace(/\b(target|boom|landed|aimed|shine)\b/g, '');
        clone.style.cssText = `position:absolute;left:0;top:0;margin:0;--w:${r.width}px`; piece.appendChild(clone); host.appendChild(piece);
        const dx = (a[0] + b[0]) / 2 - k[0], dy = (a[1] + b[1]) / 2 - k[1], n = Math.hypot(dx, dy) || 1, f = R(0.5, 1.1) * r.width;
        piece.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(dx / n) * f * 0.5}px,${(dy / n) * f * 0.5}px) rotate(${R(-18, 18)}deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${(dx / n) * f}px,${(dy / n) * f + r.height * 0.45}px) rotate(${R(-70, 70)}deg) scale(.8)`, opacity: 0 }], { duration: 900, delay: 90, easing: 'cubic-bezier(.3,.5,.5,1)', fill: 'both' });
      });
      layer.appendChild(host); setTimeout(() => host.remove(), 1050);
    },
    // contrasto: un'onda investe la carta al centro
    counter(r) { if (!ok(r)) return; shake(2.5, 180); contours('U', r, 3, { size: 2.8, dur: 900, gap: 120 }); burst(r, TINT.U, 20, 200); },
    // il timbro "Annullata" cala sulla carta
    stamp(r) {
      if (!ok(r) || !layer) return;
      const c = mid(r), d = document.createElement('div'); d.className = 'stamp'; d.textContent = 'Annullata'; d.style.cssText = `left:${c.x}px;top:${c.y}px`; layer.appendChild(d);
      const T = 'translate(-50%,-50%) rotate(-9deg)';
      d.animate(CALM ? [{ opacity: 0, transform: T }, { opacity: 1, transform: T, offset: 0.2 }, { opacity: 1, transform: T, offset: 0.8 }, { opacity: 0, transform: T }]
        : [{ opacity: 0, transform: `${T} scale(2.8)` }, { opacity: 1, transform: `${T} scale(.94)`, offset: 0.2 }, { opacity: 1, transform: `${T} scale(1.03)`, offset: 0.27 }, { opacity: 1, transform: `${T} scale(1)`, offset: 0.33 }, { opacity: 1, transform: `${T} scale(1)`, offset: 0.8 }, { opacity: 0, transform: `${T} scale(1)` }],
      { duration: 1300, easing: 'cubic-bezier(.5,0,.9,.6)' }).finished.catch(() => {}).then(() => d.remove());
      setTimeout(() => shake(2.5, 160), 250);
    },
    regrow(r) { if (!ok(r)) return; contours('G', r, 2, { size: 3, dur: 800 }); burst(r, TINT.G, 16, 160); },
    discard(r) { if (!ok(r)) return; const c = mid(r); many(18, () => ({ x: c.x + R(-r.width / 2, r.width / 2), y: c.y + R(-r.height / 2, r.height / 2), vx: R(-60, 60), vy: R(-80, 20), g: 260, life: R(0.4, 0.9), size: R(3, 5), flat: true, cols: [PAPER, TINT.B[2]] })); },
    // la Palude scruta una mano: fuochi fatui che la attraversano
    look(r) {
      if (!ok(r)) return;
      for (let i = 0; i < (low() ? 2 : 5); i++) { const x = R(r.left, r.right), y = R(r.top, r.bottom);
        sp(SP.wisp, x, y, 22, 22, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: `translate(${R(-20, 20)}px,${R(-14, 14)}px) scale(1)`, offset: 0.4 }, { opacity: 0, transform: `translate(${R(-40, 40)}px,${R(-30, 0)}px) scale(.5)` }], { dur: 1000, delay: i * 90, ease: 'ease-in-out' }); }
      many(14, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-14, 14), vy: R(-40, -8), life: R(0.6, 1.3), size: R(3, 5), cols: TINT.B, delay: R(0, 0.4), sway: R(0, 6) }));
    },
    reuse(r) {
      if (!ok(r)) return; const c = mid(r);
      sp(SP.burst, c.x, c.y, r.width * 2.6, r.width * 2.6, [{ opacity: 0, transform: 'scale(.5) rotate(0deg)' }, { opacity: 0.85, offset: 0.3 }, { opacity: 0, transform: 'scale(1) rotate(40deg)' }], { dur: 900 });
      contours('W', r, 1, { size: 2.4, dur: 800 }); burst(r, TINT.W, 14, 150);
    },
    // Vittoria: la rosa dei venti gira e si ferma; le cinque terre si accendono sui suoi punti, unite da una rotta.
    // Restituisce la durata in millisecondi, così la finestra finale compare dopo.
    win() {
      if (CALM || !layer) return 0;
      const altar = document.getElementById('altar'), ar = altar && altar.classList.contains('on') ? altar.getBoundingClientRect() : null;
      const size = Math.min(innerWidth * 0.9, innerHeight * 0.62), r = ok(ar) ? ar : { left: innerWidth / 2 - size / 2, top: innerHeight / 2 - size / 2, width: size, height: size };
      const c = mid(r), rad = Math.min(r.width, innerWidth * 0.92) * 0.45, B = 'translate(-50%,-50%)', END = 3000;
      sp('', innerWidth / 2, innerHeight / 2, innerWidth, innerHeight, [{ opacity: 0 }, { opacity: 0.72, offset: 0.12 }, { opacity: 0.72, offset: 0.85 }, { opacity: 0 }], { dur: END, cls: 'dim', ease: 'linear' });
      sp('var(--rosa)', c.x, c.y, r.width, r.height, [{ opacity: 0, transform: 'rotate(0deg) scale(.9)' }, { opacity: 1, transform: 'rotate(150deg) scale(1.1)', offset: 0.3 }, { opacity: 1, transform: 'rotate(216deg) scale(1.06)', offset: 0.6 }, { opacity: 1, transform: 'rotate(216deg) scale(1.06)', offset: 0.86 }, { opacity: 0, transform: 'rotate(216deg) scale(1)' }], { dur: END, ease: 'linear' });
      const pts = ATL.L.map((l, i) => { const a = -1.5708 + (i * 6.283) / 5; return [c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad, l]; });
      const pin = Math.max(28, rad * 0.24);
      pts.forEach(([x, y, l], i) => {
        const t0 = 450 + i * 170, k0 = t0 / END;
        sp(ICO[l], x, y, pin, pin, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 0, transform: 'scale(0)', offset: k0 }, { opacity: 1, transform: 'scale(1.35)', offset: k0 + 0.05 }, { opacity: 1, transform: 'scale(1)', offset: k0 + 0.09 }, { opacity: 1, transform: 'scale(1)', offset: 0.86 }, { opacity: 0, transform: 'scale(.7)' }], { dur: END, ease: 'linear', cls: 'pin' });
        setTimeout(() => many(10, () => { const a = R(0, 6.283), v = R(40, 150); return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, life: R(0.4, 0.8), size: R(3, 5), cols: TINT[l] }; }), t0 + 120);
        const [x2, y2] = pts[(i + 2) % 5], len = Math.hypot(x2 - x, y2 - y), ang = Math.atan2(y2 - y, x2 - x), k1 = (1350 + i * 130) / END;
        const ln = sp('', x + len / 2, y, len, 2, [{ opacity: 0, transform: `rotate(${ang}rad) scaleX(0)` }, { opacity: 0.9, transform: `rotate(${ang}rad) scaleX(0)`, offset: k1 }, { opacity: 0.9, transform: `rotate(${ang}rad) scaleX(1)`, offset: k1 + 0.09 }, { opacity: 0.9, transform: `rotate(${ang}rad) scaleX(1)`, offset: 0.86 }, { opacity: 0, transform: `rotate(${ang}rad) scaleX(1)` }], { dur: END, ease: 'linear', cls: 'route' });
        if (ln) ln.style.transformOrigin = '0 50%';
      });
      const t = document.createElement('div'); t.className = 'wint'; t.textContent = 'Vittoria'; t.style.cssText = `left:${c.x}px;top:${c.y}px;font-size:${Math.round(rad * 0.36)}px`; layer.appendChild(t);
      t.animate([{ opacity: 0, transform: `${B} scale(.7)` }, { opacity: 0, transform: `${B} scale(.7)`, offset: 0.66 }, { opacity: 1, transform: `${B} scale(1.06)`, offset: 0.74 }, { opacity: 1, transform: `${B} scale(1)`, offset: 0.78 }, { opacity: 1, transform: `${B} scale(1)`, offset: 0.9 }, { opacity: 0, transform: `${B} scale(1)` }], { duration: END, fill: 'both' }).finished.catch(() => {}).then(() => t.remove());
      for (let w = 0; w < 3; w++) setTimeout(() => many(34, () => ({ x: R(0, innerWidth), y: R(-30, -5), vx: R(-20, 20), vy: R(90, 240), g: 60, life: R(1.4, 2.2), size: R(5, 9), flat: true, sway: R(0, 6), cols: [[PAPER], TINT.W, TINT.U, TINT.R, TINT.G][(Math.random() * 5) | 0].slice(0, 2) })), 1900 + w * 330);
      return END - 250;
    },
    // Sconfitta: il tavolo si oscura un momento, cade qualche frammento di carta
    lose() {
      if (CALM || !layer) return 0;
      sp('', innerWidth / 2, innerHeight / 2, innerWidth, innerHeight, [{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0.6, offset: 0.7 }, { opacity: 0 }], { dur: 1400, cls: 'dim', ease: 'linear' });
      many(30, () => ({ x: R(0, innerWidth), y: R(-30, -5), vx: R(-10, 10), vy: R(60, 160), g: 40, life: R(1.2, 2), size: R(4, 7), flat: true, sway: R(0, 6), cols: ['#8fa3a8', '#5d7480'] }));
      return 900;
    },
    clear() { parts = []; if (layer) layer.textContent = ''; live = 0; },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && parts.length && !run && ctx) { run = true; last = performance.now(); requestAnimationFrame(loop); } });
  return api;
})();
