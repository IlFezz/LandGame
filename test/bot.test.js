// Test del computer: scelte sensate in situazioni chiave + partita completa via server.
'use strict';
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const { Game } = require('../game');
const { Bot } = require('../bot');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok  ', name); }
  catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; }
}
function setup({ h0 = [], h1 = [], bf0 = {}, bf1 = {}, gy0 = {}, gy1 = {} } = {}) {
  const g = new Game(['Umano', 'Bot'], { firstPlayer: 0 });
  const set = (pl, hand, bf, gy) => {
    pl.hand = hand.slice();
    pl.bf = { W: 0, U: 0, B: 0, R: 0, G: 0, ...bf };
    pl.gy = { W: 0, U: 0, B: 0, R: 0, G: 0, ...gy };
  };
  set(g.players[0], h0, bf0, gy0);
  set(g.players[1], h1, bf1, gy1);
  return g;
}
const botTurn = (g) => { g.active = 1; g.step = 'main'; g.landPlayed = false; };
const ok = (r) => assert.strictEqual(r, null, r);

test('gioca la terra che fa vincere', () => {
  const g = setup({ h1: ['R', 'G', 'U'], bf1: { W: 1, U: 1, B: 1, R: 1 }, bf0: { G: 1 } });
  botTurn(g);
  assert.deepStrictEqual(new Bot(g, 1).decide(), { type: 'play', card: 'G', target: undefined });
});

test('contrasta sempre una terra che fa vincere l\'avversario', () => {
  const g = setup({ h0: ['G'], h1: ['U', 'W'], bf0: { W: 1, U: 1, B: 1, R: 1 } });
  ok(g.act(0, { type: 'play', card: 'G' }));
  assert.strictEqual(new Bot(g, 1).decide().type, 'counter');
});

test('non spreca il contrasto su un\'Isola innocua a inizio partita', () => {
  const g = setup({ h0: ['U', 'W'], h1: ['U', 'B', 'R'] });
  ok(g.act(0, { type: 'play', card: 'U' }));
  assert.deepStrictEqual(new Bot(g, 1).decide(), { type: 'allow' });
});

test('la Montagna distrugge la terra che spezza il dominio avversario', () => {
  const g = setup({ h1: ['R'], bf0: { W: 1, U: 1, B: 1, G: 3 } });
  botTurn(g);
  const a = new Bot(g, 1).decide();
  assert.strictEqual(a.card, 'R');
  assert.ok(['W', 'U', 'B'].includes(a.target), a.target);
});

test('con la Palude fa scartare la terra che darebbe la vittoria', () => {
  const g = setup({ h0: ['G', 'W'], h1: ['B'], bf0: { W: 1, U: 1, B: 1, R: 1 } });
  botTurn(g);
  ok(g.act(1, { type: 'play', card: 'B' }));
  if (g.step === 'response') ok(g.act(0, { type: 'allow' }));
  assert.strictEqual(g.step, 'choice');
  assert.deepStrictEqual(new Bot(g, 1).decide(), { type: 'choose', choice: 'G' });
});

test('per contrastare scarta la carta meno utile', () => {
  const g = setup({ h0: ['G'], h1: ['U', 'G', 'W'], bf0: { W: 1, U: 1, B: 1, R: 1 }, bf1: { W: 1, U: 1, B: 1, R: 1 } });
  ok(g.act(0, { type: 'play', card: 'G' }));
  const a = new Bot(g, 1).decide();
  assert.strictEqual(a.type, 'counter');
  assert.strictEqual(a.other, 'W'); // tiene la Foresta che gli darà la vittoria
});

test('non gioca la Montagna a vuoto se ha di meglio', () => {
  const g = setup({ h1: ['R', 'G'], bf1: { W: 1 }, gy1: { B: 1 } });
  botTurn(g);
  assert.strictEqual(new Bot(g, 1).decide().card, 'G');
});

test('batte quasi sempre un giocatore casuale', () => {
  let wins = 0;
  for (let i = 0; i < 300; i++) {
    const g = new Game(['B', 'R']); const bot = new Bot(g, 0);
    while (g.phase === 'playing') {
      const p = g.actor();
      let a;
      if (p === 0) a = bot.decide();
      else {
        const v = g.view(1);
        if (g.step === 'main') { const cs = Object.keys(v.playable); const c = cs[Math.floor(Math.random() * cs.length)]; a = c ? { type: 'play', card: c, target: (v.playable[c] || [])[0] } : { type: 'pass' }; }
        else if (g.step === 'response') a = { type: 'allow' };
        else a = { type: 'choose', choice: v.choice.options[0] };
      }
      ok(g.act(p, a));
    }
    if (g.winner === 0) wins++;
  }
  assert.ok(wins > 250, `vittorie ${wins}/300`);
});

test('il livello normale batte spesso il facile', () => {
  let w = 0;
  for (let i = 0; i < 300; i++) {
    const g = new Game(['N', 'F']); const b = [new Bot(g, 0), new Bot(g, 1, { level: 'easy' })];
    while (g.phase === 'playing') { const p = g.actor(); ok(g.act(p, b[p].decide())); }
    if (g.winner === 0) w++;
  }
  assert.ok(w > 180, `vittorie del normale ${w}/300`);
});

// ---- Partita contro il computer attraverso il server ----
const PORT = 3997;
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, TIME_SCALE: '0.01' }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await sleep(5); } }
(async () => {
  try {
    await sleep(400);
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    let st = null; const errors = [];
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'state') st = m; if (m.t === 'error') errors.push(m.msg); };
    await new Promise((r) => (ws.onopen = r));
    const send = (m) => ws.send(JSON.stringify(m));
    send({ t: 'bot', name: 'Claudio', turnTime: 0, speed: 1 });
    await until(() => st && st.game);
    assert.ok(st.vsBot && st.seats[1].bot && st.seats[1].connected);
    for (let round = 0; round < 2; round++) {
      let guard = 0;
      while (st.game.phase === 'playing') {
        const g = st.game;
        const mine = (g.step === 'main' && g.active === 0) || (g.step === 'response' && g.pending.responder === 0) || (g.step === 'choice' && g.choice.player === 0);
        if (mine) {
          const before = st;
          let a;
          if (g.step === 'main') { const cs = Object.keys(g.playable); const c = cs[0]; a = c ? { type: 'play', card: c, target: (g.playable[c] || [])[0] } : { type: 'pass' }; }
          else if (g.step === 'response') a = { type: 'allow' };
          else a = { type: 'choose', choice: g.choice.options[0] };
          send({ t: 'action', a });
          await until(() => st !== before);
        } else await sleep(5);
        if (++guard > 20000) throw new Error('bloccata');
      }
      assert.deepStrictEqual(errors, []);
      console.log(`ok   partita contro il computer ${round + 1}: ${st.game.log.slice(-1)[0]}`);
      send({ t: 'rematch' });
      await until(() => st.game.phase === 'playing' && st.game.turn <= 2);
    }
    console.log(`\n${passed} test del computer superati`);
  } catch (e) { console.error('FAIL server bot', e); process.exitCode = 1; }
  finally { srv.kill(); setTimeout(() => process.exit(), 100); }
})();
