'use strict';

// =====================================================================
//  Atlas – client
// =====================================================================
const TYPES = ['W', 'U', 'B', 'R', 'G'];
const NAMES = { W: 'Pianura', U: 'Isola', B: 'Palude', R: 'Montagna', G: 'Foresta' };
const SYM = {};
for (const t of TYPES) SYM[t] = `<i class="ico ico-${t}"></i>`;
const TOMB = '<i class="ico ico-tomb"></i>';
const FXTXT = {
  W: 'Riattiva una tua terra',
  U: 'Pesca una carta, o contrasta',
  B: 'Fai scartare una terra',
  R: 'Distruggi una terra',
  G: 'Riprendi una terra dal cimitero',
};
// Descrizioni dal punto di vista di chi gioca la carta
const LONG_FX = {
  W: 'Riattiva l\'effetto di un\'altra tua terra in gioco.',
  U: 'Entrando peschi una carta.',
  B: 'Guardi la mano avversaria e scegli una terra da scartare.',
  R: 'Distruggi una terra avversaria in gioco.',
  G: 'Riprendi in mano una terra dal tuo cimitero.',
};
const TURN_OPTIONS = [30, 45, 60, 90, 0];
const SPEEDS = { slow: 1.5, medium: 1, fast: 0.6 };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Preferenze ----------
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem('blg.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem('blg.' + k) : localStorage.setItem('blg.' + k, JSON.stringify(v)); } catch {} },
};
const prefs = {
  get name() { return ls.get('name2', ''); }, set name(v) { ls.set('name2', v); },
  get session() { return ls.get('session2', null); }, set session(v) { ls.set('session2', v); },
  get sound() { return ls.get('sound', true); }, set sound(v) { ls.set('sound', v); },
  get vibe() { return ls.get('vibe', true); }, set vibe(v) { ls.set('vibe', v); },
  get turnTime() { return ls.get('turnTime', 60); }, set turnTime(v) { ls.set('turnTime', v); },
  get controls() { return ls.get('controls', 'drag'); }, set controls(v) { ls.set('controls', v); },
  get info() { return ls.get('info2', true); }, set info(v) { ls.set('info2', v); },
  get back() { const v = ls.get('back', 'bussola'); return ATL.BACKS.some((b) => b.id === v) ? v : 'bussola'; }, set back(v) { ls.set('back', v); },
  get theme() { return ls.get('theme', 'notte') === 'giorno' ? 'giorno' : 'notte'; }, set theme(v) { ls.set('theme', v); },
  // grafica: 'auto' sceglie da sola in base al dispositivo, 'lite' = Leggera, 'adv' = Avanzata
  get gfx() { const v = ls.get('gfx', 'auto'); return v === 'adv' || v === 'lite' ? v : 'auto'; }, set gfx(v) { ls.set('gfx', v); },
  get fx() { return ls.get('fx', 'high'); }, set fx(v) { ls.set('fx', v); },
  get music() { return ls.get('music', true); }, set music(v) { ls.set('music', v); },
  get level() { return ls.get('level', 'normal'); }, set level(v) { ls.set('level', v); },
  // la velocità delle animazioni è fissa (lenta); 'speedDev' serve solo ai test automatici
  get speed() { const v = ls.get('speedDev', 'slow'); return SPEEDS[v] ? v : 'slow'; },
};
// Durata scalata secondo la velocità scelta
const D = (ms) => ms * SPEEDS[prefs.speed];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = (ms) => sleep(D(ms));

// ---------- Suoni (sintetizzati, nessun file) ----------
const Sound = {
  ctx: null,
  unlock() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (prefs.music && !document.hidden) Music.start();
    } catch {}
  },
  tone(freq, dur, { type = 'sine', vol = 0.12, at = 0, to = null } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, { vol = 0.15, at = 0, freq = 1200, to = null } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t);
  },
  play(name) {
    if (!prefs.sound || !this.ctx || this.ctx.state !== 'running') return;
    const T = (...a) => this.tone(...a), N = (...a) => this.noise(...a);
    switch (name) {
      case 'draw': T(900, 0.07, { type: 'triangle', vol: 0.06, to: 600 }); break;
      case 'play': T(260, 0.12, { vol: 0.14, to: 180 }); N(0.08, { vol: 0.05, freq: 2500 }); break;
      case 'land': T(330, 0.16, { type: 'triangle', vol: 0.12 }); T(495, 0.2, { type: 'triangle', vol: 0.1, at: 0.07 }); break;
      case 'counter': T(1400, 0.28, { type: 'sawtooth', vol: 0.05, to: 250 }); N(0.2, { vol: 0.05, freq: 4000, to: 500 }); break;
      case 'fizzle': N(0.35, { vol: 0.12, freq: 3000, to: 200 }); break;
      case 'destroy': N(0.4, { vol: 0.25, freq: 900, to: 80 }); T(110, 0.25, { type: 'square', vol: 0.06, to: 50 }); break;
      case 'regrow': T(392, 0.12, { type: 'triangle', vol: 0.1 }); T(523, 0.12, { type: 'triangle', vol: 0.1, at: 0.08 }); T(659, 0.18, { type: 'triangle', vol: 0.1, at: 0.16 }); break;
      case 'discard': N(0.12, { vol: 0.1, freq: 1800 }); T(300, 0.15, { vol: 0.08, to: 180 }); break;
      case 'reuse': [660, 880, 990].forEach((f, i) => T(f, 0.2, { vol: 0.06, at: i * 0.06 })); break;
      case 'look': T(500, 0.25, { vol: 0.05, to: 700 }); break;
      case 'turn': T(523, 0.15, { vol: 0.09 }); T(784, 0.25, { vol: 0.09, at: 0.12 }); break;
      case 'tick': T(1050, 0.04, { type: 'square', vol: 0.03 }); break;
      case 'timeout': T(220, 0.3, { type: 'square', vol: 0.06, to: 140 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => T(f, 0.28, { type: 'triangle', vol: 0.1, at: i * 0.12 })); break;
      case 'lose': [392, 330, 262].forEach((f, i) => T(f, 0.35, { type: 'triangle', vol: 0.09, at: i * 0.18 })); break;
      case 'click': T(700, 0.03, { type: 'triangle', vol: 0.04 }); break;
      case 'grab': T(420, 0.12, { type: 'triangle', vol: 0.07, to: 820 }); break;
      case 'deny': T(220, 0.14, { type: 'square', vol: 0.04, to: 170 }); break;
    }
  },
};
document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });

// ---------- Musica di sottofondo: ambient generata al volo, morbida e lenta ----------
const Music = {
  on: false, master: null, bus: null, timer: null, nextChord: 0, nextNote: 0, step: 0,
  // Am9 · Fmaj7 · Cadd9 · G6 (note MIDI)
  // Dm9 · Bbmaj7 · Gm(add9) · A7sus4: lento e cupo
  chords: [[38, 50, 53, 57, 64], [34, 50, 53, 58, 62], [31, 50, 55, 58, 62], [33, 52, 57, 62, 64]],
  scale: [62, 65, 67, 69, 72, 74, 77],
  mtof: (m) => 440 * 2 ** ((m - 69) / 12),
  setup() {
    const c = Sound.ctx;
    this.master = c.createGain(); this.master.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950;
    // Riverbero leggero: due eco con retroazione e filtro (una convoluzione lunga pesa troppo sui telefoni)
    const dry = c.createGain(); dry.gain.value = 0.6;
    const wet = c.createGain(); wet.gain.value = 0.55;
    lp.connect(dry).connect(this.master);
    for (const [time, fb, pan] of [[0.37, 0.55, -0.5], [0.53, 0.5, 0.5]]) {
      const d = c.createDelay(1); d.delayTime.value = time;
      const g = c.createGain(); g.gain.value = fb;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      lp.connect(d); d.connect(f).connect(g).connect(d);
      if (p) { p.pan.value = pan; f.connect(p).connect(wet); } else f.connect(wet);
    }
    wet.connect(this.master);
    this.master.connect(c.destination);
    this.bus = lp;
  },
  start() {
    const c = Sound.ctx;
    if (this.on || !c) return;
    if (!this.master) this.setup();
    this.on = true;
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setTargetAtTime(0.11, c.currentTime, 1.8);
    this.nextChord = Math.max(this.nextChord, c.currentTime + 0.1);
    this.nextNote = this.nextChord + 2;
    this.timer = setInterval(() => this.tick(), 300);
  },
  stop() {
    if (!this.on) return;
    this.on = false;
    clearInterval(this.timer);
    const c = Sound.ctx;
    this.master.gain.cancelScheduledValues(c.currentTime);
    this.master.gain.setTargetAtTime(0, c.currentTime, 0.5);
  },
  // quando qualcuno è a un passo dalla vittoria la musica si fa più tesa: un battito grave e un suono più aperto
  tension(v) {
    v = !!v; if (v === this.tense) return; this.tense = v;
    if (this.bus) this.bus.frequency.setTargetAtTime(v ? 1700 : 950, Sound.ctx.currentTime, 1.5);
  },
  tick() {
    const c = Sound.ctx;
    if (!c || c.state !== 'running') return;
    if (this.tense) {
      if (!this.nextBeat || this.nextBeat < c.currentTime) this.nextBeat = c.currentTime + 0.2;
      while (this.nextBeat < c.currentTime + 1.5) {
        this.voice(55, this.nextBeat, { peak: 0.13, attack: 0.03, hold: 0.05, release: 0.35 });
        this.voice(55, this.nextBeat + 0.28, { peak: 0.08, attack: 0.03, hold: 0.04, release: 0.3 });
        this.voice(this.mtof(74), this.nextBeat, { type: 'triangle', peak: 0.012, attack: 0.6, hold: 0.1, release: 0.5 });
        this.nextBeat += 1.25;
      }
    }
    while (this.nextChord < c.currentTime + 1.5) { this.chord(this.nextChord); this.nextChord += 11; }
    while (this.nextNote < c.currentTime + 1.5) {
      if (Math.random() < 0.55) this.note(this.nextNote);
      this.nextNote += 2.2 + Math.random() * 4;
    }
  },
  voice(freq, t, { type = 'sine', peak = 0.04, attack = 2.5, hold = 6, release = 3.5, detune = 0 } = {}) {
    const c = Sound.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + attack + hold + release + 0.1);
  },
  chord(t) {
    const notes = this.chords[this.step++ % this.chords.length];
    notes.forEach((m, i) => {
      const f = this.mtof(m);
      if (i === 0) { this.voice(f, t, { peak: 0.06, hold: 8 }); this.voice(f / 2, t, { peak: 0.035, hold: 8, attack: 4 }); return; } // basso + bordone
      this.voice(f, t + i * 0.12, { type: 'triangle', peak: 0.018, detune: -6 });
      this.voice(f, t + i * 0.12, { peak: 0.022, detune: 6 });
    });
  },
  note(t) {
    const m = this.scale[Math.floor(Math.random() * this.scale.length)];
    this.voice(this.mtof(m), t, { peak: 0.028, attack: 0.4, hold: 0.1, release: 4.5 });
  },
};
function setMusic(on) {
  prefs.music = on;
  Sound.unlock();
  if (on) Music.start(); else Music.stop();
}

// ---------- Vibrazione ----------
// Android: Vibration API. iPhone (Safari 18+): non ha l'API, ma un interruttore "switch" nascosto produce un feedback aptico.
let iosSwitch = null;
function vibrate(pattern) {
  if (!prefs.vibe) return;
  try {
    // sotto i ~35 ms molti telefoni Android non vibrano affatto
    if (navigator.vibrate) { navigator.vibrate(Array.isArray(pattern) ? pattern : Math.max(40, pattern)); return; }
    if (!iosSwitch) {
      const label = document.createElement('label');
      label.style.cssText = 'position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', '');
      label.appendChild(input); document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  } catch {}
}

// ---------- Aspetto ----------
let gfxCapable = null;
// con la grafica avanzata ogni effetto del gioco avviene anche dentro la scena (onde sul tavolo, particelle)
for (const k of ['enter', 'cast', 'destroy', 'counter', 'regrow', 'reuse', 'look', 'discard', 'win', 'lose']) {
  const orig = FX[k];
  FX[k] = function (a, b) { if (Scene.active) Scene.fx(k, a, b); return orig.apply(this, arguments); };
}
// se la grafica avanzata rallenta il dispositivo, si torna alla leggera (solo se non l'hai scelta tu)
Scene.onSlow = (why) => {
  if (prefs.gfx === 'adv' && why === 'slow') return;
  prefs.gfx = 'lite'; Scene.set(false);
  toast('Grafica leggera attivata per mantenere il gioco fluido', true);
  if (ui.menu) render();
};
function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.style.setProperty('--bk', `var(--bk-${prefs.back})`);
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.content = prefs.theme === 'giorno' ? '#cbd8d4' : '#0a232b';
  Scene.setTheme(prefs.theme); Scene.setBack(prefs.back);
  Scene.set(prefs.gfx === 'adv');
  document.body.classList.toggle('low-fx', prefs.fx === 'low');
  FX.setQuality(prefs.fx === 'low' ? 0.4 : 1);
}

// ---------- Stato ----------
let S = null;          // metadati stanza dall'ultimo messaggio
let G = null;          // vista di gioco attualmente mostrata
let clockOffset = 0;   // ora server - ora locale
const ui = {
  mode: null,           // modalità aperta nella home
  sel: null,            // { card, idx } carta sollevata (comandi a tocco)
  staged: null,         // { card, idx } carta posata al centro in attesa del bersaglio
  counter: false,       // sto scegliendo come contrastare
  pick: null,           // { card, idx } seconda carta da scartare col contrasto
  gyOpen: null,         // 'me' | 'opp' cimitero aperto
  menu: false, confirmLeave: false, rules: false, log: false,
  animating: false, caption: null,
};
let lastPlay = null;     // { card, idx, rect } per far partire l'animazione dalla carta giusta
let lastCounter = null;  // { islandIdx, pickIdx }
let lastReuse = null;    // { w, card } terra riattivata dalla Pianura (origine delle frecce del suo effetto)
let needRender = false;

// La rosa dei venti al centro del tavolo: un solo elemento fisso, mai ricreato dai render (così non va ridisegnato)
const Altar = {
  el: null, ang: 0,
  place() {
    const el = this.el || (this.el = $('#altar'));
    const c = $('#center');
    if (!el) return;
    if (!c) { el.classList.remove('on'); return; }
    const r = c.getBoundingClientRect();
    const land = innerWidth / innerHeight >= 1.1;
    const size = land && innerHeight > 520 ? Math.min(innerHeight * 0.5, r.width * 0.5) : Math.min(r.height * 0.96, r.width * 0.96);
    Object.assign(el.style, { left: `${r.left + r.width / 2 - size / 2}px`, top: `${r.top + r.height / 2 - size / 2}px`, width: `${size}px`, height: `${size}px` });
    this.rect = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size };
    el.classList.add('on');
  },
  state() {},
  // un quinto di giro quando si gioca una carta (invece di una rotazione continua)
  cast(card) {
    Scene.cast(card, this.rect);
    const el = this.el; if (!el) return;
    el.style.setProperty('--ang0', `${this.ang}deg`);
    this.ang += 72;
    el.style.setProperty('--ang', `${this.ang}deg`);
    el.classList.remove('cast'); void el.offsetWidth; el.classList.add('cast');
  },
};
let autoAllowKey = null;

// ---------- Schermo intero ----------
// Da app installata lo schermo intero arriva dal manifest; nel browser si chiede con un pulsante (dove è permesso).
const Full = {
  api: () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled),
  on: () => !!(document.fullscreenElement || document.webkitFullscreenElement),
  label() { return this.on() ? '⤡ Esci dallo schermo intero' : '⤢ Schermo intero'; },
  async toggle() {
    if (!this.api()) {
      return toast(/iP(hone|od|ad)/.test(navigator.userAgent)
        ? 'Su iPhone: tocca Condividi e poi «Aggiungi alla schermata Home», poi apri Atlas da lì'
        : 'Questo browser non permette lo schermo intero', true);
    }
    try {
      if (this.on()) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); ls.set('full', false); }
      else { const el = document.documentElement; await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' }); ls.set('full', true); }
    } catch { toast('Il browser non permette lo schermo intero'); }
  },
  // aggiorna le scritte dei pulsanti senza ridisegnare la pagina
  sync() { $$('[data-full]').forEach((b) => { b.textContent = this.label(); }); },
};
// se l'ultima volta eri a schermo intero, ci si torna al primo tocco (il browser chiede un gesto)
document.addEventListener('pointerdown', () => {
  if (ls.get('full', false) && Full.api() && !Full.on()) (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement, { navigationUI: 'hide' }).catch(() => {});
}, { capture: true, once: true });
// L'altezza del gioco segue quella vera dello schermo: niente scorrimento, in nessun caso.
let fitTimer = null;
function fitScreen() {
  document.documentElement.style.setProperty('--app-h', `${innerHeight}px`);
  Scene.resize();
  if (app.dataset.game) { layoutHand(); fitCenter(); drawArrows(); Altar.place(); Tut.place(); fitBox($('.sheet', app), 16); } else fitLobby();
  Full.sync();
}
// Se lo spazio al centro del tavolo non basta (schermi bassi, barre del browser visibili),
// carta giocata, scritte e pulsanti si rimpiccioliscono insieme invece di finire sopra il tuo campo.
function fitCenter() {
  const c = $('#center');
  if (!c) return;
  const kids = [...c.children];
  kids.forEach((k) => { k.style.zoom = ''; });
  const avail = c.clientHeight;
  if (avail < 40) return;
  // gli spazi tra gli elementi non si rimpiccioliscono: si corregge in un paio di passaggi
  let z = 1;
  for (let i = 0; i < 4 && c.scrollHeight > avail + 1; i++) {
    z = Math.max(0.45, z * (avail - 2) / c.scrollHeight - 0.02);
    kids.forEach((k) => { k.style.zoom = z.toFixed(3); });
  }
}
// la home e la stanza d'attesa si rimpiccioliscono se non ci stanno, invece di scorrere
// La home tiene lo spazio per la modalità più alta già aperta: aprendo e chiudendo le tendine
// non si sposta né si rimpicciolisce nulla. Se non ci sta, si rimpicciolisce una volta sola.
function fitLobby() {
  const l = $('.lobby', app);
  if (!l) return;
  l.style.zoom = ''; l.style.minHeight = '';
  const modes = $$('.mode', l);
  let h = l.offsetHeight;
  if (modes.length) {
    l.classList.add('measuring');
    const open = modes.map((m) => m.classList.contains('open'));
    for (const m of modes) {
      modes.forEach((x) => x.classList.toggle('open', x === m));
      h = Math.max(h, l.offsetHeight);
    }
    modes.forEach((x, i) => x.classList.toggle('open', open[i]));
    void l.offsetHeight;
    l.classList.remove('measuring');
    l.style.minHeight = `${h}px`;
  }
  // spazio vero: altezza dello schermo meno i margini (compresi quelli per la tacca della fotocamera)
  const cs = getComputedStyle(app);
  const base = parseFloat(getComputedStyle(l).zoom) || 1, avail = innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 10;
  if (h * base > avail) l.style.zoom = (avail / h).toFixed(3);
}
// rimpicciolisce un pannello (home, menu) finché non sta tutto nello schermo
function fitBox(l, margin) {
  if (!l) return;
  l.style.zoom = '';
  const base = parseFloat(getComputedStyle(l).zoom) || 1;
  const h = l.getBoundingClientRect().height, avail = innerHeight - margin;
  if (h > avail) l.style.zoom = (base * avail / h).toFixed(3);
}
let fitTimer2 = null;
function refit() { fitScreen(); clearTimeout(fitTimer); clearTimeout(fitTimer2); fitTimer = setTimeout(fitScreen, 250); fitTimer2 = setTimeout(fitScreen, 800); } // alcuni browser cambiano misura in più tempi
if (window.ResizeObserver) new ResizeObserver(() => { if (Math.abs(innerHeight - parseFloat(document.documentElement.style.getPropertyValue('--app-h'))) > 1) refit(); }).observe(document.documentElement);
['fullscreenchange', 'webkitfullscreenchange', 'orientationchange'].forEach((e) => document.addEventListener(e, refit));
window.addEventListener('resize', refit);

// ---------- Connessione ----------
let ws = null, wsReady = false, queue = [], retry = 0;
function connect() {
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => {
    wsReady = true; retry = 0;
    const sess = prefs.session;
    if (sess && sess.code && !sess.local && !queue.some((m) => m.t === 'create' || m.t === 'join')) {
      ws.send(JSON.stringify({ t: 'join', code: sess.code, token: sess.token, name: prefs.name }));
    }
    queue.forEach((m) => ws.send(JSON.stringify(m)));
    queue = [];
    render();
  };
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  ws.onclose = () => {
    wsReady = false;
    render();
    setTimeout(connect, Math.min(1000 * 2 ** retry++, 8000));
  };
}
function onMessage(m) {
    if (m.t === 'joined') {
      prefs.session = { code: m.code, token: m.token, local: !!m.local };
      history.replaceState(null, '', location.pathname);
      send({ t: 'prefs', speed: SPEEDS[prefs.speed] });
    } else if (m.t === 'state') {
      inbox.push(m); pump();
    } else if (m.t === 'error') {
      toast(m.msg);
      if (/non trovata/.test(m.msg) || (/piena/.test(m.msg) && !S)) { prefs.session = null; S = null; G = null; render(); }
    }
}

// Le partite contro il computer e il tutorial girano qui nel browser, con lo stesso codice del server:
// si gioca anche offline e senza aspettare che il server si svegli.
const Local = {
  hub: null, active: false,
  conn: { send: (m) => { const c = JSON.parse(JSON.stringify(m)); setTimeout(() => onMessage(c), 0); }, close() {} },
  get() {
    if (!this.hub) this.hub = new BLGHub.Hub({ local: true, onChange: (room) => ls.set('localGame', this.hub.snapshot(room)) });
    return this.hub;
  },
  send(m) {
    this.get().message(this.conn, m);
    if (m.t === 'leave') { this.active = false; ls.set('localGame', null); }
  },
  // dopo una chiusura dell'app la partita riprende da dove era
  resume() {
    const sess = prefs.session;
    if (!sess || !sess.local) return;
    const saved = ls.get('localGame', null);
    if (!saved || !saved.room || saved.room.code !== sess.code || !saved.game) { prefs.session = null; return; }
    try { this.active = true; this.get().restore(saved, this.conn); } catch (e) { console.error(e); this.active = false; prefs.session = null; ls.set('localGame', null); }
  },
};
const isLocal = () => Local.active;
function send(m) {
  if (m.t === 'bot' || m.t === 'tutorial') Local.active = true;
  if (Local.active) return Local.send(m);
  if (wsReady) ws.send(JSON.stringify(m)); else { queue.push(m); connect(); }
}
function act(a) {
  if (!Tut.allows(a)) return;
  ui.sel = null; ui.staged = null; ui.counter = false; ui.pick = null; ui.gyOpen = null;
  clearArrows('aim');
  Sound.play('click');
  send({ t: 'action', a });
}

// ---------- Coda degli stati e animazioni ----------
const inbox = [];
let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  while (inbox.length) {
    const m = inbox.shift();
    clockOffset = m.now - Date.now();
    const { game, steps, ...meta } = m;
    S = meta;
    if (steps && steps.length && drag) cancelDrag(true);
    if (steps) for (const st of steps) Stats.track(st.ev, st.game);
    const animate = steps && steps.length && !document.hidden && inbox.length < 3 && !reduceMotion;
    if (animate) {
      ui.animating = true;
      for (const st of steps) {
        try { await animateStep(st.ev, st.game); } catch (e) { console.error(e); G = st.game; }
      }
      ui.animating = false; ui.caption = null;
    } else if (steps && steps.length) {
      const last = steps[steps.length - 1].ev;
      if (last.type === 'end') endSound(last);
    }
    G = game;
    lastPlay = null; lastCounter = null;
    if (!G || G.step !== 'response' || !G.pending || G.pending.responder !== G.you) { ui.counter = false; ui.pick = null; }
    if (!G || G.step !== 'main' || G.active !== G.you || G.landPlayed) { ui.sel = null; ui.staged = null; }
    render();
  }
  pumping = false;
}

// ---------- UI helpers ----------
let toastTimer;
function toast(msg, info) {
  const t = $('#toast');
  t.textContent = msg; t.className = info ? 'info' : '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
}
// le parti di una carta: tavola (la terra vista dall'alto), simbolo, nome, effetto
const cardFace = (t, text = true) => `<div class="art"></div><i class="gem ico ico-${t}"></i><div class="nm">${NAMES[t]}</div>${text ? `<div class="tx">${FXTXT[t]}</div>` : ''}`;
const cardHtml = (t, extra = '', attrs = '', inner = '') => `<div class="card k-${t} ${extra}" data-card="${t}" ${attrs}>${cardFace(t)}${inner}</div>`;
// il ventaglio delle cinque terre in cima alla home
const pips = () => `<div class="fan">${TYPES.map((t, i) => `<div class="card mini k-${t}" style="--rot:${(i - 2) * 9}deg;--dy:${Math.abs(i - 2) * Math.abs(i - 2) * 3}px"><div class="art"></div><i class="gem ico ico-${t}"></i></div>`).join('')}</div>`;
const who = (p) => (G && p === G.you ? 'me' : 'opp');
const winsWith = (bf, t) => { const b = { ...bf, [t]: bf[t] + 1 }; return TYPES.every((x) => b[x] > 0) || TYPES.some((x) => b[x] >= 5); };
const closeToWin = (bf) => TYPES.filter((t) => bf[t] > 0).length >= 4 || Math.max(...TYPES.map((t) => bf[t])) >= 4;
const info = () => prefs.info && !(S && S.tutorial); // nel tutorial spiega il Maestro

// =====================================================================
//  Render
// =====================================================================
function render() {
  if (drag && drag.active) { needRender = true; return; }
  needRender = false;
  const view = !S || !prefs.session ? 'lobby' : !G ? 'waiting' : 'game';
  if (view === 'lobby') renderLobby(); else if (view === 'waiting') renderWaiting(); else renderGame();
  Music.tension(view === 'game' && G.phase === 'playing' && (closeToWin(G.me.bf) || closeToWin(G.opp.bf)));
  // passaggio animato quando si cambia schermata (home ↔ attesa ↔ tavolo)
  if (ui.view && ui.view !== view) {
    const root = $('.lobby, .game', app);
    if (root) { root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter'); setTimeout(() => root.classList.remove('enter'), 700); }
  }
  ui.view = view;
}

// ---------- Home: quattro schede (Gioca, Profilo, Collezione, Impara) ----------
const TABS = [['play', 'Gioca'], ['profile', 'Profilo'], ['collection', 'Collezione'], ['learn', 'Impara']];
const TAB_ICON = {
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4.5 4.5-6.5 8-6.5s6.5 2 8 6.5"/>',
  collection: '<rect x="8" y="3" width="11" height="15" rx="2"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
  learn: '<path d="M3.5 5.5c3-1.5 5.8-1 8.5 1 2.7-2 5.5-2.5 8.5-1V19c-3-1.5-5.8-1-8.5 1-2.7-2-5.5-2.5-8.5-1z"/><path d="M12 6.5V20"/>',
};
const tabIcon = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICON[id]}</svg>`;

function collectionHtml() {
  const theme = (id, label) => `<button class="tile table-tile tt-${id} ${prefs.theme === id ? 'on' : ''}" data-theme-pick="${id}"><span class="tt-prev"><i></i></span><b>${label}</b></button>`;
  return `<h2 class="pane-title">Collezione</h2>
    <p class="pane-sub">Scegli il tavolo e il dorso delle carte.</p>
    <h4>Tavolo</h4>
    <div class="tiles">${theme('notte', 'Notte')}${theme('giorno', 'Giorno')}</div>
    <h4>Dorso delle carte</h4>
    <div class="tiles">${ATL.BACKS.map((b) => `<button class="tile back-tile ${prefs.back === b.id ? 'on' : ''}" data-back="${b.id}"><span class="bk-prev" style="background-image:var(--bk-${b.id})"></span><b>${b.name}</b></button>`).join('')}</div>
    <p class="pane-note">Altri tavoli e dorsi in arrivo.</p>`;
}

function learnHtml() {
  const done = Stats.load(prefs.name).tutorial;
  return `<h2 class="pane-title">Impara</h2>
    <div class="learn-card"><div class="lc-text"><b>Tutorial con il Maestro</b><small>Una partita guidata, passo per passo: circa 5 minuti.</small></div>
      ${done ? '<span class="done">Completato</span>' : ''}
      <button class="btn primary" id="tutorial">${done ? 'Rifai il tutorial' : 'Inizia il tutorial'}</button></div>
    <h4>Le cinque terre</h4>
    <ul class="lands-ref">${TYPES.map((t) => `<li><i class="ico ico-${t}"></i><b>${NAMES[t]}</b><span>${FXTXT[t]}</span></li>`).join('')}</ul>
    <p class="learn-win">Si vince con cinque terre diverse in gioco, oppure cinque uguali.</p>
    <button class="btn" id="rules">Regole complete</button>`;
}

// Cambia scheda senza ridisegnare la home: le schede scorrono di lato e sfumano.
function setTab(id) {
  if (id === (ui.tab || 'play')) return;
  const order = TABS.map((t) => t[0]), ti = order.indexOf(id);
  ui.tab = id;
  if (id === 'profile') { const n = $('#name') && $('#name').value.trim(); if (n) prefs.name = n; const pp = $('.pane-profile'); if (pp) { pp.innerHTML = Stats.panel(prefs.name); Stats.bind(); } }
  if (id === 'learn') { const pl = $('.pane-learn'); if (pl) { pl.innerHTML = learnHtml(); bindLearn(); } }
  $$('.pane', app).forEach((p) => {
    const i = order.indexOf(p.dataset.pane), on = p.dataset.pane === id;
    if (on) { p.style.transition = 'none'; p.style.setProperty('--dx', `${i < order.indexOf(ui.prevTab || 'play') ? -22 : 22}px`); void p.offsetWidth; p.style.transition = ''; }
    else p.style.setProperty('--dx', `${i < ti ? -22 : 22}px`);
    p.classList.toggle('on', on);
    if (on) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true');
  });
  ui.prevTab = id;
  $$('.tab', app).forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
  Sound.play('click');
}
function bindLearn() {
  const t = $('#tutorial');
  if (t) t.onclick = () => { const n = ($('#name') && $('#name').value.trim()) || prefs.name || 'Tu'; Tut.reset(); send({ t: 'tutorial', name: n, speed: SPEEDS[prefs.speed] }); };
  const r = $('#rules'); if (r) r.onclick = () => { ui.rules = true; render(); };
}

function renderLobby() {
  delete app.dataset.game;
  clearArrows();
  if ($('#altar')) $('#altar').classList.remove('on');
  const params = new URLSearchParams(location.search);
  const pre = (params.get('room') || '').toUpperCase();
  if (pre && !ui.mode) { ui.mode = 'friend'; ui.tab = 'play'; }
  const reconnecting = prefs.session && !S;
  const tab = reconnecting ? 'play' : ui.tab || 'play', ti = TABS.findIndex((t) => t[0] === tab);
  ui.prevTab = tab;
  const tt = prefs.turnTime;
  const ttSeg = `<div class="seg" data-group="tt">${TURN_OPTIONS.map((v) => `<button data-tt="${v}" class="${v === tt ? 'on' : ''}">${v ? v + 's' : '∞'}</button>`).join('')}</div>`;
  const pane = (id, i, html) => `<section class="pane pane-${id} ${id === tab ? 'on' : ''}" data-pane="${id}" style="--dx:${i < ti ? -22 : 22}px" ${id === tab ? '' : 'aria-hidden="true"'}>${html}</section>`;
  const play = `
    <div class="lcol lcol-a">
      <div class="toprow"><button class="fsbtn" id="fullscreen" data-full>${Full.label()}</button>
        <button class="musicbtn ${prefs.music ? '' : 'off'}" id="music" aria-label="Musica">♪</button></div>
      ${pips()}
      <h1>Atlas</h1>
      <p class="sub">Metti in gioco tutte e cinque le terre, oppure cinque uguali.</p>
      ${reconnecting ? '' : `<div class="who"><label for="name">Giochi come</label><input id="name" maxlength="20" value="${esc(prefs.name)}" placeholder="il tuo nome" autocomplete="nickname" size="12"></div>`}
    </div>
    <div class="lcol lcol-b">
    ${reconnecting ? `<p class="sub">Riconnessione alla stanza <b>${esc(prefs.session.code)}</b>…</p>
      <button class="linkbtn" id="forget">Annulla</button>` : `
    <div class="mode ${ui.mode === 'bot' ? 'open' : ''}" data-mode="bot">
      <button class="btn modebtn"><span class="mt"><b>Contro il computer</b><small>Anche senza connessione</small></span><span class="chev">▾</span></button>
      <div class="modebody"><div class="modeinner">
        <div class="field"><label>Difficoltà</label>
          <div class="seg" data-group="lvl"><button data-lvl="easy" class="${prefs.level === 'easy' ? 'on' : ''}">Facile</button><button data-lvl="normal" class="${prefs.level !== 'easy' ? 'on' : ''}">Normale</button></div></div>
        <div class="field"><label>Tempo per turno</label>${ttSeg}</div>
        <button class="btn primary" id="bot">Inizia la partita</button>
      </div></div>
    </div>
    <div class="mode ${ui.mode === 'friend' ? 'open' : ''}" data-mode="friend">
      <button class="btn modebtn"><span class="mt"><b>Con un amico</b><small>Crea una stanza o entra con un codice</small></span><span class="chev">▾</span></button>
      <div class="modebody"><div class="modeinner">
        <div class="field"><label>Tempo per turno</label>${ttSeg}</div>
        <button class="btn primary" id="create">Crea stanza</button>
        <div class="or">oppure entra con un codice</div>
        <div class="row"><input id="code" class="code-input" maxlength="4" value="${esc(pre)}" placeholder="CODICE" autocomplete="off" autocapitalize="characters"><button class="btn" id="join">Entra</button></div>
      </div></div>
    </div>`}
    </div>`;
  app.innerHTML = `
  <div class="lobby tabbed">
    <div class="panes">
      ${pane('play', 0, play)}
      ${reconnecting ? '' : pane('profile', 1, Stats.panel(prefs.name)) + pane('collection', 2, collectionHtml()) + pane('learn', 3, learnHtml())}
    </div>
    ${reconnecting ? '' : `<nav class="tabs" aria-label="Sezioni">${TABS.map(([id, l]) => `<button class="tab ${id === tab ? 'on' : ''}" data-tab="${id}">${tabIcon(id)}<span>${l}</span></button>`).join('')}</nav>`}
  </div>${ui.rules ? rulesHtml() : ''}${ui.transfer ? Stats.transferHtml() : ''}`;
  bindOverlays();
  bindLearn();
  $('#music').onclick = () => { setMusic(!prefs.music); $('#music').classList.toggle('off', !prefs.music); };
  if ($('#fullscreen')) $('#fullscreen').onclick = () => Full.toggle();
  $$('[data-tab]').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });
  $$('[data-theme-pick]').forEach((b) => { b.onclick = () => { prefs.theme = b.dataset.themePick; applyPrefs(); Sound.play('click'); $$('[data-theme-pick]').forEach((x) => x.classList.toggle('on', x === b)); }; });
  $$('[data-back]').forEach((b) => { b.onclick = () => { prefs.back = b.dataset.back; applyPrefs(); Sound.play('click'); $$('[data-back]').forEach((x) => x.classList.toggle('on', x === b)); }; });
  if (reconnecting) {
    $('#forget').onclick = () => { prefs.session = null; render(); };
    return fitLobby();
  }
  $$('.mode').forEach((m) => {
    $('.modebtn', m).onclick = () => {
      const open = !m.classList.contains('open');
      $$('.mode').forEach((x) => x.classList.remove('open'));
      if (open) m.classList.add('open');
      ui.mode = open ? m.dataset.mode : null;
      Sound.play('click');
    };
  });
  $$('[data-tt]').forEach((b) => { b.onclick = () => { prefs.turnTime = Number(b.dataset.tt); $$('[data-tt]').forEach((x) => x.classList.toggle('on', x.dataset.tt === b.dataset.tt)); }; });
  $$('[data-lvl]').forEach((b) => { b.onclick = () => { prefs.level = b.dataset.lvl; $$('[data-lvl]').forEach((x) => x.classList.toggle('on', x === b)); }; });
  const getName = () => { const n = $('#name').value.trim(); if (!n) { toast('Scrivi il tuo nome'); $('#name').focus(); return null; } prefs.name = n; return n; };
  const speed = SPEEDS[prefs.speed];
  // il nome si salva mentre lo scrivi: Profilo e statistiche lo seguono
  $('#name').addEventListener('input', () => { const n = $('#name').value.trim(); if (n) prefs.name = n; });
  $('#bot').onclick = () => { const n = getName(); if (n) send({ t: 'bot', name: n, turnTime: prefs.turnTime, speed, level: prefs.level }); };
  $('#create').onclick = () => { const n = getName(); if (n) send({ t: 'create', name: n, turnTime: prefs.turnTime, speed }); };
  $('#join').onclick = () => {
    const n = getName(); if (!n) return;
    const c = $('#code').value.trim().toUpperCase();
    if (c.length !== 4) return toast('Il codice ha 4 caratteri');
    send({ t: 'join', code: c, name: n });
  };
  $('#code').onkeydown = (e) => { if (e.key === 'Enter') $('#join').click(); };
  fitLobby();
}

function renderWaiting() {
  delete app.dataset.game;
  clearArrows();
  if ($('#altar')) $('#altar').classList.remove('on');
  const link = `${location.origin}${location.pathname}?room=${S.code}`;
  app.innerHTML = `
  <div class="lobby waiting">
    ${pips()}
    <p class="sub">Condividi questo codice con l'avversario</p>
    <div class="bigcode">${S.code}</div>
    <p class="sub">Tempo per turno: <b>${S.turnTime ? S.turnTime + ' secondi' : 'illimitato'}</b></p>
    <div class="row"><button class="btn primary" id="share">Condividi link</button></div>
    <p class="sub"><span class="spinner"></span> In attesa che l'avversario entri…</p>
    <button class="linkbtn" id="leave">Esci dalla stanza</button>
  </div>`;
  $('#share').onclick = async () => {
    const text = `Giochiamo ad Atlas! Codice stanza: ${S.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Atlas', text, url: link }); } catch {} }
    else { try { await navigator.clipboard.writeText(link); toast('Link copiato!', true); } catch { toast(link, true); } }
  };
  $('#leave').onclick = leave;
  fitLobby();
}

function leave() {
  cancelDrag(true);
  send({ t: 'leave' });
  prefs.session = null; S = null; G = null;
  Object.assign(ui, { sel: null, staged: null, counter: false, pick: null, gyOpen: null, menu: false, confirmLeave: false, log: false, rules: false });
  render();
}

// ---------- Pezzi del tavolo ----------
function bfHtml(pl, w, targets) {
  return `<div class="bf" id="bf-${w}">${TYPES.map((t) => {
    const n = pl.bf[t];
    const tg = targets && targets.includes(t);
    return `<div id="slot-${w}-${t}" class="slot s-${t} ${n ? 'full' : 'empty'} ${n >= 4 ? 'five' : ''} ${tg ? 'target' : ''}"
      ${tg ? `data-act="target" data-v="${t}"` : ''}>
      <div class="em">${SYM[t]}</div>${n ? `<div class="card mini k-${t}">${cardFace(t, false)}</div>` : ''}${n > 1 ? `<div class="count">${n}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

// Cimitero: un segnalino col totale; toccandolo si apre il dettaglio
function gyHtml(pl, w, targets) {
  const total = TYPES.reduce((s, t) => s + pl.gy[t], 0);
  const open = ui.gyOpen === w;
  const chips = TYPES.filter((t) => pl.gy[t]).map((t) => {
    const tg = targets && targets.includes(t);
    return `<button id="gy-${w}-${t}" class="gchip c-${t} ${tg ? 'target' : ''}" ${tg ? `data-act="target" data-v="${t}"` : ''}>
      ${SYM[t]}<span class="nm">${NAMES[t]}</span><b>×${pl.gy[t]}</b></button>`;
  }).join('');
  return `<span class="gywrap"><button class="gybadge ${open ? 'open' : ''} ${targets && targets.length && !open ? 'target' : ''}" id="gy-${w}" data-act="gy" data-v="${w}" title="Cimitero">
      ${TOMB}<b>${total}</b></button>
    ${open ? `<div class="gypop ${w}"><div class="gyhead">Cimitero${w === 'opp' ? ` di ${esc(G.opp.name)}` : ''}</div>
      ${chips || '<div class="gyempty">Vuoto</div>'}</div>` : ''}</span>`;
}

// la mano avversaria: dorsi aperti a ventaglio, come tenuti in mano
function oppFan(n) {
  const k = Math.min(n, 10), mid = (k - 1) / 2, step = k > 6 ? 7 : 10;
  return `<div class="fanbacks">${Array.from({ length: k }, (_, i) => `<div class="back" style="--r:${((i - mid) * step).toFixed(1)}deg"></div>`).join('')}</div>`;
}
function deckHtml(pl, w) {
  const h = pl.deckCount > 30 ? 3 : pl.deckCount > 12 ? 2 : pl.deckCount > 0 ? 1 : 0;
  return `<div class="deck" id="deck-${w}" title="Carte nel mazzo"><div class="pile h${h} ${pl.deckCount ? '' : 'emptypile'}"></div><b>${pl.deckCount}</b></div>`;
}

// Cosa sta chiedendo il gioco al giocatore locale
function myTask() {
  const g = G;
  if (!g || g.phase !== 'playing' || ui.animating) return null;
  const me = g.you;
  if (g.step === 'main' && g.active === me && !g.landPlayed) return 'main';
  if (g.step === 'response' && g.pending && g.pending.responder === me) return 'response';
  if (g.step === 'choice' && g.choice && g.choice.player === me) return 'choice';
  return null;
}
const needsTarget = (card) => { const t = G.playable && G.playable[card]; return !!(t && t.length); };

// Bersagli evidenziati sul campo
function boardTargets() {
  const out = { opp: null, me: null, gyMe: null };
  const task = myTask();
  if (task === 'main' && ui.staged) {
    const c = ui.staged.card, t = G.playable[c];
    if (c === 'R') out.opp = t;
    if (c === 'W') out.me = t;
    if (c === 'G') out.gyMe = t;
  }
  if (task === 'choice') {
    if (G.choice.kind === 'destroy') out.opp = G.choice.options;
    if (G.choice.kind === 'regrow') out.gyMe = G.choice.options;
  }
  return out;
}

function stackHtml() {
  const p = G.pending;
  if (ui.staged) {
    return `<div id="stack" class="stack-area">${cardHtml(ui.staged.card, 'onstack staged', '', '<button class="unstage" data-act="unstage" aria-label="Annulla">✕</button>')}</div>`;
  }
  if (!p && G.resolving) return `<div id="stack" class="stack-area">${cardHtml(G.resolving.land, 'onstack resolving ' + (G.resolving.owner === G.you ? 'mine' : 'theirs'))}</div>`;
  if (!p) return `<div id="stack" class="stack-area"><div class="stack-slot"></div></div>`;
  const counters = p.counters
    ? `<div class="ctr ${p.counters % 2 ? 'neg' : 'pos'}">${SYM.U.repeat(Math.min(p.counters, 6))}<span class="${p.counters % 2 ? 'no' : 'yes'}">${p.counters % 2 ? '✕' : '✓'}</span></div>` : '';
  return `<div id="stack" class="stack-area">${cardHtml(p.land, 'onstack ' + (p.owner === G.you ? 'mine' : 'theirs'))}${counters}</div>`;
}

// Testo di stato: solo l'essenziale (più dettagli con "Info nella plancia")
function statusHtml() {
  const g = G, me = g.you, opp = esc(g.opp.name);
  if (ui.caption !== null) return { text: ui.caption, cls: 'cap' };
  if (g.phase !== 'playing') return { text: '', cls: '' };
  if (g.step === 'response' && g.pending.responder === me && g.pending.owner !== me && winsWith(g.opp.bf, g.pending.land)) {
    return { text: `Se entra, ${opp} vince!`, cls: 'danger' };
  }
  if (!info()) return { text: '', cls: '' };
  if (g.step === 'main') return g.active === me ? { text: 'Il tuo turno', cls: 'mine' } : { text: `Turno di ${opp}`, cls: '' };
  if (g.step === 'response' && g.pending) {
    const p = g.pending;
    if (p.responder !== me) return { text: `${opp} può contrastare…`, cls: '' };
    if (p.owner !== me && p.counters === 0) return { text: `${opp} gioca ${NAMES[p.land]}`, cls: 'mine' };
    if (p.owner === me) return { text: `${opp} contrasta la tua ${NAMES[p.land]}!`, cls: 'mine' };
    return { text: `${opp} ha annullato il tuo contrasto!`, cls: 'mine' };
  }
  if (g.step === 'choice' && g.choice && g.choice.player !== me) return { text: `${opp} sta scegliendo…`, cls: '' };
  return { text: '', cls: '' };
}

// Cosa succede se la terra in attesa risolve, dal punto di vista di chi guarda
function consequenceText(p) {
  const g = G, opp = esc(g.opp.name);
  if (p.owner === g.you) return `Se non rispondi, la tua ${NAMES[p.land]} viene annullata.`;
  const t = p.target;
  const reuse = { U: 'pescherà una carta', B: 'guarderà la tua mano e ti farà scartare una terra', R: 'distruggerà una tua terra', G: 'riprenderà una terra dal suo cimitero' };
  switch (p.land) {
    case 'U': return `Se risolve, ${opp} pescherà una carta.`;
    case 'B': return `Se risolve, ${opp} guarderà la tua mano e ti farà scartare una terra.`;
    case 'R': return t ? `Se risolve, la tua ${NAMES[t]} verrà distrutta.` : 'Entrerà senza effetto.';
    case 'G': return t ? `Se risolve, ${opp} riprenderà ${NAMES[t]} dal suo cimitero.` : 'Entrerà senza effetto.';
    case 'W': return t ? `Se risolve, ${opp} riattiverà la sua ${NAMES[t]} e ${reuse[t]}.` : 'Entrerà senza effetto.';
  }
  return '';
}

// Indici in mano: l'Isola che verrebbe scartata col contrasto e le carte scartabili insieme
function counterPlan() {
  const hand = G.hand;
  const others = G.counterOthers || [];
  if (!others.length) return null;
  const pickIdx = ui.pick ? ui.pick.idx : -1;
  const islandIdx = hand.findIndex((c, i) => c === 'U' && i !== pickIdx);
  const eligible = hand.map((c, i) => i !== islandIdx && others.includes(c));
  return { islandIdx, eligible };
}

function actionsHtml() {
  const task = myTask();
  const g = G;
  const hint = (t) => (info() ? `<div class="hint">${t}</div>` : '');
  if (!task) {
    if (g.phase === 'playing' && !ui.animating && S.vsBot && g.active !== g.you && g.step === 'main') return hint('Il computer sta pensando…');
    return '';
  }
  if (task === 'main') {
    if (ui.staged) {
      const c = ui.staged.card;
      return hint(c === 'R' ? 'Tocca la terra avversaria da distruggere.' : c === 'G' ? 'Tocca nel tuo cimitero la terra da recuperare.' : 'Tocca la tua terra da riattivare.');
    }
    const how = prefs.controls === 'drag' ? 'Trascina una carta al centro per giocarla.' : 'Tocca una carta e poi il centro per giocarla.';
    if (S.tutorial) return Tut.wantsPass() ? '<button class="btn passbtn" data-act="pass">Passa il turno</button>' : ''; // nel tutorial si fa sempre la mossa indicata
    return `${hint(how)}<button class="btn passbtn" data-act="pass">Passa il turno</button>`;
  }
  if (task === 'response') {
    const p = g.pending;
    const plan = counterPlan();
    const allowLabel = p.owner === g.you ? 'Accetta' : 'Lascia risolvere';
    // nessun contrasto possibile: si risolve da solo (nel tutorial invece si aspetta il pulsante)
    if (!plan) return S.tutorial ? `<div class="acts"><button class="btn primary" data-act="allow">${allowLabel}</button></div>` : hint(consequenceText(p));
    if (!ui.counter) {
      return `${hint(consequenceText(p))}
        <div class="acts"><button class="btn counterbtn" data-act="counter-start">${SYM.U} Contrasta</button>
        <button class="btn primary" data-act="allow">${allowLabel}</button></div>
        ${hint('Contrastare costa un\'Isola e un\'altra terra dalla tua mano.')}`;
    }
    const result = p.owner === g.you ? '<i class="yes">✓</i>' : '<i class="no">✕</i>';
    const second = ui.pick ? `<span class="fcard">${SYM[ui.pick.card]}</span>` : '<span class="fcard q">?</span>';
    return `<div class="formula"><span class="fcard">${SYM.U}</span><b>+</b>${second}<b>→</b><span class="fcard res">${SYM[p.land]}${result}</span></div>
      ${ui.pick ? '' : hint('Tocca in mano la seconda terra da scartare.')}
      <div class="acts">${ui.pick ? '<button class="btn counterbtn" data-act="counter-confirm">Conferma</button>' : ''}
      <button class="btn ghost" data-act="counter-cancel">Annulla</button></div>`;
  }
  if (task === 'choice') {
    const c = g.choice;
    if (c.kind === 'discard') return '';
    return hint(c.kind === 'destroy' ? 'Tocca la terra avversaria da distruggere.' : 'Tocca nel tuo cimitero la terra da recuperare.');
  }
  return '';
}

function timerHtml() {
  if (!S.timer || !G || G.phase !== 'playing') return `<div id="timer" class="timer off"></div>`;
  return `<div id="timer" class="timer ${S.timer.actor === G.you ? 'mine' : ''}"><div class="fill"></div><span class="tlabel"></span></div>`;
}

function handHtml(task) {
  const g = G, hand = g.hand;
  if (!hand.length) return '';
  const plan = task === 'response' && ui.counter ? counterPlan() : null;
  return hand.map((t, i) => {
    let cls = '', attrs = `data-idx="${i}"`, badge = '';
    if (task === 'main' && g.playable && t in g.playable) {
      cls = 'playable';
      attrs += ` data-act="card" data-v="${t}"`;
      if (ui.sel && ui.sel.idx === i) cls += ' lift';
      if (ui.staged && ui.staged.idx === i) cls += ' away';
    } else if (task === 'main' || !task) cls = 'idle';
    if (plan) {
      if (i === plan.islandIdx || (ui.pick && ui.pick.idx === i)) { cls = 'lift marked'; badge = '<div class="badge">✕</div>'; }
      else if (plan.eligible[i] && !ui.pick) { cls = 'pick'; attrs += ` data-act="pick" data-v="${t}"`; }
      else cls = 'idle';
    }
    return cardHtml(t, cls, attrs, badge);
  }).join('');
}

const PARTS = ['top', 'timer', 'opp', 'center', 'me', 'hand'];
const partCache = {};
function renderGame() {
  const g = G, me = g.you;
  const oppConnected = S.seats[g.opp.seat] && S.seats[g.opp.seat].connected;
  const st = statusHtml();
  const task = myTask();
  const tg = boardTargets();
  const centerDrop = task === 'main' && !ui.staged && (ui.sel || (drag && drag.active));
  if (task === 'choice' && G.choice.kind === 'regrow') ui.gyOpen = 'me';

  const parts = {
    top: `<div class="topbar">
      <span>${S.tutorial ? 'Tutorial' : S.vsBot ? 'Contro il computer' : `Stanza <b class="code">${S.code}</b>`}${wsReady || S.local ? '' : ' · <span class="warn">riconnessione…</span>'}</span>
      <button class="menubtn" data-act="menu" aria-label="Menu">☰</button>
    </div>`,
    timer: timerHtml(),
    opp: `<section class="zone opp ${g.active === g.opp.seat && g.phase === 'playing' ? 'active' : ''}">
      <div class="zhead">
        <span class="pname"><span class="dot ${oppConnected ? '' : 'off'}"></span>${esc(g.opp.name)}${closeToWin(g.opp.bf) ? ' <span class="near">!</span>' : ''}</span>
        <div class="backs" id="hand-opp" title="Carte in mano all'avversario">${oppFan(g.opp.handCount)}<small>${g.opp.handCount}</small></div>
        ${deckHtml(g.opp, 'opp')}
        ${gyHtml(g.opp, 'opp')}
      </div>
      ${bfHtml(g.opp, 'opp', tg.opp)}
    </section>`,
    center: `<section class="center ${centerDrop ? 'droppable' : ''}" id="center" ${task === 'main' && ui.sel && !ui.staged ? 'data-act="center"' : ''}>
      ${stackHtml()}
      <div class="status ${st.cls}" id="status">${st.text}</div>
      <div class="actions-area">${actionsHtml()}</div>
    </section>`,
    me: `<section class="zone me ${g.active === me && g.phase === 'playing' ? 'active' : ''}">
      ${bfHtml(g.me, 'me', tg.me)}
      <div class="zhead">
        <span class="pname"><span class="dot"></span>${esc(g.me.name)}${closeToWin(g.me.bf) ? ' <span class="near">!</span>' : ''}</span>
        ${deckHtml(g.me, 'me')}
        ${gyHtml(g.me, 'me', tg.gyMe)}
      </div>
    </section>`,
    hand: `<div class="hand ${task === 'response' && ui.counter ? 'counter-mode' : ''}" id="hand-me">${handHtml(task)}</div>`,
    over: `${task === 'choice' && g.choice.kind === 'discard' ? revealHtml() : ''}
      ${g.phase === 'over' && !ui.animating ? overHtml() : ''}
      ${S.tutorial && g.phase === 'playing' ? Tut.html() : ''}
      ${ui.menu ? menuHtml() : ''}${ui.log ? logHtml() : ''}${ui.rules ? rulesHtml() : ''}${ui.stats ? Stats.html() : ''}${ui.transfer ? Stats.transferHtml() : ''}`,
  };
  // Si ridisegnano solo le parti dello schermo che sono cambiate
  if (!app.dataset.game) {
    app.innerHTML = `<div class="game">${PARTS.map((k) => `<div class="part" data-p="${k}"></div>`).join('')}</div>
      <div id="banner" class="banner hidden"></div><div class="part" data-p="over"></div>`;
    app.dataset.game = '1';
    for (const k in partCache) delete partCache[k];
  }
  $('.game', app).classList.toggle('busy', ui.animating);
  let handChanged = false;
  for (const k of [...PARTS, 'over']) {
    if (partCache[k] === parts[k]) continue;
    $(`.part[data-p="${k}"]`, app).innerHTML = parts[k];
    partCache[k] = parts[k];
    if (k === 'hand') handChanged = true;
  }
  if (handChanged) layoutHand();
  Altar.place();
  bindOverlays();
  if (ui.menu) fitBox($('.sheet', app), 16);
  tickTimer();
  fitCenter();
  drawArrows();
  Tut.place();
  maybeAutoAllow(task);
}

// Se non posso contrastare, la terra risolve da sola dopo una pausa casuale (così non si capisce cosa ho in mano)
function maybeAutoAllow(task) {
  if (task !== 'response' || counterPlan() || S.tutorial) return;
  const key = `${G.turn}|${G.pending.counters}|${G.pending.land}`;
  if (autoAllowKey === key) return;
  autoAllowKey = key;
  setTimeout(() => {
    if (myTask() === 'response' && `${G.turn}|${G.pending.counters}|${G.pending.land}` === key) act({ type: 'allow' });
  }, 900 + Math.random() * 1300);
}

// ---------- Mano a ventaglio: tutte le carte sempre visibili ----------
function layoutHand() {
  const hand = $('#hand-me');
  if (!hand) return;
  // la carta posata al centro non occupa posto nel ventaglio
  const cards = $$('.card', hand).filter((c) => !c.classList.contains('away'));
  const n = cards.length;
  if (!n) return;
  const W = hand.clientWidth;
  const cw = cards[0].offsetWidth || 66;
  const pad = 10 + cw * 0.14; // margine per la rotazione delle carte esterne
  const step = n > 1 ? Math.min(cw + 6, (W - cw - pad * 2) / (n - 1)) : 0;
  const total = cw + step * (n - 1);
  const start = Math.max(pad, (W - total) / 2);
  const mid = (n - 1) / 2;
  const ang = n > 1 ? Math.min(3, 15 / (n - 1)) : 0;
  hand.classList.add('laying'); // le carte vanno al loro posto senza scivolare dall'angolo
  cards.forEach((c, i) => {
    const off = i - mid;
    c.style.setProperty('--x', `${Math.round(start + i * step)}px`);
    c.style.setProperty('--rot', `${off * ang}deg`);
    c.style.setProperty('--dy', `${Math.min(10, off * off * ang * 0.25)}px`);
    c.style.zIndex = String(i + 1);
  });
  void hand.offsetWidth; hand.classList.remove('laying');
}
window.addEventListener('resize', () => { layoutHand(); drawArrows(); Altar.place(); });

// Palude: la mano avversaria a schermo intero, sfondo sfocato
function revealHtml() {
  const c = G.choice;
  return `<div class="overlay blur reveal">
    <div class="rv-title">Mano di ${esc(G.opp.name)}</div>
    <div class="rv-cards" style="--n:${Math.max(3, c.revealed.length)}">${c.revealed.map((t, i) => cardHtml(t, 'big pick', `data-act="choose" data-v="${t}" style="animation-delay:${i * 60}ms"`)).join('')}</div>
  </div>`;
}

function overHtml() {
  const g = G;
  const won = g.winner === g.you;
  const title = g.winner == null ? 'Pareggio' : won ? 'Hai vinto!' : `Ha vinto ${esc(g.opp.name)}`;
  const iAsked = S.rematch[g.you], oppAsked = S.rematch[g.opp.seat];
  if (S.tutorial) return `<div class="overlay"><div class="box endbox won">
    <h2>Tutorial completato</h2>
    <p>Hai visto all'opera tutte e cinque le terre e anche il contrasto. Ora prova una partita vera.</p>
    <button class="btn primary" data-act="rematch">Gioca contro il computer</button>
    <button class="btn" data-act="leave-now">Torna alla home</button>
  </div></div>`;
  return `<div class="overlay"><div class="box endbox ${g.winner == null ? '' : won ? 'won' : 'lost'}">
    <h2>${title}</h2>
    <p class="muted">${esc(g.endText || '')}</p>
    ${iAsked && !S.vsBot ? `<p>In attesa che ${esc(g.opp.name)} accetti la rivincita…</p>`
      : `<button class="btn primary" data-act="rematch">${oppAsked && !S.vsBot ? 'Accetta la rivincita' : 'Rivincita'}</button>`}
    <button class="btn" data-act="leave-now">Esci</button>
  </div></div>`;
}

function menuHtml() {
  const tog = (on) => `<span class="tog ${on ? 'on' : ''}"><span></span></span>`;
  const seg = (act, cur, opts) => `<div class="seg small">${opts.map(([v, l]) => `<button data-act="${act}" data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return `<div class="sheet-bd" data-act="menu-close"></div>
  <div class="sheet">
    <h3>Menu</h3>
    ${ui.confirmLeave ? `
      <p>Vuoi davvero uscire? ${S.tutorial ? 'Potrai rifare il tutorial quando vuoi dalla home.' : S.vsBot ? 'La partita contro il computer verrà chiusa.' : 'Non potrai rientrare in questa partita.'}</p>
      <button class="btn exitbtn" data-act="leave-now">Esci dalla partita</button>
      <button class="btn" data-act="leave-no">Annulla</button>` : `
    <button class="btn fullrow" data-act="toggle-full" data-full>${Full.label()}</button>
    <div class="mrow col"><span>Comandi</span>${seg('set-controls', prefs.controls, [['drag', 'Trascina'], ['tap', 'Tocca']])}</div>
    <div class="mrow col"><span>Grafica</span>${seg('set-gfx', Scene.on ? 'adv' : 'lite', [['lite', 'Leggera'], ['adv', 'Avanzata (prova)']])}</div>
    <div class="mrow col"><span>Effetti grafici</span>${seg('set-fx', prefs.fx, [['high', 'Completi'], ['low', 'Ridotti']])}</div>
    <button class="mrow" data-act="toggle-info">Info nella plancia ${tog(prefs.info)}</button>
    <button class="mrow" data-act="toggle-music">Musica ${tog(prefs.music)}</button>
    <button class="mrow" data-act="toggle-sound">Effetti sonori ${tog(prefs.sound)}</button>
    <button class="mrow" data-act="toggle-vibe">Vibrazione ${tog(prefs.vibe)}</button>
    <div class="mrow two"><button data-act="open-log">Registro</button><button data-act="open-rules">Regole</button><button data-act="open-stats">Statistiche</button></div>
    <button class="btn" data-act="menu-close">Chiudi</button>
    <button class="btn exitbtn" data-act="leave-ask">Esci dalla partita</button>`}
  </div>`;
}

function logHtml() {
  return `<div class="overlay" data-act="close-log"><div class="box rules" onclick="event.stopPropagation()">
    <h2>Registro</h2>
    <ol class="loglist">${G.log.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
    <button class="btn primary" data-act="close-log">Chiudi</button>
  </div></div>`;
}

function rulesHtml() {
  return `<div class="overlay"><div class="box rules">
    <h2 style="text-align:center">Regole</h2>
    <h4>Obiettivo</h4>Avere in gioco una terra di ogni tipo, oppure 5 terre dello stesso tipo. Si vince appena la terra entra in gioco.
    <h4>Preparazione</h4><ul><li>Mazzo da 50 carte: 10 per tipo.</li><li>Si pescano 5 carte, niente mulligan.</li><li>Chi inizia salta la prima pescata.</li></ul>
    <h4>Turno</h4>Peschi una carta, poi puoi giocare <b>una</b> terra (o passare). L'effetto si attiva quando entra in gioco.
    <h4>Terre</h4><ul>
      <li>${SYM.W} <b>Pianura</b>: riattiva l'effetto di un'altra tua terra in gioco (non Pianura).</li>
      <li>${SYM.U} <b>Isola</b>: quando entra peschi 1 carta. Dalla mano, scartala con un'altra terra per contrastare la terra appena giocata dall'avversario (e il suo effetto). Anche un contrasto può essere contrastato.</li>
      <li>${SYM.B} <b>Palude</b>: guardi la mano avversaria e scegli una terra da scartare.</li>
      <li>${SYM.R} <b>Montagna</b>: distruggi una terra avversaria in gioco.</li>
      <li>${SYM.G} <b>Foresta</b>: riprendi in mano una terra dal tuo cimitero.</li></ul>
    Senza bersagli la terra si gioca comunque, senza effetto.
    <h4>Comandi</h4>Porta la carta al centro della plancia (trascinandola, o toccandola e poi toccando il centro). Se ha un bersaglio, tocca poi la carta da colpire: terra avversaria per la Montagna, tua terra per la Pianura, carta nel tuo cimitero per la Foresta. Il cimitero si apre toccando 🪦.
    <h4>Tempo</h4>Se il tempo scade passi il turno; se scade durante una risposta la terra avversaria risolve.
    <h4>Carte finite</h4>Se un mazzo è vuoto non si pesca. Quando entrambi i mazzi sono vuoti e nessuno può o vuole più giocare, vince chi ha più tipi di terra diversi in gioco; in parità vince chi ha giocato l'ultima terra.
    <div style="text-align:center;margin-top:12px"><button class="btn primary" id="rules-close">Chiudi</button></div>
  </div></div>`;
}
function bindOverlays() {
  const b = $('#rules'); if (b) b.onclick = () => { ui.rules = true; render(); };
  Stats.bind();
  const c = $('#rules-close'); if (c) c.onclick = () => { ui.rules = false; render(); };
}

// ---------- Giocare una carta ----------
// Porta la carta al centro: se serve un bersaglio resta lì in attesa, altrimenti viene giocata subito.
function stageCard(card, idx, rect) {
  if (myTask() !== 'main') return;
  if (!Tut.allows({ type: 'play', card, staging: true })) return;
  if (needsTarget(card)) {
    ui.staged = { card, idx }; ui.sel = null;
    if (card === 'G') ui.gyOpen = 'me';
    Sound.play('play'); vibrate(15);
    Altar.cast(card);
    render();
    FX.cast(card, rectOf($('#stack .card')));
    const el = $('#stack .card');
    if (rect && el) fly(rect, el, card, { dur: 220 });
  } else {
    lastPlay = { card, idx, rect };
    act({ type: 'play', card });
  }
}

// ---------- Click (delegati) ----------
app.addEventListener('click', (e) => {
  if (dragJustEnded) return;
  const el = e.target.closest('[data-act]');
  // chiude il cimitero aperto toccando altrove (non mentre serve sceglierci un bersaglio)
  const gyLocked = (ui.staged && ui.staged.card === 'G') || (myTask() === 'choice' && G.choice.kind === 'regrow');
  if (ui.gyOpen && !e.target.closest('.gywrap') && !gyLocked) {
    ui.gyOpen = null; render();
    if (!el) return;
  }
  if (!el || !app.contains(el)) return;
  const a = el.dataset.act, v = el.dataset.v;
  const idx = el.dataset.idx != null ? Number(el.dataset.idx) : -1;
  switch (a) {
    case 'card': {
      if (prefs.controls === 'drag') { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); return; }
      if (ui.staged) return;
      if (myTask() === 'main' && !Tut.allows({ type: 'play', card: v, staging: true })) return;
      if (ui.sel && ui.sel.idx === idx) return stageCard(v, idx, el.getBoundingClientRect());
      ui.sel = { card: v, idx }; Sound.play('click'); return render();
    }
    case 'center': if (ui.sel) { const c = $(`#hand-me .card[data-idx="${ui.sel.idx}"]`); stageCard(ui.sel.card, ui.sel.idx, rectOf(c)); } return;
    case 'unstage': ui.staged = null; ui.gyOpen = null; clearArrows('aim'); Sound.play('click'); return render();
    case 'pass': return act({ type: 'pass' });
    case 'target':
      if (myTask() === 'main' && ui.staged) {
        lastPlay = { card: ui.staged.card, idx: ui.staged.idx, rect: rectOf($('#stack .card')) };
        return act({ type: 'play', card: ui.staged.card, target: v });
      }
      if (myTask() === 'choice') return act({ type: 'choose', choice: v });
      return;
    case 'gy': if (gyLocked) return; ui.gyOpen = ui.gyOpen === v ? null : v; Sound.play('click'); return render();
    case 'counter-start': ui.counter = true; ui.pick = null; Sound.play('click'); return render();
    case 'counter-cancel': ui.counter = false; ui.pick = null; return render();
    case 'pick': ui.pick = { card: v, idx }; Sound.play('click'); vibrate(10); return render();
    case 'counter-confirm': {
      if (!ui.pick) return;
      const plan = counterPlan();
      lastCounter = { islandIdx: plan.islandIdx, pickIdx: ui.pick.idx };
      return act({ type: 'counter', other: ui.pick.card });
    }
    case 'allow': return act({ type: 'allow' });
    case 'choose': return act({ type: 'choose', choice: v });
    case 'menu': ui.menu = true; ui.confirmLeave = false; return render();
    case 'menu-close': ui.menu = false; ui.confirmLeave = false; return render();
    case 'set-controls': prefs.controls = v; ui.sel = null; Sound.play('click'); return render();
    case 'set-theme': prefs.theme = v; applyPrefs(); Sound.play('click'); return render();
    case 'set-gfx':
      if (v === 'adv' && !Scene.supported()) { toast('Questo dispositivo non supporta la grafica avanzata'); return; }
      prefs.gfx = v; applyPrefs(); Sound.play('click'); return render();
    case 'set-fx': prefs.fx = v; applyPrefs(); Sound.play('click'); return render();
    case 'toggle-info': prefs.info = !prefs.info; Sound.play('click'); return render();
    case 'toggle-sound': prefs.sound = !prefs.sound; Sound.unlock(); Sound.play('click'); return render();
    case 'toggle-music': setMusic(!prefs.music); return render();
    case 'toggle-vibe':
      prefs.vibe = !prefs.vibe;
      if (prefs.vibe) {
        vibrate([90, 60, 90]); // prova
        if (!navigator.vibrate && !/iP(hone|ad|od)/.test(navigator.userAgent)) toast('Questo browser non supporta la vibrazione', true);
      }
      return render();
    case 'open-log': ui.menu = false; ui.log = true; return render();
    case 'close-log': ui.log = false; return render();
    case 'open-rules': ui.menu = false; ui.rules = true; return render();
    case 'leave-ask': ui.confirmLeave = true; return render();
    case 'leave-no': ui.confirmLeave = false; return render();
    case 'leave-now': return leave();
    case 'open-stats': ui.menu = false; ui.stats = true; return render();
    case 'tut-next': Tut.next(); return render();
    case 'toggle-full': return Full.toggle();
    case 'tut-go': Sound.play('click'); return send({ t: 'tut-go' });
    case 'tut-back': Tut.prev(); Sound.play('click'); return render();
    case 'rematch': return send({ t: 'rematch' });
  }
});
app.addEventListener('contextmenu', (e) => { if (e.target.closest('.game')) e.preventDefault(); });

// =====================================================================
//  Trascinamento: parte subito (al primo movimento o dopo un attimo)
// =====================================================================
const HOLD_MS = 90, SLOP = 4;
let drag = null;
let dragJustEnded = false;

app.addEventListener('pointerdown', (e) => {
  if (prefs.controls !== 'drag' || myTask() !== 'main' || drag || ui.staged) return;
  const el = e.target.closest('.hand .card.playable');
  if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
  // tutorial: la carta sbagliata non si stacca nemmeno dalla mano
  if (!Tut.allows({ type: 'play', card: el.dataset.card, staging: true })) { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); return; }
  drag = { idx: Number(el.dataset.idx), card: el.dataset.card, el, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, pid: e.pointerId };
  el.classList.add('pressing');
  drag.timer = setTimeout(startDrag, HOLD_MS);
});

function startDrag() {
  if (!drag || drag.active) return;
  const { el } = drag;
  const r = el.getBoundingClientRect();
  drag.active = true;
  drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top;
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = el.offsetWidth + 'px'; ghost.style.height = el.offsetHeight + 'px'; ghost.style.setProperty('--gw', el.offsetWidth + 'px');
  ghost.innerHTML = cardHtml(drag.card, 'floating');
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  el.classList.remove('pressing'); el.classList.add('ghosted');
  const center = $('#center');
  if (center) center.classList.add('droppable');
  drag.centerRect = rectOf(center);
  Altar.state();
  document.body.classList.add('dragging');
  moveGhost(drag.x, drag.y);
  Sound.play('grab'); vibrate(15);
  FX.sparkle(r, drag.card, 8);
}

function moveGhost(x, y) {
  if (!drag || !drag.ghost) return;
  drag.ghost.style.transform = `translate(${x - drag.dx}px, ${y - drag.dy - 20}px)`;
  const center = $('#center');
  const r = drag.centerRect;
  const over = !!(r && x >= r.left && x <= r.right && y - 20 >= r.top && y - 20 <= r.bottom);
  if (over !== drag.over) {
    if (center) center.classList.toggle('dropover', over);
    Altar.state();
    if (over) vibrate(8);
    drag.over = over;
  }
}

window.addEventListener('pointermove', (e) => {
  if (drag && e.pointerId === drag.pid) {
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > SLOP) startDrag();
      else return;
    }
    e.preventDefault();
    queueMove(() => moveGhost(drag.x, drag.y));
    return;
  }
  if (ui.staged) { const x = e.clientX, y = e.clientY; queueMove(() => aimArrow(x, y)); }
}, { passive: false });

// Il dito può muoversi più volte per frame: si aggiorna una volta sola, al frame successivo
let moveJob = null;
function queueMove(fn) {
  if (!moveJob) requestAnimationFrame(() => { const f = moveJob; moveJob = null; if (f) f(); });
  moveJob = fn;
}

document.addEventListener('touchmove', (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });

window.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  if (!drag.active) { finishDrag(); return; } // tocco veloce: lo gestisce il click
  const d = drag;
  dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 60);
  if (d.over && myTask() === 'main') {
    const rect = d.ghost.firstElementChild.getBoundingClientRect();
    const handCard = d.el;
    finishDrag(true);
    handCard.style.visibility = 'hidden';
    stageCard(d.card, d.idx, rect);
  } else {
    Sound.play('deny');
    cancelDrag(false);
  }
});
window.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.pid) cancelDrag(false); });

function finishDrag(skipRender) {
  if (!drag) return;
  clearTimeout(drag.timer);
  const center = $('#center');
  if (center) center.classList.remove('droppable', 'dropover');
  Altar.state();
  if (drag.ghost) drag.ghost.remove();
  if (drag.el) drag.el.classList.remove('pressing', 'ghosted');
  document.body.classList.remove('dragging');
  drag = null;
  if (needRender && !skipRender) render();
}

// Annulla il trascinamento: la carta torna in mano con un'animazione
function cancelDrag(instant) {
  if (!drag) return;
  const d = drag;
  if (!d.active || instant || !d.ghost) { finishDrag(); return; }
  const from = d.ghost.firstElementChild.getBoundingClientRect();
  const to = d.el.getBoundingClientRect();
  const ghost = d.ghost;
  d.ghost = null;
  const el = d.el;
  el.style.visibility = 'hidden';
  finishDrag(true);
  ghost.firstElementChild.classList.remove('floating');
  ghost.animate([
    { transform: `translate(${from.left}px, ${from.top}px)` },
    { transform: `translate(${to.left}px, ${to.top}px)` },
  ], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {})
    .then(() => { ghost.remove(); el.style.visibility = ''; if (needRender) render(); });
}

// =====================================================================
//  Frecce: chi colpisce cosa
// =====================================================================
const ARROW_COLOR = { R: '#d9482f', W: '#e0a92e', G: '#2f9e6a', B: '#8a6cc0', U: '#1f8fb8' };
function clearArrows(cls) {
  const svg = $('#arrows'); if (!svg) return;
  $$(cls ? `g.${cls}` : 'g.arrow', svg).forEach((n) => n.remove());
  syncArrows();
}
function syncArrows() { const svg = $('#arrows'); if (svg) svg.classList.toggle('on', svg.childElementCount > 0); }
function centerOf(el) { const r = rectOf(el); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r } : null; }

// Disegna una freccia curva da a → b. Ritorna il gruppo SVG.
function arrow(a, b, color, cls = 'pending', animate = true) {
  const svg = $('#arrows'); if (!svg || !a || !b) return null;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 20) return null;
  const shrink = b.r ? Math.min(b.r.width, b.r.height) * 0.42 : 0; // la punta si ferma sul bordo
  if (a.r) { // la freccia parte dal bordo della carta, non dal centro
    const k = Math.min(a.r.width, a.r.height) * 0.45 / len;
    a = { x: a.x + dx * k, y: a.y + dy * k };
  }
  const ex = b.x - (dx / len) * shrink, ey = b.y - (dy / len) * shrink;
  const nx = -dy / len, ny = dx / len, bend = Math.min(60, len * 0.25) * (dx >= 0 ? -1 : 1);
  const cx = (a.x + ex) / 2 + nx * bend, cy = (a.y + ey) / 2 + ny * bend;
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', `arrow ${cls}`);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', `M${a.x},${a.y} Q${cx},${cy} ${ex},${ey}`);
  path.setAttribute('stroke', color);
  path.setAttribute('class', 'shaft');
  const ang = Math.atan2(ey - cy, ex - cx), s = 16;
  // la linea si ferma alla base della punta, così le "ali" partono esattamente dalla fine
  const bx = ex - s * 0.8 * Math.cos(ang), by = ey - s * 0.8 * Math.sin(ang);
  path.setAttribute('d', `M${a.x},${a.y} Q${cx},${cy} ${bx},${by}`);
  const head = document.createElementNS(ns, 'path');
  head.setAttribute('d', `M${ex},${ey} L${ex - s * Math.cos(ang - 0.5)},${ey - s * Math.sin(ang - 0.5)} L${ex - s * Math.cos(ang + 0.5)},${ey - s * Math.sin(ang + 0.5)} Z`);
  head.setAttribute('fill', color);
  head.setAttribute('class', 'head');
  const under = path.cloneNode(); under.setAttribute('class', 'under'); under.removeAttribute('stroke');
  g.appendChild(under); g.appendChild(path); g.appendChild(head);
  svg.appendChild(g);
  svg.classList.add('on');
  if (animate) {
    const L = path.getTotalLength();
    for (const el of [under, path]) {
      el.style.strokeDasharray = `${L}`;
      el.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: D(350), easing: 'ease-out', fill: 'forwards' })
        .finished.catch(() => {}).then(() => { el.style.strokeDasharray = ''; });
    }
    head.animate([{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: D(350), fill: 'forwards' });
  }
  return g;
}

// Elemento colpito dalla terra in attesa
function pendingTargetEl(p) {
  if (!p || !p.target) return null;
  const ownerW = who(p.owner), otherW = ownerW === 'me' ? 'opp' : 'me';
  if (p.land === 'R') return slotEl(otherW, p.target);
  if (p.land === 'W') return slotEl(ownerW, p.target);
  if (p.land === 'G') return gyEl(ownerW, p.target);
  return null;
}

let lastArrowKey = null;
let arrowDone = null; // l'effetto mirato è già avvenuto: la freccia sparisce
function drawArrows() {
  clearArrows('pending');
  const p = G && (G.pending || G.resolving);
  if (!p || !p.target || ui.staged || arrowDone === `${G.turn}|${p.land}`) { if (!p) lastArrowKey = null; return; }
  const key = `${G.turn}|${p.land}|${p.target}`;
  arrow(centerOf($('#stack .card')), centerOf(pendingTargetEl(p)), ARROW_COLOR[p.land], 'pending', key !== lastArrowKey);
  lastArrowKey = key;
}

// Mentre si sceglie il bersaglio, la freccia segue il dito/mouse e si aggancia ai bersagli validi
let aimCache = null; // bersagli e origine letti una volta per carta posata
function aimArrow(x, y) {
  clearArrows('aim');
  if (!ui.staged) { aimCache = null; return; }
  const src = $('#stack .card');
  if (!aimCache || aimCache.src !== src) aimCache = { src, from: centerOf(src), targets: $$('.target').map((el) => ({ el, c: centerOf(el) })) };
  const tg = aimCache.targets.find((t) => t.c && Math.abs(t.c.x - x) < t.c.r.width / 2 + 6 && Math.abs(t.c.y - y) < t.c.r.height / 2 + 6);
  arrow(aimCache.from, tg ? tg.c : { x, y }, ARROW_COLOR[ui.staged.card], 'aim' + (tg ? ' locked' : ''), false);
}

async function flashArrow(fromEl, toEl, color, ms = 500) {
  const g = arrow(centerOf(fromEl), centerOf(toEl), color, 'flash', true);
  await wait(ms);
  if (g) g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(200), fill: 'forwards' }).finished.catch(() => {}).then(() => { g.remove(); syncArrows(); });
}

// ---------- Timer ----------
let lastTick = null;
function tickTimer() {
  const el = $('#timer');
  if (!el || el.classList.contains('off') || !S || !S.timer) return;
  const now = Date.now() + clockOffset;
  const total = S.timer.total * 1000;
  const left = Math.max(0, S.timer.deadline - now);
  const shown = Math.min(left, total);
  const fill = $('.fill', el);
  // la barra avanza a scatti di 1/60: si ridisegna solo quando cambia davvero
  const k = (Math.ceil((shown / total) * 60) / 60).toFixed(4);
  if (fill.dataset.k !== k) { fill.dataset.k = k; fill.style.transform = `scaleX(${k})`; }
  const secs = Math.ceil(shown / 1000);
  const mine = S.timer.actor === G.you;
  const label = `${mine ? 'Tu' : G.opp.name} · ${secs}s`;
  const tl = $('.tlabel', el); if (tl.textContent !== label) tl.textContent = label;
  el.classList.toggle('low', secs <= 5);
  if (mine && secs <= 5 && secs > 0 && lastTick !== secs && !ui.animating) { lastTick = secs; Sound.play('tick'); if (secs === 3) vibrate(40); }
}
setInterval(tickTimer, 200);

// =====================================================================
//  Animazioni
// =====================================================================
const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
const okRect = (r) => r && r.width > 0 && r.height > 0;

function handEl(w, card, idx) {
  if (w === 'me') {
    if (idx != null && idx >= 0) { const e = $(`#hand-me .card[data-idx="${idx}"]`); if (e && (!card || e.dataset.card === card)) return e; }
    const cards = $$(`#hand-me .card${card ? `[data-card="${card}"]` : ''}`);
    return cards[cards.length - 1] || $('#hand-me');
  }
  const backs = $$('#hand-opp .back');
  return backs[backs.length - 1] || $('#hand-opp');
}
const slotEl = (w, t) => $(`#slot-${w}-${t}`);
const gyEl = (w, t) => (t && $(`#gy-${w}-${t}`)) || $(`#gy-${w}`);
const deckEl = (w) => $(`#deck-${w} .pile`) || $(`#deck-${w}`);
const stackCard = () => $('#stack .card') || $('#stack');

function makeFlyer(face, w, h) {
  const f = document.createElement('div');
  if (face) { f.className = `flyer card k-${face} ${w < 120 ? 'compact' : ''}`; f.innerHTML = cardFace(face, w >= 120); }
  else f.className = 'flyer cardback';
  Object.assign(f.style, { width: w + 'px', height: h + 'px' }); f.style.setProperty('--w', w + 'px');
  document.body.appendChild(f);
  return f;
}

// Fa volare una carta da `from` (rettangolo) all'elemento `toEl`.
// Con `flip` (solo grafica avanzata) la carta parte coperta e si gira in volo.
function fly(from, toEl, face, { dur = 420, hideTarget = true, delay = 0, flip = false } = {}) {
  const to = rectOf(toEl);
  if (!okRect(from) || !okRect(to)) return Promise.resolve();
  const W = Math.max(46, Math.min(Math.max(to.width, from.width * 0.8), 190)), H = W * 1.4;
  // grafica avanzata: il volo lo disegna la scena (la carta si gira e si piega in aria)
  if (Scene.active) {
    if (hideTarget && toEl) toEl.style.visibility = 'hidden';
    setTimeout(() => FX.trail({ sx: from.left + from.width / 2, sy: from.top + from.height / 2, ex: to.left + to.width / 2, ey: to.top + to.height / 2, w: W * 0.8, h: H * 0.8 }, face || 'N', D(dur)), D(delay));
    return Scene.fly(from, to, face, { dur: D(dur), delay: D(delay), flip, mini: !!(toEl && toEl.closest && toEl.closest('.slot')) })
      .then(() => { if (hideTarget && toEl) toEl.style.visibility = ''; });
  }
  const f = makeFlyer(face, W, H);
  const sx = from.left + from.width / 2 - W / 2, sy = from.top + from.height / 2 - H / 2;
  const ex = to.left + to.width / 2 - W / 2, ey = to.top + to.height / 2 - H / 2;
  const s0 = Math.max(0.15, Math.min(from.width / W, 1.2)), s1 = Math.max(0.15, Math.min(to.width / W, 1.2));
  if (hideTarget && toEl) toEl.style.visibility = 'hidden';
  const anim = f.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(${s0})`, opacity: 0.9 },
    { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 30}px) scale(${Math.max(s0, s1) * 1.08})`, opacity: 1, offset: 0.5 },
    { transform: `translate(${ex}px, ${ey}px) scale(${s1})`, opacity: 1 },
  ], { duration: D(dur), delay: D(delay), easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' });
  setTimeout(() => FX.trail({ sx: sx + W / 2, sy: sy + H / 2, ex: ex + W / 2, ey: ey + H / 2, w: W * 0.8, h: H * 0.8 }, face || 'N', D(dur)), D(delay));
  return anim.finished.catch(() => {}).then(() => {
    f.remove();
    if (hideTarget && toEl) toEl.style.visibility = '';
  });
}

function pulse(el, cls = 'pulse', ms = 600) {
  if (!el) return Promise.resolve();
  el.style.animationDuration = D(ms) + 'ms';
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  return wait(ms).then(() => { el.classList.remove(cls); el.style.animationDuration = ''; });
}

function banner(text, mine) {
  const b = $('#banner');
  if (!b) return Promise.resolve();
  b.textContent = text;
  b.style.animationDuration = D(1000) + 'ms';
  b.className = 'banner hidden'; void b.offsetWidth; // riavvia l'animazione (il banner ora resta nel DOM)
  b.className = `banner ${mine ? 'mine' : ''}`;
  return wait(1000).then(() => b.classList.add('hidden'));
}

function setCaption(text) {
  ui.caption = text;
  const s = $('#status');
  if (s) { s.innerHTML = text; s.className = 'status cap'; }
}

function endSound(ev) {
  if (!G) return;
  if (ev.winner == null) Sound.play('lose');
  else if (ev.winner === G.you) { Sound.play('win'); vibrate([60, 40, 120]); return FX.win(); }
  else { Sound.play('lose'); vibrate(200); return FX.lose(); }
  return 0;
}

async function animateStep(ev, next) {
  if (!G || ev.type === 'deal') {
    G = next; ui.caption = ''; render();
    if (ev.type === 'deal') await animateDeal();
    return;
  }
  const w = who(ev.player);
  const opp = esc(G.opp.name);
  const say = (p, mine, theirs) => (p === G.you ? mine.charAt(0).toUpperCase() + mine.slice(1) : `${opp} ${theirs}`);
  // origine delle frecce degli effetti: la terra che risolve, o la terra riattivata dalla Pianura
  const srcEl = () => (lastReuse ? slotEl(lastReuse.w, lastReuse.card) : stackCard());
  const r = next.resolving || G.resolving;
  const direct = (land, card) => r && !lastReuse && r.land === land && r.target === card; // freccia già disegnata

  switch (ev.type) {
    case 'turn': {
      G = next; ui.caption = ''; render();
      const mine = ev.player === G.you;
      if (mine) { Sound.play('turn'); vibrate(30); }
      await banner(mine ? 'Il tuo turno' : `Turno di ${G.opp.name}`, mine);
      return;
    }
    case 'draw': {
      const from = rectOf(deckEl(w));
      G = next; render();
      Sound.play('draw');
      const to = w === 'me' ? handEl('me', ev.card) : handEl('opp');
      await fly(from, to, w === 'me' ? ev.card : null, { dur: 380, flip: true });
      if (w === 'me') { pulse(to, 'newcard', 700); FX.sparkle(rectOf(to), ev.card, 6); }
      return;
    }
    case 'play': {
      let from;
      if (w === 'me' && lastPlay && lastPlay.card === ev.card) from = lastPlay.rect || rectOf(handEl('me', ev.card, lastPlay.idx));
      else from = rectOf(handEl(w, w === 'me' ? ev.card : null));
      lastPlay = null; lastReuse = null; arrowDone = null;
      G = next; render(); clearArrows('pending');
      if (ev.player !== G.you) setCaption(`${opp} gioca ${NAMES[ev.card]}`);
      Sound.play('play');
      Altar.cast(ev.card);
      await fly(from, stackCard(), ev.card, { dur: 420, flip: w !== 'me' });
      FX.cast(ev.card, rectOf(stackCard()));
      if (ev.target) { lastArrowKey = null; drawArrows(); await pulse(pendingTargetEl(G.pending), 'aimed', 500); }
      else await wait(250);
      return;
    }
    case 'counter': {
      let fromU, fromX;
      if (w === 'me' && lastCounter) {
        fromU = rectOf(handEl('me', 'U', lastCounter.islandIdx));
        fromX = rectOf(handEl('me', ev.other, lastCounter.pickIdx));
      } else if (w === 'me') { fromU = rectOf(handEl('me', 'U')); fromX = rectOf(handEl('me', ev.other)); }
      else { fromU = fromX = rectOf(handEl('opp')); }
      lastCounter = null;
      G = next; render();
      setCaption(say(ev.player, `contrasti ${SYM.U}+${SYM[ev.other]}`, `contrasta ${SYM.U}+${SYM[ev.other]}`));
      Sound.play('counter');
      if (ev.player !== G.you) vibrate(60);
      const st = $('#stack');
      if (st) st.classList.add('zap');
      await Promise.all([
        fly(fromU, gyEl(w, 'U'), 'U', { dur: 480 }),
        fly(fromX, gyEl(w, ev.other), ev.other, { dur: 480, delay: 120 }),
      ]);
      FX.counter(rectOf(stackCard()));
      await wait(550);
      return;
    }
    case 'countered': {
      const sc = stackCard();
      clearArrows('pending');
      if (sc && sc.classList.contains('card')) {
        FX.stamp(rectOf(sc));
        await new Promise((r) => setTimeout(r, 950));
        sc.classList.add('fizzle');
        await wait(350);
      }
      const from = rectOf(sc);
      G = next; render();
      Sound.play('fizzle');
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'enter': {
      const from = rectOf(stackCard());
      clearArrows('pending');
      lastReuse = null;
      G = next; render();
      setCaption('');
      Sound.play('land');
      const to = slotEl(w, ev.card);
      await fly(from, to, ev.card, { dur: 420 });
      FX.enter(ev.card, rectOf(to));
      await pulse(to, 'landed', 650);
      return;
    }
    case 'destroy': {
      const s = slotEl(w, ev.card);
      if (direct('R', ev.card)) await wait(150); else await flashArrow(srcEl(), s, ARROW_COLOR.R, 450);
      arrowDone = `${G.turn}|${r ? r.land : ''}`; clearArrows('pending');
      Sound.play('destroy');
      if (ev.player === G.you) vibrate(80);
      await pulse(s, 'boom', 300);
      // la tavola si strappa: i frammenti sono una copia, la casella si aggiorna subito sotto
      FX.destroy(s);
      G = next; render();
      await new Promise((r) => setTimeout(r, 750));
      await pulse(gyEl(w), 'landed', 450);
      return;
    }
    case 'regrow': {
      if (!direct('G', ev.card)) await flashArrow(srcEl(), gyEl(w), ARROW_COLOR.G, 400);
      const from = rectOf(gyEl(w, ev.card));
      arrowDone = `${G.turn}|${r ? r.land : ''}`; clearArrows('pending');
      FX.regrow(from);
      G = next; render();
      Sound.play('regrow');
      const to = w === 'me' ? handEl('me', ev.card) : handEl('opp');
      await fly(from, to, ev.card, { dur: 450 });
      return;
    }
    case 'discard': {
      const from = rectOf(w === 'me' ? handEl('me', ev.card) : handEl('opp'));
      FX.discard(from);
      G = next; render();
      Sound.play('discard');
      await fly(from, gyEl(w, ev.card), ev.card, { dur: 420 });
      return;
    }
    case 'look': {
      const target = ev.player === G.you ? $('#hand-opp') : $('#hand-me');
      await flashArrow(srcEl(), target, ARROW_COLOR.B, 450);
      G = next; render();
      Sound.play('look');
      FX.look(rectOf(target));
      if (ev.player !== G.you) { setCaption(`${opp} scruta la tua mano`); await pulse($('#hand-me'), 'peek', 700); }
      else await wait(350);
      return;
    }
    case 'reuse': {
      G = next; render(); // la freccia Pianura → terra riattivata è già sul tavolo
      Sound.play('reuse');
      FX.reuse(rectOf(slotEl(w, ev.card)));
      lastReuse = { w, card: ev.card }; // l'effetto riattivato parte da questa terra
      await pulse(slotEl(w, ev.card), 'shine', 650);
      return;
    }
    case 'pass': {
      G = next; render();
      setCaption(say(ev.player, 'passi', 'passa'));
      await wait(550);
      return;
    }
    case 'timeout': {
      G = next; render();
      setCaption('Tempo scaduto');
      Sound.play('timeout');
      if (ev.player === G.you) vibrate(150);
      await wait(700);
      return;
    }
    case 'end': {
      G = next; ui.caption = null; render();
      // la finestra del risultato compare quando la scena finale è terminata
      await new Promise((r) => setTimeout(r, Math.max(500, endSound(ev) || 0)));
      return;
    }
    default:
      G = next; render();
  }
}

async function animateDeal() {
  Sound.play('draw');
  const jobs = [];
  const fromMe = rectOf(deckEl('me')), fromOpp = rectOf(deckEl('opp'));
  $$('#hand-me .card').forEach((el, i) => {
    jobs.push(fly(fromMe, el, el.dataset.card, { dur: 380, delay: i * 90 }));
    setTimeout(() => Sound.play('draw'), D(i * 90));
  });
  $$('#hand-opp .back').forEach((el, i) => jobs.push(fly(fromOpp, el, null, { dur: 380, delay: i * 90 })));
  await Promise.all(jobs);
}

// ---------- Avvio ----------
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) connect();
  const c = Sound.ctx;
  if (c) { if (document.hidden) c.suspend(); else { c.resume(); if (prefs.music) Music.start(); } }
});
document.addEventListener('keydown', (e) => {
  if (!G || e.target.closest('input')) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (ui.menu || ui.log || ui.rules) { ui.menu = ui.log = ui.rules = false; ui.confirmLeave = false; }
    else if (ui.staged) { ui.staged = null; clearArrows('aim'); }
    else if (ui.counter) { ui.counter = false; ui.pick = null; }
    else if (ui.sel) ui.sel = null;
    else if (ui.gyOpen) ui.gyOpen = null;
    return render();
  }
  if (k === 'm') { ui.menu = !ui.menu; ui.confirmLeave = false; return render(); }
  if (k === 'p' && myTask() === 'main' && !ui.staged) return act({ type: 'pass' });
});
FX.init();
document.documentElement.style.setProperty('--app-h', `${innerHeight}px`);
applyPrefs();
Local.resume();
render();
connect();
