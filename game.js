// Motore di gioco "The Basic Land Game" – logica pura, nessuna dipendenza.
'use strict';

const TYPES = ['W', 'U', 'B', 'R', 'G'];
const NAMES = { W: 'Pianura', U: 'Isola', B: 'Palude', R: 'Montagna', G: 'Foresta' };

function emptyCount() { return { W: 0, U: 0, B: 0, R: 0, G: 0 }; }

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function removeOne(arr, x) {
  const i = arr.indexOf(x);
  if (i === -1) return false;
  arr.splice(i, 1);
  return true;
}

const ORDER = { W: 0, U: 1, B: 2, R: 3, G: 4 };
const sortTypes = (a) => a.slice().sort((x, y) => ORDER[x] - ORDER[y]);

class Game {
  constructor(names, opts = {}) {
    this.rng = opts.rng || Math.random;
    this.copies = opts.copies || 10;
    this.handSize = opts.handSize || 5;
    this.players = names.map((name) => {
      const deck = [];
      for (const t of TYPES) for (let i = 0; i < this.copies; i++) deck.push(t);
      return { name, deck: shuffle(deck, this.rng), hand: [], bf: emptyCount(), gy: emptyCount() };
    });
    this.phase = 'playing';
    this.turn = 0;
    this.active = null;
    this.step = null; // 'main' | 'response' | 'choice'
    this.landPlayed = false;
    this.pending = null; // { owner, land, target, counters, responder }
    this.choice = null; // { player, kind, options }
    this.passStreak = 0;
    this.lastLandPlayer = null;
    this.winner = null;
    this.endReason = null;
    this.log = [];
    this.firstPlayer = opts.firstPlayer != null ? opts.firstPlayer : (this.rng() < 0.5 ? 0 : 1);

    for (let p = 0; p < 2; p++) for (let i = 0; i < this.handSize; i++) this.draw(p, true);
    this.addLog(`${this.players[this.firstPlayer].name} inizia la partita (salta la prima pescata).`);
    this.beginTurn(this.firstPlayer);
  }

  opp(p) { return 1 - p; }
  name(p) { return this.players[p].name; }
  addLog(text) { this.log.push(text); if (this.log.length > 200) this.log.shift(); }

  draw(p, silent) {
    const pl = this.players[p];
    if (pl.deck.length === 0) {
      if (!silent) this.addLog(`${pl.name} non ha più carte nel mazzo e non pesca.`);
      return false;
    }
    pl.hand.push(pl.deck.pop());
    if (!silent) this.addLog(`${pl.name} pesca una carta.`);
    return true;
  }

  beginTurn(p) {
    this.active = p;
    this.turn++;
    this.landPlayed = false;
    this.pending = null;
    this.choice = null;
    this.step = 'main';
    const skipDraw = this.turn === 1; // chi inizia salta la prima pescata
    if (!skipDraw) this.draw(p);
    if (this.checkOutOfCards()) return;
    // Nessuna carta in mano: il turno passa da solo
    if (this.players[p].hand.length === 0) {
      this.addLog(`${this.name(p)} non ha carte in mano e passa.`);
      this.countPass();
      if (this.checkOutOfCards()) return;
      this.beginTurn(this.opp(p));
    }
  }

  // Fine per carte esaurite: entrambi i mazzi vuoti e (entrambe le mani vuote
  // oppure entrambi i giocatori hanno passato di fila).
  checkOutOfCards() {
    const [a, b] = this.players;
    if (a.deck.length || b.deck.length) return false;
    const handsEmpty = a.hand.length === 0 && b.hand.length === 0;
    if (!handsEmpty && this.passStreak < 2) return false;
    const da = this.distinct(0), db = this.distinct(1);
    let winner;
    if (da !== db) winner = da > db ? 0 : 1;
    else winner = this.lastLandPlayer; // pareggio: vince chi ha giocato l'ultima terra
    this.endGame(winner, 'cards',
      `Carte esaurite. Tipi di terra distinti: ${a.name} ${da}, ${b.name} ${db}.` +
      (da === db && winner != null ? ` Parità: vince chi ha giocato l'ultima terra.` : ''));
    return true;
  }

  // Contano solo i passaggi fatti quando entrambi i mazzi sono vuoti.
  countPass() {
    const empty = this.players.every((pl) => pl.deck.length === 0);
    this.passStreak = empty ? this.passStreak + 1 : 0;
  }

  distinct(p) { return TYPES.filter((t) => this.players[p].bf[t] > 0).length; }

  hasWon(p) {
    const bf = this.players[p].bf;
    return TYPES.every((t) => bf[t] > 0) || TYPES.some((t) => bf[t] >= 5);
  }

  endGame(winner, reason, text) {
    this.phase = 'over';
    this.step = null;
    this.winner = winner;
    this.endReason = reason;
    this.pending = null;
    this.choice = null;
    if (text) this.addLog(text);
    this.addLog(winner == null ? 'La partita finisce in parità.' : `🏆 ${this.name(winner)} vince!`);
  }

  // Bersagli validi da dichiarare quando si gioca una terra.
  // Restituisce null se la terra non richiede bersaglio, altrimenti l'elenco (può essere vuoto).
  targetsFor(p, land) {
    const me = this.players[p], op = this.players[this.opp(p)];
    if (land === 'R') return TYPES.filter((t) => op.bf[t] > 0);
    if (land === 'G') return TYPES.filter((t) => me.gy[t] > 0);
    if (land === 'W') return TYPES.filter((t) => t !== 'W' && me.bf[t] > 0);
    return null;
  }

  canRespond(p) { return this.players[p].hand.length >= 2; }

  act(p, a) {
    if (this.phase !== 'playing') return 'La partita è finita.';
    if (!a || typeof a.type !== 'string') return 'Azione non valida.';
    switch (a.type) {
      case 'play': return this.doPlay(p, a.card, a.target);
      case 'pass': return this.doPass(p);
      case 'counter': return this.doCounter(p, a.other);
      case 'allow': return this.doAllow(p);
      case 'choose': return this.doChoose(p, a.choice);
      default: return 'Azione sconosciuta.';
    }
  }

  doPlay(p, card, target) {
    if (this.step !== 'main' || this.active !== p) return 'Non è il tuo momento.';
    if (this.landPlayed) return 'Hai già giocato una terra in questo turno.';
    const me = this.players[p];
    if (!TYPES.includes(card) || !me.hand.includes(card)) return 'Non hai quella carta.';
    const valid = this.targetsFor(p, card);
    let tgt = null;
    if (valid && valid.length) {
      if (!valid.includes(target)) return 'Scegli un bersaglio valido.';
      tgt = target;
    }
    removeOne(me.hand, card);
    this.landPlayed = true;
    this.passStreak = 0;
    this.pending = { owner: p, land: card, target: tgt, counters: 0, responder: null };
    let msg = `${me.name} gioca ${NAMES[card]}`;
    if (card === 'R' && tgt) msg += ` puntando ${NAMES[tgt]} di ${this.name(this.opp(p))}`;
    if (card === 'G' && tgt) msg += ` per recuperare ${NAMES[tgt]} dal cimitero`;
    if (card === 'W' && tgt) msg += ` per riattivare ${NAMES[tgt]}`;
    if (valid && !valid.length) msg += ' (nessun bersaglio)';
    this.addLog(msg + '.');
    this.openResponse(this.opp(p));
    return null;
  }

  openResponse(responder) {
    if (this.canRespond(responder)) {
      this.step = 'response';
      this.pending.responder = responder;
    } else {
      this.resolvePending();
    }
  }

  doPass(p) {
    if (this.step !== 'main' || this.active !== p) return 'Non è il tuo momento.';
    if (this.landPlayed) return 'Turno già concluso.';
    this.addLog(`${this.name(p)} passa il turno senza giocare terre.`);
    this.countPass();
    if (this.checkOutOfCards()) return null;
    this.beginTurn(this.opp(p));
    return null;
  }

  doCounter(p, other) {
    if (this.step !== 'response' || this.pending.responder !== p) return 'Non puoi rispondere ora.';
    const hand = this.players[p].hand;
    if (!hand.includes('U')) return 'Ti serve un\'Isola in mano.';
    if (!TYPES.includes(other)) return 'Scegli la seconda terra da scartare.';
    const need = other === 'U' ? 2 : 1;
    if (hand.filter((c) => c === 'U').length < need || !hand.includes(other)) return 'Non hai quella carta da scartare.';
    removeOne(hand, 'U');
    removeOne(hand, other);
    this.players[p].gy.U++;
    this.players[p].gy[other]++;
    this.pending.counters++;
    const what = this.pending.counters === 1 ? NAMES[this.pending.land] : 'il contrasto';
    this.addLog(`${this.name(p)} scarta Isola + ${NAMES[other]} e contrasta ${what}!`);
    this.openResponse(this.opp(p));
    return null;
  }

  doAllow(p) {
    if (this.step !== 'response' || this.pending.responder !== p) return 'Non puoi rispondere ora.';
    this.resolvePending();
    return null;
  }

  resolvePending() {
    const { owner, land, target, counters } = this.pending;
    const me = this.players[owner];
    if (counters % 2 === 1) {
      me.gy[land]++;
      this.addLog(`${NAMES[land]} di ${me.name} viene contrastata e finisce nel cimitero.`);
      this.endTurn();
      return;
    }
    me.bf[land]++;
    this.lastLandPlayer = owner;
    this.addLog(`${NAMES[land]} entra in gioco per ${me.name}.`);
    if (this.hasWon(owner)) {
      const five = TYPES.find((t) => me.bf[t] >= 5);
      this.endGame(owner, 'combo', five ? `${me.name} ha 5 ${NAMES[five]} in gioco!` : `${me.name} ha una terra di ogni tipo in gioco!`);
      return;
    }
    this.applyEffect(owner, land, target, false);
  }

  // Applica l'effetto d'ingresso. Ritorna dopo aver chiuso il turno o aperto una scelta.
  applyEffect(p, land, target, viaPlains) {
    const me = this.players[p], op = this.players[this.opp(p)];
    switch (land) {
      case 'U':
        this.draw(p);
        break;
      case 'B':
        if (op.hand.length) {
          this.step = 'choice';
          this.choice = { player: p, kind: 'discard', options: TYPES.filter((t) => op.hand.includes(t)) };
          this.addLog(`${me.name} guarda la mano di ${op.name}.`);
          return;
        }
        this.addLog(`${op.name} non ha carte in mano: la Palude non ha effetto.`);
        break;
      case 'R': {
        if (viaPlains) {
          const opts = TYPES.filter((t) => op.bf[t] > 0);
          if (opts.length) { this.step = 'choice'; this.choice = { player: p, kind: 'destroy', options: opts }; return; }
          this.addLog('Nessuna terra avversaria da distruggere.');
          break;
        }
        if (target && op.bf[target] > 0) this.destroy(p, target);
        break;
      }
      case 'G': {
        if (viaPlains) {
          const opts = TYPES.filter((t) => me.gy[t] > 0);
          if (opts.length) { this.step = 'choice'; this.choice = { player: p, kind: 'regrow', options: opts }; return; }
          this.addLog('Nessuna terra nel cimitero da recuperare.');
          break;
        }
        if (target && me.gy[target] > 0) this.regrow(p, target);
        break;
      }
      case 'W':
        if (target && me.bf[target] > 0) {
          this.addLog(`La Pianura riattiva l'effetto di ${NAMES[target]}.`);
          this.applyEffect(p, target, null, true);
          return;
        }
        break;
    }
    this.endTurn();
  }

  destroy(p, t) {
    const op = this.players[this.opp(p)];
    op.bf[t]--; op.gy[t]++;
    this.addLog(`${NAMES[t]} di ${op.name} viene distrutta.`);
  }

  regrow(p, t) {
    const me = this.players[p];
    me.gy[t]--; me.hand.push(t);
    this.addLog(`${me.name} riprende in mano ${NAMES[t]} dal cimitero.`);
  }

  doChoose(p, c) {
    if (this.step !== 'choice' || this.choice.player !== p) return 'Non devi scegliere ora.';
    if (!this.choice.options.includes(c)) return 'Scelta non valida.';
    const op = this.players[this.opp(p)];
    if (this.choice.kind === 'discard') {
      removeOne(op.hand, c); op.gy[c]++;
      this.addLog(`${this.name(p)} fa scartare ${NAMES[c]} a ${op.name}.`);
    } else if (this.choice.kind === 'destroy') {
      this.destroy(p, c);
    } else if (this.choice.kind === 'regrow') {
      this.regrow(p, c);
    }
    this.choice = null;
    this.endTurn();
    return null;
  }

  endTurn() {
    if (this.phase !== 'playing') return;
    this.pending = null;
    this.choice = null;
    this.beginTurn(this.opp(this.active));
  }

  // Vista dello stato per un singolo giocatore (nasconde le informazioni segrete).
  view(p) {
    const me = this.players[p], op = this.players[this.opp(p)];
    const pub = (pl, i) => ({
      name: pl.name, seat: i, handCount: pl.hand.length, deckCount: pl.deck.length,
      bf: { ...pl.bf }, gy: { ...pl.gy },
    });
    const v = {
      phase: this.phase, turn: this.turn, active: this.active, step: this.step, you: p,
      me: pub(me, p), opp: pub(op, this.opp(p)),
      hand: sortTypes(me.hand),
      landPlayed: this.landPlayed,
      pending: this.pending ? { ...this.pending } : null,
      choice: null,
      winner: this.winner, endReason: this.endReason,
      log: this.log.slice(-60),
    };
    if (this.choice) {
      v.choice = { player: this.choice.player, kind: this.choice.kind };
      if (this.choice.player === p) {
        v.choice.options = this.choice.options.slice();
        if (this.choice.kind === 'discard') v.choice.revealed = sortTypes(op.hand);
      }
    }
    if (this.phase === 'playing' && this.step === 'main' && this.active === p && !this.landPlayed) {
      v.playable = {};
      for (const t of new Set(me.hand)) v.playable[t] = this.targetsFor(p, t);
    }
    if (this.step === 'response' && this.pending.responder === p) {
      const uCount = me.hand.filter((c) => c === 'U').length;
      v.counterOthers = uCount === 0 ? [] : TYPES.filter((t) => (t === 'U' ? uCount >= 2 : me.hand.includes(t)));
    }
    return v;
  }
}

module.exports = { Game, TYPES, NAMES };
