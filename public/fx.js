'use strict';
// =====================================================================
//  Effetti particellari in pixel art (canvas a bassa risoluzione, leggero)
// =====================================================================
const FX = (() => {
  const PAL = {
    W: ['#ffffff', '#fffbe0', '#ffe680', '#ffc23a', '#e08a20'],
    U: ['#ffffff', '#c8ecff', '#7cc4ff', '#3a8ae0', '#1f5cb0'],
    B: ['#f0dcff', '#c890ff', '#9048e0', '#5a1ea0', '#2a1040'],
    R: ['#fffbe0', '#ffe27a', '#ffb82a', '#f05a14', '#a01c0a'],
    G: ['#f0ffc8', '#b8f09a', '#7ad86a', '#2f9a48', '#1a6a32'],
    N: ['#ffffff', '#d8d0f0', '#a89cd8', '#6a5aa0', '#3e3466'],
  };
  const SMOKE = ['#4a3a5a', '#32263e', '#20182a', '#120c18'];
  const ROCK = ['#8a84a0', '#5a5470', '#3a3448', '#1e1a28'];
  const COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches; // telefono o tablet
  let cv, ctx, S = 2, parts = [], objs = [], running = false, last = 0;
  let quality = 1, userQ = 1, ambient = false, ambientTint = 'N', ambT = 0, skip = false;
  let MAX = COARSE ? 380 : 900;
  // misura dei tempi di frame per abbassare la qualità da solo se il dispositivo fatica
  let perfT = 0, perfN = 0, perfSlow = 0, autoLevel = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  function init() {
    cv = document.getElementById('fx');
    if (!cv) return;
    ctx = cv.getContext('2d', { alpha: true, desynchronized: true });
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!cv) return;
    S = Math.min(innerWidth, innerHeight) > 620 ? 3 : 2;
    if (COARSE) S = 3; // su telefono pixel più grossi: meno lavoro, stesso stile
    cv.width = Math.ceil(innerWidth / S); cv.height = Math.ceil(innerHeight / S);
    ctx.imageSmoothingEnabled = false;
  }
  const ambientOn = () => ambient && quality >= 1 && !COARSE;
  function kick() {
    if (!running && ctx && !document.hidden) { running = true; last = performance.now(); cv.classList.add('on'); requestAnimationFrame(loop); }
  }

  // p: x,y,vx,vy (px CSS e px/s), g gravità, drag, life, size, cols, add, shape
  function P(o) {
    if (parts.length >= MAX) return;
    o.age = 0; o.g = o.g || 0; o.drag = o.drag || 0; o.size = o.size || S; o.cols = o.cols || PAL.N;
    parts.push(o);
  }
  function many(n, fn) { n = Math.max(1, Math.round(n * quality)); for (let i = 0; i < n; i++) P(fn(i, n)); kick(); }
  function O(o) { o.age = 0; objs.push(o); kick(); }

  // Se per circa 1,5 secondi di effetti i frame superano i 24 ms, riduce la qualità (al massimo due volte)
  function watch(dt) {
    if (parts.length < 40 || autoLevel >= 2) return;
    perfT += dt; perfN++;
    if (dt > 0.024) perfSlow++;
    if (perfT < 1.5) return;
    if (perfSlow / perfN > 0.35) {
      autoLevel++;
      quality = Math.max(0.3, quality * 0.55);
      MAX = Math.round(MAX * 0.6);
      document.body.classList.add('auto-low');
    }
    perfT = 0; perfN = 0; perfSlow = 0;
  }

  const stats = { frames: 0, ms: 0, max: 0 }; // misura del costo del motore (per i test)
  function loop(now) {
    const t0 = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    const busy = parts.length > 12 || objs.length > 0;
    // con solo il pulviscolo d'ambiente basta disegnare un frame sì e uno no
    if (!busy) { skip = !skip; if (skip) { requestAnimationFrame(loop); return; } }
    last = now;
    if (busy) watch(dt);
    if (ambientOn()) {
      ambT += dt;
      if (ambT > 0.4) {
        ambT = 0;
        P({ x: R(0, innerWidth), y: R(innerHeight * 0.3, innerHeight), vx: R(-6, 6), vy: R(-22, -8), life: R(4, 7), size: S, cols: [PAL[ambientTint][2], PAL[ambientTint][3]], add: true, soft: 0.5, wob: R(0, 6) });
      }
    }
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]; o.age += dt;
      if (o.age >= o.life) { objs[i] = objs[objs.length - 1]; objs.pop(); continue; }
      ctx.globalCompositeOperation = o.add ? 'lighter' : 'source-over';
      o.draw(ctx, o.age / o.life, o.age);
    }
    // aggiornamento (rimozione per scambio, senza splice)
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (p.delay > 0) { p.delay -= dt; p.age -= dt; continue; }
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt + (p.wob ? Math.sin(p.age * 3 + p.wob) * 0.4 : 0); p.y += p.vy * dt;
    }
    // disegno: prima le opache, poi le luminose; colore e trasparenza cambiano solo quando serve
    let lastCol = '', lastA = -1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!!p.add !== !!pass || p.delay > 0) continue;
        const t = p.age / p.life;
        const a = Math.round((t > 0.7 ? (1 - t) / 0.3 : 1) * (p.soft || 1) * 8) / 8; // 8 livelli
        if (a !== lastA) { ctx.globalAlpha = a; lastA = a; }
        const col = p.cols[Math.min(p.cols.length - 1, (t * p.cols.length) | 0)];
        if (col !== lastCol) { ctx.fillStyle = col; lastCol = col; }
        const s = Math.max(1, Math.round((p.shrink ? p.size * (1 - t * 0.7) : p.size) / S));
        const x = Math.round(p.x / S), y = Math.round(p.y / S);
        if (p.shape === 1 && (p.age * 9 + (p.wob || 0)) % 2 < 1.3) { ctx.fillRect(x - s, y, s * 3, s); ctx.fillRect(x, y - s, s, s * 3); }
        else ctx.fillRect(x, y, s, s);
      }
    }
    ctx.globalAlpha = 1;
    const ms = performance.now() - t0; stats.frames++; stats.ms += ms; if (ms > stats.max) stats.max = ms;
    if (parts.length || objs.length || ambientOn()) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
  }

  // ---------- mattoncini ----------
  const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  function edgePoint(r, t) { // punto sul perimetro, t in [0,1)
    const per = 2 * (r.width + r.height); let d = t * per;
    if (d < r.width) return { x: r.left + d, y: r.top, nx: 0, ny: -1 }; d -= r.width;
    if (d < r.height) return { x: r.right, y: r.top + d, nx: 1, ny: 0 }; d -= r.height;
    if (d < r.width) return { x: r.right - d, y: r.bottom, nx: 0, ny: 1 }; d -= r.width;
    return { x: r.left, y: r.bottom - d, nx: -1, ny: 0 };
  }
  function flash(r, color, life = 0.35, grow = 10) {
    O({ life, add: true, draw(c, t) {
      c.globalAlpha = (1 - t) * 0.55; c.fillStyle = color;
      const g = grow * t; c.fillRect(Math.round((r.left - g) / S), Math.round((r.top - g) / S), Math.round((r.width + g * 2) / S), Math.round((r.height + g * 2) / S));
    } });
  }
  function ring(x, y, r0, r1, cols, life = 0.6, squash = 1, thick = 1) {
    O({ life, add: true, draw(c, t) {
      const rad = (r0 + (r1 - r0) * (1 - (1 - t) * (1 - t))) / S;
      c.globalAlpha = 1 - t; c.fillStyle = cols[Math.min(cols.length - 1, (t * cols.length) | 0)];
      const n = Math.max(12, Math.round(rad * 3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        c.fillRect(Math.round(x / S + Math.cos(a) * rad), Math.round(y / S + Math.sin(a) * rad * squash), thick, thick);
      }
    } });
  }
  function shake(power = 6, ms = 300) {
    const el = document.getElementById('app');
    if (!el || quality < 1 || COARSE || !el.animate) return; // sul telefono si usa la vibrazione
    const k = [];
    for (let i = 0; i < 7; i++) k.push({ transform: `translate(${Math.round(R(-power, power))}px, ${Math.round(R(-power, power))}px)` });
    k.push({ transform: 'none' });
    el.animate(k, { duration: ms, easing: 'steps(8)' });
  }

  // ---------- effetti d'ingresso, uno per colore ----------
  // Foresta: radici e rampicanti che avvolgono la carta
  function vines(r) {
    const paths = [];
    const mk = (dir, startT) => {
      const pts = []; const n = 70;
      for (let i = 0; i < n; i++) {
        const e = edgePoint(r, (((startT + dir * (i / n) * 0.52) % 1) + 1) % 1);
        const w = Math.sin(i * 0.55) * 3 + 2;
        pts.push({ i, x: e.x + e.nx * w, y: e.y + e.ny * w, leaf: i % 6 === 3, nx: e.nx, ny: e.ny });
        if (i % 11 === 7) { // viticcio che si arriccia verso l'esterno
          let a = Math.atan2(e.ny, e.nx) + R(-0.5, 0.5), x = e.x, y = e.y;
          for (let k = 0; k < 9; k++) { a += 0.35 * dir; x += Math.cos(a) * S * 1.3; y += Math.sin(a) * S * 1.3; pts.push({ x, y, tend: true, at: i }); }
        }
      }
      return pts;
    };
    const bottomMid = (r.width + r.height + r.width / 2) / (2 * (r.width + r.height));
    paths.push(mk(1, bottomMid), mk(-1, bottomMid));
    // le radici crescono soltanto: ogni punto si disegna una volta su un canvas a parte
    const pad = 12;
    const ox = Math.floor((r.left - pad) / S), oy = Math.floor((r.top - pad) / S);
    const off = document.createElement('canvas');
    off.width = Math.ceil((r.width + pad * 2) / S) + 4; off.height = Math.ceil((r.height + pad * 2) / S) + 4;
    const oc = off.getContext('2d');
    const done = paths.map(() => 0);
    const order = paths.map((pts) => pts.slice().sort((p, q) => (p.tend ? p.at + 2 : p.i) - (q.tend ? q.at + 2 : q.i)));
    O({ life: 1.9, draw(c, t) {
      const lim = Math.floor(Math.min(1, t / 0.45) * 70);
      order.forEach((pts, k) => {
        while (done[k] < pts.length && (pts[done[k]].tend ? pts[done[k]].at + 2 : pts[done[k]].i) <= lim) {
          const p = pts[done[k]++];
          const x = Math.round(p.x / S) - ox, y = Math.round(p.y / S) - oy;
          oc.fillStyle = '#0c3a1e'; oc.fillRect(x, y, 2, 2);
          oc.fillStyle = p.tend ? '#2f9a48' : '#1a6a32'; oc.fillRect(x, y, 1, 1);
          if (p.leaf) { oc.fillStyle = '#7ad86a'; oc.fillRect(x + Math.round(p.nx * 2), y + Math.round(p.ny * 2), 2, 2); oc.fillStyle = '#d8ffb0'; oc.fillRect(x + Math.round(p.nx * 2), y + Math.round(p.ny * 2), 1, 1); }
        }
      });
      c.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      c.drawImage(off, ox, oy);
    } });
  }
  const ENTER = {
    G(r) {
      vines(r);
      many(26, () => { const e = edgePoint(r, Math.random()); return { x: e.x, y: e.y, vx: e.nx * R(10, 60) + R(-20, 20), vy: e.ny * R(10, 60) - R(10, 50), g: 90, drag: 1.5, life: R(0.7, 1.5), size: S * pick([1, 1, 2]), cols: [PAL.G[1], PAL.G[2], PAL.G[3]], delay: R(0, 0.6), wob: R(0, 6) }; });
      many(14, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-8, 8), vy: R(-40, -12), life: R(1, 2), cols: [PAL.G[0], PAL.G[1]], add: true, shape: 1, wob: R(0, 6), delay: R(0.2, 0.9) }));
    },
    R(r) {
      flash(r, '#ff7a1a', 0.4, 14); shake(5, 280);
      many(60, () => ({ x: R(r.left - 4, r.right + 4), y: r.bottom - R(0, r.height * 0.35), vx: R(-22, 22), vy: R(-190, -50), g: -60, drag: 1.2, life: R(0.35, 0.95), size: S * pick([1, 2, 2, 3]), shrink: true, cols: PAL.R, add: true, delay: R(0, 0.25) }));
      many(22, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-50, 50), vy: R(-170, -60), g: 120, life: R(0.8, 1.7), cols: [PAL.R[1], PAL.R[2], PAL.R[3]], add: true, wob: R(0, 6) }));
      many(10, () => ({ x: R(r.left, r.right), y: r.top + R(0, 10), vx: R(-10, 10), vy: R(-45, -20), drag: 0.6, life: R(0.9, 1.6), size: S * 3, cols: SMOKE, soft: 0.6, delay: R(0.15, 0.5) }));
    },
    U(r) {
      const c = mid(r);
      ring(c.x, r.bottom - 4, 6, r.width * 0.95, PAL.U, 0.8, 0.35, 1);
      setTimeout(() => ring(c.x, r.bottom - 4, 6, r.width * 1.25, PAL.U, 0.9, 0.35, 1), 160);
      many(46, () => { const a = R(-Math.PI * 0.92, -Math.PI * 0.08), v = R(80, 250); return { x: c.x + R(-r.width * 0.35, r.width * 0.35), y: r.bottom - 6, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, g: 420, life: R(0.5, 1.0), size: S * pick([1, 1, 2]), cols: [PAL.U[0], PAL.U[1], PAL.U[2], PAL.U[3]], add: true }; });
      many(16, () => ({ x: R(r.left, r.right), y: R(r.top + r.height * 0.4, r.bottom), vx: R(-6, 6), vy: R(-50, -20), life: R(0.8, 1.6), cols: [PAL.U[1], PAL.U[2]], add: true, wob: R(0, 6), delay: R(0.1, 0.6) }));
      flash(r, '#3a8ae0', 0.3, 6);
    },
    B(r) {
      const c = mid(r);
      many(34, () => ({ x: R(r.left - 6, r.right + 6), y: R(r.top + r.height * 0.3, r.bottom + 4), vx: R(-18, 18), vy: R(-55, -12), drag: 0.9, life: R(0.9, 1.9), size: S * pick([2, 3, 4]), shrink: true, cols: SMOKE, soft: 0.75, wob: R(0, 6), delay: R(0, 0.3) }));
      many(26, () => { const a = R(0, Math.PI * 2), d = R(r.width * 0.7, r.width * 1.3); return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 1.5 + Math.sin(a) * 40, vy: -Math.sin(a) * d * 1.5 - Math.cos(a) * 40, drag: 1.1, life: R(0.6, 0.9), cols: [PAL.B[1], PAL.B[2], PAL.B[3]], add: true, delay: R(0, 0.35) }; });
      many(8, () => ({ x: R(r.left, r.right), y: r.bottom, vx: 0, vy: R(20, 60), g: 80, life: R(0.5, 0.9), cols: [PAL.B[2], PAL.B[3], PAL.B[4]], delay: R(0.2, 0.7) }));
      flash(r, '#7a2ad0', 0.45, 8);
    },
    W(r) {
      const c = mid(r);
      O({ life: 0.9, add: true, draw(cx, t) { // colonna di luce dal cielo
        const a = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        const x0 = Math.round(r.left / S), w = Math.round(r.width / S), y1 = Math.round(r.bottom / S);
        for (let i = 0; i < w; i++) {
          const k = 1 - Math.abs(i - w / 2) / (w / 2);
          cx.globalAlpha = a * (0.12 + 0.3 * k) * ((i + ((t * 20) | 0)) % 3 ? 1 : 0.4);
          cx.fillStyle = k > 0.6 ? '#fffbe0' : '#ffe680'; cx.fillRect(x0 + i, 0, 1, y1);
        }
      } });
      ring(c.x, c.y, 8, r.width * 1.1, PAL.W, 0.7, 1, 1);
      many(34, () => ({ x: R(r.left - 14, r.right + 14), y: R(r.top - 14, r.bottom + 14), vx: R(-10, 10), vy: R(-34, -6), life: R(0.7, 1.7), cols: [PAL.W[0], PAL.W[1], PAL.W[2], PAL.W[3]], add: true, shape: 1, wob: R(0, 6), delay: R(0, 0.7) }));
    },
  };

  const api = {
    init, PAL,
    // q: 1 = completi, <1 = ridotti. Sul telefono "completi" usa comunque un po' meno particelle.
    setQuality(q) { userQ = q; quality = q * (COARSE ? 0.75 : 1) * (autoLevel ? 0.55 ** autoLevel : 1); kick(); },
    stats, get quality() { return quality; }, get autoLevel() { return autoLevel; }, get count() { return parts.length; },
    setAmbient(on, tint) { ambient = on; if (tint) ambientTint = tint; if (on) kick(); },
    tint(t) { ambientTint = t || 'N'; },
    enter(type, r) { if (r && r.width && ENTER[type]) ENTER[type](r); },
    // carta posata sull'altare
    cast(type, r) {
      if (!r || !r.width) return;
      const c = mid(r);
      ring(c.x, c.y, r.width * 0.4, r.width * 1.15, PAL[type], 0.5, 1, 1);
      many(18, () => { const e = edgePoint(r, Math.random()); return { x: e.x, y: e.y, vx: e.nx * R(20, 80), vy: e.ny * R(20, 80), drag: 3, life: R(0.3, 0.7), cols: PAL[type], add: true }; });
    },
    // esplosione: una terra viene distrutta
    destroy(r) {
      if (!r || !r.width) return;
      const c = mid(r);
      flash(r, '#ffb82a', 0.35, 26); shake(10, 420);
      ring(c.x, c.y, 6, r.width * 1.5, PAL.R, 0.5, 1, 2);
      many(70, () => { const a = R(0, Math.PI * 2), v = R(40, 330); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.6, life: R(0.3, 0.9), size: S * pick([1, 2, 2, 3]), shrink: true, cols: PAL.R, add: true }; });
      many(26, () => { const a = R(-Math.PI, 0), v = R(80, 300); return { x: c.x + R(-10, 10), y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 620, life: R(0.6, 1.2), size: S * pick([1, 2, 3]), cols: ROCK }; });
      many(14, () => ({ x: c.x + R(-r.width / 2, r.width / 2), y: c.y + R(-10, 10), vx: R(-16, 16), vy: R(-60, -20), drag: 0.7, life: R(0.9, 1.7), size: S * 4, shrink: true, cols: SMOKE, soft: 0.7, delay: R(0.1, 0.35) }));
    },
    // contrasto: un'onda travolge la carta sull'altare
    counter(r) {
      if (!r || !r.width) return;
      const c = mid(r);
      many(70, (i, n) => { const k = i / n; return { x: r.left - 60 - R(0, 50), y: r.top + k * r.height + R(-8, 8), vx: R(380, 620), vy: R(-50, 50), drag: 2.4, life: R(0.45, 0.9), size: S * pick([1, 2, 2]), cols: PAL.U, add: true, delay: R(0, 0.12) }; });
      setTimeout(() => { ring(c.x, c.y, 8, r.width * 1.4, PAL.U, 0.55, 1, 2); flash(r, '#7cc4ff', 0.3, 12); shake(4, 200); }, 140);
      many(24, () => { const a = R(-Math.PI, 0), v = R(60, 220); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 500, life: R(0.5, 0.9), cols: [PAL.U[0], PAL.U[1], PAL.U[2]], add: true, delay: 0.16 }; });
    },
    // la carta annullata si sbriciola in pixel
    dissolve(r, type) {
      if (!r || !r.width) return;
      const cell = S * 3;
      for (let y = r.top; y < r.bottom; y += cell) for (let x = r.left; x < r.right; x += cell) {
        if (Math.random() > 0.6 * quality + 0.2) continue;
        P({ x, y, vx: R(-70, 70), vy: R(-120, 20), g: 380, life: R(0.5, 1.1), size: cell, shrink: true, cols: [PAL[type][2], PAL[type][3], PAL[type][4], '#1e1a28'], delay: (y - r.top) / r.height * 0.25 });
      }
      kick();
    },
    regrow(r) {
      if (!r || !r.width) return;
      const c = mid(r);
      many(26, (i) => { const a = i * 0.7; return { x: c.x + Math.cos(a) * 10, y: c.y + Math.sin(a) * 10, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 40, drag: 2, life: R(0.5, 1.0), cols: [PAL.G[0], PAL.G[1], PAL.G[2]], add: true, shape: i % 3 ? 0 : 1, delay: i * 0.012 }; });
      ring(c.x, c.y, 4, 40, PAL.G, 0.5);
    },
    discard(r) {
      if (!r || !r.width) return;
      const c = mid(r);
      many(26, () => ({ x: c.x + R(-r.width / 2, r.width / 2), y: c.y + R(-r.height / 2, r.height / 2), vx: R(-60, 60), vy: R(-80, 30), g: 260, life: R(0.4, 0.9), size: S * pick([1, 2]), cols: [PAL.B[0], PAL.B[1], PAL.B[2], PAL.B[3]], add: true }));
    },
    // la Palude scruta una mano
    look(r) {
      if (!r || !r.width) return;
      many(30, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-14, 14), vy: R(-40, -8), life: R(0.6, 1.3), size: S * pick([1, 2]), cols: [PAL.B[1], PAL.B[2], PAL.B[3]], add: true, wob: R(0, 6), delay: R(0, 0.4) }));
      many(10, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-10, 10), vy: R(-20, -5), drag: 0.5, life: R(0.8, 1.4), size: S * 3, shrink: true, cols: SMOKE, soft: 0.6 }));
    },
    reuse(r) {
      if (!r || !r.width) return;
      const c = mid(r);
      ring(c.x, c.y, r.width * 0.2, r.width * 0.9, PAL.W, 0.6, 1, 2);
      many(24, () => { const e = edgePoint(r, Math.random()); return { x: e.x, y: e.y, vx: e.nx * R(10, 50), vy: e.ny * R(10, 50) - 20, life: R(0.5, 1.2), cols: PAL.W, add: true, shape: 1, wob: R(0, 6), delay: R(0, 0.3) }; });
    },
    sparkle(r, type = 'N', n = 8) {
      if (!r || !r.width) return;
      many(n, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-20, 20), vy: R(-50, -10), life: R(0.4, 0.9), cols: PAL[type], add: true, shape: 1, wob: R(0, 6) }));
    },
    // scia colorata dietro a una carta in volo
    // scia dietro a una carta in volo: la posizione si calcola dal percorso, senza leggere il DOM
    trail(path, type, ms) {
      if (quality < 0.7 || !path) return;
      const cols = [PAL[type][1], PAL[type][2], PAL[type][3]];
      const t0 = performance.now();
      const iv = setInterval(() => {
        const k = (performance.now() - t0) / ms;
        if (k >= 1) return clearInterval(iv);
        const e = 1 - (1 - k) * (1 - k);
        const x = path.sx + (path.ex - path.sx) * e, y = path.sy + (path.ey - path.sy) * e - Math.sin(k * Math.PI) * 30;
        for (let i = 0; i < 2; i++) P({ x: x + R(-path.w / 2, path.w / 2), y: y + R(-path.h / 2, path.h / 2), vx: R(-14, 14), vy: R(-14, 14), life: R(0.25, 0.5), cols, add: true, size: S * pick([1, 1, 2]), shrink: true });
        kick();
      }, 45);
    },
    // fontana di luce per la vittoria
    win(colors = 'WUBRG') {
      let n = 0;
      const iv = setInterval(() => {
        if (++n > 26) return clearInterval(iv);
        const x = R(innerWidth * 0.15, innerWidth * 0.85), y = R(innerHeight * 0.2, innerHeight * 0.6), t = colors[(Math.random() * colors.length) | 0];
        ring(x, y, 4, R(40, 90), PAL[t], 0.7, 1, 2);
        many(28, () => { const a = R(0, Math.PI * 2), v = R(40, 240); return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 160, drag: 1.6, life: R(0.6, 1.4), size: S * pick([1, 2]), cols: PAL[t], add: true, shape: Math.random() < 0.3 ? 1 : 0, wob: R(0, 6) }; });
      }, 110);
    },
    lose() {
      many(60, () => ({ x: R(0, innerWidth), y: R(-20, innerHeight * 0.4), vx: R(-10, 10), vy: R(30, 120), drag: 0.3, life: R(1.2, 2.6), size: S * pick([2, 3]), shrink: true, cols: SMOKE, soft: 0.6, delay: R(0, 0.8) }));
    },
    clear() { parts = []; objs = []; },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  return api;
})();
