// Giocatore computer di difficoltà media.
// Usa solo informazioni legittime: la propria mano, il campo e i cimiteri (pubblici),
// il numero di carte avversarie e la mano avversaria solo quando una Palude la rivela.
'use strict';
const { TYPES } = require('./game');

// Valore di una posizione sul campo: premia l'avvicinarsi a dominio o cinque uguali.
const STEP = [0, 3, 9, 20, 45, 1000];
function distinct(bf) { return TYPES.filter((t) => bf[t] > 0).length; }
function maxSame(bf) { return Math.max(...TYPES.map((t) => bf[t])); }
function wins(bf) { return distinct(bf) === 5 || maxSame(bf) >= 5; }
function score(bf) { return wins(bf) ? 1000 : STEP[distinct(bf)] + STEP[Math.min(maxSame(bf), 4)]; }
function need(bf) { return Math.min(5 - distinct(bf), 5 - maxSame(bf)); }
const plus = (bf, t, n = 1) => ({ ...bf, [t]: bf[t] + n });

// Quanto vale distruggere la terra `t` nel campo `bf`.
function destroyValue(bf, t) {
  if (!bf[t]) return 0;
  return score(bf) - score(plus(bf, t, -1));
}
function bestDestroy(bf) {
  let best = null, v = -1;
  for (const t of TYPES) if (bf[t]) { const x = destroyValue(bf, t) + (bf[t] === 1 ? 0.5 : 0); if (x > v) { v = x; best = t; } }
  return { target: best, value: Math.max(0, v) };
}
// Quanto vale per me avere in mano una carta di tipo `t` (per giocarla in futuro).
function cardValue(myBf, t) {
  let v = 2;
  const after = plus(myBf, t);
  if (wins(after)) v += 40;
  v += (score(after) - score(myBf)) * 0.5;
  if (t === 'U') v += 3; // permette di contrastare
  return v;
}
function bestRegrow(myBf, gy) {
  let best = null, v = -1;
  for (const t of TYPES) if (gy[t]) { const x = cardValue(myBf, t); if (x > v) { v = x; best = t; } }
  return { target: best, value: Math.max(0, v) };
}

class Bot {
  constructor(game, seat, opts = {}) {
    this.g = game; this.p = seat;
    this.rng = opts.rng || Math.random;
  }
  get me() { return this.g.players[this.p]; }
  get op() { return this.g.players[1 - this.p]; }

  // Valore dell'effetto di una terra che entra per `owner` (in prospettiva di owner).
  effectValue(owner, land, target) {
    const own = this.g.players[owner], other = this.g.players[1 - owner];
    switch (land) {
      case 'U': return 4;
      case 'B': return other.hand.length ? 4 + (need(other.bf) <= 1 ? 4 : 0) : 0;
      case 'R': return target ? destroyValue(other.bf, target) * 1.2 : 0;
      case 'G': return target ? 1 + cardValue(own.bf, target) : 0;
      case 'W': {
        if (!target) return 0;
        if (target === 'R') return bestDestroy(other.bf).value * 1.2;
        if (target === 'G') return 1 + bestRegrow(own.bf, own.gy).value;
        return this.effectValue(owner, target, null);
      }
    }
    return 0;
  }

  // Valore complessivo di giocare `card` con `target` per `owner`.
  playValue(owner, card, target) {
    const bf = this.g.players[owner].bf;
    const after = plus(bf, card);
    if (wins(after)) return 10000;
    return (score(after) - score(bf)) + this.effectValue(owner, card, target);
  }

  decide() {
    const g = this.g;
    if (g.step === 'main') return this.decideMain();
    if (g.step === 'response') return this.decideResponse();
    if (g.step === 'choice') return this.decideChoice();
    return null;
  }

  decideMain() {
    const g = this.g, hand = this.me.hand;
    const options = [];
    for (const card of new Set(hand)) {
      const targets = g.targetsFor(this.p, card);
      const list = targets && targets.length ? targets : [null];
      for (const target of list) {
        let v = this.playValue(this.p, card, target);
        // Tieni almeno un'Isola (e una carta di accompagnamento) se l'avversario è vicino alla vittoria.
        const islands = hand.filter((c) => c === 'U').length;
        if (card === 'U' && islands === 1 && need(this.op.bf) <= 2 && v < 1000) v -= 6;
        if (card !== 'U' && islands >= 1 && hand.length === 2 && need(this.op.bf) <= 1 && v < 1000) v -= 4;
        v += this.rng() * 1.5; // un po' di varietà, senza stravolgere le priorità
        options.push({ card, target, v });
      }
    }
    if (!options.length) return { type: 'pass' };
    options.sort((a, b) => b.v - a.v);
    const best = options[0];
    return { type: 'play', card: best.card, target: best.target || undefined };
  }

  // Quanto mi costa scartare la carta `t` (oltre all'Isola).
  keepValue(t) {
    const dup = this.me.hand.filter((c) => c === t).length;
    return cardValue(this.me.bf, t) - (dup - 1) * 2;
  }

  decideResponse() {
    const g = this.g, pend = g.pending;
    const others = this.counterOthers();
    if (!others.length) return { type: 'allow' };
    const resolves = pend.counters % 2 === 0; // senza un mio contrasto la terra risolve
    let want = false;
    if (pend.owner !== this.p && resolves) {
      // Danno se la terra avversaria risolve
      const harm = this.playValue(pend.owner, pend.land, pend.target);
      const threat = need(plus(this.op.bf, pend.land)) <= 1;
      want = harm >= 1000 || harm >= 16 || (threat && harm >= 10);
    } else if (pend.owner === this.p && !resolves) {
      // La mia terra sta per essere annullata: rispondo se vale molto
      const gain = this.playValue(this.p, pend.land, pend.target);
      want = gain >= 1000 || gain >= 18;
    }
    if (!want) return { type: 'allow' };
    others.sort((a, b) => this.keepValue(a) - this.keepValue(b));
    return { type: 'counter', other: others[0] };
  }

  counterOthers() {
    const hand = this.me.hand;
    const u = hand.filter((c) => c === 'U').length;
    if (!u) return [];
    return TYPES.filter((t) => (t === 'U' ? u >= 2 : hand.includes(t)));
  }

  decideChoice() {
    const g = this.g, c = g.choice;
    let best = c.options[0];
    if (c.kind === 'discard') {
      // Mano rivelata dalla Palude: togli la carta più utile all'avversario
      const val = (t) => {
        let v = cardValue(this.op.bf, t);
        if (t === 'U') v += 4;
        if (t === 'R' && distinct(this.me.bf) >= 3) v += 3;
        return v;
      };
      best = c.options.slice().sort((a, b) => val(b) - val(a))[0];
    } else if (c.kind === 'destroy') {
      best = bestDestroy(this.op.bf).target || best;
    } else if (c.kind === 'regrow') {
      best = bestRegrow(this.me.bf, this.me.gy).target || best;
    }
    return { type: 'choose', choice: best };
  }
}

module.exports = { Bot, score, need, wins };
