// Test della classifica della sfida del giorno: il server rigioca le partite e rifiuta quelle truccate.
'use strict';
const assert = require('assert');
const os = require('os');
const path = require('path');
process.env.CLASSIFICA_FILE = path.join(os.tmpdir(), 'atlas-classifica-test-' + process.pid + '.json');
process.env.STORE_FILE = path.join(os.tmpdir(), 'atlas-store-test-' + process.pid + '.json');
delete process.env.UPSTASH_REDIS_REST_URL;
const { Game } = require('../game');
const { Bot } = require('../bot');
const { dailyOpts, dailyScenario } = require('../hub');
const Classifica = require('../classifica');
const Account = require('../account');
const acct = async (m, ip = '1.2.3.4') => Account.handle('POST', JSON.stringify(m), ip);

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok  ', name); }
  catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; }
}
const dayAt = (k) => new Date(Date.now() + k * 86400000).toISOString().slice(0, 10);
const today = dayAt(0);
// una partita vinta dal «giocatore» in uno dei giorni accettati (ieri, oggi, domani)
function wonGame() {
  for (let k = 0; k < 300; k++) {
    const day = dayAt((k % 3) - 1);
    const r = play(day);
    if (r.g.winner === 0) return { ...r, day };
  }
  throw new Error('nessuna vittoria nelle prove');
}

// Una partita del giorno giocata dal computer per entrambi, con l'elenco delle mosse (come l'app).
function play(day) {
  const g = new Game(['Tu', 'BOT'], dailyOpts(day));
  const steps = [];
  for (let n = 0; g.phase === 'playing' && n < 2000; n++) {
    const p = g.actor();
    let a = new Bot(g, p, { level: 'normal' }).decide();
    // il «giocatore» ogni tanto gioca una carta a caso: partite diverse a ogni prova
    const v = g.view(p);
    if (p === 0 && g.step === 'main' && v.playable && Math.random() < 0.35) {
      const cards = Object.keys(v.playable);
      if (cards.length) {
        const c = cards[Math.floor(Math.random() * cards.length)], tg = v.playable[c];
        a = { type: 'play', card: c };
        if (tg && tg.length) a.target = tg[Math.floor(Math.random() * tg.length)];
        else if (tg && !tg.length) a = { type: 'pass' };
      }
    }
    if (!a || g.act(p, a)) { a = g.step === 'main' ? { type: 'pass' } : { type: 'allow' }; assert.strictEqual(g.act(p, a), null); }
    steps.push({ p, a });
  }
  return { g, steps };
}

(async () => {
  await test('la situazione del giorno rispetta le regole', () => {
    for (let i = 0; i < 200; i++) {
      const s = dailyScenario('2026-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0') + 'x' + i);
      for (const su of s.setup) {
        const kinds = Object.keys(su.bf);
        assert.ok(kinds.length <= 3 && Object.values(su.bf).every((n) => n <= 3), 'nessuno parte vincente');
        assert.ok(su.hand >= 3 && su.hand <= 6);
      }
    }
  });

  await test('partite rigiocate dal server: vittoria accettata, sconfitta riconosciuta', async () => {
    let won = 0, lost = 0;
    for (let k = 0; k < 300 && (won < 2 || lost < 1); k++) {
      const day = '2026-12-' + String(1 + (k % 28)).padStart(2, '0');
      const { g, steps } = play(day);
      const r = Classifica.replay(day, steps);
      if (g.winner === 0) { assert.deepStrictEqual(r, { turns: g.turn }); won++; }
      else { assert.ok(r.lost, 'sconfitta'); lost++; }
    }
    assert.ok(won > 0, 'almeno una vittoria nelle prove');
  });

  await test('mosse truccate rifiutate', () => {
    const res = wonGame();
    const steps = JSON.parse(JSON.stringify(res.steps));
    // partita non finita (mosse tolte), carta che non si ha, mosse di un altro giorno
    assert.ok(Classifica.replay(res.day, steps.slice(0, -3)).error);
    const i = steps.findIndex((s) => s.p === 0 && s.a.type === 'play');
    const fake = JSON.parse(JSON.stringify(steps));
    fake[i].a.card = ['W', 'U', 'B', 'R', 'G'].find((t) => !res.g.players[0].hand.includes(t) && t !== steps[i].a.card) || 'X';
    assert.ok(Classifica.replay(res.day, fake).error, 'carta inventata');
    const other = Classifica.replay(dayAt(5), steps);
    assert.ok(other.error || other.lost, 'le mosse valgono solo per quel giorno');
  });

  await test('account ospite: nome unico, cambio nome, profilo salvato', async () => {
    const g1 = (await acct({ a: 'create' })).body;
    assert.match(g1.name, /^Ospite\d{4}$/);
    assert.ok(g1.id && g1.token);
    const anna = (await acct({ a: 'create', name: 'Anna', profile: { cpu: { won: 3 } } })).body;
    assert.strictEqual(anna.name, 'Anna', 'il nome che si usava già');
    const anna2 = (await acct({ a: 'create', name: 'anna' })).body;
    assert.match(anna2.name, /^Ospite/, 'nome già preso: si diventa ospite');
    assert.strictEqual(anna2.taken, 'anna');
    let r = await acct({ a: 'rename', id: g1.id, token: g1.token, name: 'ANNA' });
    assert.strictEqual(r.status, 409, 'nome di un altro');
    r = await acct({ a: 'rename', id: g1.id, token: 'sbagliata', name: 'Carlo' });
    assert.strictEqual(r.status, 401, 'chiave sbagliata');
    r = await acct({ a: 'rename', id: g1.id, token: g1.token, name: 'Carlo' });
    assert.strictEqual(r.body.name, 'Carlo');
    r = await acct({ a: 'create', name: g1.name });
    assert.strictEqual(r.body.name, r.body.name.startsWith('Ospite') ? r.body.name : null, 'i nomi da ospite non si scelgono');
    r = await acct({ a: 'rename', id: anna.id, token: anna.token, name: 'Anna Maria' });
    r = await acct({ a: 'rename', id: g1.id, token: g1.token, name: 'anna' });
    assert.strictEqual(r.body.name, 'anna', 'il nome lasciato libero si può prendere');
    assert.strictEqual((await acct({ a: 'save', id: g1.id, token: g1.token, profile: { cpu: { won: 5 } } })).body.ok, true);
    assert.deepStrictEqual((await acct({ a: 'load', id: g1.id, token: g1.token })).body, { name: 'anna', profile: { cpu: { won: 5 } } });
    let limited = false;
    for (let i = 0; i < 25; i++) if ((await acct({ a: 'create' }, '9.9.9.9')).status === 429) limited = true;
    assert.ok(limited, 'troppi account dallo stesso indirizzo');
  });

  await test('invio e classifica: meno turni vince, un account conta una volta', async () => {
    const res = wonGame();
    const a1 = (await acct({ a: 'create', name: 'Dora' }, '5.5.5.5')).body;
    const b1 = (await acct({ a: 'create', name: 'Bruno' }, '5.5.5.5')).body;
    const send = (acc, steps) => Classifica.handle('POST', new URLSearchParams(), JSON.stringify({ day: res.day, id: acc.id, token: acc.token, steps }));
    const a = await send(a1, res.steps);
    assert.strictEqual(a.status, 200);
    assert.strictEqual(a.body.ok, true);
    assert.strictEqual(a.body.me.rank, 1);
    await send(a1, res.steps); // stesso account: una riga sola
    const b = await send(b1, res.steps);
    assert.strictEqual(b.body.total, 2);
    assert.strictEqual(b.body.me.rank, 2, 'a parità di turni vale chi arriva prima');
    const v = await Classifica.handle('GET', new URLSearchParams({ day: res.day, id: b1.id }), '');
    assert.deepStrictEqual(v.body.top.map((e) => e.name), ['Dora', 'Bruno']);
    assert.strictEqual(v.body.me.rank, 2);
    const noacc = await Classifica.handle('POST', new URLSearchParams(), JSON.stringify({ day: res.day, name: 'Dora', steps: res.steps }));
    assert.strictEqual(noacc.status, 401, 'senza account non si entra');
    const fake = await send({ id: a1.id, token: 'x' }, res.steps);
    assert.strictEqual(fake.status, 401, 'chiave sbagliata');
    const old = await Classifica.handle('POST', new URLSearchParams(), JSON.stringify({ day: '2020-01-01', id: a1.id, token: a1.token, steps: res.steps }));
    assert.strictEqual(old.status, 400, 'sfide vecchie rifiutate');
  });

  require('fs').rmSync(process.env.CLASSIFICA_FILE, { force: true });
  require('fs').rmSync(process.env.STORE_FILE, { force: true });
  console.log(`\n${passed} test della classifica superati`);
})();
