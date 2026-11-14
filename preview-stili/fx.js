'use strict';
// Effetti dell'anteprima: canvas a bassa risoluzione con tetto alle particelle;
// gli elementi DOM (lampi, numeri, scosse) animano solo transform e opacity.
const FXP = (() => {
  const ST = document.documentElement.dataset.style;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const MAX = { spire: 110, hearth: 260, bazaar: 150 }[ST];
  const PAL = {
    W: ['#fff8d8', '#ffe07a', '#f2b53a'], U: ['#e4f5ff', '#7cc4ff', '#2f7fd8'], B: ['#e6ccff', '#a56be8', '#3a2452'],
    R: ['#fff0b0', '#ffa02a', '#e2401a'], G: ['#e8ffc0', '#7ad86a', '#2c8a45'], N: ['#ffffff', '#e0d8c8', '#a09880'],
  };
  const CONF = ['#ff5a8a', '#ffd23d', '#4fd8ff', '#6fe36a', '#b98cff'];
  let cv, ctx, S = COARSE ? 4 : 3, parts = [], objs = [], run = false, last = 0;
  const stats = { frames: 0, slow: 0, worst: 0, peak: 0 };
  const R = (a, b) => a + Math.random() * (b - a);
  const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  function init() {
    cv = document.getElementById('fx'); ctx = cv.getContext('2d');
    const rs = () => { cv.width = Math.ceil(innerWidth / S); cv.height = Math.ceil(innerHeight / S); };
    rs(); addEventListener('resize', rs);
  }
  function kick() { if (!run) { run = true; last = performance.now(); cv.classList.add('on'); requestAnimationFrame(loop); } }
  function P(o) { if (parts.length >= MAX) return; o.age = 0; parts.push(o); if (parts.length > stats.peak) stats.peak = parts.length; }
  function many(n, fn) { for (let i = 0; i < n; i++) P(fn(i, n)); kick(); }
  function O(o) { o.age = 0; objs.push(o); kick(); }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stats.frames++; if (dt > 0.02) stats.slow++; if (dt > stats.worst) stats.worst = dt;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]; o.age += dt;
      if (o.age >= o.life) { objs[i] = objs[objs.length - 1]; objs.pop(); continue; }
      ctx.globalCompositeOperation = o.add ? 'lighter' : 'source-over';
      o.draw(ctx, o.age / o.life);
    }
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (pass === 0) {
          p.age += dt;
          if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
          if (p.delay > 0) { p.delay -= dt; p.age -= dt; continue; }
          p.vy += (p.g || 0) * dt;
          if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        if (!!p.add !== !!pass || p.delay > 0) continue;
        const t = p.age / p.life;
        ctx.globalAlpha = (t > 0.6 ? (1 - t) / 0.4 : 1) * (p.a || 1);
        ctx.fillStyle = p.cols[Math.min(p.cols.length - 1, (t * p.cols.length) | 0)];
        const s = Math.max(1, (p.size * (p.shrink ? 1 - t * 0.7 : 1)) / S);
        ctx.fillRect(p.x / S - s / 2, p.y / S - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    if (parts.length || objs.length) requestAnimationFrame(loop);
    else { run = false; ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
  }

  // ---------- oggetti su canvas ----------
  function slash(x1, y1, x2, y2, col, life = 0.45) {
    O({ life, add: true, draw(c, t) {
      const g = Math.min(1, t / 0.3), a = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
      const ex = x1 + (x2 - x1) * g, ey = y1 + (y2 - y1) * g;
      c.globalAlpha = a; c.lineCap = 'round';
      c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(x1 / S, y1 / S); c.lineTo(ex / S, ey / S); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(x1 / S, y1 / S); c.lineTo(ex / S, ey / S); c.stroke();
    } });
  }
  function ring(x, y, r0, r1, col, life = 0.6, lw = 1.5) {
    O({ life, add: true, draw(c, t) {
      c.globalAlpha = 1 - t; c.strokeStyle = col; c.lineWidth = lw * (1 - t * 0.6);
      c.beginPath(); c.arc(x / S, y / S, (r0 + (r1 - r0) * (1 - (1 - t) * (1 - t))) / S, 0, 6.283); c.stroke();
    } });
  }
  function beam(r, col) {
    O({ life: 0.9, add: true, draw(c, t) {
      c.globalAlpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.5; c.fillStyle = col;
      c.fillRect(r.left / S, 0, r.width / S, r.bottom / S);
      c.fillRect((r.left + r.width * 0.3) / S, 0, (r.width * 0.4) / S, r.bottom / S);
    } });
  }

  // ---------- elementi DOM ----------
  function flash(r, col, grow = 8, ms = 320) {
    const d = document.createElement('div'); d.className = 'flash';
    Object.assign(d.style, { left: r.left - grow + 'px', top: r.top - grow + 'px', width: r.width + grow * 2 + 'px', height: r.height + grow * 2 + 'px', background: col, borderRadius: '10px' });
    document.body.appendChild(d);
    d.animate([{ opacity: 0.75, transform: 'scale(.9)' }, { opacity: 0, transform: 'scale(1.12)' }], { duration: ms, easing: 'ease-out' }).finished.then(() => d.remove());
  }
  function num(text, r, col) {
    const c = mid(r), d = document.createElement('div'); d.className = 'fnum'; d.textContent = text;
    Object.assign(d.style, { left: Math.max(90, Math.min(innerWidth - 90, c.x)) + 'px', top: r.top + 'px', color: col });
    document.body.appendChild(d);
    d.animate([{ opacity: 0, transform: 'translate(-50%,-20%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-90%) scale(1.15)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-160%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-220%) scale(1)' }], { duration: 1000, easing: 'ease-out' }).finished.then(() => d.remove());
  }
  function shake(p = 5, ms = 260) {
    const el = document.querySelector('.board'); const k = [];
    for (let i = 0; i < 6; i++) k.push({ transform: `translate(${R(-p, p).toFixed(1)}px,${R(-p, p).toFixed(1)}px)` });
    k.push({ transform: 'none' }); el.animate(k, { duration: ms });
  }
  function pop(el, big = 1.18) {
    el.animate([{ transform: 'scale(.6)' }, { transform: `scale(${big})`, offset: 0.45 }, { transform: 'scale(.95)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' });
  }

  // ---------- particelle a tema per ogni terra ----------
  function emit(l, r, n, sz = 1) {
    const c = mid(r), pal = PAL[l];
    if (l === 'W') many(n, () => ({ x: R(r.left - 10, r.right + 10), y: R(r.top, r.bottom), vx: R(-8, 8), vy: R(-80, -25), life: R(0.6, 1.3), size: 4 * sz, cols: pal, add: true, delay: R(0, 0.4) }));
    if (l === 'U') many(n, () => { const a = R(-2.7, -0.45), v = R(120, 300); return { x: c.x + R(-r.width * 0.3, r.width * 0.3), y: r.bottom - 4, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, g: 520, life: R(0.5, 0.95), size: 4.5 * sz, cols: pal, add: true }; });
    if (l === 'B') many(n, (i) => { const a = R(0, 6.28), d = R(r.width * 0.8, r.width * 1.4); const smoke = i % 3 === 0;
      return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 1.5 + Math.sin(a) * 50, vy: -Math.sin(a) * d * 1.5 - Math.cos(a) * 50, drag: 1.1, life: R(0.6, 0.95), size: (smoke ? 10 : 4) * sz, cols: smoke ? ['#2a1c38', '#150e1e'] : pal, add: !smoke, a: smoke ? 0.7 : 1, shrink: true, delay: R(0, 0.25) }; });
    if (l === 'R') many(n, () => ({ x: R(r.left, r.right), y: r.bottom - R(0, r.height * 0.3), vx: R(-25, 25), vy: R(-230, -60), g: -40, drag: 1.2, life: R(0.35, 0.9), size: 7 * sz, shrink: true, cols: pal, add: true, delay: R(0, 0.2) }));
    if (l === 'G') many(n, (i) => { const a = i * 2.4, v = R(50, 150); return { x: c.x + Math.cos(a) * r.width * 0.4, y: c.y + Math.sin(a) * r.height * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 160, drag: 1.4, life: R(0.7, 1.4), size: 5 * sz, cols: pal, delay: i * 0.012 }; });
  }

  // ---------- ricette per stile ----------
  const api = {
    init, stats, MAX,
    enter(l, el) {
      const r = el.getBoundingClientRect(), c = mid(r), col = PAL[l][1];
      if (ST === 'spire') { // sobrio: taglio, lampo, piccola scossa, numero che sale
        slash(r.left - 8, r.bottom + 6, r.right + 8, r.top - 6, col);
        flash(r, col, 4, 240); shake(3, 200); num('+1 ' + NAMES[l], r, col); emit(l, r, 14, 0.8);
      } else if (ST === 'hearth') { // ricco: fascio, anelli, molte particelle luminose
        beam(r, PAL[l][0]); flash(r, col, 14, 420);
        ring(c.x, c.y, r.width * 0.3, r.width * 1.1, col, 0.7, 2.5);
        setTimeout(() => ring(c.x, c.y, r.width * 0.3, r.width * 1.5, PAL[l][0], 0.8, 1.5), 140);
        emit(l, r, 75, 1); many(18, () => ({ x: R(r.left, r.right), y: R(r.top, r.bottom), vx: R(-20, 20), vy: R(-40, -10), life: R(0.8, 1.6), size: 3, cols: ['#fff', PAL[l][0]], add: true, delay: R(0.2, 0.8) }));
      } else { // cartoon: rimbalzo, anello spesso, pochi pezzi grossi
        pop(el); ring(c.x, c.y, r.width * 0.4, r.width * 1.0, '#fff', 0.4, 3.5);
        emit(l, r, 16, 1.7); num('+1', r, '#fff');
      }
    },
    destroy(el) {
      const r = el.getBoundingClientRect(), c = mid(r);
      el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.15) rotate(-4deg)', opacity: 1, offset: 0.2 }, { transform: 'scale(.4) rotate(12deg)', opacity: 0, offset: 0.6 }, { transform: 'scale(.4)', opacity: 0, offset: 0.85 }, { transform: 'none', opacity: 1 }], { duration: 1600 });
      if (ST === 'spire') {
        slash(r.left - 10, r.top - 6, r.right + 10, r.bottom + 6, '#e8553a'); setTimeout(() => slash(r.right + 10, r.top - 6, r.left - 10, r.bottom + 6, '#e8553a'), 90);
        flash(r, '#fff', 6, 200); shake(7, 300); num('Distrutta', r, '#ff8a6a');
        many(18, () => { const a = R(-3.14, 0), v = R(60, 220); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 600, life: R(0.5, 0.9), size: 5, cols: ['#8a8478', '#4a463e'] }; });
      } else if (ST === 'hearth') {
        flash(r, '#ffb040', 24, 380); shake(9, 380); ring(c.x, c.y, 8, r.width * 1.6, '#ffb040', 0.55, 3);
        many(110, () => { const a = R(0, 6.28), v = R(40, 360); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.6, life: R(0.35, 0.95), size: R(4, 9), shrink: true, cols: PAL.R, add: true }; });
        many(26, () => { const a = R(-3.14, 0), v = R(90, 300); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 640, life: R(0.6, 1.1), size: 6, cols: ['#7a6a5a', '#3a3028'] }; });
      } else {
        ring(c.x, c.y, 8, r.width * 1.2, '#fff', 0.4, 4); shake(5, 240); num('BOOM!', r, '#ffd23d');
        many(22, () => { const a = R(0, 6.28), v = R(120, 320); return { x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 500, drag: 1, life: R(0.5, 0.9), size: 11, shrink: true, cols: ['#ffd23d', '#ff7a2a', '#ff4a6a'] }; });
      }
    },
    counter(el) {
      const r = el.getBoundingClientRect(), c = mid(r);
      el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(18px) rotate(5deg)', opacity: 1, offset: 0.25 }, { transform: 'translateX(26px) rotate(8deg) scale(.8)', opacity: 0, offset: 0.55 }, { transform: 'none', opacity: 0, offset: 0.85 }, { transform: 'none', opacity: 1 }], { duration: 1700 });
      if (ST === 'spire') {
        slash(r.left - 30, c.y, r.right + 30, c.y, PAL.U[1], 0.5); flash(r, PAL.U[1], 4, 260); shake(3, 200); num('Annullata', r, PAL.U[0]);
        emit('U', r, 12, 0.8);
      } else if (ST === 'hearth') {
        many(90, (i, n) => ({ x: r.left - 70 - R(0, 50), y: r.top + (i / n) * r.height + R(-8, 8), vx: R(420, 680), vy: R(-50, 50), drag: 2.4, life: R(0.45, 0.9), size: R(4, 8), cols: PAL.U, add: true, delay: R(0, 0.12) }));
        setTimeout(() => { ring(c.x, c.y, 8, r.width * 1.5, PAL.U[1], 0.6, 3); flash(r, PAL.U[0], 14, 360); shake(4, 220); emit('U', r, 40, 1); }, 150);
      } else {
        ring(c.x, c.y, 6, r.width, PAL.U[1], 0.45, 4); num('NO!', r, '#4fd8ff'); emit('U', r, 18, 1.8);
      }
    },
    win() {
      const b = document.querySelector('.board');
      const d = document.createElement('div'); d.className = 'winb'; d.textContent = 'Vittoria!'; b.appendChild(d);
      d.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.12)', offset: 0.15 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.25 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.85 }, { opacity: 0, transform: 'translate(-50%,-60%) scale(1)' }], { duration: 2600 }).finished.then(() => d.remove());
      const rounds = { spire: 3, hearth: 12, bazaar: 8 }[ST];
      let n = 0;
      const iv = setInterval(() => {
        if (n++ >= rounds) return clearInterval(iv);
        const x = R(innerWidth * 0.15, innerWidth * 0.85), y = R(innerHeight * 0.2, innerHeight * 0.6), l = 'WUBRG'[(Math.random() * 5) | 0];
        if (ST === 'spire') many(16, () => ({ x: R(0, innerWidth), y: R(innerHeight * 0.3, innerHeight * 0.8), vx: R(-6, 6), vy: R(-50, -15), life: R(1, 1.8), size: 4, cols: PAL.W, add: true }));
        else if (ST === 'hearth') { ring(x, y, 4, R(50, 100), PAL[l][1], 0.7, 2.5); many(34, () => { const a = R(0, 6.28), v = R(40, 260); return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 160, drag: 1.6, life: R(0.6, 1.3), size: R(3, 7), cols: PAL[l], add: true }; }); }
        else many(26, () => ({ x: R(0, innerWidth), y: -10, vx: R(-40, 40), vy: R(120, 320), g: 120, life: R(1.2, 2), size: R(8, 13), cols: [CONF[(Math.random() * 5) | 0]] }));
      }, ST === 'spire' ? 500 : 170);
      if (ST === 'spire') { flash({ left: 0, top: 0, width: innerWidth, height: innerHeight }, '#e6d7a3', 0, 500); shake(4, 300); }
    },
  };
  const NAMES = { W: 'Pianura', U: 'Isola', B: 'Palude', R: 'Montagna', G: 'Foresta' };
  return api;
})();
