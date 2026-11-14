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
const LONG_FX = {
  W: 'Riattiva l\'effetto di un\'altra tua terra in gioco.',
  U: 'Entrando peschi una carta.',
  B: 'Guardi la mano avversaria e scegli una terra da scartare.',
  R: 'Distruggi una terra avversaria in gioco.',
  G: 'Riprendi in mano una terra dal tuo cimitero.',
};
const TURN_OPTIONS = [30, 45, 60, 90, 0];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
};

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
    }
  },
};
const vibrate = (ms) => { if (prefs.vibe && navigator.vibrate) try { navigator.vibrate(ms); } catch {} };
document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });

// ---------- Stato ----------
let S = null;          // metadati stanza dall'ultimo messaggio
let G = null;          // vista di gioco attualmente mostrata
let clockOffset = 0;   // ora server - ora locale
const ui = { sel: null, menu: false, confirmLeave: false, rules: false, log: false, animating: false, caption: null };

// ---------- Connessione ----------
let ws = null, wsReady = false, queue = [], retry = 0;
function connect() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => {
    wsReady = true; retry = 0;
    const sess = prefs.session;
    if (sess && sess.code && !queue.some((m) => m.t === 'create' || m.t === 'join')) {
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
function act(a) { ui.sel = null; Sound.play('click'); send({ t: 'action', a }); }

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
    const animate = steps && steps.length && !document.hidden && inbox.length < 3 && !reduceMotion;
    if (animate) {
      ui.animating = true;
      for (const st of steps) {
        try { await animateStep(st.ev, st.game); } catch (e) { console.error(e); G = st.game; }
      }
      ui.animating = false; ui.caption = null;
    } else if (steps && steps.length) {
      // senza animazioni: suona solo l'ultimo evento significativo
      const last = steps[steps.length - 1].ev;
      if (last.type === 'end') endSound(last);
    }
    G = game;
    if (G && (G.step !== 'main' || G.active !== G.you)) ui.sel = null;
    render();
  }
  pumping = false;
}

// ---------- UI helpers ----------
let toastTimer;
function toast(msg, info) {
  const t = $('#toast');
  t.textContent = msg; t.className = info ? 'info' : '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}
const mini = (t) => `<span class="mini c-${t}">${SYM[t]} ${NAMES[t]}</span>`;
const pips = () => `<div class="pips">${TYPES.map((t) => `<div class="pip c-${t}">${SYM[t]}</div>`).join('')}</div>`;
const cardHtml = (t, extra = '', attrs = '') => `<div class="card c-${t} ${extra}" data-card="${t}" ${attrs}>
  <div class="sym">${SYM[t]}</div><div class="nm">${NAMES[t]}</div><div class="fx">${FX[t]}</div></div>`;
const who = (p) => (G && p === G.you ? 'me' : 'opp');
const pname = (p) => (p === G.you ? 'Tu' : esc(G.opp.name));

// =====================================================================
//  Render
// =====================================================================
function render() {
  if (!S || !prefs.session) return renderLobby();
  if (!G) return renderWaiting();
  renderGame();
}

function renderLobby() {
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
    <div class="field"><label>Tempo per turno (se crei la stanza)</label>
      <div class="seg">${TURN_OPTIONS.map((v) => `<button data-tt="${v}" class="${v === tt ? 'on' : ''}">${v ? v + 's' : '∞'}</button>`).join('')}</div></div>
    <button class="btn primary" id="create">Crea stanza</button>
    <div class="or">oppure entra con un codice</div>
    <div class="field"><input id="code" class="code-input" maxlength="4" value="${esc(pre)}" placeholder="CODICE" autocomplete="off" autocapitalize="characters"></div>
    <button class="btn" id="join">Entra nella stanza</button>
    <button class="linkbtn" id="rules">Regole del gioco</button>`}
  </div>${ui.rules ? rulesHtml() : ''}`;
  bindOverlays();
  if (reconnecting) { $('#forget').onclick = () => { prefs.session = null; render(); }; return; }
  $$('.seg button').forEach((b) => { b.onclick = () => { prefs.turnTime = Number(b.dataset.tt); render(); }; });
  const getName = () => { const n = $('#name').value.trim(); if (!n) { toast('Scrivi il tuo nome'); return null; } prefs.name = n; return n; };
  $('#create').onclick = () => { const n = getName(); if (n) send({ t: 'create', name: n, turnTime: prefs.turnTime }); };
  $('#join').onclick = () => {
    const n = getName(); if (!n) return;
    const c = $('#code').value.trim().toUpperCase();
    if (c.length !== 4) return toast('Il codice ha 4 caratteri');
    send({ t: 'join', code: c, name: n });
  };
  $('#code').onkeydown = (e) => { if (e.key === 'Enter') $('#join').click(); };
}

function renderWaiting() {
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
  send({ t: 'leave' });
  prefs.session = null; S = null; G = null;
  Object.assign(ui, { sel: null, menu: false, confirmLeave: false, log: false, rules: false });
  render();
}

// Avanzamento verso la vittoria
function progressHtml(pl) {
  const distinct = TYPES.filter((t) => pl.bf[t] > 0).length;
  const max = Math.max(...TYPES.map((t) => pl.bf[t]));
  const close = distinct >= 4 || max >= 4;
  return `<span class="prog ${close ? 'close' : ''}" title="Tipi diversi · massimo dello stesso tipo">
    ${close ? '⚠️ ' : ''}Tipi ${distinct}/5 · Uguali ${max}/5</span>`;
}

function bfHtml(pl, w, targets) {
  return `<div class="bf">${TYPES.map((t) => {
    const n = pl.bf[t];
    const tg = targets && targets.includes(t);
    return `<div id="slot-${w}-${t}" class="slot c-${t} ${n ? '' : 'empty'} ${n >= 4 ? 'five' : ''} ${tg ? 'target' : ''}"
      ${tg ? `data-act="target" data-v="${t}"` : ''}>
      <div class="sym">${SYM[t]}</div><div class="nm">${NAMES[t]}</div>${n ? `<div class="count">${n}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

function gyHtml(pl, w, targets) {
  const items = TYPES.filter((t) => pl.gy[t]).map((t) => {
    const tg = targets && targets.includes(t);
    return `<span id="gy-${w}-${t}" class="chip c-${t} ${tg ? 'target' : ''}" ${tg ? `data-act="target" data-v="${t}"` : ''}>${SYM[t]}×${pl.gy[t]}</span>`;
  }).join('');
  return `<div class="gy" id="gy-${w}"><span class="lbl">🪦</span>${items || '<i>cimitero vuoto</i>'}</div>`;
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

// Bersagli evidenziati sul campo
function boardTargets() {
  const out = { opp: null, me: null, gyMe: null };
  const task = myTask();
  if (task === 'main' && ui.sel) {
    const t = G.playable[ui.sel];
    if (t && t.length) {
      if (ui.sel === 'R') out.opp = t;
      if (ui.sel === 'W') out.me = t;
      if (ui.sel === 'G') out.gyMe = t;
    }
  }
  if (task === 'choice') {
    if (G.choice.kind === 'destroy') out.opp = G.choice.options;
    if (G.choice.kind === 'regrow') out.gyMe = G.choice.options;
  }
  return out;
}

function stackHtml() {
  const p = G.pending;
  if (!p) return `<div id="stack" class="stack-area"><div class="stack-slot"></div></div>`;
  const whose = p.land === 'R' ? (p.owner === G.you ? ' (avversaria)' : ' (tua)') : '';
  const arrow = p.target ? `<div class="arrow">➜</div><div class="tg">${mini(p.target)}<small>${whose}</small></div>` : '';
  const counters = p.counters
    ? `<div class="ctr">${'💧'.repeat(Math.min(p.counters, 6))}<small>${p.counters % 2 ? 'sarà annullata' : 'risolverà'}</small></div>` : '';
  return `<div id="stack" class="stack-area"><div class="by">${pname(p.owner)}</div>${cardHtml(p.land, 'onstack')}${arrow}${counters}</div>`;
}

function statusText() {
  const g = G, me = g.you, opp = esc(g.opp.name);
  if (ui.caption) return { text: ui.caption, cls: 'cap' };
  if (g.phase === 'over') return { text: 'Partita finita', cls: '' };
  if (g.step === 'main') return g.active === me ? { text: 'Il tuo turno', cls: 'mine' } : { text: `Turno di ${opp}`, cls: '' };
  if (g.step === 'response') return g.pending.responder === me
    ? { text: g.pending.owner === me ? `${opp} ha contrastato la tua terra!` : `${opp} gioca ${NAMES[g.pending.land]}`, cls: 'mine' }
    : { text: g.pending.counters ? `${opp} può rispondere al tuo contrasto…` : `${opp} sta decidendo se contrastare…`, cls: '' };
  if (g.step === 'choice') return g.choice.player === me
    ? { text: 'Fai la tua scelta', cls: 'mine' } : { text: `${opp} sta scegliendo…`, cls: '' };
  return { text: '', cls: '' };
}

function chip(t, act, extra = '') {
  return `<button class="optchip c-${t}" data-act="${act}" data-v="${t}">${SYM[t]} ${extra}${NAMES[t]}</button>`;
}

function actionsHtml() {
  const task = myTask();
  const g = G;
  if (!task) {
    if (g.phase === 'playing' && !ui.animating && g.step === 'main' && g.active !== g.you) return `<div class="hint">Attendi la mossa dell'avversario.</div>`;
    return '';
  }
  if (task === 'main') {
    if (!ui.sel) return `<div class="hint">Tocca una carta della tua mano per giocarla.</div>
      <div class="acts"><button class="btn small" data-act="pass">Passa il turno</button></div>`;
    const c = ui.sel, t = g.playable[c];
    let body;
    if (t && t.length) {
      const q = c === 'R' ? 'Tocca la terra avversaria da distruggere' : c === 'G' ? 'Tocca la terra da recuperare dal cimitero' : 'Tocca la tua terra da riattivare';
      body = `<div class="hint"><b>${NAMES[c]}</b> · ${q}:</div><div class="chips">${t.map((x) => chip(x, 'target')).join('')}</div>`;
    } else {
      const none = t ? ' Nessun bersaglio: entrerà senza effetto.' : '';
      body = `<div class="hint"><b>${NAMES[c]}</b> · ${LONG_FX[c]}${none}</div>
        <div class="acts"><button class="btn primary small" data-act="play" data-v="${c}">Gioca ${NAMES[c]}</button></div>`;
    }
    return body + `<div class="acts"><button class="btn small ghost" data-act="cancel">Annulla</button></div>`;
  }
  if (task === 'response') {
    const p = g.pending, mineLand = p.owner === g.you;
    let detail = '';
    if (p.counters === 0) {
      if (p.target) detail = p.land === 'R' ? `Vuole distruggere la tua ${NAMES[p.target]}.` : p.land === 'G' ? `Vuole recuperare ${NAMES[p.target]}.` : `Vuole riattivare ${NAMES[p.target]}.`;
      else detail = LONG_FX[p.land];
    } else if (!mineLand) detail = 'Ha contrastato il tuo contrasto.';
    const others = g.counterOthers || [];
    const verb = mineLand ? 'Contro-contrasta' : 'Contrasta';
    return `<div class="hint">${detail}</div>
      ${others.length ? `<div class="hint">${verb} scartando 💧 Isola +</div><div class="chips">${others.map((t) => chip(t, 'counter')).join('')}</div>`
        : `<div class="hint dim">Per contrastare servono un'Isola e un'altra terra in mano.</div>`}
      <div class="acts"><button class="btn primary small" data-act="allow">${mineLand ? 'Accetta' : 'Lascia risolvere'}</button></div>`;
  }
  if (task === 'choice') {
    const c = g.choice;
    if (c.kind === 'discard') {
      return `<div class="hint">Mano di ${esc(g.opp.name)} · tocca la terra da scartare:</div>
        <div class="revealed">${c.revealed.map((t) => (c.options.includes(t) ? cardHtml(t, 'small pick', `data-act="choose" data-v="${t}"`) : '')).join('')}</div>`;
    }
    const q = c.kind === 'destroy' ? 'Tocca la terra avversaria da distruggere:' : 'Tocca la terra da recuperare dal cimitero:';
    return `<div class="hint">${q}</div><div class="chips">${c.options.map((t) => chip(t, 'choose')).join('')}</div>`;
  }
  return '';
}

function timerHtml() {
  if (!S.timer || !G || G.phase !== 'playing') return `<div id="timer" class="timer off"></div>`;
  return `<div id="timer" class="timer ${S.timer.actor === G.you ? 'mine' : ''}"><div class="fill"></div><span class="tlabel"></span></div>`;
}

function renderGame() {
  const g = G, me = g.you;
  const oppConnected = S.seats[g.opp.seat] && S.seats[g.opp.seat].connected;
  const st = statusText();
  const task = myTask();
  const tg = boardTargets();
  const hand = g.hand;
  const keepScroll = $('.hand') ? $('.hand').scrollLeft : 0;

  app.innerHTML = `
  <div class="game ${ui.animating ? 'busy' : ''}">
    <div class="topbar">
      <span>Stanza <b class="code">${S.code}</b>${wsReady ? '' : ' · <span class="warn">riconnessione…</span>'}</span>
      <button class="menubtn" data-act="menu" aria-label="Menu">☰</button>
    </div>
    ${timerHtml()}

    <section class="zone opp ${g.active === g.opp.seat && g.phase === 'playing' ? 'active' : ''}">
      <div class="zhead">
        <span class="pname"><span class="dot ${oppConnected ? '' : 'off'}"></span>${esc(g.opp.name)}</span>
        ${progressHtml(g.opp)}
      </div>
      <div class="zrow">
        <div class="backs" id="hand-opp">${'<div class="back"></div>'.repeat(Math.min(g.opp.handCount, 12))}${g.opp.handCount > 12 ? `<small>+${g.opp.handCount - 12}</small>` : ''}<small class="hc">✋${g.opp.handCount}</small></div>
        ${deckHtml(g.opp, 'opp')}
      </div>
      ${bfHtml(g.opp, 'opp', tg.opp)}
      ${gyHtml(g.opp, 'opp')}
    </section>

    <section class="center">
      ${stackHtml()}
      <div class="status ${st.cls}" id="status">${st.text}</div>
      <div class="actions-area">${actionsHtml()}</div>
    </section>

    <section class="zone me ${g.active === me && g.phase === 'playing' ? 'active' : ''}">
      ${gyHtml(g.me, 'me', tg.gyMe)}
      ${bfHtml(g.me, 'me', tg.me)}
      <div class="zhead">
        <span class="pname"><span class="dot"></span>${esc(g.me.name)} (tu)</span>
        ${progressHtml(g.me)}
        ${deckHtml(g.me, 'me')}
      </div>
    </section>

    <div class="hand" id="hand-me">${hand.length ? hand.map((t) => {
      const playable = task === 'main' && g.playable && t in g.playable;
      const cls = (playable ? 'playable' : 'dim') + (ui.sel === t ? ' selected' : '');
      return cardHtml(t, cls, playable ? `data-act="sel" data-v="${t}"` : '');
    }).join('') : '<div class="nohand">Nessuna carta in mano</div>'}</div>
  </div>
  <div id="banner" class="banner hidden"></div>
  ${g.phase === 'over' && !ui.animating ? overHtml() : ''}
  ${ui.menu ? menuHtml() : ''}
  ${ui.log ? logHtml() : ''}
  ${ui.rules ? rulesHtml() : ''}`;
  const h = $('.hand'); if (h) h.scrollLeft = keepScroll;
  // la carta selezionata deve restare unica anche con doppioni
  if (ui.sel) { const sels = $$('.hand .card.selected'); sels.slice(1).forEach((e) => e.classList.remove('selected')); }
  bindOverlays();
  tickTimer();
}

function overHtml() {
  const g = G;
  const won = g.winner === g.you;
  const title = g.winner == null ? 'Pareggio' : won ? '🏆 Hai vinto!' : `Ha vinto ${esc(g.opp.name)}`;
  const iAsked = S.rematch[g.you], oppAsked = S.rematch[g.opp.seat];
  return `<div class="overlay"><div class="box">
    <h2>${title}</h2>
    <p class="muted">${esc(g.endText || '')}</p>
    ${iAsked ? `<p>In attesa che ${esc(g.opp.name)} accetti la rivincita…</p>`
      : `<button class="btn primary" data-act="rematch">${oppAsked ? 'Accetta la rivincita' : 'Rivincita'}</button>`}
    <button class="btn" data-act="leave-now">Esci</button>
  </div></div>`;
}

function menuHtml() {
  const tog = (on) => `<span class="tog ${on ? 'on' : ''}"><span></span></span>`;
  return `<div class="sheet-bd" data-act="menu-close"></div>
  <div class="sheet">
    <h3>Menu</h3>
    ${ui.confirmLeave ? `
      <p>Vuoi davvero uscire? Non potrai rientrare in questa partita.</p>
      <button class="btn danger" data-act="leave-now">Esci dalla partita</button>
      <button class="btn" data-act="leave-no">Annulla</button>` : `
    <button class="mrow" data-act="toggle-sound">🔊 Effetti sonori ${tog(prefs.sound)}</button>
    <button class="mrow" data-act="toggle-vibe">📳 Vibrazione ${tog(prefs.vibe)}</button>
    <button class="mrow" data-act="open-log">📜 Registro partita</button>
    <button class="mrow" data-act="open-rules">📖 Regole</button>
    <div class="mrow info">⏱ Tempo per turno: ${S.turnTime ? S.turnTime + 's' : 'illimitato'}</div>
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
    Il bersaglio di Montagna, Foresta e Pianura si dichiara prima del contrasto; la Palude sceglie alla risoluzione. Senza bersagli la terra si gioca comunque, senza effetto.
    <h4>Tempo</h4>Se il tempo del turno scade passi il turno; se scade durante una risposta la terra avversaria risolve.
    <h4>Carte finite</h4>Se un mazzo è vuoto non si pesca. Quando entrambi i mazzi sono vuoti e nessuno può o vuole più giocare, vince chi ha più tipi di terra diversi in gioco; in parità vince chi ha giocato l'ultima terra.
    <div style="text-align:center;margin-top:12px"><button class="btn primary" id="rules-close">Chiudi</button></div>
  </div></div>`;
}
function bindOverlays() {
  const b = $('#rules'); if (b) b.onclick = () => { ui.rules = true; render(); };
  const c = $('#rules-close'); if (c) c.onclick = () => { ui.rules = false; render(); };
}

// ---------- Click (delegati) ----------
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !app.contains(el)) return;
  const a = el.dataset.act, v = el.dataset.v;
  switch (a) {
    case 'sel': ui.sel = ui.sel === v ? null : v; Sound.play('click'); return render();
    case 'cancel': ui.sel = null; return render();
    case 'pass': return act({ type: 'pass' });
    case 'play': return act({ type: 'play', card: v });
    case 'target':
      if (myTask() === 'main' && ui.sel) return act({ type: 'play', card: ui.sel, target: v });
      if (myTask() === 'choice') return act({ type: 'choose', choice: v });
      return;
    case 'counter': return act({ type: 'counter', other: v });
    case 'allow': return act({ type: 'allow' });
    case 'choose': return act({ type: 'choose', choice: v });
    case 'menu': ui.menu = true; ui.confirmLeave = false; return render();
    case 'menu-close': ui.menu = false; ui.confirmLeave = false; return render();
    case 'toggle-sound': prefs.sound = !prefs.sound; Sound.unlock(); Sound.play('click'); return render();
    case 'toggle-vibe': prefs.vibe = !prefs.vibe; vibrate(30); return render();
    case 'open-log': ui.menu = false; ui.log = true; return render();
    case 'close-log': ui.log = false; return render();
    case 'open-rules': ui.menu = false; ui.rules = true; return render();
    case 'leave-ask': ui.confirmLeave = true; return render();
    case 'leave-no': ui.confirmLeave = false; return render();
    case 'leave-now': return leave();
    case 'rematch': return send({ t: 'rematch' });
  }
});

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

function handEl(w, card) {
  if (w === 'me') {
    const cards = $$(`#hand-me .card${card ? `[data-card="${card}"]` : ''}`);
    return cards[cards.length - 1] || $('#hand-me');
  }
  const backs = $$('#hand-opp .back');
  return backs[backs.length - 1] || $('#hand-opp');
}
const slotEl = (w, t) => $(`#slot-${w}-${t}`);
const gyEl = (w, t) => $(`#gy-${w}-${t}`) || $(`#gy-${w}`);
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
  // dimensione di "carta": usa la più grande delle due per un volo naturale
  const W = Math.max(48, Math.min(to.width, 74)), H = W * 1.4;
  const f = makeFlyer(face, W, H);
  const sx = from.left + from.width / 2 - W / 2, sy = from.top + from.height / 2 - H / 2;
  const ex = to.left + to.width / 2 - W / 2, ey = to.top + to.height / 2 - H / 2;
  const s0 = Math.max(0.35, Math.min(from.width / W, 1.2)), s1 = Math.max(0.35, Math.min(to.width / W, 1.2));
  if (hideTarget && toEl) toEl.style.visibility = 'hidden';
  const anim = f.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(${s0})`, opacity: 0.9 },
    { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 30}px) scale(${Math.max(s0, s1) * 1.08})`, opacity: 1, offset: 0.5 },
    { transform: `translate(${ex}px, ${ey}px) scale(${s1})`, opacity: 1 },
  ], { duration: dur, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' });
  return anim.finished.catch(() => {}).then(() => {
    f.remove();
    if (hideTarget && toEl) toEl.style.visibility = '';
  });
}

function pulse(el, cls = 'pulse', ms = 600) {
  if (!el) return Promise.resolve();
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  return sleep(ms).then(() => el.classList.remove(cls));
}

function banner(text, mine) {
  const b = $('#banner');
  if (!b) return Promise.resolve();
  b.textContent = text;
  b.className = `banner ${mine ? 'mine' : ''}`;
  return sleep(900).then(() => b.classList.add('hidden'));
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
  // Prima partita (nessuno stato precedente): mostra direttamente
  if (!G || ev.type === 'deal') {
    G = next; render();
    if (ev.type === 'deal') await animateDeal();
    return;
  }
  const w = who(ev.player);
  const opp = G.opp.name;
  // "Giochi Isola" per te, "Marco gioca Isola" per l'avversario
  const say = (p, mine, theirs) => (p === G.you ? mine.charAt(0).toUpperCase() + mine.slice(1) : `${opp} ${theirs}`);

  switch (ev.type) {
    case 'turn': {
      G = next; ui.caption = null; render();
      const mine = ev.player === G.you;
      if (mine) { Sound.play('turn'); vibrate(30); }
      await banner(mine ? 'Il tuo turno' : `Turno di ${opp}`, mine);
      return;
    }
    case 'draw': {
      const from = rectOf(deckEl(w));
      G = next; render();
      setCaption(ev.player === G.you ? `Peschi ${ev.card ? NAMES[ev.card] : 'una carta'}` : `${opp} pesca una carta`);
      Sound.play('draw');
      const to = w === 'me' ? handEl('me', ev.card) : handEl('opp');
      if (w === 'me' && to) to.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      await fly(from, to, w === 'me' ? ev.card : null, { dur: 380 });
      if (w === 'me') pulse(to, 'newcard', 700);
      return;
    }
    case 'play': {
      const from = rectOf(handEl(w, w === 'me' ? ev.card : null));
      G = next; render();
      let cap = say(ev.player, `giochi ${NAMES[ev.card]}`, `gioca ${NAMES[ev.card]}`);
      if (ev.target) cap += ev.card === 'R' ? ` → ${NAMES[ev.target]}` : ev.card === 'G' ? ` (recupera ${NAMES[ev.target]})` : ` (riattiva ${NAMES[ev.target]})`;
      setCaption(cap);
      Sound.play('play');
      await fly(from, stackCard(), ev.card, { dur: 460 });
      // evidenzia il bersaglio dichiarato
      if (ev.target) {
        const tw = ev.card === 'R' ? (ev.player === G.you ? 'opp' : 'me') : w;
        const tEl = ev.card === 'G' ? gyEl(tw, ev.target) : slotEl(tw, ev.target);
        await pulse(tEl, 'aimed', 500);
      } else await sleep(250);
      return;
    }
    case 'counter': {
      const from = rectOf(w === 'me' ? $('#hand-me') : handEl('opp'));
      G = next; render();
      setCaption(say(ev.player, 'contrasti!', 'contrasta!') + ` (Isola + ${NAMES[ev.other]})`);
      Sound.play('counter');
      if (ev.player !== G.you) vibrate(60);
      const st = $('#stack');
      st && st.classList.add('zap');
      await Promise.all([
        fly(from, gyEl(w, 'U'), 'U', { dur: 420 }),
        fly(from, gyEl(w, ev.other), ev.other, { dur: 420, delay: 90 }),
      ]);
      await sleep(250);
      return;
    }
    case 'countered': {
      const sc = stackCard();
      sc && sc.classList.add('fizzle');
      await sleep(350);
      const from = rectOf(sc);
      G = next; render();
      setCaption(`${NAMES[ev.card]} viene annullata`);
      Sound.play('fizzle');
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'enter': {
      const from = rectOf(stackCard());
      G = next; render();
      setCaption(`${NAMES[ev.card]} entra in gioco${ev.player === G.you ? '' : ` per ${opp}`}`);
      Sound.play('land');
      const to = slotEl(w, ev.card);
      await fly(from, to, ev.card, { dur: 420 });
      await pulse(to, 'landed', 450);
      return;
    }
    case 'destroy': {
      const s = slotEl(w, ev.card);
      setCaption(`${NAMES[ev.card]} ${ev.player === G.you ? 'tua' : `di ${opp}`} viene distrutta!`);
      Sound.play('destroy');
      if (ev.player === G.you) vibrate(80);
      await pulse(s, 'boom', 450);
      const from = rectOf(s);
      G = next; render();
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'regrow': {
      const from = rectOf(gyEl(w, ev.card));
      G = next; render();
      setCaption(say(ev.player, `recuperi ${NAMES[ev.card]} dal cimitero`, `recupera ${NAMES[ev.card]} dal cimitero`));
      Sound.play('regrow');
      const to = w === 'me' ? handEl('me', ev.card) : handEl('opp');
      await fly(from, to, ev.card, { dur: 450 });
      return;
    }
    case 'discard': {
      const from = rectOf(w === 'me' ? handEl('me', ev.card) : handEl('opp'));
      G = next; render();
      setCaption(ev.player === G.you ? `Scarti ${NAMES[ev.card]}` : `${opp} scarta ${NAMES[ev.card]}`);
      Sound.play('discard');
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'look': {
      G = next; render();
      setCaption(ev.player === G.you ? `Guardi la mano di ${opp}` : `${opp} guarda la tua mano 👀`);
      Sound.play('look');
      if (ev.player !== G.you) await pulse($('#hand-me'), 'peek', 700);
      else await sleep(300);
      return;
    }
    case 'reuse': {
      G = next; render();
      setCaption(`La Pianura riattiva ${NAMES[ev.card]}`);
      Sound.play('reuse');
      await pulse(slotEl(w, ev.card), 'shine', 650);
      return;
    }
    case 'pass': {
      G = next; render();
      setCaption(ev.auto ? say(ev.player, 'non hai carte: turno passato', 'non ha carte: turno passato') : say(ev.player, 'passi il turno', 'passa il turno'));
      await sleep(550);
      return;
    }
    case 'timeout': {
      G = next; render();
      setCaption(`⏱ Tempo scaduto${ev.player === G.you ? '' : ` per ${opp}`}`);
      Sound.play('timeout');
      if (ev.player === G.you) vibrate(150);
      await sleep(700);
      return;
    }
    case 'end': {
      G = next; ui.caption = null; render();
      endSound(ev);
      await sleep(500);
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
    setTimeout(() => Sound.play('draw'), i * 90);
  });
  $$('#hand-opp .back').forEach((el, i) => jobs.push(fly(fromOpp, el, null, { dur: 380, delay: i * 90 })));
  await Promise.all(jobs);
}

// ---------- Avvio ----------
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
document.addEventListener('visibilitychange', () => { if (!document.hidden) connect(); });
render();
connect();
