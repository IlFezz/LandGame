'use strict';
// =====================================================================
//  Tutorial: una partita guidata contro il "Maestro".
//  Mazzi e mosse del Maestro sono preparati in hub.js; qui ci sono le spiegazioni,
//  l'evidenziazione dell'elemento da usare e il blocco delle mosse fuori programma.
//
//  Ogni momento della partita ha una o più pagine: le prime spiegano (pulsante «Avanti»),
//  l'ultima chiede di fare qualcosa (giocare, passare, contrastare) oppure di far giocare il Maestro.
//  «Indietro» rilegge le pagine già viste, anche dei momenti precedenti.
// =====================================================================
const NAMES_ART = { W: 'la Pianura', U: 'l\'Isola', B: 'la Palude', R: 'la Montagna', G: 'la Foresta' };
const Tut = {
  page: 0, key: null, history: [], back: 0,
  reset() { this.page = 0; this.key = null; this.history = []; this.back = 0; },
  active() { return !!(S && S.tutorial && G && G.phase === 'playing'); },

  // ---------- il copione ----------
  // Le pagine del momento attuale. Una pagina: { text, hl, card, allow, wrong, pass }
  pages() {
    const g = G, T = g.turn, task = myTask();
    const drag = prefs.controls === 'drag';
    const how = (land) => drag ? `Trascina ${land} evidenziata al centro del tavolo e lasciala lì.` : `Tocca ${land} evidenziata e poi tocca il centro del tavolo.`;
    const info = (text, hl) => ({ text, hl });
    const play = (card, text) => ({ text, card, hl: `#hand-me .card[data-card="${card}"]`, allow: (a) => a.type === 'play' && a.card === card,
      wrong: `In questo passaggio puoi giocare solo ${NAMES_ART[card]}, la carta evidenziata.` });
    const allow = (text) => ({ text, hl: '[data-act="allow"]', allow: (a) => a.type === 'allow', wrong: 'In questo passaggio premi «Lascia risolvere».' });

    if (task === 'main' && ui.staged) {
      const t = { G: 'Ora tocca l\'<b>Isola</b> nel tuo cimitero: tornerà nella tua mano.', R: 'Ora tocca una terra del Maestro: è il bersaglio della Montagna e verrà distrutta.', W: 'Ora tocca la tua <b>Montagna</b>: la Pianura ne ripeterà l\'effetto.' }[ui.staged.card];
      return [{ text: t, allow: (a) => a.type === 'play' && a.card === ui.staged.card }];
    }
    if (T === 1 && task === 'main') return [
      info('Benvenuto in <b>Atlas</b>! È un gioco di carte per due giocatori. Il Maestro ti insegnerà a giocare con una partita vera, passo per passo.'),
      info('Ogni carta è una <b>terra</b>. Ce ne sono cinque tipi: <b>Pianura</b>, <b>Isola</b>, <b>Palude</b>, <b>Montagna</b> e <b>Foresta</b>. Ogni tipo ha un colore e un simbolo.', '#hand-me'),
      info('Si vince così: avere in gioco <b>una terra di ogni tipo</b>, oppure <b>cinque terre dello stesso tipo</b>. Si vince nel momento in cui la terra giusta entra in gioco.'),
      info('Questo è il tuo <b>campo</b>: le terre che hai in gioco. C\'è un posto per ogni tipo, e il numero indica quante terre di quel tipo hai.', '#bf-me'),
      info('In alto c\'è il campo del Maestro. Le sue carte in mano le vedi coperte: sai quante sono, ma non quali.', '#bf-opp'),
      info('In basso c\'è la tua <b>mano</b>: le carte che puoi giocare. Il Maestro le vede coperte.', '#hand-me'),
      info('Accanto al tuo nome ci sono il <b>mazzo</b>, con le carte che restano da pescare, e il <b>cimitero</b>, dove finiscono le terre distrutte o scartate.', '#deck-me, #gy-me'),
      info('Come funziona un turno: all\'inizio peschi una carta (chi inizia la partita salta la prima pescata). Poi puoi giocare <b>una sola terra</b>, oppure passare il turno.'),
      info('Ogni terra ha un <b>effetto</b> che si attiva quando entra in gioco. Te li presento uno alla volta, mentre giochi.'),
      info('Quando giochi una terra, l\'avversario può provare a fermarla prima che entri in gioco: si chiama <b>contrasto</b>. Lo vedremo più avanti.'),
      info('Cominciamo con l\'<b>Isola</b>. Il suo effetto: quando entra in gioco <b>peschi una carta</b>.', '#hand-me .card[data-card="U"]'),
      play('U', how('l\'<b>Isola</b>')),
    ];
    if (T === 3 && task === 'main') return [
      info('La Montagna del Maestro ha distrutto la tua Isola. Le terre distrutte finiscono nel <b>cimitero</b>: tocca il segnalino accanto al tuo nome per vedere cosa contiene.', '#gy-me'),
      info('A inizio turno hai pescato una carta. Ora ti presento la <b>Foresta</b>: quando entra in gioco <b>riprendi in mano una terra dal tuo cimitero</b>.', '#hand-me .card[data-card="G"]'),
      play('G', `${how('la <b>Foresta</b>')} Poi tocca l'Isola nel cimitero.`),
    ];
    if (T === 5 && task === 'main') return [
      info('La Palude ti ha fatto scartare una carta, ma la Foresta ti aveva già fatto recuperare l\'Isola: ce l\'hai di nuovo in mano.'),
      info('La <b>Montagna</b>: quando entra in gioco <b>distrugge una terra dell\'avversario</b>, a tua scelta.', '#hand-me .card[data-card="R"]'),
      play('R', `${how('la <b>Montagna</b>')} Poi tocca una terra del Maestro.`),
    ];
    if (T === 7 && task === 'main') return [
      info('Contrasto riuscito: la Montagna del Maestro è finita nel suo cimitero senza effetto, e la tua Foresta è salva.'),
      info('La <b>Pianura</b>: quando entra in gioco <b>ripete l\'effetto di un\'altra tua terra già in gioco</b>. Sulla Montagna, per esempio, distrugge un\'altra terra avversaria.', '#hand-me .card[data-card="W"]'),
      play('W', `${how('la <b>Pianura</b>')} Poi tocca la tua Montagna.`),
    ];
    if (T === 9 && task === 'main') return [
      info('Hai in gioco Foresta, Montagna e Pianura: tre tipi su cinque. Ti mancano l\'Isola e la Palude.', '#bf-me'),
      info('Non sei obbligato a giocare una terra ogni turno. Puoi <b>passare il turno</b>: per esempio per tenerti un\'Isola in mano e poter contrastare l\'avversario.'),
      { text: 'Prova: premi <b>«Passa il turno»</b>. Il turno va al Maestro senza che tu giochi nulla.', hl: '[data-act="pass"]', pass: true, allow: (a) => a.type === 'pass', wrong: 'In questo passaggio premi «Passa il turno».' },
    ];
    if (T === 11 && task === 'main') return [play('U', `Ora gioca l'<b>Isola</b>: pescherai una carta e avrai quattro tipi di terra in gioco. ${how('l\'<b>Isola</b>')}`)];
    if (T === 13 && task === 'main') return [
      info('Hai quattro tipi diversi in gioco. Il punto esclamativo rosso accanto al tuo nome avvisa che sei a un passo dalla vittoria; lo vedrai anche accanto all\'avversario, quando sarà lui a esserlo.', '.zone.me .pname'),
      info('La <b>Palude</b>: quando entra in gioco guardi la mano dell\'avversario e scegli una terra che dovrà scartare. Ma qui basta che entri in gioco: è il quinto tipo che ti manca.', '#hand-me .card[data-card="B"]'),
      play('B', `Gioca la <b>Palude</b> e vinci. ${how('la <b>Palude</b>')}`),
    ];

    if (task === 'response') {
      if (T === 2) return [
        info('Il Maestro ha giocato una <b>Montagna</b>: distrugge una terra dell\'avversario. La freccia indica il bersaglio: la tua Isola.'),
        info('La sua terra non è ancora entrata in gioco. Adesso puoi <b>contrastarla</b> (lo impareremo tra poco) oppure <b>lasciarla risolvere</b>: in quel caso entra in gioco e il suo effetto si applica.'),
        allow('Questa volta premi <b>«Lascia risolvere»</b>.'),
      ];
      if (T === 4) return [
        info('Il Maestro ha giocato una <b>Palude</b>: quando entra in gioco guarda la tua mano e sceglie una terra che dovrai scartare nel cimitero.'),
        allow('Premi <b>«Lascia risolvere»</b>.'),
      ];
      if (T === 6) {
        if (ui.counter) return [ui.pick
          ? { text: 'Premi <b>«Conferma»</b>: l\'Isola e la terra scelta vanno nel tuo cimitero, e la Montagna del Maestro ci finisce senza effetto.', hl: '[data-act="counter-confirm"]', allow: (a) => a.type === 'counter' }
          : { text: 'L\'Isola è già stata scelta da sola: è quella segnata in rosso. Ora tocca nella tua mano <b>un\'altra terra qualsiasi</b> da scartare insieme a lei.', allow: (a) => a.type === 'counter' }];
        return [
          info('Il Maestro gioca un\'altra <b>Montagna</b>, questa volta contro la tua Foresta. Fermalo con un <b>contrasto</b>.'),
          info('Il contrasto si può fare <b>solo se hai un\'Isola in mano</b>. Si scartano due carte: l\'Isola più un\'altra terra a tua scelta. La terra dell\'avversario finisce nel cimitero e il suo effetto non avviene.', '#hand-me .card[data-card="U"]'),
          info('Quando premi «Contrasta», l\'Isola viene <b>scelta automaticamente</b>: tu devi solo toccare la seconda terra da scartare, poi confermare.'),
          info('Attenzione: anche l\'avversario può contrastare il tuo contrasto, se ha un\'Isola. Vince chi contrasta per ultimo.'),
          { text: 'Premi <b>«Contrasta»</b>.', hl: '[data-act="counter-start"]', allow: (a) => a.type === 'counter', wrong: 'In questo passaggio premi «Contrasta».' },
        ];
      }
      if (T === 8) return [
        info('Il Maestro ha giocato una <b>Pianura</b>, ma non ha altre terre in gioco da riattivare: entrerà in gioco senza effetto.'),
        allow('Non hai Isole in mano, quindi non puoi contrastare. Premi <b>«Lascia risolvere»</b>.'),
      ];
      if (T === 10) return [
        info('Il Maestro ha giocato una <b>Foresta</b> per riprendere una terra dal suo cimitero. Hai un\'Isola in mano: potresti contrastarla.'),
        info('Ma contrastare costa due carte, e la Foresta del Maestro non ti danneggia. In più l\'Isola ti serve per vincere: conviene tenerla.'),
        allow('Premi <b>«Lascia risolvere»</b>.'),
      ];
      if (T === 12) return [allow('Il Maestro gioca una <b>Pianura</b> per ripetere l\'effetto della sua Foresta. Non ti danneggia: premi <b>«Lascia risolvere»</b>.')];
      return [allow('Premi <b>«Lascia risolvere»</b>.')];
    }
    if (task === 'choice' && T === 7) return [{ text: 'La Pianura ripete l\'effetto della Montagna: tocca la terra del Maestro da distruggere.' }];
    return null;
  },

  // la pagina dal vivo del momento attuale (o null)
  live() {
    if (!this.active() || ui.animating) return null;
    if (S.tutWait) { // tocca al Maestro: aspetta che il giocatore abbia letto
      const g = G;
      const text = g.step === 'choice' ? 'Il Maestro ha guardato la tua mano: ora sceglie quale terra farti scartare.' : {
        2: 'Hai giocato la tua terra e il turno è finito. Ora tocca al Maestro: pesca una carta e gioca una terra.',
        4: 'Tocca di nuovo al Maestro. Vediamo cosa gioca.',
        6: 'Turno del Maestro. Ha ancora una Montagna in mano: stai attento.',
        8: 'Tocca al Maestro. Gli hai distrutto tutte le terre: vediamo come risponde.',
        10: 'Hai passato il turno: ora tocca al Maestro.',
        12: 'Ultimo turno del Maestro.',
      }[g.turn] || 'Tocca al Maestro.';
      return { key: `wait|${g.turn}|${g.step}`, page: { text, go: true }, last: true, i: 0 };
    }
    const pages = this.pages();
    if (!pages) return null;
    const key = `${G.turn}|${myTask()}|${ui.staged ? 'st' : ''}|${ui.counter ? 'c' : ''}${ui.pick ? 'p' : ''}`;
    if (key !== this.key) { this.key = key; this.page = 0; this.back = 0; }
    const i = Math.min(this.page, pages.length - 1);
    return { key, page: pages[i], last: i === pages.length - 1, i };
  },

  // quello che il riquadro mostra: una pagina già letta (Indietro) oppure quella dal vivo
  shown() {
    const L = this.live();
    if (!L) return null;
    const h = this.history, id = `${L.key}#${L.i}`;
    if (!h.length || h[h.length - 1].id !== id) h.push({ id, text: L.page.text });
    if (this.back > 0) return { review: true, text: h[h.length - 1 - this.back].text };
    return { ...L.page, info: !L.last };
  },

  next() { if (this.back > 0) this.back--; else this.page++; },
  prev() { if (this.back < this.history.length - 1) this.back++; },

  // false se la mossa non è quella che il tutorial chiede (e spiega perché)
  allows(a) {
    const P = this.shown();
    if (!P) return true;
    if (P.review) { toast('Stai rileggendo: premi «Avanti» per tornare al punto in cui eri', true); return false; }
    if (P.info || P.go) { toast('Premi «Avanti» per continuare', true); return false; }
    if (!P.allow || P.allow(a)) return true;
    toast(P.wrong || 'Segui il consiglio del tutorial', true);
    return false;
  },
  wantsPass() { const P = this.shown(); return !!(P && P.pass && !P.review); },

  html() {
    const P = this.shown();
    if (!P) return '';
    const back = this.back < this.history.length - 1 ? '<button class="btn small ghost" data-act="tut-back">Indietro</button>' : '<span></span>';
    const fwd = P.review || P.info ? '<button class="btn primary small" data-act="tut-next">Avanti</button>'
      : P.go ? '<button class="btn primary small" data-act="tut-go">Avanti</button>' : '';
    return `<div class="coach ${P.review ? 'review' : ''}" id="coach">${P.review ? '<small>Stai rileggendo un passaggio precedente</small>' : ''}<p>${P.text}</p>
      <div class="coach-acts">${back}${fwd}</div></div>`;
  },

  // posiziona il riquadro sopra il centro del tavolo ed evidenzia l'elemento di cui si parla
  place() {
    $$('.coach-hl').forEach((e) => e.classList.remove('coach-hl'));
    $$('.coach-tag').forEach((e) => e.remove());
    $$('.coach-dim').forEach((e) => e.classList.remove('coach-dim'));
    const el = $('#coach'), c = $('#center');
    if (!el || !c) return;
    const r = c.getBoundingClientRect(), land = innerWidth / innerHeight >= 1.1;
    let css;
    if (!land) css = { left: `${innerWidth / 2}px`, top: `${r.top + 2}px`, width: `${Math.min(innerWidth * 0.92, 460)}px`, transform: 'translateX(-50%)' };
    else if (innerHeight > 520) css = { left: `${Math.max(16, r.left + 8)}px`, top: `${r.top + r.height / 2}px`, width: `${Math.min(innerWidth * 0.27, 480)}px`, transform: 'translateY(-50%)' };
    else css = { left: `${r.left}px`, top: `${r.top + 44}px`, width: `${r.width}px`, transform: 'none' }; // sotto il pulsante del menu
    Object.assign(el.style, css);
    const P = this.shown();
    if (!P || P.review || !P.hl) return;
    $$(P.hl).forEach((t, i) => {
      if (i > 1) return;
      t.classList.add('coach-hl');
      // la carta da giocare porta un'etichetta; le altre si spengono, così si capisce quale usare
      if (P.card && i === 0) {
        t.insertAdjacentHTML('beforeend', '<span class="coach-tag">Gioca questa</span>');
        $$('#hand-me .card').forEach((x) => { if (x !== t) x.classList.add('coach-dim'); });
      }
    });
  },
};
