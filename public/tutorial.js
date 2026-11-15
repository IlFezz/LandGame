'use strict';
// =====================================================================
//  Tutorial: una partita guidata contro il "Maestro".
//  Mazzi e mosse del Maestro sono preparati in hub.js; qui ci sono i consigli,
//  l'evidenziazione dell'elemento da usare e il blocco delle mosse fuori programma.
// =====================================================================
const NAMES_ART = { W: 'la Pianura', U: 'l\'Isola', B: 'la Palude', R: 'la Montagna', G: 'la Foresta' };
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
    if (ui.animating) return null;
    // tocca al Maestro: aspetta che il giocatore abbia letto
    if (S.tutWait) {
      if (g.step === 'choice') return { text: 'Il Maestro ha guardato la tua mano: ora sceglie quale terra farti scartare.', go: true };
      const t = {
        2: 'Il tuo turno è finito. Ora tocca al Maestro: pesca una carta e gioca una terra.',
        4: 'Tocca di nuovo al Maestro. Vediamo cosa gioca.',
        6: 'Turno del Maestro. Attento: ha ancora una Montagna in mano.',
        8: 'Tocca al Maestro. Gli hai distrutto tutte le terre: vediamo come risponde.',
        10: 'Ultimo turno del Maestro prima della tua vittoria. Premi «Avanti» per vedere cosa gioca.',
      }[T] || 'Tocca al Maestro.';
      return { text: t, go: true };
    }
    const play = (card, text) => ({ text, card, hl: `#hand-me .card[data-card="${card}"]`, allow: (a) => a.type === 'play' && a.card === card,
      wrong: `In questo passaggio puoi giocare solo ${NAMES_ART[card]}, la carta evidenziata.` });
    if (task === 'main') {
      const L = {
        1: play('U', 'Trascina l\'<b>Isola</b> evidenziata al centro del tavolo. Quando entra in gioco ti fa pescare una carta.'),
        3: play('G', 'Il Maestro ha distrutto la tua Isola: ora è nel tuo cimitero. Gioca la <b>Foresta</b> evidenziata per riprenderla in mano.'),
        5: play('R', 'La <b>Montagna</b> distrugge una terra dell\'avversario. Giocala e poi tocca una terra del Maestro.'),
        7: play('W', 'La <b>Pianura</b> ripete l\'effetto di un\'altra tua terra in gioco. Giocala sulla tua Montagna per distruggere un\'altra terra del Maestro.'),
        9: play('U', 'Hai Foresta, Montagna e Pianura in gioco. Aggiungi l\'<b>Isola</b>: ti mancherà solo la Palude.'),
        11: play('B', 'Gioca la <b>Palude</b>: con cinque tipi di terra diversi in gioco vinci subito.'),
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
          ? (ui.pick ? 'Premi «Conferma»: l\'Isola e la terra scelta vanno nel cimitero e la Montagna del Maestro non ha effetto.' : 'Tocca in mano la seconda terra da scartare insieme all\'Isola: va bene una qualsiasi.')
          : 'Il Maestro vuole distruggere la tua Foresta. Fermalo: premi «Contrasta». Scarterai un\'Isola più un\'altra terra a tua scelta, e la sua Montagna finirà nel cimitero senza effetto.',
        hl: ui.counter ? (ui.pick ? '[data-act="counter-confirm"]' : null) : '[data-act="counter-start"]',
        allow: (a) => a.type === 'counter',
        wrong: 'Questa volta contrasta: premi «Contrasta».',
      };
      if (T === 8) return allowOnly('Il Maestro gioca una <b>Pianura</b>, ma non ha altre terre da riattivare: non succederà nulla. Non hai Isole in mano, quindi non puoi contrastare. Premi «Lascia risolvere».');
      if (T === 10) return allowOnly('Il Maestro gioca una <b>Foresta</b> e riprenderà una terra dal suo cimitero. Premi «Lascia risolvere».');
      return { text: 'Premi «Lascia risolvere».', hl: '[data-act="allow"]' };
    }
    if (task === 'choice' && T === 7) return { text: 'Scegli quale terra del Maestro distruggere.' };
    return null;
  },

  // false se la mossa non è quella che il tutorial chiede (e spiega perché)
  allows(a) {
    const L = this.lesson();
    if (!L) return true;
    if (L.next || L.go) { toast('Premi «Avanti» per continuare', true); return false; }
    if (!L.allow || L.allow(a)) return true;
    toast(L.wrong || 'Segui il consiglio del tutorial', true);
    return false;
  },

  html() {
    const L = this.lesson();
    if (!L || ui.animating) return '';
    const btn = L.next ? 'tut-next' : L.go ? 'tut-go' : null;
    return `<div class="coach" id="coach"><p>${L.text}</p>${btn ? `<div class="coach-acts">
      ${L.next ? '<button class="linkbtn" data-act="tut-skip">Esci</button>' : ''}<button class="btn primary small" data-act="${btn}">Avanti</button></div>` : ''}</div>`;
  },

  // posiziona il consiglio sopra il centro del tavolo ed evidenzia l'elemento da usare
  place() {
    $$('.coach-hl').forEach((e) => e.classList.remove('coach-hl'));
    $$('.coach-tag').forEach((e) => e.remove());
    $$('.coach-dim').forEach((e) => e.classList.remove('coach-dim'));
    const el = $('#coach'), c = $('#center');
    if (!el || !c) return;
    const r = c.getBoundingClientRect(), land = innerWidth / innerHeight >= 1.1;
    let css;
    if (!land) css = { left: `${innerWidth / 2}px`, top: `${r.top + 2}px`, width: `${Math.min(innerWidth * 0.92, 440)}px`, transform: 'translateX(-50%)' };
    else if (innerHeight > 520) css = { left: `${Math.max(16, r.left + 8)}px`, top: `${r.top + r.height / 2}px`, width: `${Math.min(innerWidth * 0.26, 480)}px`, transform: 'translateY(-50%)' };
    else css = { left: `${r.left}px`, top: `${r.top + 44}px`, width: `${r.width}px`, transform: 'none' }; // sotto il pulsante del menu
    Object.assign(el.style, css);
    const L = this.lesson();
    if (L && L.hl) {
      const t = $(L.hl);
      if (t) {
        t.classList.add('coach-hl');
        // la carta da giocare porta un'etichetta; le altre si spengono un po', così si capisce quale usare
        if (L.card) {
          t.insertAdjacentHTML('beforeend', '<span class="coach-tag">Gioca questa</span>');
          $$('#hand-me .card').forEach((c) => { if (c !== t) c.classList.add('coach-dim'); });
        }
      }
    }
  },
};
