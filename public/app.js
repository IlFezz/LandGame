'use strict';

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

const $ = (s) => document.querySelector(s);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Stato locale ----------
const store = {
  get name() { return localStorage.getItem('blg.name') || ''; },
  set name(v) { localStorage.setItem('blg.name', v); },
  get session() { try { return JSON.parse(localStorage.getItem('blg.session')); } catch { return null; } },
  set session(v) { v ? localStorage.setItem('blg.session', JSON.stringify(v)) : localStorage.removeItem('blg.session'); },
};
let S = null;            // ultimo stato dal server
let ws = null;
let wsReady = false;
let queue = [];
let retry = 0;
let wantConnection = false;
let userSheet = null;    // pannello aperto dall'utente (es. scelta bersaglio)
let showRules = false;

// ---------- Connessione ----------
function connect() {
  wantConnection = true;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  ws = new WebSocket(url);
  ws.onopen = () => {
    wsReady = true; retry = 0;
    const sess = store.session;
    if (sess && sess.code && !queue.some((m) => m.t === 'create' || m.t === 'join')) {
      ws.send(JSON.stringify({ t: 'join', code: sess.code, token: sess.token, name: store.name }));
    }
    queue.forEach((m) => ws.send(JSON.stringify(m)));
    queue = [];
    render();
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'joined') {
      store.session = { code: m.code, token: m.token };
      history.replaceState(null, '', location.pathname);
    } else if (m.t === 'state') {
      const prev = S;
      S = m;
      if (prev && prev.game && m.game && prev.game.turn !== m.game.turn) userSheet = null;
      render();
    } else if (m.t === 'error') {
      toast(m.msg);
      if (/non trovata/.test(m.msg) || (/piena/.test(m.msg) && !S)) { store.session = null; S = null; render(); }
    }
  };
  ws.onclose = () => {
    wsReady = false;
    if (!wantConnection) return;
    render();
    const delay = Math.min(1000 * 2 ** retry++, 8000);
    setTimeout(connect, delay);
  };
}
function send(m) {
  if (wsReady) ws.send(JSON.stringify(m)); else { queue.push(m); connect(); }
}
const act = (a) => { userSheet = null; send({ t: 'action', a }); };

// ---------- UI helpers ----------
let toastTimer;
function toast(msg, info) {
  const t = $('#toast');
  t.textContent = msg; t.className = info ? 'info' : '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}
const mini = (t) => `<span class="mini c-${t}">${SYM[t]} ${NAMES[t]}</span>`;
const pips = () => `<div class="pips">${TYPES.map((t) => `<div class="pip c-${t}">${SYM[t]}</div>`).join('')}</div>`;

function bfHtml(bf) {
  return `<div class="bf">${TYPES.map((t) => {
    const n = bf[t];
    return `<div class="slot c-${t} ${n ? '' : 'empty'} ${n >= 4 ? 'five' : ''}">
      <div class="sym">${SYM[t]}</div><div>${NAMES[t]}</div>${n ? `<div class="count">${n}</div>` : ''}</div>`;
  }).join('')}</div>`;
}
function gyHtml(gy) {
  const items = TYPES.filter((t) => gy[t]).map((t) => `<span class="chip c-${t}">${SYM[t]}×${gy[t]}</span>`).join('');
  return `<div class="gy">🪦 Cimitero: ${items || '<i>vuoto</i>'}</div>`;
}

// ---------- Render ----------
function render() {
  if (!S || !store.session) return renderLobby();
  if (!S.game) return renderWaiting();
  renderGame();
}

function renderLobby() {
  closeSheet();
  const params = new URLSearchParams(location.search);
  const pre = (params.get('room') || '').toUpperCase();
  const reconnecting = store.session && !S;
  app.innerHTML = `
  <div class="lobby">
    ${pips()}
    <h1>Basic Land Game</h1>
    <p class="sub">10 terre per colore. Fai dominio o cinque uguali.</p>
    ${reconnecting ? `<p class="sub">Riconnessione alla stanza <b>${esc(store.session.code)}</b>…</p>
      <button class="linkbtn" id="forget">Annulla</button>` : `
    <div class="field"><label>Il tuo nome</label><input id="name" maxlength="20" value="${esc(store.name)}" placeholder="Es. Claudio" autocomplete="nickname"></div>
    <button class="btn primary" id="create">Crea stanza</button>
    <div class="or">oppure entra con un codice</div>
    <div class="field"><input id="code" class="code-input" maxlength="4" value="${esc(pre)}" placeholder="CODICE" autocomplete="off" autocapitalize="characters"></div>
    <button class="btn" id="join">Entra nella stanza</button>
    <button class="linkbtn" id="rules">Regole del gioco</button>`}
  </div>${showRules ? rulesHtml() : ''}`;
  bindRules();
  if (reconnecting) { $('#forget').onclick = () => { store.session = null; render(); }; return; }
  const getName = () => { const n = $('#name').value.trim(); if (!n) { toast('Scrivi il tuo nome'); return null; } store.name = n; return n; };
  $('#create').onclick = () => { const n = getName(); if (n) send({ t: 'create', name: n }); };
  $('#join').onclick = () => {
    const n = getName(); if (!n) return;
    const c = $('#code').value.trim().toUpperCase();
    if (c.length !== 4) return toast('Il codice ha 4 caratteri');
    send({ t: 'join', code: c, name: n });
  };
  $('#code').onkeydown = (e) => { if (e.key === 'Enter') $('#join').click(); };
}

function renderWaiting() {
  closeSheet();
  const link = `${location.origin}${location.pathname}?room=${S.code}`;
  app.innerHTML = `
  <div class="lobby waiting">
    ${pips()}
    <p class="sub">Condividi questo codice con l'avversario</p>
    <div class="bigcode">${S.code}</div>
    <div class="row"><button class="btn primary" id="share">Condividi link</button></div>
    <p class="sub">In attesa che l'avversario entri…</p>
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
  store.session = null; S = null; userSheet = null;
  render();
}

function statusText(g, seats) {
  const me = g.you, oppName = esc(g.opp.name);
  if (g.phase === 'over') return { text: 'Partita finita', mine: false };
  if (g.step === 'main') return g.active === me
    ? { text: 'Tocca a te: gioca una terra o passa', mine: true }
    : { text: `Turno di ${oppName}…`, mine: false };
  if (g.step === 'response') return g.pending.responder === me
    ? { text: 'Vuoi rispondere?', mine: true }
    : { text: `${oppName} sta decidendo se contrastare…`, mine: false };
  if (g.step === 'choice') return g.choice.player === me
    ? { text: 'Fai la tua scelta', mine: true }
    : { text: `${oppName} sta scegliendo…`, mine: false };
  return { text: '', mine: false };
}

function pendingHtml(g) {
  const p = g.pending;
  if (!p) return '';
  const owner = p.owner === g.you ? 'Tu' : esc(g.opp.name);
  let tgt = '';
  if (p.target) {
    const whose = p.land === 'R' ? (p.owner === g.you ? 'avversaria' : 'tua') : '';
    tgt = ` → ${mini(p.target)} ${whose}`;
  }
  return `<div class="stack">${owner}: ${mini(p.land)}${tgt}</div>
    ${p.counters ? `<div class="counters" style="text-align:center">💧 Contrasti: ${p.counters} ${p.counters % 2 ? '(sarà annullata)' : '(risolve)'}</div>` : ''}`;
}

function renderGame() {
  const g = S.game;
  const me = g.you;
  const seats = S.seats;
  const oppConnected = seats[g.opp.seat] && seats[g.opp.seat].connected;
  const st = statusText(g, seats);
  const myTurnMain = g.phase === 'playing' && g.step === 'main' && g.active === me && !g.landPlayed;

  app.innerHTML = `
  <div class="game">
    <div class="topbar">
      <span>Stanza <span class="code">${S.code}</span> · turno ${g.turn}${wsReady ? '' : ' · <span style="color:#e57373">riconnessione…</span>'}</span>
      <span><button id="rules">Regole</button> <button id="leave">Esci</button></span>
    </div>

    <div class="zone ${g.active === g.opp.seat && g.phase === 'playing' ? 'active' : ''}">
      <div class="zhead">
        <span class="pname"><span class="dot ${oppConnected ? '' : 'off'}"></span>${esc(g.opp.name)}</span>
        <span class="stats"><span>✋ <b>${g.opp.handCount}</b></span><span>📚 <b>${g.opp.deckCount}</b></span></span>
      </div>
      <div class="backs" style="margin-bottom:8px">${'<div class="back"></div>'.repeat(Math.min(g.opp.handCount, 20))}</div>
      ${bfHtml(g.opp.bf)}
      ${gyHtml(g.opp.gy)}
    </div>

    <div class="center">
      <div class="status ${st.mine ? 'mine' : ''}">${st.text}</div>
      ${pendingHtml(g)}
    </div>

    <div class="zone ${g.active === me && g.phase === 'playing' ? 'active' : ''}">
      <div class="zhead">
        <span class="pname"><span class="dot"></span>${esc(g.me.name)} (tu)</span>
        <span class="stats"><span>📚 <b>${g.me.deckCount}</b></span></span>
      </div>
      ${bfHtml(g.me.bf)}
      ${gyHtml(g.me.gy)}
      <div class="hand">${g.hand.length ? g.hand.map((t, i) => `
        <div class="card c-${t} ${myTurnMain ? 'playable' : 'dim'}" data-card="${t}">
          <div class="sym">${SYM[t]}</div><div>${NAMES[t]}</div><div class="fx">${FX[t]}</div>
        </div>`).join('') : '<div style="color:var(--muted);font-size:13px;padding:10px">Nessuna carta in mano</div>'}</div>
      ${myTurnMain ? `<div class="actions"><button class="btn" id="pass">Passa il turno</button></div>` : ''}
    </div>

    <details class="log" ${localStorage.getItem('blg.log') === '1' ? 'open' : ''}>
      <summary>Registro partita</summary>
      <ol>${g.log.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    </details>
  </div>
  ${g.phase === 'over' ? overHtml(g) : ''}
  ${showRules ? rulesHtml() : ''}`;

  $('#leave').onclick = () => { userSheet = { kind: 'leave' }; renderSheet(); };
  bindRules();
  $('.log').ontoggle = (e) => localStorage.setItem('blg.log', e.target.open ? '1' : '0');
  if (myTurnMain) {
    document.querySelectorAll('.card.playable').forEach((el) => {
      el.onclick = () => { userSheet = { kind: 'play', card: el.dataset.card }; renderSheet(); };
    });
    $('#pass').onclick = () => { userSheet = { kind: 'pass' }; renderSheet(); };
  }
  if (g.phase === 'over') {
    const r = $('#rematch');
    if (r) r.onclick = () => send({ t: 'rematch' });
    $('#over-leave').onclick = leave;
  }
  renderSheet();
}

function overHtml(g) {
  const won = g.winner === g.you;
  const title = g.winner == null ? 'Pareggio' : won ? '🏆 Hai vinto!' : `Ha vinto ${esc(g.opp.name)}`;
  const reason = g.log.slice(-2, -1)[0] || '';
  const iAsked = S.rematch[g.you], oppAsked = S.rematch[g.opp.seat];
  return `<div class="overlay"><div class="box">
    <h2>${title}</h2>
    <p style="color:var(--muted);margin:0">${esc(reason)}</p>
    ${iAsked ? `<p style="margin:0">In attesa che ${esc(g.opp.name)} accetti la rivincita…</p>`
      : `<button class="btn primary" id="rematch">${oppAsked ? 'Accetta la rivincita' : 'Rivincita'}</button>`}
    <button class="btn" id="over-leave">Esci</button>
  </div></div>`;
}

// ---------- Pannello azioni ----------
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheet-backdrop').classList.add('hidden'); }
function openSheet(html, dismissable) {
  const sh = $('#sheet'), bd = $('#sheet-backdrop');
  sh.innerHTML = html; sh.classList.remove('hidden'); bd.classList.remove('hidden');
  bd.onclick = dismissable ? () => { userSheet = null; closeSheet(); } : null;
}
const optBtn = (t, val, extra = '') => `<button class="opt c-${t}" data-v="${val}"><span class="sym">${SYM[t]}</span>${NAMES[t]}${extra}</button>`;

function renderSheet() {
  const g = S && S.game;
  if (userSheet && userSheet.kind === 'leave') {
    openSheet(`<h3>Uscire dalla partita?</h3><p>Non potrai più rientrare in questa partita.</p>
      <button class="btn danger" id="yes">Esci</button><button class="btn" id="no">Resta</button>`, true);
    $('#yes').onclick = () => { closeSheet(); leave(); };
    $('#no').onclick = () => { userSheet = null; closeSheet(); };
    return;
  }
  if (!g || g.phase !== 'playing') { closeSheet(); return; }
  const me = g.you;

  if (userSheet && userSheet.kind === 'pass' && g.step === 'main' && g.active === me && !g.landPlayed) {
    openSheet(`<h3>Passare il turno?</h3><p>Non giocherai nessuna terra in questo turno.</p>
      <button class="btn primary" id="yes">Passa</button><button class="btn" id="no">Annulla</button>`, true);
    $('#yes').onclick = () => act({ type: 'pass' });
    $('#no').onclick = () => { userSheet = null; closeSheet(); };
    return;
  }

  // Risposta obbligatoria (contrasto)
  if (g.step === 'response' && g.pending.responder === me) {
    const p = g.pending;
    const mineLand = p.owner === me;
    const title = mineLand
      ? `${esc(g.opp.name)} ha contrastato la tua ${NAMES[p.land]}!`
      : p.counters === 0 ? `${esc(g.opp.name)} gioca ${NAMES[p.land]}` : `${esc(g.opp.name)} contrasta il tuo contrasto!`;
    let detail = '';
    if (p.counters === 0 && p.target) {
      detail = p.land === 'R' ? `Vuole distruggere la tua ${NAMES[p.target]}.`
        : p.land === 'G' ? `Vuole recuperare ${NAMES[p.target]} dal cimitero.`
        : `Vuole riattivare la sua ${NAMES[p.target]}.`;
    } else if (p.counters === 0 && p.land === 'B') detail = 'Guarderà la tua mano e ti farà scartare una terra.';
    else if (p.counters === 0 && p.land === 'U') detail = 'Pescherà una carta.';
    const others = g.counterOthers || [];
    const verb = mineLand ? 'Contro-contrasta' : 'Contrasta';
    openSheet(`
      <h3>${title}</h3>${detail ? `<p>${detail}</p>` : ''}
      ${others.length ? `<p>${verb} scartando un'Isola insieme a:</p><div class="opts">${others.map((t) => optBtn(t, t)).join('')}</div>`
        : `<p>Per contrastare ti servono un'Isola e un'altra terra in mano.</p>`}
      <button class="btn primary" id="allow">${mineLand ? 'Accetta (la terra viene annullata)' : 'Lascia risolvere'}</button>`, false);
    $('#sheet').querySelectorAll('.opt').forEach((b) => { b.onclick = () => act({ type: 'counter', other: b.dataset.v }); });
    $('#allow').onclick = () => act({ type: 'allow' });
    return;
  }

  // Scelta obbligatoria (Palude, Pianura→Montagna/Foresta)
  if (g.step === 'choice' && g.choice.player === me) {
    const c = g.choice;
    let title, html = '';
    if (c.kind === 'discard') {
      title = `Mano di ${esc(g.opp.name)}: scegli la terra da scartare`;
      html = `<div class="revealed">${c.revealed.map(mini).join('')}</div>`;
    } else if (c.kind === 'destroy') title = 'Scegli la terra avversaria da distruggere';
    else title = 'Scegli la terra da recuperare dal cimitero';
    openSheet(`<h3>${title}</h3>${html}<div class="opts">${c.options.map((t) => optBtn(t, t)).join('')}</div>`, false);
    $('#sheet').querySelectorAll('.opt').forEach((b) => { b.onclick = () => act({ type: 'choose', choice: b.dataset.v }); });
    return;
  }

  // Giocata dalla mano (aperta dall'utente)
  if (userSheet && userSheet.kind === 'play' && g.step === 'main' && g.active === me && !g.landPlayed && g.playable) {
    const card = userSheet.card;
    const targets = g.playable[card];
    if (targets === undefined) { userSheet = null; closeSheet(); return; }
    let body;
    if (targets && targets.length) {
      const q = card === 'R' ? 'Quale terra avversaria vuoi distruggere?'
        : card === 'G' ? 'Quale terra vuoi recuperare dal cimitero?'
        : 'Quale tua terra vuoi riattivare?';
      body = `<p>${q}</p><div class="opts">${targets.map((t) => optBtn(t, t)).join('')}</div>`;
    } else {
      const none = targets ? '<p>Nessun bersaglio disponibile: la terra entrerà senza effetto.</p>' : `<p>${FX[card]}.</p>`;
      body = `${none}<button class="btn primary" id="confirm">Gioca ${NAMES[card]}</button>`;
    }
    openSheet(`<h3>${SYM[card]} Gioca ${NAMES[card]}</h3>${body}<button class="btn" id="cancel">Annulla</button>`, true);
    $('#sheet').querySelectorAll('.opt').forEach((b) => { b.onclick = () => act({ type: 'play', card, target: b.dataset.v }); });
    const cf = $('#confirm'); if (cf) cf.onclick = () => act({ type: 'play', card });
    $('#cancel').onclick = () => { userSheet = null; closeSheet(); };
    return;
  }
  closeSheet();
}

// ---------- Regole ----------
function rulesHtml() {
  return `<div class="overlay" id="rules-ov"><div class="box rules">
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
    <h4>Carte finite</h4>Se un mazzo è vuoto non si pesca. Quando entrambi i mazzi sono vuoti e nessuno può o vuole più giocare, vince chi ha più tipi di terra diversi in gioco; in parità vince chi ha giocato l'ultima terra.
    <div style="text-align:center;margin-top:12px"><button class="btn primary" id="rules-close">Chiudi</button></div>
  </div></div>`;
}
function bindRules() {
  const b = $('#rules'); if (b) b.onclick = () => { showRules = true; render(); };
  const c = $('#rules-close'); if (c) c.onclick = () => { showRules = false; render(); };
}

// ---------- Avvio ----------
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
document.addEventListener('visibilitychange', () => { if (!document.hidden && wantConnection) connect(); });
render();
connect();
