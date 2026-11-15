'use strict';
// =====================================================================
//  Tutorial: una partita guidata contro il "Maestro".
//  Mazzi e mosse del Maestro sono preparati in hub.js; qui ci sono i consigli,
//  l'evidenziazione dell'elemento da usare e il blocco delle mosse fuori programma.
// =====================================================================
const Tut = {
  intro: 0,
  INTRO: [
    'Benvenuto! Si vince mettendo in gioco <b>cinque terre diverse</b>, oppure <b>cinque terre uguali</b>.',
    'A ogni turno peschi una carta e puoi giocare <b>una sola terra</b>. Ogni terra, quando entra in gioco, ha un effetto: il Maestro ti mostrerà come funzionano.',
  ],
  reset() { this.intro = 0; },
  next() { this.intro++; },
  active() { return !!(S && S.tutorial && G && G.phase === 'playing'); },

  // Il consiglio per il momento attuale: { text, hl (elemento da evidenziare), allow (mosse permesse), wrong, next }
  lesson() {
    if (!this.active()) return null;
    if (this.intro < this.INTRO.length) return { text: this.INTRO[this.intro], next: true };
    const g = G, T = g.turn, task = myTask();
    const play = (card, text, wrong) => ({ text, hl: `#hand-me .card[data-card="${card}"]`, allow: (a) => a.type === 'play' && a.card === card, wrong });
    if (task === 'main') {
      const L = {
        1: play('U', 'Trascina l\'<b>Isola</b> al centro del tavolo. Quando entra in gioco ti fa pescare una carta.', 'Per ora gioca l\'Isola.'),
        3: play('G', 'Il Maestro ha distrutto la tua Isola: ora è nel tuo cimitero. Gioca la <b>Foresta</b> per riprenderla in mano.', 'Gioca la Foresta per recuperare l\'Isola.'),
        5: play('R', 'La <b>Montagna</b> distrugge una terra dell\'avversario. Giocala e poi tocca una terra del Maestro.', 'Ora gioca la Montagna.'),
        7: play('W', 'La <b>Pianura</b> ripete l\'effetto di un\'altra tua terra in gioco. Giocala sulla tua Montagna per distruggere un\'altra terra del Maestro.', 'Ora gioca la Pianura.'),
        9: play('U', 'Hai Foresta, Montagna e Pianura in gioco. Aggiungi l\'<b>Isola</b>: ti mancherà solo la Palude.', 'Gioca l\'Isola.'),
        11: play('B', 'Gioca la <b>Palude</b>: con cinque tipi di terra diversi in gioco vinci subito.', 'Gioca la Palude per vincere.'),
      }[T];
      if (L && ui.staged) {
        L.text = { G: 'Ora tocca l\'<b>Isola</b> nel tuo cimitero: tornerà nella tua mano.', R: 'Tocca una terra del Maestro: verrà distrutta.', W: 'Tocca la tua <b>Montagna</b>: la Pianura ne ripeterà l\'effetto.' }[ui.staged.card] || L.text;
        L.hl = null;
      }
      return L || null;
    }
    if (task === 'response') {
      const allowOnly = (text) => ({ text, hl: '[data-act="allow"]', allow: (a) => a.type === 'allow', wrong: 'Questa volta lascia risolvere: il contrasto lo vediamo tra poco.' });
      if (T === 2) return allowOnly('Il Maestro gioca una <b>Montagna</b> contro la tua Isola: se la lasci risolvere, la distrugge. Per ora premi «Lascia risolvere».');
      if (T === 4) return allowOnly('Il Maestro gioca una <b>Palude</b>: guarderà la tua mano e ti farà scartare una terra. Lascia risolvere.');
      if (T === 6) return {
        text: ui.counter
          ? 'Tocca la <b>Montagna</b> o la <b>Foresta</b> da scartare insieme all\'Isola, poi premi «Conferma».'
          : 'Il Maestro vuole distruggere la tua Foresta. Fermalo: premi «Contrasta». Scarterai un\'Isola e un\'altra terra, e la sua Montagna finirà nel cimitero senza effetto.',
        hl: ui.counter ? (ui.pick ? '[data-act="counter-confirm"]' : null) : '[data-act="counter-start"]',
        allow: (a) => a.type === 'counter' && (a.other === 'G' || a.other === 'R'),
        wrong: 'Tieni Pianura e Palude, ti serviranno: scarta la Montagna o la Foresta.',
      };
      return null;
    }
    if (task === 'choice' && T === 7) return { text: 'Scegli quale terra del Maestro distruggere.' };
    return null;
  },

  // false se la mossa non è quella che il tutorial chiede (e spiega perché)
  allows(a) {
    const L = this.lesson();
    if (!L) return true;
    if (L.next) { toast('Premi «Avanti» per continuare', true); return false; }
    if (!L.allow || L.allow(a)) return true;
    toast(L.wrong || 'Segui il consiglio del tutorial', true);
    return false;
  },

  html() {
    const L = this.lesson();
    if (!L || ui.animating) return '';
    return `<div class="coach" id="coach"><p>${L.text}</p>${L.next ? `<div class="coach-acts">
      <button class="linkbtn" data-act="tut-skip">Esci</button><button class="btn primary small" data-act="tut-next">Avanti</button></div>` : ''}</div>`;
  },

  // posiziona il consiglio sopra il centro del tavolo ed evidenzia l'elemento da usare
  place() {
    $$('.coach-hl').forEach((e) => e.classList.remove('coach-hl'));
    const el = $('#coach'), c = $('#center');
    if (!el || !c) return;
    const r = c.getBoundingClientRect(), land = innerWidth / innerHeight >= 1.1;
    let css;
    if (!land) css = { left: `${innerWidth / 2}px`, top: `${r.top + 2}px`, width: `${Math.min(innerWidth * 0.92, 440)}px`, transform: 'translateX(-50%)' };
    else if (innerHeight > 520) css = { left: `${Math.max(16, r.left + 8)}px`, top: `${r.top + r.height / 2}px`, width: `${Math.min(innerWidth * 0.26, 480)}px`, transform: 'translateY(-50%)' };
    else css = { left: `${r.left}px`, top: `${r.top + 44}px`, width: `${r.width}px`, transform: 'none' }; // sotto il pulsante del menu
    Object.assign(el.style, css);
    const L = this.lesson();
    if (L && L.hl) { const t = $(L.hl); if (t) t.classList.add('coach-hl'); }
  },
};
