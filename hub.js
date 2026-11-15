// Gestione delle stanze: crea le partite, inoltra le mosse, fa giocare il computer e scandisce il timer.
// Lo stesso codice gira sul server (partite tra amici) e nel browser (partite contro il computer e tutorial),
// così contro il computer si gioca anche offline e senza aspettare che il server si svegli.
'use strict';
{
const isNode = typeof module !== 'undefined' && module.exports;
const { Game, TYPES } = isNode ? require('./game') : globalThis.BLGGame;
const { Bot } = isNode ? require('./bot') : globalThis.BLGBot;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TURN_TIMES = [0, 30, 45, 60, 90];
const ANIM_MS = 700;       // durata media di un'animazione a velocità "media" (il timer parte dopo)
const BOT_SEAT = 1;

// Numeri casuali: crypto se c'è, altrimenti Math.random
function randInt(n) {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) { const a = new Uint32Array(1); c.getRandomValues(a); return a[0] % n; }
  return Math.floor(Math.random() * n);
}
const newToken = () => Array.from({ length: 32 }, () => '0123456789abcdef'[randInt(16)]).join('');
const cleanName = (n) => (String(n || '').trim().slice(0, 20) || 'Giocatore');
// Fattore di velocità delle animazioni inviato dal client (lenta 1.5, media 1, veloce 0.6).
const speedOf = (v) => { const n = Number(v); return n >= 0.3 && n <= 3 ? n : 1.5; };

// Le pescate dell'avversario non rivelano la carta.
function eventFor(ev, seat) {
  if (ev.type === 'draw' && ev.player !== seat) return { ...ev, card: null };
  return ev;
}

// ---------- Tutorial: mazzi preparati e mosse del computer già scritte ----------
// Ordine di pescata (la prima carta dell'elenco è la prima pescata). Il resto del mazzo viene dopo.
// Le pescate danno doppioni di Pianura e Palude: per il contrasto si può scartare qualsiasi seconda terra.
const TUT_ME = ['U', 'G', 'R', 'W', 'B', /* pescate: */ 'G', 'W', 'B', 'R', 'U', 'G', 'W'];
const TUT_BOT = ['R', 'B', 'R', 'W', 'G', /* pescate: */ 'G', 'W', 'R', 'B', 'W', 'R'];
function tutorialDeck(order) {
  const left = { W: 10, U: 10, B: 10, R: 10, G: 10 };
  order.forEach((c) => left[c]--);
  const rest = [];
  // in fondo al mazzo niente Isole, così il computer non può contrastare per caso
  for (const t of ['W', 'B', 'R', 'G', 'U']) for (let i = 0; i < left[t]; i++) rest.push(t);
  return rest.concat(order.slice().reverse()); // si pesca dalla fine
}
function tutorialBotMove(g) {
  const me = BOT_SEAT;
  if (g.step === 'response') return { type: 'allow' };
  if (g.step === 'choice') {
    const o = g.choice.options;
    return { type: 'choose', choice: ['G', 'R'].find((c) => o.includes(c)) || o[0] };
  }
  const plan = { 2: ['R', 'U'], 4: ['B'], 6: ['R', 'G'], 8: ['W'], 10: ['G'], 12: ['R'] }[g.turn];
  const hand = g.players[me].hand;
  if (plan && hand.includes(plan[0])) {
    const valid = g.targetsFor(me, plan[0]) || [];
    const target = valid.includes(plan[1]) ? plan[1] : valid[0];
    return { type: 'play', card: plan[0], target };
  }
  return null; // se qualcosa non va come previsto gioca il computer normale
}

class Hub {
  // opts.local: stanze nel browser (solo computer e tutorial). opts.timeScale: solo per i test.
  // opts.onChange(room): chiamata dopo ogni cambiamento (il browser la usa per salvare la partita).
  constructor(opts = {}) {
    this.rooms = new Map();
    this.local = !!opts.local;
    this.timeScale = opts.timeScale || 1;
    this.onChange = opts.onChange || null;
  }

  newCode() {
    let code;
    do { code = Array.from({ length: 4 }, () => ALPHABET[randInt(ALPHABET.length)]).join(''); } while (this.rooms.has(code));
    return code;
  }
  // Tempo stimato per animare `n` eventi sul client, secondo la velocità scelta dal giocatore.
  animTime(room, n) { return Math.min(n * ANIM_MS * (room.animFactor || 1.5), 9000); }

  // Invia lo stato a entrambi. `events` (opzionale) sono i passaggi da animare.
  broadcast(room, events) {
    room.touched = Date.now();
    const n = events ? events.length : 0;
    this.scheduleTimer(room, n);
    this.scheduleBot(room, n);
    room.seats.forEach((s, i) => {
      if (!s || !s.conn) return;
      s.conn.send(this.stateMsg(room, i, events));
    });
    if (this.onChange) this.onChange(room);
  }

  stateMsg(room, i, events) {
    const msg = {
      t: 'state', code: room.code, seat: i, now: Date.now(),
      seats: room.seats.map((x) => (x ? { name: x.name, connected: !!x.conn || !!x.bot, bot: !!x.bot } : null)),
      vsBot: !!room.bot, botLevel: room.botLevel || null, local: this.local, tutorial: !!room.tutorial,
      tutWait: !!(room.tutorial && room.tutWait && room.tutWait !== room.tutGo), // il Maestro aspetta «Avanti»
      rematch: room.rematch.slice(), turnTime: room.turnTime,
      timer: room.timer ? { deadline: room.timer.deadline, total: room.timer.total, actor: room.timer.actor } : null,
      game: room.game ? room.game.view(i) : null,
    };
    if (events && events.length) msg.steps = events.map((e) => ({ ev: eventFor(e.ev, i), game: e.views[i] }));
    return msg;
  }

  // Timer del turno: si riavvia solo quando cambia la decisione in corso.
  scheduleTimer(room, nEvents) {
    const g = room.game;
    const actor = g ? g.actor() : null;
    const key = g && actor != null ? `${g.turn}|${g.step}|${actor}|${g.pending ? g.pending.counters : ''}` : null;
    const botTurn = room.bot && actor === BOT_SEAT;
    if (!room.turnTime || key == null || botTurn) {
      if (room.timer) { clearTimeout(room.timer.handle); room.timer = null; }
      return;
    }
    if (room.timer && room.timer.key === key) return;
    if (room.timer) clearTimeout(room.timer.handle);
    const total = room.turnTime; // stesso tempo per giocare, contrastare e scegliere
    const deadline = Date.now() + (this.animTime(room, nEvents) + total * 1000) * this.timeScale;
    const handle = setTimeout(() => {
      if (!room.game || room.game.actor() !== actor) return;
      room.timer = null;
      if (!room.seats.some((x) => x && x.conn)) return; // nessuno collegato: il timer riparte al rientro
      room.game.autoAct();
      this.broadcast(room, room.game.takeEvents());
    }, deadline - Date.now());
    room.timer = { key, deadline, total, actor, handle };
  }

  // Mossa del computer, dopo le animazioni e un breve "tempo per pensare".
  scheduleBot(room, nEvents) {
    if (!room.bot) return;
    const g = room.game;
    const actor = g ? g.actor() : null;
    if (actor !== BOT_SEAT) { if (room.botTimer) { clearTimeout(room.botTimer.handle); room.botTimer = null; } return; }
    const key = `${g.turn}|${g.step}|${g.pending ? g.pending.counters : ''}`;
    if (room.botTimer && room.botTimer.key === key) return;
    if (room.botTimer) clearTimeout(room.botTimer.handle);
    // Nel tutorial il Maestro gioca e sceglie solo dopo che il giocatore ha letto e premuto «Avanti»;
    // quando deve solo lasciar risolvere una terra lo fa subito.
    if (room.tutorial && g.step !== 'response' && room.tutGo !== key) { room.tutWait = key; return; }
    const think = room.tutorial ? 300 : g.step === 'main' ? 900 + Math.random() * 900 : 700 + Math.random() * 700;
    const handle = setTimeout(() => {
      room.botTimer = null;
      if (!room.game || room.game !== g || g.actor() !== BOT_SEAT) return;
      if (!room.seats[0].conn) return; // giocatore assente (app chiusa): il computer aspetta
      let a = room.tutorial ? tutorialBotMove(g) : null;
      if (!a || g.act(BOT_SEAT, a)) {
        a = new Bot(g, BOT_SEAT, { level: room.botLevel }).decide();
        if (!a || g.act(BOT_SEAT, a)) g.act(BOT_SEAT, g.step === 'main' ? { type: 'pass' } : { type: 'allow' });
      }
      this.broadcast(room, g.takeEvents());
    }, (this.animTime(room, nEvents) + think) * this.timeScale);
    room.botTimer = { key, handle };
  }

  clearTimers(room) {
    if (room.timer) { clearTimeout(room.timer.handle); room.timer = null; }
    if (room.botTimer) { clearTimeout(room.botTimer.handle); room.botTimer = null; }
  }

  startGame(room) {
    const names = [room.seats[0].name, room.seats[1].name];
    room.game = room.tutorial ? new Game(names, { decks: [tutorialDeck(TUT_ME), tutorialDeck(TUT_BOT)], firstPlayer: 0 }) : new Game(names);
    room.rematch = [false, false];
    this.clearTimers(room);
  }

  attach(conn, room, seat) {
    const s = room.seats[seat];
    if (s.conn && s.conn !== conn) s.conn.close(); // sessione precedente sostituita
    s.conn = conn;
    conn.room = room; conn.seat = seat;
    conn.send({ t: 'joined', code: room.code, seat, token: s.token, local: this.local });
  }

  newBotRoom(m, tutorial) {
    const tt = Number(m.turnTime);
    const room = {
      code: this.newCode(), bot: true, tutorial,
      seats: [{ name: cleanName(m.name), token: newToken(), conn: null }, { name: 'Computer', token: null, conn: null, bot: true }],
      game: null, rematch: [false, false], touched: Date.now(), timer: null, botTimer: null,
      turnTime: tutorial ? 0 : TURN_TIMES.includes(tt) ? tt : 60, animFactor: speedOf(m.speed),
      botLevel: m.level === 'easy' ? 'easy' : 'normal',
    };
    room.seats[1].name = tutorial ? 'Maestro' : room.botLevel === 'easy' ? 'Computer (facile)' : 'Computer';
    this.rooms.set(room.code, room);
    return room;
  }

  // Riprende una partita salvata (solo nel browser): `saved` viene da snapshot().
  restore(saved, conn) {
    const room = Object.assign(saved.room, { timer: null, botTimer: null, touched: Date.now() });
    room.seats.forEach((s) => { if (s) s.conn = null; });
    const g = Object.assign(Object.create(Game.prototype), saved.game);
    g.rng = Math.random; g.events = [];
    room.game = g;
    this.rooms.set(room.code, room);
    this.attach(conn, room, 0);
    this.broadcast(room);
    return room;
  }
  snapshot(room) {
    const { timer, botTimer, game, ...rest } = room;
    return JSON.parse(JSON.stringify({
      room: { ...rest, seats: rest.seats.map((s) => s && { name: s.name, token: s.token, bot: !!s.bot }) },
      game: game ? Object.fromEntries(Object.entries(game).filter(([k]) => k !== 'rng' && k !== 'events')) : null,
    }));
  }

  message(conn, m) {
    if (!m || typeof m !== 'object') return;
    const err = (msg) => conn.send({ t: 'error', msg });

    if (m.t === 'create') {
      if (this.local) return err('Per giocare con un amico serve la connessione.');
      const tt = Number(m.turnTime);
      const room = {
        code: this.newCode(), seats: [{ name: cleanName(m.name), token: newToken(), conn: null }, null], game: null,
        rematch: [false, false], touched: Date.now(), timer: null,
        turnTime: TURN_TIMES.includes(tt) ? tt : 60, animFactor: speedOf(m.speed),
      };
      this.rooms.set(room.code, room);
      this.attach(conn, room, 0);
      return this.broadcast(room);
    }
    if (m.t === 'bot' || m.t === 'tutorial') {
      const room = this.newBotRoom(m, m.t === 'tutorial');
      this.attach(conn, room, 0);
      this.startGame(room);
      return this.broadcast(room, room.game.takeEvents());
    }
    if (m.t === 'join') {
      const room = this.rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return err('Stanza non trovata. Controlla il codice.');
      if (m.token) { // rientro con il proprio token
        const seat = room.seats.findIndex((s) => s && s.token === m.token);
        if (seat !== -1) { this.attach(conn, room, seat); return this.broadcast(room); }
      }
      if (room.seats[1]) return err('La stanza è già piena.');
      room.seats[1] = { name: cleanName(m.name), token: newToken(), conn: null };
      this.attach(conn, room, 1);
      this.startGame(room);
      return this.broadcast(room, room.game.takeEvents());
    }

    const room = conn.room;
    if (!room) return err('Non sei in una stanza.');
    if (m.t === 'action') {
      if (!room.game) return err('La partita non è ancora iniziata.');
      const e = room.game.act(conn.seat, m.a);
      if (e) { err(e); return conn.send(this.stateMsg(room, conn.seat)); }
      return this.broadcast(room, room.game.takeEvents());
    }
    if (m.t === 'rematch') {
      if (!room.game || room.game.phase !== 'over') return;
      room.rematch[conn.seat] = true;
      if (room.bot) { room.rematch[BOT_SEAT] = true; room.tutorial = false; } // dopo il tutorial, una partita vera
      if (room.rematch.every(Boolean)) { this.startGame(room); return this.broadcast(room, room.game.takeEvents()); }
      return this.broadcast(room);
    }
    if (m.t === 'tut-go') {
      if (!room.tutorial || !room.tutWait) return;
      room.tutGo = room.tutWait; room.tutWait = null;
      return this.broadcast(room);
    }
    if (m.t === 'prefs') {
      room.animFactor = speedOf(m.speed);
      return;
    }
    if (m.t === 'leave') {
      const seat = conn.seat;
      room.seats[seat].conn = null;
      conn.room = null;
      if (!room.game || room.bot) { this.rooms.delete(room.code); this.clearTimers(room); }
      else this.broadcast(room);
      return;
    }
  }

  close(conn) {
    const room = conn.room;
    if (!room) return;
    const s = room.seats[conn.seat];
    if (s && s.conn === conn) { s.conn = null; this.broadcast(room); }
  }

  // Pulizia delle stanze inattive da più di 2 ore; tiene vive le connessioni.
  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const anyone = room.seats.some((s) => s && s.conn);
      if (!anyone && now - room.touched > 2 * 3600 * 1000) { this.clearTimers(room); this.rooms.delete(code); }
      for (const s of room.seats) if (s && s.conn && s.conn.ping) s.conn.ping();
    }
  }
}

if (isNode) module.exports = { Hub, BOT_SEAT };
else globalThis.BLGHub = { Hub, BOT_SEAT };
}
