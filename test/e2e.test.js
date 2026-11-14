// Avvia il server e gioca partite complete con due client WebSocket reali.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');
const PORT = 3999;

const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT }, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { ws, state: null, joined: null, errors: [], waiters: [] };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'state') c.state = m;
    if (m.t === 'joined') c.joined = m;
    if (m.t === 'error') c.errors.push(m.msg);
    c.waiters.splice(0).forEach((f) => f());
  };
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = new Promise((r) => (ws.onopen = r));
  c.next = () => new Promise((r) => c.waiters.push(r));
  return c;
}
async function until(fn, ms = 3000) {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await sleep(5); }
}

function pickAction(v) {
  if (v.step === 'main') {
    const cards = Object.keys(v.playable);
    if (!cards.length) return { type: 'pass' };
    const c = cards[Math.floor(Math.random() * cards.length)];
    const t = v.playable[c];
    return { type: 'play', card: c, target: t && t.length ? t[0] : undefined };
  }
  if (v.step === 'response') return v.counterOthers.length && Math.random() < 0.4 ? { type: 'counter', other: v.counterOthers[0] } : { type: 'allow' };
  return { type: 'choose', choice: v.choice.options[0] };
}
function myTurn(v) {
  if (v.phase !== 'playing') return false;
  if (v.step === 'main') return v.active === v.you;
  if (v.step === 'response') return v.pending.responder === v.you;
  return v.choice.player === v.you;
}

(async () => {
  try {
    await sleep(400);
    const a = client(), b = client();
    await Promise.all([a.open, b.open]);
    a.send({ t: 'create', name: 'Anna', turnTime: 0 });
    await until(() => a.joined);
    const code = a.joined.code;
    assert.match(code, /^[A-Z0-9]{4}$/);
    assert.strictEqual(a.state.game, null);

    b.send({ t: 'join', code: 'ZZZZ', name: 'X' });
    await until(() => b.errors.length);
    b.errors.length = 0;
    b.send({ t: 'join', code: code.toLowerCase(), name: 'Bruno' });
    await until(() => b.joined && a.state.game && b.state.game);
    assert.strictEqual(a.state.game.me.name, 'Anna');
    assert.strictEqual(b.state.game.me.name, 'Bruno');
    assert.strictEqual(a.state.game.opp.handCount, 5);
    assert.ok(!('hand' in a.state.game.opp), 'la mano avversaria non deve essere inviata');

    // Un terzo giocatore non può entrare
    const c = client(); await c.open;
    c.send({ t: 'join', code, name: 'Carlo' });
    await until(() => c.errors.length);
    assert.match(c.errors[0], /piena/);
    c.ws.close();

    for (let game = 0; game < 3; game++) {
      let steps = 0;
      while (a.state.game.phase === 'playing') {
        const actor = myTurn(a.state.game) ? a : b;
        const before = JSON.stringify(actor.state.game.log);
        actor.send({ t: 'action', a: pickAction(actor.state.game) });
        await until(() => JSON.stringify(actor.state.game.log) !== before || actor.state.game.phase !== 'playing' || actor.errors.length);
        await sleep(2);
        assert.deepStrictEqual(actor.errors, []);
        if (++steps > 500) throw new Error('troppi passi');
      }
      await until(() => b.state.game.phase === 'over');
      console.log(`partita ${game + 1}: ${a.state.game.log.slice(-1)[0]} (${steps} azioni)`);

      // Riconnessione di Bruno con il token durante la schermata finale
      const token = b.joined.token;
      b.ws.close();
      await until(() => a.state.seats[1].connected === false);
      const b2 = client(); await b2.open;
      b2.send({ t: 'join', code, token });
      await until(() => b2.state && b2.state.seat === 1);
      Object.assign(b, { ws: b2.ws, send: b2.send }); b2.ws.onmessage = b.ws.onmessage = null;
      b2.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.t === 'state') b.state = m; if (m.t === 'joined') b.joined = m; if (m.t === 'error') b.errors.push(m.msg); };
      b.state = b2.state; b.joined = b2.joined;
      await until(() => a.state.seats[1].connected === true);

      // Rivincita
      a.send({ t: 'rematch' });
      await until(() => b.state.rematch[0]);
      b.send({ t: 'rematch' });
      await until(() => a.state.game.phase === 'playing' && a.state.game.turn === 1 && b.state.game.phase === 'playing');
    }
    console.log('E2E ok');
  } catch (e) {
    console.error('E2E FAIL', e);
    process.exitCode = 1;
  } finally {
    srv.kill();
    setTimeout(() => process.exit(), 100);
  }
})();
