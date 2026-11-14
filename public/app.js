'use strict';

// =====================================================================
//  Basic Land Game – client
// =====================================================================
const TYPES = ['W', 'U', 'B', 'R', 'G'];
const NAMES = { W: 'Pianura', U: 'Isola', B: 'Palude', R: 'Montagna', G: 'Foresta' };
const SYM = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲' };
const FX = {
  W: 'Riattiva una tua terra',
  U: 'Pesca 1 · Contrasta',
  B: 'Scarta dalla mano avversaria',
  R: 'Distruggi una terra',
  G: 'Recupera dal cimitero',
};
// Descrizioni dal punto di vista di chi gioca la carta
const LONG_FX = {
  W: 'Riattiva l\'effetto di un\'altra tua terra in gioco.',
  U: 'Entrando peschi una carta.',
  B: 'Guardi la mano avversaria e scegli una terra da scartare.',
  R: 'Distruggi una terra avversaria in gioco.',
  G: 'Riprendi in mano una terra dal tuo cimitero.',
};
const TURN_OPTIONS = [30, 45, 60, 90, 0];
const SPEEDS = { slow: 1.5, medium: 1, fast: 0.6 };
const SPEED_LABEL = { slow: 'Lenta', medium: 'Media', fast: 'Veloce' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Preferenze ----------
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem('blg.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem('blg.' + k) : localStorage.setItem('blg.' + k, JSON.stringify(v)); } catch {} },
};
const prefs = {
  get name() { return ls.get('name2', ''); }, set name(v) { ls.set('name2', v); },
  get session() { return ls.get('session2', null); }, set session(v) { ls.set('session2', v); },
  get sound() { return ls.get('sound', true); }, set sound(v) { ls.set('sound', v); },
  get vibe() { return ls.get('vibe', true); }, set vibe(v) { ls.set('vibe', v); },
  get turnTime() { return ls.get('turnTime', 60); }, set turnTime(v) { ls.set('turnTime', v); },
  get controls() { return ls.get('controls', 'drag'); }, set controls(v) { ls.set('controls', v); },
  get info() { return ls.get('info', false); }, set info(v) { ls.set('info', v); },
  get speed() { const v = ls.get('speed', 'slow'); return SPEEDS[v] ? v : 'slow'; }, set speed(v) { ls.set('speed', v); },
};
// Durata scalata secondo la velocità scelta
const D = (ms) => ms * SPEEDS[prefs.speed];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = (ms) => sleep(D(ms));

// ---------- Suoni (sintetizzati, nessun file) ----------
const Sound = {
  ctx: null,
  unlock() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {}
  },
  tone(freq, dur, { type = 'sine', vol = 0.12, at = 0, to = null } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, { vol = 0.15, at = 0, freq = 1200, to = null } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t);
  },
  play(name) {
    if (!prefs.sound || !this.ctx || this.ctx.state !== 'running') return;
    const T = (...a) => this.tone(...a), N = (...a) => this.noise(...a);
    switch (name) {
      case 'draw': T(900, 0.07, { type: 'triangle', vol: 0.06, to: 600 }); break;
      case 'play': T(260, 0.12, { vol: 0.14, to: 180 }); N(0.08, { vol: 0.05, freq: 2500 }); break;
      case 'land': T(330, 0.16, { type: 'triangle', vol: 0.12 }); T(495, 0.2, { type: 'triangle', vol: 0.1, at: 0.07 }); break;
      case 'counter': T(1400, 0.28, { type: 'sawtooth', vol: 0.05, to: 250 }); N(0.2, { vol: 0.05, freq: 4000, to: 500 }); break;
      case 'fizzle': N(0.35, { vol: 0.12, freq: 3000, to: 200 }); break;
      case 'destroy': N(0.4, { vol: 0.25, freq: 900, to: 80 }); T(110, 0.25, { type: 'square', vol: 0.06, to: 50 }); break;
      case 'regrow': T(392, 0.12, { type: 'triangle', vol: 0.1 }); T(523, 0.12, { type: 'triangle', vol: 0.1, at: 0.08 }); T(659, 0.18, { type: 'triangle', vol: 0.1, at: 0.16 }); break;
      case 'discard': N(0.12, { vol: 0.1, freq: 1800 }); T(300, 0.15, { vol: 0.08, to: 180 }); break;
      case 'reuse': [660, 880, 990].forEach((f, i) => T(f, 0.2, { vol: 0.06, at: i * 0.06 })); break;
      case 'look': T(500, 0.25, { vol: 0.05, to: 700 }); break;
      case 'turn': T(523, 0.15, { vol: 0.09 }); T(784, 0.25, { vol: 0.09, at: 0.12 }); break;
      case 'tick': T(1050, 0.04, { type: 'square', vol: 0.03 }); break;
      case 'timeout': T(220, 0.3, { type: 'square', vol: 0.06, to: 140 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => T(f, 0.28, { type: 'triangle', vol: 0.1, at: i * 0.12 })); break;
      case 'lose': [392, 330, 262].forEach((f, i) => T(f, 0.35, { type: 'triangle', vol: 0.09, at: i * 0.18 })); break;
      case 'click': T(700, 0.03, { type: 'triangle', vol: 0.04 }); break;
      case 'grab': T(420, 0.12, { type: 'triangle', vol: 0.07, to: 820 }); break;
      case 'deny': T(220, 0.14, { type: 'square', vol: 0.04, to: 170 }); break;
    }
  },
};
document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });

// ---------- Vibrazione ----------
// Android: Vibration API. iPhone (Safari 18+): non ha l'API, ma un interruttore "switch" nascosto produce un feedback aptico.
let iosSwitch = null;
function vibrate(pattern) {
  if (!prefs.vibe) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(pattern); return; }
    if (!iosSwitch) {
      const label = document.createElement('label');
      label.style.cssText = 'position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', '');
      label.appendChild(input); document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  } catch {}
}

// ---------- Stato ----------
let S = null;          // metadati stanza dall'ultimo messaggio
let G = null;          // vista di gioco attualmente mostrata
let clockOffset = 0;   // ora server - ora locale
const ui = {
  sel: null,            // { card, idx } carta sollevata (comandi a tocco)
  staged: null,         // { card, idx } carta posata al centro in attesa del bersaglio
  counter: false,       // sto scegliendo come contrastare
  pick: null,           // { card, idx } seconda carta da scartare col contrasto
  gyOpen: null,         // 'me' | 'opp' cimitero aperto
  menu: false, confirmLeave: false, rules: false, log: false,
  animating: false, caption: null,
};
let lastPlay = null;     // { card, idx, rect } per far partire l'animazione dalla carta giusta
let lastCounter = null;  // { islandIdx, pickIdx }
let lastEnter = null;    // { w, card } ultima terra entrata (origine delle frecce degli effetti)
let needRender = false;
let autoAllowKey = null;

// ---------- Connessione ----------
let ws = null, wsReady = false, queue = [], retry = 0;
function connect() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => {
    wsReady = true; retry = 0;
    const sess = prefs.session;
    if (sess && sess.code && !queue.some((m) => m.t === 'create' || m.t === 'join' || m.t === 'bot')) {
      ws.send(JSON.stringify({ t: 'join', code: sess.code, token: sess.token, name: prefs.name }));
    }
    queue.forEach((m) => ws.send(JSON.stringify(m)));
    queue = [];
    render();
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'joined') {
      prefs.session = { code: m.code, token: m.token };
      history.replaceState(null, '', location.pathname);
      send({ t: 'prefs', speed: SPEEDS[prefs.speed] });
    } else if (m.t === 'state') {
      inbox.push(m); pump();
    } else if (m.t === 'error') {
      toast(m.msg);
      if (/non trovata/.test(m.msg) || (/piena/.test(m.msg) && !S)) { prefs.session = null; S = null; G = null; render(); }
    }
  };
  ws.onclose = () => {
    wsReady = false;
    render();
    setTimeout(connect, Math.min(1000 * 2 ** retry++, 8000));
  };
}
function send(m) { if (wsReady) ws.send(JSON.stringify(m)); else { queue.push(m); connect(); } }
function act(a) {
  ui.sel = null; ui.staged = null; ui.counter = false; ui.pick = null; ui.gyOpen = null;
  clearArrows('aim');
  Sound.play('click');
  send({ t: 'action', a });
}

// ---------- Coda degli stati e animazioni ----------
const inbox = [];
let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  while (inbox.length) {
    const m = inbox.shift();
    clockOffset = m.now - Date.now();
    const { game, steps, ...meta } = m;
    S = meta;
    if (steps && steps.length && drag) cancelDrag(true);
    const animate = steps && steps.length && !document.hidden && inbox.length < 3 && !reduceMotion;
    if (animate) {
      ui.animating = true;
      for (const st of steps) {
        try { await animateStep(st.ev, st.game); } catch (e) { console.error(e); G = st.game; }
      }
      ui.animating = false; ui.caption = null;
    } else if (steps && steps.length) {
      const last = steps[steps.length - 1].ev;
      if (last.type === 'end') endSound(last);
    }
    G = game;
    lastPlay = null; lastCounter = null;
    if (!G || G.step !== 'response' || G.pending.responder !== G.you) { ui.counter = false; ui.pick = null; }
    if (!G || G.step !== 'main' || G.active !== G.you || G.landPlayed) { ui.sel = null; ui.staged = null; }
    render();
  }
  pumping = false;
}

// ---------- UI helpers ----------
let toastTimer;
function toast(msg, info) {
  const t = $('#toast');
  t.textContent = msg; t.className = info ? 'info' : '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
}
const pips = () => `<div class="pips">${TYPES.map((t) => `<div class="pip c-${t}">${SYM[t]}</div>`).join('')}</div>`;
const cardHtml = (t, extra = '', attrs = '', inner = '') => `<div class="card c-${t} ${extra}" data-card="${t}" ${attrs}>
  <div class="sym">${SYM[t]}</div><div class="nm">${NAMES[t]}</div><div class="fx">${FX[t]}</div>${inner}</div>`;
const who = (p) => (G && p === G.you ? 'me' : 'opp');
const winsWith = (bf, t) => { const b = { ...bf, [t]: bf[t] + 1 }; return TYPES.every((x) => b[x] > 0) || TYPES.some((x) => b[x] >= 5); };
const closeToWin = (bf) => TYPES.filter((t) => bf[t] > 0).length >= 4 || Math.max(...TYPES.map((t) => bf[t])) >= 4;
const info = () => prefs.info;

// =====================================================================
//  Render
// =====================================================================
function render() {
  if (drag && drag.active) { needRender = true; return; }
  needRender = false;
  if (!S || !prefs.session) return renderLobby();
  if (!G) return renderWaiting();
  renderGame();
}

function renderLobby() {
  clearArrows();
  const params = new URLSearchParams(location.search);
  const pre = (params.get('room') || '').toUpperCase();
  const reconnecting = prefs.session && !S;
  const tt = prefs.turnTime;
  app.innerHTML = `
  <div class="lobby">
    ${pips()}
    <h1>Basic Land Game</h1>
    <p class="sub">10 terre per colore. Fai dominio o cinque uguali.</p>
    ${reconnecting ? `<p class="sub">Riconnessione alla stanza <b>${esc(prefs.session.code)}</b>…</p>
      <button class="linkbtn" id="forget">Annulla</button>` : `
    <div class="field"><label>Il tuo nome</label><input id="name" maxlength="20" value="${esc(prefs.name)}" placeholder="Es. Claudio" autocomplete="nickname"></div>
    <div class="field"><label>Tempo per turno</label>
      <div class="seg">${TURN_OPTIONS.map((v) => `<button data-tt="${v}" class="${v === tt ? 'on' : ''}">${v ? v + 's' : '∞'}</button>`).join('')}</div></div>
    <button class="btn primary" id="bot">🤖 Gioca contro il computer</button>
    <button class="btn" id="create">👥 Crea stanza per 2 giocatori</button>
    <div class="or">oppure entra con un codice</div>
    <div class="field"><input id="code" class="code-input" maxlength="4" value="${esc(pre)}" placeholder="CODICE" autocomplete="off" autocapitalize="characters"></div>
    <button class="btn" id="join">Entra nella stanza</button>
    <button class="linkbtn" id="rules">Regole del gioco</button>`}
  </div>${ui.rules ? rulesHtml() : ''}`;
  bindOverlays();
  if (reconnecting) { $('#forget').onclick = () => { prefs.session = null; render(); }; return; }
  $$('.seg button').forEach((b) => { b.onclick = () => { prefs.turnTime = Number(b.dataset.tt); render(); }; });
  const getName = () => { const n = $('#name').value.trim(); if (!n) { toast('Scrivi il tuo nome'); return null; } prefs.name = n; return n; };
  const speed = SPEEDS[prefs.speed];
  $('#bot').onclick = () => { const n = getName(); if (n) send({ t: 'bot', name: n, turnTime: prefs.turnTime, speed }); };
  $('#create').onclick = () => { const n = getName(); if (n) send({ t: 'create', name: n, turnTime: prefs.turnTime, speed }); };
  $('#join').onclick = () => {
    const n = getName(); if (!n) return;
    const c = $('#code').value.trim().toUpperCase();
    if (c.length !== 4) return toast('Il codice ha 4 caratteri');
    send({ t: 'join', code: c, name: n });
  };
  $('#code').onkeydown = (e) => { if (e.key === 'Enter') $('#join').click(); };
}

function renderWaiting() {
  clearArrows();
  const link = `${location.origin}${location.pathname}?room=${S.code}`;
  app.innerHTML = `
  <div class="lobby waiting">
    ${pips()}
    <p class="sub">Condividi questo codice con l'avversario</p>
    <div class="bigcode">${S.code}</div>
    <p class="sub">Tempo per turno: <b>${S.turnTime ? S.turnTime + ' secondi' : 'illimitato'}</b></p>
    <div class="row"><button class="btn primary" id="share">Condividi link</button></div>
    <p class="sub"><span class="spinner"></span> In attesa che l'avversario entri…</p>
    <button class="linkbtn" id="leave">Esci dalla stanza</button>
  </div>`;
  $('#share').onclick = async () => {
    const text = `Giochiamo a Basic Land Game! Codice stanza: ${S.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Basic Land Game', text, url: link }); } catch {} }
    else { try { await navigator.clipboard.writeText(link); toast('Link copiato!', true); } catch { toast(link, true); } }
  };
  $('#leave').onclick = leave;
}

function leave() {
  cancelDrag(true);
  send({ t: 'leave' });
  prefs.session = null; S = null; G = null;
  Object.assign(ui, { sel: null, staged: null, counter: false, pick: null, gyOpen: null, menu: false, confirmLeave: false, log: false, rules: false });
  render();
}

// ---------- Pezzi del tavolo ----------
function bfHtml(pl, w, targets) {
  return `<div class="bf" id="bf-${w}">${TYPES.map((t) => {
    const n = pl.bf[t];
    const tg = targets && targets.includes(t);
    return `<div id="slot-${w}-${t}" class="slot c-${t} ${n ? '' : 'empty'} ${n >= 4 ? 'five' : ''} ${tg ? 'target' : ''}"
      ${tg ? `data-act="target" data-v="${t}"` : ''}>
      <div class="sym">${SYM[t]}</div><div class="nm">${NAMES[t]}</div>${n ? `<div class="count">${n}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

// Cimitero: un segnalino col totale; toccandolo si apre il dettaglio
function gyHtml(pl, w, targets) {
  const total = TYPES.reduce((s, t) => s + pl.gy[t], 0);
  const open = ui.gyOpen === w;
  const chips = TYPES.filter((t) => pl.gy[t]).map((t) => {
    const tg = targets && targets.includes(t);
    return `<button id="gy-${w}-${t}" class="gchip c-${t} ${tg ? 'target' : ''}" ${tg ? `data-act="target" data-v="${t}"` : ''}>
      <span class="sym">${SYM[t]}</span><span class="nm">${NAMES[t]}</span><b>×${pl.gy[t]}</b></button>`;
  }).join('');
  return `<span class="gywrap"><button class="gybadge ${open ? 'open' : ''} ${targets && targets.length && !open ? 'target' : ''}" id="gy-${w}" data-act="gy" data-v="${w}" title="Cimitero">
      <span>🪦</span><b>${total}</b></button>
    ${open ? `<div class="gypop ${w}"><div class="gyhead">🪦 Cimitero${w === 'opp' ? ` di ${esc(G.opp.name)}` : ''}</div>
      ${chips || '<div class="gyempty">Vuoto</div>'}</div>` : ''}</span>`;
}

function deckHtml(pl, w) {
  return `<div class="deck" id="deck-${w}" title="Carte nel mazzo"><div class="pile ${pl.deckCount ? '' : 'emptypile'}"></div><b>${pl.deckCount}</b></div>`;
}

// Cosa sta chiedendo il gioco al giocatore locale
function myTask() {
  const g = G;
  if (!g || g.phase !== 'playing' || ui.animating) return null;
  const me = g.you;
  if (g.step === 'main' && g.active === me && !g.landPlayed) return 'main';
  if (g.step === 'response' && g.pending.responder === me) return 'response';
  if (g.step === 'choice' && g.choice.player === me) return 'choice';
  return null;
}
const needsTarget = (card) => { const t = G.playable && G.playable[card]; return !!(t && t.length); };

// Bersagli evidenziati sul campo
function boardTargets() {
  const out = { opp: null, me: null, gyMe: null };
  const task = myTask();
  if (task === 'main' && ui.staged) {
    const c = ui.staged.card, t = G.playable[c];
    if (c === 'R') out.opp = t;
    if (c === 'W') out.me = t;
    if (c === 'G') out.gyMe = t;
  }
  if (task === 'choice') {
    if (G.choice.kind === 'destroy') out.opp = G.choice.options;
    if (G.choice.kind === 'regrow') out.gyMe = G.choice.options;
  }
  return out;
}

function stackHtml() {
  const p = G.pending;
  if (ui.staged) {
    return `<div id="stack" class="stack-area">${cardHtml(ui.staged.card, 'onstack staged', '', '<button class="unstage" data-act="unstage" aria-label="Annulla">✕</button>')}</div>`;
  }
  if (!p) return `<div id="stack" class="stack-area"><div class="stack-slot"></div></div>`;
  const counters = p.counters
    ? `<div class="ctr ${p.counters % 2 ? 'neg' : 'pos'}">${'💧'.repeat(Math.min(p.counters, 6))}<span>${p.counters % 2 ? '🚫' : '✅'}</span></div>` : '';
  return `<div id="stack" class="stack-area">${cardHtml(p.land, 'onstack ' + (p.owner === G.you ? 'mine' : 'theirs'))}${counters}</div>`;
}

// Testo di stato: solo l'essenziale (più dettagli con "Info nella plancia")
function statusHtml() {
  const g = G, me = g.you, opp = esc(g.opp.name);
  if (ui.caption !== null) return { text: ui.caption, cls: 'cap' };
  if (g.phase !== 'playing') return { text: '', cls: '' };
  if (g.step === 'response' && g.pending.responder === me && g.pending.owner !== me && winsWith(g.opp.bf, g.pending.land)) {
    return { text: `⚠️ Se entra, ${opp} vince!`, cls: 'danger' };
  }
  if (!info()) return { text: '', cls: '' };
  if (g.step === 'main') return g.active === me ? { text: 'Il tuo turno', cls: 'mine' } : { text: `Turno di ${opp}`, cls: '' };
  if (g.step === 'response') {
    const p = g.pending;
    if (p.responder !== me) return { text: `${opp} può contrastare…`, cls: '' };
    if (p.owner !== me && p.counters === 0) return { text: `${opp} gioca ${NAMES[p.land]}`, cls: 'mine' };
    if (p.owner === me) return { text: `${opp} contrasta la tua ${NAMES[p.land]}!`, cls: 'mine' };
    return { text: `${opp} ha annullato il tuo contrasto!`, cls: 'mine' };
  }
  if (g.step === 'choice' && g.choice.player !== me) return { text: `${opp} sta scegliendo…`, cls: '' };
  return { text: '', cls: '' };
}

// Cosa succede se la terra in attesa risolve, dal punto di vista di chi guarda
function consequenceText(p) {
  const g = G, opp = esc(g.opp.name);
  if (p.owner === g.you) return `Se non rispondi, la tua ${NAMES[p.land]} viene annullata.`;
  const t = p.target;
  const reuse = { U: 'pescherà una carta', B: 'guarderà la tua mano e ti farà scartare una terra', R: 'distruggerà una tua terra', G: 'riprenderà una terra dal suo cimitero' };
  switch (p.land) {
    case 'U': return `Se risolve, ${opp} pescherà una carta.`;
    case 'B': return `Se risolve, ${opp} guarderà la tua mano e ti farà scartare una terra.`;
    case 'R': return t ? `Se risolve, la tua ${NAMES[t]} verrà distrutta.` : 'Entrerà senza effetto.';
    case 'G': return t ? `Se risolve, ${opp} riprenderà ${NAMES[t]} dal suo cimitero.` : 'Entrerà senza effetto.';
    case 'W': return t ? `Se risolve, ${opp} riattiverà la sua ${NAMES[t]} e ${reuse[t]}.` : 'Entrerà senza effetto.';
  }
  return '';
}

// Indici in mano: l'Isola che verrebbe scartata col contrasto e le carte scartabili insieme
function counterPlan() {
  const hand = G.hand;
  const others = G.counterOthers || [];
  if (!others.length) return null;
  const pickIdx = ui.pick ? ui.pick.idx : -1;
  const islandIdx = hand.findIndex((c, i) => c === 'U' && i !== pickIdx);
  const eligible = hand.map((c, i) => i !== islandIdx && others.includes(c));
  return { islandIdx, eligible };
}

function actionsHtml() {
  const task = myTask();
  const g = G;
  const hint = (t) => (info() ? `<div class="hint">${t}</div>` : '');
  if (!task) {
    if (g.phase === 'playing' && !ui.animating && S.vsBot && g.active !== g.you && g.step === 'main') return hint('Il computer sta pensando…');
    return '';
  }
  if (task === 'main') {
    if (ui.staged) {
      const c = ui.staged.card;
      return hint(c === 'R' ? 'Tocca la terra avversaria da distruggere.' : c === 'G' ? 'Tocca nel tuo cimitero la terra da recuperare.' : 'Tocca la tua terra da riattivare.');
    }
    const how = prefs.controls === 'drag' ? 'Trascina una carta al centro per giocarla.' : 'Tocca una carta e poi il centro per giocarla.';
    return `${hint(how)}<button class="btn passbtn" data-act="pass">Passa il turno</button>`;
  }
  if (task === 'response') {
    const p = g.pending;
    const plan = counterPlan();
    const allowLabel = p.owner === g.you ? 'Accetta' : 'Lascia risolvere';
    if (!plan) return hint(consequenceText(p)); // nessun contrasto possibile: si risolve da solo
    if (!ui.counter) {
      return `${hint(consequenceText(p))}
        <div class="acts"><button class="btn counterbtn" data-act="counter-start">💧 Contrasta</button>
        <button class="btn primary" data-act="allow">${allowLabel}</button></div>
        ${hint('Contrastare costa un\'Isola e un\'altra terra dalla tua mano.')}`;
    }
    const result = p.owner === g.you ? '✅' : '🚫';
    const second = ui.pick ? `<span class="fcard c-${ui.pick.card}">${SYM[ui.pick.card]}</span>` : '<span class="fcard q">?</span>';
    return `<div class="formula"><span class="fcard c-U">💧</span><b>+</b>${second}<b>→</b><span class="fcard c-${p.land} res">${SYM[p.land]}<i>${result}</i></span></div>
      ${ui.pick ? '' : hint('Tocca in mano la seconda terra da scartare.')}
      <div class="acts">${ui.pick ? '<button class="btn counterbtn" data-act="counter-confirm">Conferma</button>' : ''}
      <button class="btn ghost" data-act="counter-cancel">Annulla</button></div>`;
  }
  if (task === 'choice') {
    const c = g.choice;
    if (c.kind === 'discard') {
      return `<div class="revealed">${c.revealed.map((t) => cardHtml(t, 'small pick', `data-act="choose" data-v="${t}"`)).join('')}</div>`;
    }
    return hint(c.kind === 'destroy' ? 'Tocca la terra avversaria da distruggere.' : 'Tocca nel tuo cimitero la terra da recuperare.');
  }
  return '';
}

function timerHtml() {
  if (!S.timer || !G || G.phase !== 'playing') return `<div id="timer" class="timer off"></div>`;
  return `<div id="timer" class="timer ${S.timer.actor === G.you ? 'mine' : ''}"><div class="fill"></div><span class="tlabel"></span></div>`;
}

function handHtml(task) {
  const g = G, hand = g.hand;
  if (!hand.length) return '';
  const plan = task === 'response' && ui.counter ? counterPlan() : null;
  return hand.map((t, i) => {
    let cls = '', attrs = `data-idx="${i}"`, badge = '';
    if (task === 'main' && g.playable && t in g.playable) {
      cls = 'playable';
      attrs += ` data-act="card" data-v="${t}"`;
      if (ui.sel && ui.sel.idx === i) cls += ' lift';
      if (ui.staged && ui.staged.idx === i) cls += ' away';
    } else if (task === 'main' || !task) cls = 'idle';
    if (plan) {
      if (i === plan.islandIdx || (ui.pick && ui.pick.idx === i)) { cls = 'lift marked'; badge = '<div class="badge">✕</div>'; }
      else if (plan.eligible[i] && !ui.pick) { cls = 'pick'; attrs += ` data-act="pick" data-v="${t}"`; }
      else cls = 'idle';
    }
    return cardHtml(t, cls, attrs, badge);
  }).join('');
}

function renderGame() {
  const g = G, me = g.you;
  const oppConnected = S.seats[g.opp.seat] && S.seats[g.opp.seat].connected;
  const st = statusHtml();
  const task = myTask();
  const tg = boardTargets();
  const centerDrop = task === 'main' && !ui.staged && (ui.sel || (drag && drag.active));
  if (task === 'choice' && G.choice.kind === 'regrow') ui.gyOpen = 'me';

  app.innerHTML = `
  <div class="game ${ui.animating ? 'busy' : ''}">
    <div class="topbar">
      <span>${S.vsBot ? '🤖 Contro il computer' : `Stanza <b class="code">${S.code}</b>`}${wsReady ? '' : ' · <span class="warn">riconnessione…</span>'}</span>
      <button class="menubtn" data-act="menu" aria-label="Menu">☰</button>
    </div>
    ${timerHtml()}

    <section class="zone opp ${g.active === g.opp.seat && g.phase === 'playing' ? 'active' : ''}">
      <div class="zhead">
        <span class="pname"><span class="dot ${oppConnected ? '' : 'off'}"></span>${esc(g.opp.name)}${closeToWin(g.opp.bf) ? ' <span class="near">⚠️</span>' : ''}</span>
        <div class="backs" id="hand-opp">${'<div class="back"></div>'.repeat(Math.min(g.opp.handCount, 10))}<small>${g.opp.handCount}</small></div>
        ${deckHtml(g.opp, 'opp')}
        ${gyHtml(g.opp, 'opp')}
      </div>
      ${bfHtml(g.opp, 'opp', tg.opp)}
    </section>

    <section class="center ${centerDrop ? 'droppable' : ''}" id="center" ${task === 'main' && ui.sel && !ui.staged ? 'data-act="center"' : ''}>
      ${stackHtml()}
      <div class="status ${st.cls}" id="status">${st.text}</div>
      <div class="actions-area">${actionsHtml()}</div>
    </section>

    <section class="zone me ${g.active === me && g.phase === 'playing' ? 'active' : ''}">
      ${bfHtml(g.me, 'me', tg.me)}
      <div class="zhead">
        <span class="pname"><span class="dot"></span>${esc(g.me.name)}${closeToWin(g.me.bf) ? ' <span class="near">⚠️</span>' : ''}</span>
        ${deckHtml(g.me, 'me')}
        ${gyHtml(g.me, 'me', tg.gyMe)}
      </div>
    </section>

    <div class="hand ${task === 'response' && ui.counter ? 'counter-mode' : ''}" id="hand-me">${handHtml(task)}</div>
  </div>
  <div id="banner" class="banner hidden"></div>
  ${g.phase === 'over' && !ui.animating ? overHtml() : ''}
  ${ui.menu ? menuHtml() : ''}
  ${ui.log ? logHtml() : ''}
  ${ui.rules ? rulesHtml() : ''}`;
  layoutHand();
  bindOverlays();
  tickTimer();
  drawArrows();
  maybeAutoAllow(task);
}

// Se non posso contrastare, la terra risolve da sola dopo una pausa casuale (così non si capisce cosa ho in mano)
function maybeAutoAllow(task) {
  if (task !== 'response' || counterPlan()) return;
  const key = `${G.turn}|${G.pending.counters}|${G.pending.land}`;
  if (autoAllowKey === key) return;
  autoAllowKey = key;
  setTimeout(() => {
    if (myTask() === 'response' && `${G.turn}|${G.pending.counters}|${G.pending.land}` === key) act({ type: 'allow' });
  }, 900 + Math.random() * 1300);
}

// ---------- Mano a ventaglio: tutte le carte sempre visibili ----------
function layoutHand() {
  const hand = $('#hand-me');
  if (!hand) return;
  // la carta posata al centro non occupa posto nel ventaglio
  const cards = $$('.card', hand).filter((c) => !c.classList.contains('away'));
  const n = cards.length;
  if (!n) return;
  const W = hand.clientWidth;
  const cw = cards[0].offsetWidth || 66;
  const pad = 6 + cw * 0.08; // margine per la rotazione delle carte esterne
  const step = n > 1 ? Math.min(cw + 6, (W - cw - pad * 2) / (n - 1)) : 0;
  const total = cw + step * (n - 1);
  const start = Math.max(pad, (W - total) / 2);
  const mid = (n - 1) / 2;
  const ang = n > 1 ? Math.min(3, 15 / (n - 1)) : 0;
  cards.forEach((c, i) => {
    const off = i - mid;
    c.style.left = `${start + i * step}px`;
    c.style.setProperty('--rot', `${off * ang}deg`);
    c.style.setProperty('--dy', `${Math.min(10, off * off * ang * 0.25)}px`);
    c.style.zIndex = String(i + 1);
  });
}
window.addEventListener('resize', () => { layoutHand(); drawArrows(); });

function overHtml() {
  const g = G;
  const won = g.winner === g.you;
  const title = g.winner == null ? 'Pareggio' : won ? '🏆 Hai vinto!' : `Ha vinto ${esc(g.opp.name)}`;
  const iAsked = S.rematch[g.you], oppAsked = S.rematch[g.opp.seat];
  return `<div class="overlay"><div class="box">
    <h2>${title}</h2>
    <p class="muted">${esc(g.endText || '')}</p>
    ${iAsked && !S.vsBot ? `<p>In attesa che ${esc(g.opp.name)} accetti la rivincita…</p>`
      : `<button class="btn primary" data-act="rematch">${oppAsked && !S.vsBot ? 'Accetta la rivincita' : 'Rivincita'}</button>`}
    <button class="btn" data-act="leave-now">Esci</button>
  </div></div>`;
}

function menuHtml() {
  const tog = (on) => `<span class="tog ${on ? 'on' : ''}"><span></span></span>`;
  const seg = (act, cur, opts) => `<div class="seg small">${opts.map(([v, l]) => `<button data-act="${act}" data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return `<div class="sheet-bd" data-act="menu-close"></div>
  <div class="sheet">
    <h3>Menu</h3>
    ${ui.confirmLeave ? `
      <p>Vuoi davvero uscire? ${S.vsBot ? 'La partita contro il computer verrà chiusa.' : 'Non potrai rientrare in questa partita.'}</p>
      <button class="btn danger" data-act="leave-now">Esci dalla partita</button>
      <button class="btn" data-act="leave-no">Annulla</button>` : `
    <div class="mrow col"><span>🎮 Comandi</span>${seg('set-controls', prefs.controls, [['drag', 'Trascina'], ['tap', 'Tocca']])}</div>
    <div class="mrow col"><span>⚡ Velocità animazioni</span>${seg('set-speed', prefs.speed, Object.keys(SPEEDS).map((k) => [k, SPEED_LABEL[k]]))}</div>
    <button class="mrow" data-act="toggle-info">💬 Info nella plancia ${tog(prefs.info)}</button>
    <button class="mrow" data-act="toggle-sound">🔊 Effetti sonori ${tog(prefs.sound)}</button>
    <button class="mrow" data-act="toggle-vibe">📳 Vibrazione ${tog(prefs.vibe)}</button>
    <div class="mrow two"><button data-act="open-log">📜 Registro</button><button data-act="open-rules">📖 Regole</button></div>
    <button class="mrow danger" data-act="leave-ask">🚪 Esci dalla partita</button>
    <button class="btn" data-act="menu-close">Chiudi</button>`}
  </div>`;
}

function logHtml() {
  return `<div class="overlay" data-act="close-log"><div class="box rules" onclick="event.stopPropagation()">
    <h2>Registro</h2>
    <ol class="loglist">${G.log.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    <button class="btn primary" data-act="close-log">Chiudi</button>
  </div></div>`;
}

function rulesHtml() {
  return `<div class="overlay"><div class="box rules">
    <h2 style="text-align:center">Regole</h2>
    <h4>Obiettivo</h4>Avere in gioco una terra di ogni tipo, oppure 5 terre dello stesso tipo. Si vince appena la terra entra in gioco.
    <h4>Preparazione</h4><ul><li>Mazzo da 50 carte: 10 per tipo.</li><li>Si pescano 5 carte, niente mulligan.</li><li>Chi inizia salta la prima pescata.</li></ul>
    <h4>Turno</h4>Peschi una carta, poi puoi giocare <b>una</b> terra (o passare). L'effetto si attiva quando entra in gioco.
    <h4>Terre</h4><ul>
      <li>${SYM.W} <b>Pianura</b>: riattiva l'effetto di un'altra tua terra in gioco (non Pianura).</li>
      <li>${SYM.U} <b>Isola</b>: quando entra peschi 1 carta. Dalla mano, scartala con un'altra terra per contrastare la terra appena giocata dall'avversario (e il suo effetto). Anche un contrasto può essere contrastato.</li>
      <li>${SYM.B} <b>Palude</b>: guardi la mano avversaria e scegli una terra da scartare.</li>
      <li>${SYM.R} <b>Montagna</b>: distruggi una terra avversaria in gioco.</li>
      <li>${SYM.G} <b>Foresta</b>: riprendi in mano una terra dal tuo cimitero.</li></ul>
    Senza bersagli la terra si gioca comunque, senza effetto.
    <h4>Comandi</h4>Porta la carta al centro della plancia (trascinandola, o toccandola e poi toccando il centro). Se ha un bersaglio, tocca poi la carta da colpire: terra avversaria per la Montagna, tua terra per la Pianura, carta nel tuo cimitero per la Foresta. Il cimitero si apre toccando 🪦.
    <h4>Tempo</h4>Se il tempo scade passi il turno; se scade durante una risposta la terra avversaria risolve.
    <h4>Carte finite</h4>Se un mazzo è vuoto non si pesca. Quando entrambi i mazzi sono vuoti e nessuno può o vuole più giocare, vince chi ha più tipi di terra diversi in gioco; in parità vince chi ha giocato l'ultima terra.
    <div style="text-align:center;margin-top:12px"><button class="btn primary" id="rules-close">Chiudi</button></div>
  </div></div>`;
}
function bindOverlays() {
  const b = $('#rules'); if (b) b.onclick = () => { ui.rules = true; render(); };
  const c = $('#rules-close'); if (c) c.onclick = () => { ui.rules = false; render(); };
}

// ---------- Giocare una carta ----------
// Porta la carta al centro: se serve un bersaglio resta lì in attesa, altrimenti viene giocata subito.
function stageCard(card, idx, rect) {
  if (myTask() !== 'main') return;
  if (needsTarget(card)) {
    ui.staged = { card, idx }; ui.sel = null;
    if (card === 'G') ui.gyOpen = 'me';
    Sound.play('play'); vibrate(15);
    render();
    const el = $('#stack .card');
    if (rect && el) fly(rect, el, card, { dur: 220 });
  } else {
    lastPlay = { card, idx, rect };
    act({ type: 'play', card });
  }
}

// ---------- Click (delegati) ----------
app.addEventListener('click', (e) => {
  if (dragJustEnded) return;
  const el = e.target.closest('[data-act]');
  // chiude il cimitero aperto toccando altrove (non mentre serve sceglierci un bersaglio)
  const gyLocked = (ui.staged && ui.staged.card === 'G') || (myTask() === 'choice' && G.choice.kind === 'regrow');
  if (ui.gyOpen && !e.target.closest('.gywrap') && !gyLocked) {
    ui.gyOpen = null; render();
    if (!el) return;
  }
  if (!el || !app.contains(el)) return;
  const a = el.dataset.act, v = el.dataset.v;
  const idx = el.dataset.idx != null ? Number(el.dataset.idx) : -1;
  switch (a) {
    case 'card': {
      if (prefs.controls === 'drag') { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); return; }
      if (ui.staged) return;
      if (ui.sel && ui.sel.idx === idx) return stageCard(v, idx, el.getBoundingClientRect());
      ui.sel = { card: v, idx }; Sound.play('click'); return render();
    }
    case 'center': if (ui.sel) { const c = $(`#hand-me .card[data-idx="${ui.sel.idx}"]`); stageCard(ui.sel.card, ui.sel.idx, rectOf(c)); } return;
    case 'unstage': ui.staged = null; ui.gyOpen = null; clearArrows('aim'); Sound.play('click'); return render();
    case 'pass': return act({ type: 'pass' });
    case 'target':
      if (myTask() === 'main' && ui.staged) {
        lastPlay = { card: ui.staged.card, idx: ui.staged.idx, rect: rectOf($('#stack .card')) };
        return act({ type: 'play', card: ui.staged.card, target: v });
      }
      if (myTask() === 'choice') return act({ type: 'choose', choice: v });
      return;
    case 'gy': if (gyLocked) return; ui.gyOpen = ui.gyOpen === v ? null : v; Sound.play('click'); return render();
    case 'counter-start': ui.counter = true; ui.pick = null; Sound.play('click'); return render();
    case 'counter-cancel': ui.counter = false; ui.pick = null; return render();
    case 'pick': ui.pick = { card: v, idx }; Sound.play('click'); vibrate(10); return render();
    case 'counter-confirm': {
      if (!ui.pick) return;
      const plan = counterPlan();
      lastCounter = { islandIdx: plan.islandIdx, pickIdx: ui.pick.idx };
      return act({ type: 'counter', other: ui.pick.card });
    }
    case 'allow': return act({ type: 'allow' });
    case 'choose': return act({ type: 'choose', choice: v });
    case 'menu': ui.menu = true; ui.confirmLeave = false; return render();
    case 'menu-close': ui.menu = false; ui.confirmLeave = false; return render();
    case 'set-controls': prefs.controls = v; ui.sel = null; Sound.play('click'); return render();
    case 'set-speed': prefs.speed = v; send({ t: 'prefs', speed: SPEEDS[v] }); Sound.play('click'); return render();
    case 'toggle-info': prefs.info = !prefs.info; Sound.play('click'); return render();
    case 'toggle-sound': prefs.sound = !prefs.sound; Sound.unlock(); Sound.play('click'); return render();
    case 'toggle-vibe': prefs.vibe = !prefs.vibe; vibrate(40); return render();
    case 'open-log': ui.menu = false; ui.log = true; return render();
    case 'close-log': ui.log = false; return render();
    case 'open-rules': ui.menu = false; ui.rules = true; return render();
    case 'leave-ask': ui.confirmLeave = true; return render();
    case 'leave-no': ui.confirmLeave = false; return render();
    case 'leave-now': return leave();
    case 'rematch': return send({ t: 'rematch' });
  }
});
app.addEventListener('contextmenu', (e) => { if (e.target.closest('.game')) e.preventDefault(); });

// =====================================================================
//  Trascinamento: parte subito (al primo movimento o dopo un attimo)
// =====================================================================
const HOLD_MS = 90, SLOP = 4;
let drag = null;
let dragJustEnded = false;

app.addEventListener('pointerdown', (e) => {
  if (prefs.controls !== 'drag' || myTask() !== 'main' || drag || ui.staged) return;
  const el = e.target.closest('.hand .card.playable');
  if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
  drag = { idx: Number(el.dataset.idx), card: el.dataset.card, el, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, pid: e.pointerId };
  el.classList.add('pressing');
  drag.timer = setTimeout(startDrag, HOLD_MS);
});

function startDrag() {
  if (!drag || drag.active) return;
  const { el } = drag;
  const r = el.getBoundingClientRect();
  drag.active = true;
  drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top;
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = el.offsetWidth + 'px'; ghost.style.height = el.offsetHeight + 'px';
  ghost.innerHTML = cardHtml(drag.card, 'floating');
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  el.classList.remove('pressing'); el.classList.add('ghosted');
  const center = $('#center');
  if (center) center.classList.add('droppable');
  document.body.classList.add('dragging');
  moveGhost(drag.x, drag.y);
  Sound.play('grab'); vibrate(15);
}

function moveGhost(x, y) {
  if (!drag || !drag.ghost) return;
  drag.ghost.style.transform = `translate(${x - drag.dx}px, ${y - drag.dy - 20}px)`;
  const center = $('#center');
  const r = rectOf(center);
  const over = !!(r && x >= r.left && x <= r.right && y - 20 >= r.top && y - 20 <= r.bottom);
  if (over !== drag.over) {
    if (center) center.classList.toggle('dropover', over);
    if (over) vibrate(8);
    drag.over = over;
  }
}

window.addEventListener('pointermove', (e) => {
  if (drag && e.pointerId === drag.pid) {
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > SLOP) startDrag();
      else return;
    }
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
    return;
  }
  if (ui.staged) aimArrow(e.clientX, e.clientY);
}, { passive: false });

document.addEventListener('touchmove', (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });

window.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  if (!drag.active) { finishDrag(); return; } // tocco veloce: lo gestisce il click
  const d = drag;
  dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 60);
  if (d.over && myTask() === 'main') {
    const rect = d.ghost.firstElementChild.getBoundingClientRect();
    const handCard = d.el;
    finishDrag(true);
    handCard.style.visibility = 'hidden';
    stageCard(d.card, d.idx, rect);
  } else {
    Sound.play('deny');
    cancelDrag(false);
  }
});
window.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.pid) cancelDrag(false); });

function finishDrag(skipRender) {
  if (!drag) return;
  clearTimeout(drag.timer);
  const center = $('#center');
  if (center) center.classList.remove('droppable', 'dropover');
  if (drag.ghost) drag.ghost.remove();
  if (drag.el) drag.el.classList.remove('pressing', 'ghosted');
  document.body.classList.remove('dragging');
  drag = null;
  if (needRender && !skipRender) render();
}

// Annulla il trascinamento: la carta torna in mano con un'animazione
function cancelDrag(instant) {
  if (!drag) return;
  const d = drag;
  if (!d.active || instant || !d.ghost) { finishDrag(); return; }
  const from = d.ghost.firstElementChild.getBoundingClientRect();
  const to = d.el.getBoundingClientRect();
  const ghost = d.ghost;
  d.ghost = null;
  const el = d.el;
  el.style.visibility = 'hidden';
  finishDrag(true);
  ghost.firstElementChild.classList.remove('floating');
  ghost.animate([
    { transform: `translate(${from.left}px, ${from.top}px)` },
    { transform: `translate(${to.left}px, ${to.top}px)` },
  ], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {})
    .then(() => { ghost.remove(); el.style.visibility = ''; if (needRender) render(); });
}

// =====================================================================
//  Frecce: chi colpisce cosa
// =====================================================================
const ARROW_COLOR = { R: '#ff5a4a', W: '#ffe58a', G: '#5fd38a', B: '#c39bff', U: '#6cb6ff' };
function clearArrows(cls) {
  const svg = $('#arrows'); if (!svg) return;
  $$(cls ? `g.${cls}` : 'g.arrow', svg).forEach((n) => n.remove());
}
function centerOf(el) { const r = rectOf(el); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r } : null; }

// Disegna una freccia curva da a → b. Ritorna il gruppo SVG.
function arrow(a, b, color, cls = 'pending', animate = true) {
  const svg = $('#arrows'); if (!svg || !a || !b) return null;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 20) return null;
  const shrink = b.r ? Math.min(b.r.width, b.r.height) * 0.42 : 0; // la punta si ferma sul bordo
  const ex = b.x - (dx / len) * shrink, ey = b.y - (dy / len) * shrink;
  const nx = -dy / len, ny = dx / len, bend = Math.min(60, len * 0.25) * (dx >= 0 ? -1 : 1);
  const cx = (a.x + ex) / 2 + nx * bend, cy = (a.y + ey) / 2 + ny * bend;
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', `arrow ${cls}`);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', `M${a.x},${a.y} Q${cx},${cy} ${ex},${ey}`);
  path.setAttribute('stroke', color);
  path.setAttribute('class', 'shaft');
  const ang = Math.atan2(ey - cy, ex - cx), s = 14;
  const head = document.createElementNS(ns, 'path');
  head.setAttribute('d', `M${ex},${ey} L${ex - s * Math.cos(ang - 0.45)},${ey - s * Math.sin(ang - 0.45)} L${ex - s * Math.cos(ang + 0.45)},${ey - s * Math.sin(ang + 0.45)} Z`);
  head.setAttribute('fill', color);
  head.setAttribute('class', 'head');
  g.appendChild(path); g.appendChild(head);
  svg.appendChild(g);
  if (animate) {
    const L = path.getTotalLength();
    path.style.strokeDasharray = `${L}`;
    path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: D(350), easing: 'ease-out', fill: 'forwards' })
      .finished.catch(() => {}).then(() => { path.style.strokeDasharray = ''; });
    head.animate([{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: D(350), fill: 'forwards' });
  }
  return g;
}

// Elemento colpito dalla terra in attesa
function pendingTargetEl(p) {
  if (!p || !p.target) return null;
  const ownerW = who(p.owner), otherW = ownerW === 'me' ? 'opp' : 'me';
  if (p.land === 'R') return slotEl(otherW, p.target);
  if (p.land === 'W') return slotEl(ownerW, p.target);
  if (p.land === 'G') return gyEl(ownerW, p.target);
  return null;
}

let lastArrowKey = null;
function drawArrows() {
  clearArrows('pending');
  if (!G || !G.pending || !G.pending.target || ui.staged) { lastArrowKey = null; return; }
  const p = G.pending;
  const key = `${G.turn}|${p.land}|${p.target}`;
  arrow(centerOf($('#stack .card')), centerOf(pendingTargetEl(p)), ARROW_COLOR[p.land], 'pending', key !== lastArrowKey);
  lastArrowKey = key;
}

// Mentre si sceglie il bersaglio, la freccia segue il dito/mouse e si aggancia ai bersagli validi
function aimArrow(x, y) {
  clearArrows('aim');
  if (!ui.staged) return;
  const hit = document.elementFromPoint(x, y);
  const tg = hit && hit.closest('.target');
  const to = tg ? centerOf(tg) : { x, y };
  arrow(centerOf($('#stack .card')), to, ARROW_COLOR[ui.staged.card], 'aim' + (tg ? ' locked' : ''), false);
}

async function flashArrow(fromEl, toEl, color, ms = 500) {
  const g = arrow(centerOf(fromEl), centerOf(toEl), color, 'flash', true);
  await wait(ms);
  if (g) g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(200), fill: 'forwards' }).finished.catch(() => {}).then(() => g.remove());
}

// ---------- Timer ----------
let lastTick = null;
function tickTimer() {
  const el = $('#timer');
  if (!el || el.classList.contains('off') || !S || !S.timer) return;
  const now = Date.now() + clockOffset;
  const total = S.timer.total * 1000;
  const left = Math.max(0, S.timer.deadline - now);
  const shown = Math.min(left, total);
  const fill = $('.fill', el);
  fill.style.width = `${(shown / total) * 100}%`;
  const secs = Math.ceil(shown / 1000);
  const mine = S.timer.actor === G.you;
  $('.tlabel', el).textContent = `${mine ? 'Tu' : G.opp.name} · ${secs}s`;
  el.classList.toggle('low', secs <= 5);
  if (mine && secs <= 5 && secs > 0 && lastTick !== secs && !ui.animating) { lastTick = secs; Sound.play('tick'); if (secs === 3) vibrate(40); }
}
setInterval(tickTimer, 200);

// =====================================================================
//  Animazioni
// =====================================================================
const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
const okRect = (r) => r && r.width > 0 && r.height > 0;

function handEl(w, card, idx) {
  if (w === 'me') {
    if (idx != null && idx >= 0) { const e = $(`#hand-me .card[data-idx="${idx}"]`); if (e && (!card || e.dataset.card === card)) return e; }
    const cards = $$(`#hand-me .card${card ? `[data-card="${card}"]` : ''}`);
    return cards[cards.length - 1] || $('#hand-me');
  }
  const backs = $$('#hand-opp .back');
  return backs[backs.length - 1] || $('#hand-opp');
}
const slotEl = (w, t) => $(`#slot-${w}-${t}`);
const gyEl = (w, t) => (t && $(`#gy-${w}-${t}`)) || $(`#gy-${w}`);
const deckEl = (w) => $(`#deck-${w} .pile`) || $(`#deck-${w}`);
const stackCard = () => $('#stack .card') || $('#stack');

function makeFlyer(face, w, h) {
  const f = document.createElement('div');
  if (face) { f.className = `flyer card c-${face}`; f.innerHTML = `<div class="sym">${SYM[face]}</div><div class="nm">${NAMES[face]}</div>`; }
  else f.className = 'flyer cardback';
  Object.assign(f.style, { width: w + 'px', height: h + 'px' });
  document.body.appendChild(f);
  return f;
}

// Fa volare una carta da `from` (rettangolo) all'elemento `toEl`.
function fly(from, toEl, face, { dur = 420, hideTarget = true, delay = 0 } = {}) {
  const to = rectOf(toEl);
  if (!okRect(from) || !okRect(to)) return Promise.resolve();
  const W = Math.max(46, Math.min(to.width, 70)), H = W * 1.4;
  const f = makeFlyer(face, W, H);
  const sx = from.left + from.width / 2 - W / 2, sy = from.top + from.height / 2 - H / 2;
  const ex = to.left + to.width / 2 - W / 2, ey = to.top + to.height / 2 - H / 2;
  const s0 = Math.max(0.3, Math.min(from.width / W, 1.2)), s1 = Math.max(0.3, Math.min(to.width / W, 1.2));
  if (hideTarget && toEl) toEl.style.visibility = 'hidden';
  const anim = f.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(${s0})`, opacity: 0.9 },
    { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 30}px) scale(${Math.max(s0, s1) * 1.08})`, opacity: 1, offset: 0.5 },
    { transform: `translate(${ex}px, ${ey}px) scale(${s1})`, opacity: 1 },
  ], { duration: D(dur), delay: D(delay), easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' });
  return anim.finished.catch(() => {}).then(() => {
    f.remove();
    if (hideTarget && toEl) toEl.style.visibility = '';
  });
}

function pulse(el, cls = 'pulse', ms = 600) {
  if (!el) return Promise.resolve();
  el.style.animationDuration = D(ms) + 'ms';
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  return wait(ms).then(() => { el.classList.remove(cls); el.style.animationDuration = ''; });
}

function banner(text, mine) {
  const b = $('#banner');
  if (!b) return Promise.resolve();
  b.textContent = text;
  b.style.animationDuration = D(1000) + 'ms';
  b.className = `banner ${mine ? 'mine' : ''}`;
  return wait(1000).then(() => b.classList.add('hidden'));
}

function setCaption(text) {
  ui.caption = text;
  const s = $('#status');
  if (s) { s.textContent = text; s.className = 'status cap'; }
}

function endSound(ev) {
  if (!G) return;
  if (ev.winner == null) Sound.play('lose');
  else if (ev.winner === G.you) { Sound.play('win'); vibrate([60, 40, 120]); }
  else { Sound.play('lose'); vibrate(200); }
}

async function animateStep(ev, next) {
  if (!G || ev.type === 'deal') {
    G = next; ui.caption = ''; render();
    if (ev.type === 'deal') await animateDeal();
    return;
  }
  const w = who(ev.player);
  const opp = G.opp.name;
  const say = (p, mine, theirs) => (p === G.you ? mine.charAt(0).toUpperCase() + mine.slice(1) : `${opp} ${theirs}`);
  const srcEl = () => (lastEnter ? slotEl(lastEnter.w, lastEnter.card) : stackCard());

  switch (ev.type) {
    case 'turn': {
      G = next; ui.caption = ''; render();
      const mine = ev.player === G.you;
      if (mine) { Sound.play('turn'); vibrate(30); }
      await banner(mine ? 'Il tuo turno' : `Turno di ${opp}`, mine);
      return;
    }
    case 'draw': {
      const from = rectOf(deckEl(w));
      G = next; render();
      Sound.play('draw');
      const to = w === 'me' ? handEl('me', ev.card) : handEl('opp');
      await fly(from, to, w === 'me' ? ev.card : null, { dur: 380 });
      if (w === 'me') pulse(to, 'newcard', 700);
      return;
    }
    case 'play': {
      let from;
      if (w === 'me' && lastPlay && lastPlay.card === ev.card) from = lastPlay.rect || rectOf(handEl('me', ev.card, lastPlay.idx));
      else from = rectOf(handEl(w, w === 'me' ? ev.card : null));
      lastPlay = null;
      G = next; render(); clearArrows('pending');
      if (ev.player !== G.you) setCaption(`${opp} gioca ${NAMES[ev.card]}`);
      Sound.play('play');
      await fly(from, stackCard(), ev.card, { dur: 420 });
      if (ev.target) { lastArrowKey = null; drawArrows(); await pulse(pendingTargetEl(G.pending), 'aimed', 500); }
      else await wait(250);
      return;
    }
    case 'counter': {
      let fromU, fromX;
      if (w === 'me' && lastCounter) {
        fromU = rectOf(handEl('me', 'U', lastCounter.islandIdx));
        fromX = rectOf(handEl('me', ev.other, lastCounter.pickIdx));
      } else if (w === 'me') { fromU = rectOf(handEl('me', 'U')); fromX = rectOf(handEl('me', ev.other)); }
      else { fromU = fromX = rectOf(handEl('opp')); }
      lastCounter = null;
      G = next; render();
      setCaption(say(ev.player, `contrasti (💧 + ${SYM[ev.other]})`, `contrasta (💧 + ${SYM[ev.other]})`));
      Sound.play('counter');
      if (ev.player !== G.you) vibrate(60);
      const st = $('#stack');
      if (st) st.classList.add('zap');
      await Promise.all([
        fly(fromU, gyEl(w, 'U'), 'U', { dur: 480 }),
        fly(fromX, gyEl(w, ev.other), ev.other, { dur: 480, delay: 120 }),
      ]);
      await flashArrow(gyEl(w), stackCard(), ARROW_COLOR.U, 450);
      return;
    }
    case 'countered': {
      const sc = stackCard();
      clearArrows('pending');
      if (sc && sc.classList.contains('card')) {
        const stamp = document.createElement('div'); stamp.className = 'stamp'; stamp.textContent = 'ANNULLATA';
        sc.appendChild(stamp);
        await wait(500);
        sc.classList.add('fizzle');
        await wait(350);
      }
      const from = rectOf(sc);
      G = next; render();
      Sound.play('fizzle');
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'enter': {
      const from = rectOf(stackCard());
      clearArrows('pending');
      G = next; render();
      setCaption('');
      Sound.play('land');
      const to = slotEl(w, ev.card);
      lastEnter = { w, card: ev.card };
      await fly(from, to, ev.card, { dur: 420 });
      await pulse(to, 'landed', 450);
      return;
    }
    case 'destroy': {
      const s = slotEl(w, ev.card);
      await flashArrow(srcEl(), s, ARROW_COLOR.R, 450);
      Sound.play('destroy');
      if (ev.player === G.you) vibrate(80);
      await pulse(s, 'boom', 450);
      const from = rectOf(s);
      G = next; render();
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'regrow': {
      await flashArrow(srcEl(), gyEl(w), ARROW_COLOR.G, 400);
      const from = rectOf(gyEl(w, ev.card));
      G = next; render();
      Sound.play('regrow');
      const to = w === 'me' ? handEl('me', ev.card) : handEl('opp');
      await fly(from, to, ev.card, { dur: 450 });
      return;
    }
    case 'discard': {
      const from = rectOf(w === 'me' ? handEl('me', ev.card) : handEl('opp'));
      G = next; render();
      Sound.play('discard');
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'look': {
      const target = ev.player === G.you ? $('#hand-opp') : $('#hand-me');
      await flashArrow(srcEl(), target, ARROW_COLOR.B, 450);
      G = next; render();
      Sound.play('look');
      if (ev.player !== G.you) { setCaption('👀'); await pulse($('#hand-me'), 'peek', 700); }
      return;
    }
    case 'reuse': {
      await flashArrow(srcEl(), slotEl(w, ev.card), ARROW_COLOR.W, 450);
      G = next; render();
      Sound.play('reuse');
      lastEnter = { w, card: ev.card }; // l'effetto riattivato parte da questa terra
      await pulse(slotEl(w, ev.card), 'shine', 650);
      return;
    }
    case 'pass': {
      G = next; render();
      setCaption(say(ev.player, 'passi', 'passa'));
      await wait(550);
      return;
    }
    case 'timeout': {
      G = next; render();
      setCaption('⏱ Tempo scaduto');
      Sound.play('timeout');
      if (ev.player === G.you) vibrate(150);
      await wait(700);
      return;
    }
    case 'end': {
      G = next; ui.caption = null; render();
      endSound(ev);
      await wait(500);
      return;
    }
    default:
      G = next; render();
  }
}

async function animateDeal() {
  Sound.play('draw');
  const jobs = [];
  const fromMe = rectOf(deckEl('me')), fromOpp = rectOf(deckEl('opp'));
  $$('#hand-me .card').forEach((el, i) => {
    jobs.push(fly(fromMe, el, el.dataset.card, { dur: 380, delay: i * 90 }));
    setTimeout(() => Sound.play('draw'), D(i * 90));
  });
  $$('#hand-opp .back').forEach((el, i) => jobs.push(fly(fromOpp, el, null, { dur: 380, delay: i * 90 })));
  await Promise.all(jobs);
}

// ---------- Avvio ----------
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
document.addEventListener('visibilitychange', () => { if (!document.hidden) connect(); });
render();
connect();
