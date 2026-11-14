// Verifica che allo scadere del tempo il server passi il turno da solo.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');
const PORT = 3998;
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, TIME_SCALE: '0.02' }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { ws, state: null, joined: null };
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.t === 'state') c.state = m; if (m.t === 'joined') c.joined = m; };
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = new Promise((r) => (ws.onopen = r));
  return c;
}
async function until(fn, ms = 4000) { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await sleep(10); } }
(async () => {
  try {
    await sleep(400);
    const a = client(), b = client();
    await Promise.all([a.open, b.open]);
    a.send({ t: 'create', name: 'Anna', turnTime: 30 });
    await until(() => a.joined);
    b.send({ t: 'join', code: a.joined.code, name: 'Bruno' });
    await until(() => a.state && a.state.game);
    assert.strictEqual(a.state.turnTime, 30);
    assert.ok(a.state.timer && a.state.timer.total === 30);
    const first = a.state.game.active;
    await until(() => a.state.game.turn >= 2, 5000); // 30s * 0.02 ≈ 0.6s + animazione
    assert.notStrictEqual(a.state.game.active, first);
    assert.ok(a.state.game.log.some((l) => l.includes('Tempo scaduto')));
    console.log('Timer ok');
  } catch (e) { console.error('Timer FAIL', e); process.exitCode = 1; }
  finally { srv.kill(); setTimeout(() => process.exit(), 100); }
})();
