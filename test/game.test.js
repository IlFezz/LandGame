'use strict';
const assert = require('assert');
const { Game, TYPES } = require('../game');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok  ', name); }
  catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; }
}

// Prepara una partita con mani/campo controllati. Turno 1 di P0 in fase main.
function setup({ h0 = [], h1 = [], bf0 = {}, bf1 = {}, gy0 = {}, gy1 = {}, deck0, deck1 } = {}) {
  const g = new Game(['Anna', 'Bruno'], { firstPlayer: 0 });
  const set = (pl, hand, bf, gy, deck) => {
    pl.hand = hand.slice();
    pl.bf = { W: 0, U: 0, B: 0, R: 0, G: 0, ...bf };
    pl.gy = { W: 0, U: 0, B: 0, R: 0, G: 0, ...gy };
    if (deck) pl.deck = deck.slice();
  };
  set(g.players[0], h0, bf0, gy0, deck0);
  set(g.players[1], h1, bf1, gy1, deck1);
  return g;
}
const ok = (r) => assert.strictEqual(r, null, r);

test('setup: 5 carte in mano, 45 nel mazzo, chi inizia non pesca', () => {
  const g = new Game(['A', 'B'], { firstPlayer: 1 });
  assert.strictEqual(g.players[1].hand.length, 5);
  assert.strictEqual(g.players[0].hand.length, 5);
  assert.strictEqual(g.players[0].deck.length, 45);
  assert.strictEqual(g.active, 1);
  ok(g.act(1, { type: 'pass' }));
  assert.strictEqual(g.players[0].hand.length, 6); // il secondo pesca
});

test('mazzo composto da 10 terre per tipo', () => {
  const g = new Game(['A', 'B']);
  const all = g.players[0].deck.concat(g.players[0].hand);
  for (const t of TYPES) assert.strictEqual(all.filter((c) => c === t).length, 10);
});

test('una sola terra per turno e solo nel proprio turno', () => {
  const g = setup({ h0: ['G', 'G'], h1: ['R'] });
  assert.ok(g.act(1, { type: 'play', card: 'R' }));
  ok(g.act(0, { type: 'play', card: 'G' })); // Bruno ha 1 carta: niente risposta, risolve
  assert.strictEqual(g.active, 1);
  assert.strictEqual(g.players[0].bf.G, 1);
});

test('Isola giocata: pesca una carta', () => {
  const g = setup({ h0: ['U'], deck0: ['R', 'B'] });
  ok(g.act(0, { type: 'play', card: 'U' }));
  assert.deepStrictEqual(g.players[0].hand, ['B']);
});

test('Montagna distrugge la terra avversaria', () => {
  const g = setup({ h0: ['R'], bf1: { G: 2 } });
  assert.ok(g.act(0, { type: 'play', card: 'R' })); // serve bersaglio
  ok(g.act(0, { type: 'play', card: 'R', target: 'G' }));
  assert.strictEqual(g.players[1].bf.G, 1);
  assert.strictEqual(g.players[1].gy.G, 1);
});

test('Montagna senza bersagli si gioca comunque', () => {
  const g = setup({ h0: ['R'] });
  ok(g.act(0, { type: 'play', card: 'R' }));
  assert.strictEqual(g.players[0].bf.R, 1);
});

test('Foresta recupera dal cimitero', () => {
  const g = setup({ h0: ['G'], gy0: { B: 1 } });
  ok(g.act(0, { type: 'play', card: 'G', target: 'B' }));
  assert.strictEqual(g.players[0].gy.B, 0);
  assert.ok(g.players[0].hand.includes('B'));
});

test('Palude: guarda la mano e scarta una terra', () => {
  const g = setup({ h0: ['B'], h1: ['U'] });
  ok(g.act(0, { type: 'play', card: 'B' }));
  assert.strictEqual(g.step, 'choice');
  assert.deepStrictEqual(g.view(0).choice.revealed, ['U']);
  assert.strictEqual(g.view(1).choice.revealed, undefined);
  ok(g.act(0, { type: 'choose', choice: 'U' }));
  assert.strictEqual(g.players[1].gy.U, 1);
  assert.strictEqual(g.active, 1);
});

test('Pianura riattiva Montagna (bersaglio scelto alla risoluzione)', () => {
  const g = setup({ h0: ['W'], bf0: { R: 1 }, bf1: { U: 1, B: 1 } });
  ok(g.act(0, { type: 'play', card: 'W', target: 'R' }));
  assert.strictEqual(g.step, 'choice');
  assert.deepStrictEqual(g.choice.options, ['U', 'B']);
  ok(g.act(0, { type: 'choose', choice: 'B' }));
  assert.strictEqual(g.players[1].bf.B, 0);
});

test('Pianura non può bersagliare Pianure', () => {
  const g = setup({ h0: ['W'], bf0: { W: 2 } });
  assert.deepStrictEqual(g.targetsFor(0, 'W'), []);
  ok(g.act(0, { type: 'play', card: 'W' }));
});

test('Pianura riattiva Isola: pesca', () => {
  const g = setup({ h0: ['W'], bf0: { U: 1 }, deck0: ['G'] });
  ok(g.act(0, { type: 'play', card: 'W', target: 'U' }));
  assert.deepStrictEqual(g.players[0].hand, ['G']);
});

test('Contrasto: Isola + altra terra annullano la terra e il suo effetto', () => {
  const g = setup({ h0: ['R'], h1: ['U', 'G', 'B'], bf1: { W: 1 } });
  ok(g.act(0, { type: 'play', card: 'R', target: 'W' }));
  assert.strictEqual(g.step, 'response');
  assert.deepStrictEqual(g.view(1).counterOthers, ['B', 'G']);
  ok(g.act(1, { type: 'counter', other: 'G' }));
  // Anna ha 0 carte: non può controbattere → risolve
  assert.strictEqual(g.players[0].bf.R, 0);
  assert.strictEqual(g.players[0].gy.R, 1);
  assert.strictEqual(g.players[1].bf.W, 1);
  assert.deepStrictEqual(g.players[1].gy, { W: 0, U: 1, B: 0, R: 0, G: 1 });
  assert.strictEqual(g.active, 1);
});

test('Contrasto al contrasto: la terra originale risolve', () => {
  const g = setup({ h0: ['R', 'U', 'W'], h1: ['U', 'G'], bf1: { W: 1 } });
  ok(g.act(0, { type: 'play', card: 'R', target: 'W' }));
  ok(g.act(1, { type: 'counter', other: 'G' }));
  assert.strictEqual(g.pending.responder, 0);
  ok(g.act(0, { type: 'counter', other: 'W' }));
  assert.strictEqual(g.players[0].bf.R, 1);
  assert.strictEqual(g.players[1].bf.W, 0);
});

test('Lasciar risolvere', () => {
  const g = setup({ h0: ['G'], h1: ['U', 'U'] });
  ok(g.act(0, { type: 'play', card: 'G' }));
  ok(g.act(1, { type: 'allow' }));
  assert.strictEqual(g.players[0].bf.G, 1);
});

test('Contrasto con due Isole', () => {
  const g = setup({ h0: ['G'], h1: ['U', 'U'] });
  ok(g.act(0, { type: 'play', card: 'G' }));
  ok(g.act(1, { type: 'counter', other: 'U' }));
  assert.strictEqual(g.players[1].gy.U, 2);
});

test('Finestra di risposta anche senza Isola (non rivela la mano)', () => {
  const g = setup({ h0: ['G'], h1: ['R', 'B'] });
  ok(g.act(0, { type: 'play', card: 'G' }));
  assert.strictEqual(g.step, 'response');
  assert.deepStrictEqual(g.view(1).counterOthers, []);
  assert.ok(g.act(1, { type: 'counter', other: 'R' }));
});

test('Vittoria con dominio', () => {
  const g = setup({ h0: ['G'], bf0: { W: 1, U: 1, B: 1, R: 1 } });
  ok(g.act(0, { type: 'play', card: 'G' }));
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.winner, 0);
});

test('Vittoria con 5 dello stesso tipo, prima che l\'effetto si risolva', () => {
  const g = setup({ h0: ['R'], bf0: { R: 4 }, bf1: { G: 1 } });
  ok(g.act(0, { type: 'play', card: 'R', target: 'G' }));
  assert.strictEqual(g.winner, 0);
  assert.strictEqual(g.players[1].bf.G, 1);
});

test('Terra contrastata non fa vincere', () => {
  const g = setup({ h0: ['G'], h1: ['U', 'B'], bf0: { W: 1, U: 1, B: 1, R: 1 } });
  ok(g.act(0, { type: 'play', card: 'G' }));
  ok(g.act(1, { type: 'counter', other: 'B' }));
  assert.strictEqual(g.phase, 'playing');
});

test('Mazzo vuoto: non si pesca e si continua', () => {
  const g = setup({ h0: ['G'], h1: ['R'], deck0: [], deck1: ['W'] });
  ok(g.act(0, { type: 'pass' }));
  assert.strictEqual(g.players[1].hand.length, 2);
  ok(g.act(1, { type: 'pass' }));
  assert.strictEqual(g.phase, 'playing');
  assert.strictEqual(g.active, 0);
});

test('Carte finite: vince chi ha più tipi distinti', () => {
  const g = setup({ h0: ['G'], h1: [], deck0: [], deck1: [], bf0: { W: 1 }, bf1: { W: 1, U: 1 } });
  ok(g.act(0, { type: 'play', card: 'G' }));
  // Bruno: mano vuota, mazzo vuoto → passa da solo; poi Anna: mani entrambe vuote → fine
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.endReason, 'cards');
  assert.strictEqual(g.winner, null === g.winner ? null : g.winner);
  // 2 tipi a 2: parità, vince chi ha giocato l'ultima terra (Anna)
  assert.strictEqual(g.winner, 0);
});

test('Carte finite: due passaggi consecutivi a mazzi vuoti chiudono la partita', () => {
  const g = setup({ h0: ['U'], h1: ['U'], deck0: [], deck1: [], bf0: { W: 1, R: 1, G: 1 }, bf1: { B: 1 } });
  ok(g.act(0, { type: 'pass' }));
  ok(g.act(1, { type: 'pass' }));
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.winner, 0);
});

test('Passaggi a mazzo pieno non chiudono la partita quando i mazzi finiscono', () => {
  const g = setup({ h0: ['B', 'B'], h1: ['B', 'B'], deck0: [], deck1: ['G'] });
  ok(g.act(0, { type: 'pass' }));
  ok(g.act(1, { type: 'pass' })); // Bruno ha pescato l'ultima carta
  assert.strictEqual(g.phase, 'playing');
});

test('Partite casuali complete senza errori e con 100 carte conservate', () => {
  for (let n = 0; n < 2000; n++) {
    const g = new Game(['A', 'B']);
    let guard = 0;
    while (g.phase === 'playing' && guard++ < 2000) {
      // giocatore che deve agire
      let p = g.active;
      if (g.step === 'response') p = g.pending.responder;
      if (g.step === 'choice') p = g.choice.player;
      const v = g.view(p);
      let a;
      if (g.step === 'main') {
        const cards = Object.keys(v.playable);
        if (!cards.length || Math.random() < 0.1) a = { type: 'pass' };
        else {
          const c = cards[Math.floor(Math.random() * cards.length)];
          const t = v.playable[c];
          a = { type: 'play', card: c, target: t && t.length ? t[Math.floor(Math.random() * t.length)] : undefined };
        }
      } else if (g.step === 'response') {
        a = v.counterOthers.length && Math.random() < 0.5 ? { type: 'counter', other: v.counterOthers[0] } : { type: 'allow' };
      } else {
        a = { type: 'choose', choice: v.choice.options[0] };
      }
      ok(g.act(p, a));
      let total = 0;
      for (const pl of g.players) total += pl.deck.length + pl.hand.length + TYPES.reduce((s, t) => s + pl.bf[t] + pl.gy[t], 0);
      if (g.pending && g.pending.counters >= 0 && g.phase === 'playing' && g.step === 'response') total += 1;
      assert.strictEqual(total, 100);
    }
    assert.strictEqual(g.phase, 'over', 'partita non terminata');
  }
});

test('Eventi: giocata, contrasto e annullamento in ordine', () => {
  const g = setup({ h0: ['R'], h1: ['U', 'G'], bf1: { W: 1 } });
  g.takeEvents();
  ok(g.act(0, { type: 'play', card: 'R', target: 'W' }));
  ok(g.act(1, { type: 'counter', other: 'G' }));
  const types = g.takeEvents().map((e) => e.ev.type);
  assert.deepStrictEqual(types.slice(0, 3), ['play', 'counter', 'countered']);
  assert.ok(types.includes('turn') && types.includes('draw'));
});

test('Eventi: ogni passo porta le viste di entrambi i giocatori', () => {
  const g = setup({ h0: ['U'], deck0: ['B'] });
  g.takeEvents();
  ok(g.act(0, { type: 'play', card: 'U' }));
  const ev = g.takeEvents();
  const draw = ev.find((e) => e.ev.type === 'draw' && e.ev.player === 0);
  assert.strictEqual(draw.ev.card, 'B');
  assert.deepStrictEqual(draw.views[0].hand, ['B']);
  assert.strictEqual(draw.views[1].opp.handCount, 1);
});

test('Tempo scaduto: passa il turno / lascia risolvere / sceglie a caso', () => {
  const g = setup({ h0: ['B', 'R'], h1: ['U', 'G'] });
  g.autoAct(); // P0 in main → passa
  assert.strictEqual(g.active, 1);
  ok(g.act(1, { type: 'play', card: 'G' }));
  assert.strictEqual(g.step, 'response');
  g.autoAct(); // P0 deve rispondere → lascia risolvere
  assert.strictEqual(g.players[1].bf.G, 1);
  ok(g.act(0, { type: 'play', card: 'B' }));
  if (g.step === 'response') g.autoAct();
  assert.strictEqual(g.step, 'choice');
  g.autoAct();
  assert.strictEqual(g.active, 1);
});

console.log(`\n${passed} test superati`);
