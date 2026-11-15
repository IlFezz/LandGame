// Il tutorial: seguendo i suggerimenti si vince all'11° turno con cinque tipi di terra.
'use strict';
const assert = require('assert');
const { Hub } = require('../hub');

// le mosse che il tutorial chiede al giocatore, turno per turno
const PLAN = {
  1: { main: { type: 'play', card: 'U' } },
  2: { response: { type: 'allow' } },
  3: { main: { type: 'play', card: 'G', target: 'U' } },
  4: { response: { type: 'allow' } },
  5: { main: { type: 'play', card: 'R', target: 'B' } },
  6: { response: { type: 'counter', other: 'R' } },
  7: { main: { type: 'play', card: 'W', target: 'R' }, choice: 'first' },
  8: { response: { type: 'allow' } },
  9: { main: { type: 'play', card: 'U' } },
  10: { response: { type: 'allow' } },
  11: { main: { type: 'play', card: 'B' } },
};

const hub = new Hub({ local: true, timeScale: 0.001 });
let last = null, errors = [];
const conn = { send: (m) => { if (m.t === 'state') last = m; if (m.t === 'error') errors.push(m.msg); } };
hub.message(conn, { t: 'tutorial', name: 'Tu' });

const done = new Promise((resolve, reject) => {
  const tick = setInterval(() => {
    const g = last && last.game;
    if (!g) return;
    if (g.phase === 'over') { clearInterval(tick); return resolve(g); }

    const step = PLAN[g.turn] || {};
    let a = null;
    if (g.step === 'main' && g.active === 0) a = step.main;
    else if (g.step === 'response' && g.pending.responder === 0) a = step.response || { type: 'allow' };
    else if (g.step === 'choice' && g.choice.player === 0) a = { type: 'choose', choice: g.choice.options[0] };
    if (!a) return;
    const key = `${g.turn}|${g.step}`;
    if (tick.key === key) return; tick.key = key;
    hub.message(conn, { t: 'action', a });
  }, 5);
  setTimeout(() => { clearInterval(tick); reject(new Error('tutorial bloccato al turno ' + (last && last.game.turn) + ' ' + (last && last.game.step))); }, 8000);
});

done.then((g) => {
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(g.winner, 0, 'deve vincere il giocatore');
  assert.strictEqual(g.turn, 11);
  if (process.env.LOG) console.log(hub.rooms.values().next().value.game.log.join('\n'));
  console.log('ok   tutorial vinto al turno', g.turn, '–', g.endText);
  process.exit(0);
}).catch((e) => { console.error('FALLITO', e.message, errors); process.exit(1); });
