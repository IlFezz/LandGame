'use strict';
// =====================================================================
//  Obiettivi: traguardi del profilo. Alcuni sbloccano un dorso o un tavolo.
//  Si controllano a fine partita (Stats.finish) con i dati della partita appena giocata.
// =====================================================================
const Goals = {
  // reward: { kind: 'back' | 'table', id, name }
  LIST: [
    { id: 'prima', name: 'Prima vittoria', desc: 'Vinci una partita.', reward: { kind: 'back', id: 'sestante', name: 'dorso Sestante' } },
    { id: 'dominio', name: 'Dominio', desc: 'Vinci con cinque terre diverse.' },
    { id: 'cinqueuguali', name: 'Cinque di un tipo', desc: 'Vinci con cinque terre uguali.' },
    { id: 'cinqueforeste', name: 'Cinque Foreste', desc: 'Vinci con cinque Foreste.', reward: { kind: 'back', id: 'radici', name: 'dorso Radici' } },
    { id: 'controcontrasto', name: 'Contro-contrasto', desc: 'Contrasta un contrasto.', reward: { kind: 'back', id: 'maree', name: 'dorso Maree' } },
    { id: 'muro', name: 'Muro', desc: 'Contrasta 3 volte nella stessa partita.' },
    { id: 'demolitore', name: 'Demolitore', desc: 'Distruggi 3 terre nella stessa partita.' },
    { id: 'lampo', name: 'Lampo', desc: 'Vinci entro il turno 10.' },
    { id: 'serie3', name: 'Tre di fila', desc: 'Vinci 3 partite di fila.', reward: { kind: 'table', id: 'pergamena', name: 'tavolo Pergamena' } },
    { id: 'serie5', name: 'Cinque di fila', desc: 'Vinci 5 partite di fila.' },
    { id: 'difficile', name: 'Mente fina', desc: 'Batti il computer difficile.', reward: { kind: 'table', id: 'corallo', name: 'tavolo Corallo' } },
    { id: 'esploratore', name: 'Esploratore', desc: 'Gioca 100 terre in totale.' },
    { id: 'vittorie10', name: 'Dieci vittorie', desc: 'Vinci 10 partite.', reward: { kind: 'back', id: 'stelle', name: 'dorso Stelle' } },
    { id: 'difficile3', name: 'Tre volte il difficile', desc: 'Batti 3 volte il computer difficile.' },
    { id: 'amico', name: 'In compagnia', desc: 'Vinci una partita contro un amico.' },
  ],
  byId(id) { return this.LIST.find((g) => g.id === id); },
  // il premio che sblocca un certo dorso o tavolo (null se è libero)
  lockFor(kind, id) { return this.LIST.find((g) => g.reward && g.reward.kind === kind && g.reward.id === id) || null; },
  unlocked(all, kind, id) { const g = this.lockFor(kind, id); return !g || !!(all.goals && all.goals[g.id]); },

  // all: profilo già aggiornato con la partita; x: { won, how, turn, mode, cur }. Le sfide non contano.
  check(all, x) {
    all.goals = all.goals || {};
    const has = (id) => !!all.goals[id], out = [];
    // una vittoria per resa dell'avversario non vale per gli obiettivi
    x = { ...x, won: x.won && x.reason !== 'surrender' };
    const c = x.cur, streak = Math.max(all.cpu.streak, all.pvp.streak);
    const lands = TYPES.reduce((n, t) => n + all.cpu.lands[t] + all.pvp.lands[t], 0);
    const tests = {
      prima: x.won,
      dominio: x.won && x.how === 'domain',
      cinqueuguali: x.won && x.how === 'five',
      cinqueforeste: x.won && x.how === 'five' && x.fiveOf === 'G',
      controcontrasto: c.cc > 0,
      muro: c.counters >= 3,
      demolitore: c.destroyed >= 3,
      lampo: x.won && x.turn <= 10,
      serie3: x.won && streak >= 3,
      serie5: x.won && streak >= 5,
      difficile: x.won && x.mode === 'hard',
      esploratore: lands >= 100,
      vittorie10: x.won && all.cpu.won + all.pvp.won >= 10,
      difficile3: x.won && all.cpu.modes.hard.w >= 3,
      amico: x.won && x.mode === 'friend',
    };
    for (const g of this.LIST) if (!has(g.id) && tests[g.id]) { all.goals[g.id] = Date.now(); out.push(g.id); }
    return out;
  },

  // finestra con l'elenco degli obiettivi
  html(name) {
    const all = Stats.load(name), got = all.goals || {};
    const n = this.LIST.filter((g) => got[g.id]).length;
    return `<div class="overlay" id="goals-ov"><div class="box rules goals" onclick="event.stopPropagation()">
      <h2>Obiettivi</h2>
      <p class="muted">${n} di ${this.LIST.length} raggiunti. Alcuni sbloccano dorsi e tavoli nella Collezione.</p>
      <ul class="goallist">${this.LIST.map((g) => `<li class="${got[g.id] ? 'got' : ''}"><span class="gmark">${got[g.id] ? '✓' : ''}</span>
        <span class="gtext"><b>${g.name}</b><small>${g.desc}${g.reward ? ` <em>Premio: ${g.reward.name}</em>` : ''}</small></span></li>`).join('')}</ul>
      <button class="btn primary" id="goals-close">Chiudi</button>
    </div></div>`;
  },
};
