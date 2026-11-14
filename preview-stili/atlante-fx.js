'use strict';
// Effetti dello stile Atlante. Due strumenti soltanto:
//  - "figurine" DOM (curve di livello, raggi, timbri, frammenti di carta) animate con transform e opacity;
//  - un canvas a bassa risoluzione per la polvere, con un tetto al numero di particelle.
const FXP = (() => {
  const { COL, ICO, PAPER, blob, uri } = ATL;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX = 120;
  const TINT = { W: ['#fff3c4', '#f1c453', '#d99a22'], U: ['#e3fbff', '#7fd3ea', '#1f8fb8'], B: ['#d9ffe9', '#9fd9a8', '#7557a6'], R: ['#ffe9a8', '#ff9a3c', '#d9482f'], G: ['#e6f7b8', '#63c98a', '#23855a'] };
  const layer = document.getElementById('fxl'), board = document.querySelector('.board');
  let cv, ctx, S = COARSE ? 4 : 3, parts = [], run = false, last = 0, live = 0;
  const stats = { peak: 0, sprites: 0 };
  const R = (a, b) => a + Math.random() * (b - a);
  const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  // ---------- figurine precalcolate ----------
  const SP = {};
  for (const l of ATL.L) {
    let s = `<g fill="none" stroke="${COL[l]}" stroke-linecap="round">`;
    [92, 74, 58].forEach((r, i) => { s += `<path d="${blob(100, 100, r, 90 + l.charCodeAt(0), 0.13)}" stroke-width="${2.4 - i * 0.6}" opacity="${1 - i * 0.25}"/>`; });
    SP['c' + l] = uri(s + '</g>', '0 0 200 200');
  }
  { let s = `<g stroke="#f1c453" stroke-linecap="round">`; for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283, r0 = 44, r1 = i % 2 ? 78 : 96; s += `<path d="M${100 + Math.cos(a) * r0} ${100 + Math.sin(a) * r0}L${100 + Math.cos(a) * r1} ${100 + Math.sin(a) * r1}" stroke-width="${i % 2 ? 1.2 : 2}"/>`; } SP.burst = uri(s + '</g>', '0 0 200 200'); }
  SP.crack = uri(`<path d="M0 22L14 18 24 26 38 12 52 24 66 16 78 28 92 14 108 24 120 18 134 27 148 15 160 22" fill="none" stroke="#ffb347" stroke-width="3" stroke-linejoin="round"/><path d="M38 12L44 2M92 14L88 4M134 27L140 36M66 16L60 30" stroke="#ffe08a" stroke-width="2" stroke-linecap="round"/>`, '0 0 160 40');
  SP.tree = uri(`<circle cx="13" cy="14" r="10" fill="#0a1418" opacity=".3"/><circle cx="12" cy="12" r="10" fill="#2f9e6a"/><circle cx="9" cy="9" r="4.500" fill="#fff" opacity=".18"/>`, '0 0 24 26');
  SP.wisp = uri(`<circle cx="12" cy="12" r="11" fill="#b6ffd6" opacity=".25"/><circle cx="12" cy="12" r="4" fill="#e4fff0"/>`, '0 0 24 24');

  function sp(bg, x, y, w, h, kf, o = {}) {
    if (CALM) return null;
    const d = document.createElement('i'); d.className = 'sp';
    d.style.cssText = `left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px;` + (bg ? `background-image:${bg}` : '');
    if (o.cls) d.classList.add(o.cls);
    layer.appendChild(d); live++; if (live > stats.sprites) stats.sprites = live;
    d.animate(kf, { duration: o.dur || 800, delay: o.delay || 0, easing: o.ease || 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }).finished.then(() => { d.remove(); live--; });
    return d;
  }
  // le curve di livello che si allargano dalla carta: la firma dello stile
  function contours(l, r, n = 3, o = {}) {
    const c = mid(r), size = r.width * (o.size || 2.7);
    for (let i = 0; i < n; i++) sp(SP['c' + l], c.x, c.y, size, size, o.inward
      ? [{ opacity: 0, transform: `scale(1.1) rotate(${i * 25}deg)` }, { opacity: 0.9, offset: 0.4 }, { opacity: 0, transform: `scale(.3) rotate(${i * 25 + 30}deg)` }]
      : [{ opacity: 0, transform: `scale(.3) rotate(${i * 25}deg)` }, { opacity: 0.95, offset: 0.25 }, { opacity: 0, transform: `scale(1) rotate(${i * 25 + (i % 2 ? -14 : 14)}deg)` }],
    { dur: o.dur || 1150, delay: i * (o.gap || 170) });
  }
  const settle = (el, hard) => el.animate([{ transform: `translateY(-16%) scale(${hard ? 1.28 : 1.16}) rotate(-3deg)`, opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translateY(${hard ? 3 : 1.5}%) scale(.97) rotate(.6deg)`, offset: 0.62 }, { transform: 'none', opacity: 1 }], { duration: hard ? 440 : 540, easing: 'cubic-bezier(.3,.9,.3,1)' });
  function shake(p = 3, ms = 240) { if (CALM) return; const k = []; for (let i = 0; i < 6; i++) k.push({ transform: `translate(${R(-p, p).toFixed(1)}px,${R(-p, p).toFixed(1)}px)` }); k.push({ transform: 'none' }); board.animate(k, { duration: ms }); }

  // ---------- polvere su canvas ----------
  function init() { cv = document.getElementById('fx'); ctx = cv.getContext('2d'); const rs = () => { cv.width = Math.ceil(innerWidth / S); cv.height = Math.ceil(innerHeight / S); }; rs(); addEventListener('resize', rs); }
  function P(o) { if (CALM || parts.length >= MAX) return; o.age = 0; parts.push(o); if (parts.length > stats.peak) stats.peak = parts.length; if (!run) { run = true; last = performance.now(); cv.classList.add('on'); requestAnimationFrame(loop); } }
  const many = (n, fn) => { for (let i = 0; i < n; i++) P(fn(i, n)); };
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (p.delay > 0) { p.delay -= dt; p.age -= dt; continue; }
      p.vy += (p.g || 0) * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += (p.vx + (p.sway ? Math.sin(p.age * 5 + p.sway) * 30 : 0)) * dt; p.y += p.vy * dt;
      const t = p.age / p.life;
      ctx.globalAlpha = t > 0.65 ? (1 - t) / 0.35 : 1;
      ctx.fillStyle = p.cols[Math.min(p.cols.length - 1, (t * p.cols.length) | 0)];
      const s = Math.max(1, (p.size * (p.shrink ? 1 - t * 0.6 : 1)) / S);
      ctx.fillRect(p.x / S - s / 2, p.y / S - s / 2, s, p.flat ? s * 0.5 : s);
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(loop); else { run = false; ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
  }

  // ---------- un ingresso per ogni terra ----------
  const ENTER = {
    W(el, r, c) { // il sole si apre dietro la tavola, il vento porta via la pula
      settle(el); contours('W', r);
      sp(SP.burst, c.x, c.y, r.width * 3.2, r.width * 3.2, [{ opacity: 0, transform: 'scale(.5) rotate(0deg)' }, { opacity: 0.85, offset: 0.3 }, { opacity: 0, transform: 'scale(1) rotate(50deg)' }], { dur: 1300 });
      many(26, () => ({ x: R(r.left - 20, r.right), y: R(r.top, r.bottom), vx: R(40, 130), vy: R(-40, -5), drag: 0.6, life: R(0.9, 1.7), size: R(3, 5), cols: TINT.W, delay: R(0, 0.5), sway: R(0, 6) }));
    },
    U(el, r, c) { // la marea: onde larghe e uno spruzzo
      settle(el); contours('U', r, 4, { size: 3, gap: 200, dur: 1300 });
      sp('', c.x, c.y, r.width * 2.2, r.width * 2.2, [{ opacity: 0.5, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1)' }], { dur: 700, cls: 'wash' });
      many(34, () => { const a = R(-2.75, -0.4), v = R(120, 320); return { x: c.x + R(-r.width * 0.3, r.width * 0.3), y: r.bottom - 6, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, g: 560, life: R(0.5, 1), size: R(3, 5), cols: TINT.U }; });
    },
    B(el, r, c) { // il terreno si chiude sulla carta, bolle e fuochi fatui
      settle(el); contours('B', r, 3, { inward: true, dur: 1200 });
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.6, d = r.width * 0.9;
        sp(SP.wisp, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 22, 22, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: `translate(${-Math.sin(a) * 26}px,${Math.cos(a) * 26}px) scale(1)`, offset: 0.4 }, { opacity: 0, transform: `translate(${-Math.cos(a) * d * 0.7}px,${-Math.sin(a) * d * 0.7}px) scale(.4)` }], { dur: 1400, delay: i * 110, ease: 'ease-in-out' }); }
      many(18, () => ({ x: R(r.left - 12, r.right + 12), y: R(r.top + r.height * 0.5, r.bottom + 10), vx: R(-6, 6), vy: R(-55, -20), life: R(0.9, 1.8), size: R(3, 6), cols: TINT.B, delay: R(0, 0.6), sway: R(0, 6) }));
    },
    R(el, r, c) { // l'urto: la terra si spacca, faville
      settle(el, true); setTimeout(() => shake(3, 220), 190);
      contours('R', r, 3, { dur: 800, gap: 90, size: 2.4 });
      sp(SP.crack, c.x, r.bottom, r.width * 2.4, r.width * 0.6, [{ opacity: 0, transform: 'scaleX(.15)' }, { opacity: 1, transform: 'scaleX(1)', offset: 0.25 }, { opacity: 0, transform: 'scaleX(1.06)' }], { dur: 700, delay: 180 });
      many(40, () => ({ x: R(r.left, r.right), y: r.bottom - R(0, r.height * 0.3), vx: R(-30, 30), vy: R(-280, -70), g: 120, drag: 0.9, life: R(0.4, 1), size: R(3, 6), shrink: true, cols: TINT.R, delay: 0.18 + R(0, 0.15) }));
    },
    G(el, r, c) { // il bosco si allarga intorno alla carta
      settle(el); contours('G', r);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283 + 0.3, d = r.width * R(0.72, 0.98), s = r.width * R(0.16, 0.26);
        sp(SP.tree, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 1.15, s, s * 1.08, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.2)', offset: 0.22 }, { opacity: 1, transform: 'scale(1)', offset: 0.34 }, { opacity: 1, transform: 'scale(1)', offset: 0.8 }, { opacity: 0, transform: 'scale(.6)' }], { dur: 1500, delay: 120 + i * 60, ease: 'ease-out' }); }
      many(16, () => ({ x: R(r.left - 10, r.right + 10), y: R(r.top - 10, r.top + r.height * 0.4), vx: R(-10, 10), vy: R(20, 60), life: R(1, 1.8), size: R(4, 6), flat: true, cols: TINT.G, delay: R(0.2, 0.8), sway: R(0, 6) }));
    },
  };

  const api = {
    MAX, stats,
    enter(l, el) { const r = el.getBoundingClientRect(); ENTER[l](el, r, mid(r)); },
    // la tavola si strappa in frammenti di carta
    destroy(el) {
      const r = el.getBoundingClientRect(), c = mid(r);
      if (CALM) { el.animate([{ opacity: 1 }, { opacity: 0, offset: 0.2 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: 1700 }); return; }
      shake(5, 300);
      sp(SP.crack, c.x, c.y, r.width * 2, r.width * 0.5, [{ opacity: 1, transform: 'rotate(-28deg) scaleX(.2)' }, { opacity: 1, transform: 'rotate(-28deg) scaleX(1)', offset: 0.3 }, { opacity: 0, transform: 'rotate(-28deg) scaleX(1.1)' }], { dur: 420 });
      const host = document.createElement('div'); host.className = 'shards';
      host.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      const E = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]], k = [50 + R(-10, 10), 46 + R(-10, 10)];
      E.forEach((a, i) => {
        const b = E[(i + 1) % 8], piece = document.createElement('div'); piece.className = 'shard';
        piece.style.clipPath = `polygon(${k[0]}% ${k[1]}%,${a[0]}% ${a[1]}%,${b[0]}% ${b[1]}%)`;
        const clone = el.cloneNode(true); clone.style.cssText = `position:absolute;left:0;top:0;--w:${r.width}px`; piece.appendChild(clone); host.appendChild(piece);
        const dx = (a[0] + b[0]) / 2 - k[0], dy = (a[1] + b[1]) / 2 - k[1], n = Math.hypot(dx, dy) || 1, f = R(0.5, 1.1) * r.width;
        piece.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(dx / n) * f * 0.5}px,${(dy / n) * f * 0.5}px) rotate(${R(-18, 18)}deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${(dx / n) * f}px,${(dy / n) * f + r.height * 0.45}px) rotate(${R(-70, 70)}deg) scale(.8)`, opacity: 0 }], { duration: 950, delay: 110, easing: 'cubic-bezier(.3,.5,.5,1)', fill: 'both' });
      });
      layer.appendChild(host); setTimeout(() => host.remove(), 1150);
      el.animate([{ opacity: 1 }, { opacity: 0, offset: 0.07 }, { opacity: 0, offset: 0.78 }, { opacity: 1 }], { duration: 1900 });
      many(26, () => { const a = R(0, 6.283), v = R(40, 220); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 420, drag: 1.4, life: R(0.5, 1), size: R(3, 6), flat: true, cols: [PAPER, '#e7dcc5', TINT.R[1]], delay: 0.1 }; });
    },
    // un timbro cala sulla carta, che sbiadisce
    counter(el) {
      const r = el.getBoundingClientRect(), c = mid(r);
      el.animate([{ opacity: 1, transform: 'none' }, { opacity: 1, transform: 'none', offset: 0.16 }, { opacity: 1, transform: 'scale(.96) rotate(1.500deg)', offset: 0.2 }, { opacity: 0.22, transform: 'scale(.96) rotate(1.500deg)', offset: 0.5 }, { opacity: 0.22, transform: 'scale(.96)', offset: 0.82 }, { opacity: 1, transform: 'none' }], { duration: 1900 });
      const d = document.createElement('div'); d.className = 'stamp'; d.textContent = 'Annullata'; d.style.cssText = `left:${c.x}px;top:${c.y}px`; layer.appendChild(d);
      const T = 'translate(-50%,-50%) rotate(-9deg)';
      d.animate(CALM ? [{ opacity: 0, transform: T }, { opacity: 1, transform: T, offset: 0.15 }, { opacity: 1, transform: T, offset: 0.8 }, { opacity: 0, transform: T }]
        : [{ opacity: 0, transform: `${T} scale(2.8)` }, { opacity: 1, transform: `${T} scale(.94)`, offset: 0.16 }, { opacity: 1, transform: `${T} scale(1.03)`, offset: 0.21 }, { opacity: 1, transform: `${T} scale(1)`, offset: 0.26 }, { opacity: 1, transform: `${T} scale(1)`, offset: 0.8 }, { opacity: 0, transform: `${T} scale(1)` }],
      { duration: 1700, easing: 'cubic-bezier(.5,0,.9,.6)' }).finished.then(() => d.remove());
      setTimeout(() => {
        shake(2.5, 180); contours('U', r, 2, { size: 2.6, dur: 900 });
        many(18, () => { const a = R(0, 6.283), v = R(60, 190); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.4, life: R(0.4, 0.8), size: R(3, 5), cols: TINT.U }; });
      }, 270);
    },
    // la rosa dei venti gira e si ferma; le cinque terre si accendono sui suoi punti, unite da una rotta
    win() {
      const rose = document.querySelector('.rose'), r = rose.getBoundingClientRect(), c = mid(r), rad = Math.min(r.width, innerWidth * 0.92) * 0.45;
      const B = 'translate(-50%,-50%)', END = 3400;
      sp('', innerWidth / 2, innerHeight / 2, innerWidth, innerHeight, [{ opacity: 0 }, { opacity: 0.72, offset: 0.12 }, { opacity: 0.72, offset: 0.85 }, { opacity: 0 }], { dur: END, cls: 'dim', ease: 'linear' });
      // una copia della rosa, sopra il velo, gira e si ferma
      sp('var(--rosa)', c.x, c.y, r.width, r.height, [{ opacity: 0, transform: 'rotate(0deg) scale(.9)' }, { opacity: 1, transform: 'rotate(150deg) scale(1.1)', offset: 0.3 }, { opacity: 1, transform: 'rotate(216deg) scale(1.06)', offset: 0.6 }, { opacity: 1, transform: 'rotate(216deg) scale(1.06)', offset: 0.86 }, { opacity: 0, transform: 'rotate(216deg) scale(1)' }], { dur: END, ease: 'linear' });
      const pts = ATL.L.map((l, i) => { const a = -1.5708 + (i * 6.283) / 5; return [c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad, l]; });
      const pin = Math.max(28, rad * 0.24);
      pts.forEach(([x, y, l], i) => {
        const t0 = 500 + i * 190, k0 = t0 / END;
        sp(ICO[l], x, y, pin, pin, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 0, transform: 'scale(0)', offset: k0 }, { opacity: 1, transform: 'scale(1.35)', offset: k0 + 0.05 }, { opacity: 1, transform: 'scale(1)', offset: k0 + 0.09 }, { opacity: 1, transform: 'scale(1)', offset: 0.86 }, { opacity: 0, transform: 'scale(.7)' }], { dur: END, ease: 'linear', cls: 'pin' });
        setTimeout(() => many(10, () => { const a = R(0, 6.283), v = R(40, 150); return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, life: R(0.4, 0.8), size: R(3, 5), cols: TINT[l] }; }), t0 + 120);
        const [x2, y2] = pts[(i + 2) % 5], len = Math.hypot(x2 - x, y2 - y), ang = Math.atan2(y2 - y, x2 - x), k1 = (1500 + i * 150) / END;
        const ln = sp('', x + len / 2, y, len, 2, [{ opacity: 0, transform: `rotate(${ang}rad) scaleX(0)` }, { opacity: 0.9, transform: `rotate(${ang}rad) scaleX(0)`, offset: k1 }, { opacity: 0.9, transform: `rotate(${ang}rad) scaleX(1)`, offset: k1 + 0.09 }, { opacity: 0.9, transform: `rotate(${ang}rad) scaleX(1)`, offset: 0.86 }, { opacity: 0, transform: `rotate(${ang}rad) scaleX(1)` }], { dur: END, ease: 'linear', cls: 'route' });
        if (ln) ln.style.transformOrigin = '0 50%', ln.style.left = x + 'px';
      });
      const t = document.createElement('div'); t.className = 'wint'; t.textContent = 'Vittoria'; t.style.cssText = `left:${c.x}px;top:${c.y}px;font-size:${Math.round(rad * 0.36)}px`; layer.appendChild(t);
      t.animate([{ opacity: 0, transform: `${B} scale(.7)` }, { opacity: 0, transform: `${B} scale(.7)`, offset: 0.62 }, { opacity: 1, transform: `${B} scale(1.06)`, offset: 0.69 }, { opacity: 1, transform: `${B} scale(1)`, offset: 0.73 }, { opacity: 1, transform: `${B} scale(1)`, offset: 0.9 }, { opacity: 0, transform: `${B} scale(1)` }], { duration: END + 500 }).finished.then(() => t.remove());
      for (let w = 0; w < 3; w++) setTimeout(() => many(34, () => ({ x: R(0, innerWidth), y: R(-30, -5), vx: R(-20, 20), vy: R(90, 240), g: 60, life: R(1.4, 2.2), size: R(5, 9), flat: true, sway: R(0, 6), cols: [[PAPER], TINT.W, TINT.U, TINT.R, TINT.G][(Math.random() * 5) | 0].slice(0, 2) })), 2150 + w * 330);
    },
  };
  init();
  return api;
})();
