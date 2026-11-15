'use strict';
// =====================================================================
//  Statistiche: salvate su questo dispositivo, una scheda per ogni nome usato.
//  Un "codice di trasferimento" le copia su un altro dispositivo, senza account né server.
// =====================================================================
const Stats = {
  cur: null, // la partita in corso
  blank: () => ({ played: 0, won: 0, lost: 0, draw: 0, streak: 0, best: 0, fastest: 0, counters: 0, destroyed: 0,
    lands: { W: 0, U: 0, B: 0, R: 0, G: 0 }, winBy: { domain: 0, five: 0, cards: 0 },
    modes: { easy: { p: 0, w: 0 }, normal: { p: 0, w: 0 }, friend: { p: 0, w: 0 } }, tutorial: false, since: Date.now() }),
  keyOf: (name) => String(name || '').trim().toLowerCase() || 'giocatore',
  all() { return ls.get('stats', {}); },
  save(all) { ls.set('stats', all); },
  load(name) {
    const p = this.all()[this.keyOf(name)];
    return p ? { ...this.blank(), ...p.s, name: p.n } : { ...this.blank(), name: name || 'Giocatore' };
  },
  store(name, s) {
    const all = this.all();
    const { name: _, ...rest } = s;
    all[this.keyOf(name)] = { n: name, s: rest };
    this.save(all);
  },

  // chiamata per ogni evento della partita (anche quelli non animati)
  // la partita in corso resta salvata, così conta anche se l'app viene chiusa e riaperta a metà
  fresh: () => ({ code: S.code, mode: !S.vsBot ? 'friend' : S.botLevel === 'easy' ? 'easy' : 'normal', tutorial: !!S.tutorial, lands: { W: 0, U: 0, B: 0, R: 0, G: 0 }, counters: 0, destroyed: 0 }),
  track(ev, game) {
    if (!game || !S) return;
    if (!this.cur) { const saved = ls.get('statsCur', null); this.cur = saved && saved.code === S.code ? saved : null; }
    if (ev.type === 'deal' || !this.cur) this.cur = this.fresh();
    if (ev.type === 'deal') return ls.set('statsCur', this.cur);
    const c = this.cur, me = game.you;
    if (ev.type === 'play' && ev.player === me) c.lands[ev.card]++;
    if (ev.type === 'counter' && ev.player === me) c.counters++;
    if (ev.type === 'destroy' && ev.by === me) c.destroyed++;
    if (ev.type === 'end') { this.finish(ev, game); this.cur = null; ls.set('statsCur', null); }
    else if (ev.type === 'play' || ev.type === 'counter' || ev.type === 'destroy') ls.set('statsCur', c);
  },
  finish(ev, game) {
    const c = this.cur, name = game.me.name, s = this.load(name);
    if (c.tutorial) { s.tutorial = true; return this.store(name, s); }
    const won = ev.winner === game.you, draw = ev.winner == null;
    s.played++;
    s.modes[c.mode].p++;
    if (draw) { s.draw++; s.streak = 0; }
    else if (won) {
      s.won++; s.modes[c.mode].w++; s.streak++; s.best = Math.max(s.best, s.streak);
      const how = game.endReason === 'cards' ? 'cards' : Object.values(game.me.bf).some((n) => n >= 5) ? 'five' : 'domain';
      s.winBy[how]++;
      if (!s.fastest || game.turn < s.fastest) s.fastest = game.turn;
    } else { s.lost++; s.streak = 0; }
    for (const t in c.lands) s.lands[t] += c.lands[t];
    s.counters += c.counters; s.destroyed += c.destroyed;
    this.store(name, s);
  },

  // ---------- trasferimento ----------
  exportCode(name) {
    const s = this.load(name);
    return 'BLG1-' + btoa(unescape(encodeURIComponent(JSON.stringify({ n: s.name, s }))));
  },
  importCode(code) {
    const raw = String(code || '').trim().replace(/\s+/g, '');
    if (!raw.startsWith('BLG1-')) throw new Error('Codice non valido');
    const d = JSON.parse(decodeURIComponent(escape(atob(raw.slice(5)))));
    if (!d || !d.n || !d.s || typeof d.s.played !== 'number') throw new Error('Codice non valido');
    this.store(d.n, { ...this.blank(), ...d.s });
    return d.n;
  },

  // ---------- finestra ----------
  html() {
    const name = prefs.name || 'Giocatore', s = this.load(name);
    const profiles = Object.values(this.all()).map((p) => p.n).filter((n) => this.keyOf(n) !== this.keyOf(name));
    const pct = s.played ? Math.round((s.won / s.played) * 100) : 0;
    const maxLand = Math.max(1, ...TYPES.map((t) => s.lands[t]));
    const mode = (k, label) => (s.modes[k].p ? `<li><span>${label}</span><b>${s.modes[k].w} su ${s.modes[k].p}</b></li>` : '');
    const body = s.played ? `
      <div class="kpis"><div><b>${s.played}</b><span>partite</span></div><div><b>${pct}%</b><span>vinte</span></div><div><b>${s.best}</b><span>serie migliore</span></div></div>
      <h4>Vittorie per modalità</h4>
      <ul class="srows">${mode('easy', 'Computer facile')}${mode('normal', 'Computer normale')}${mode('friend', 'Contro amici')}</ul>
      <h4>Come vinci</h4>
      <ul class="srows"><li><span>Cinque terre diverse</span><b>${s.winBy.domain}</b></li><li><span>Cinque terre uguali</span><b>${s.winBy.five}</b></li><li><span>A carte finite</span><b>${s.winBy.cards}</b></li></ul>
      <h4>Terre giocate</h4>
      <div class="lbars">${TYPES.map((t) => `<div class="lbar"><i class="ico ico-${t}"></i><span style="--k:${(s.lands[t] / maxLand).toFixed(3)}"></span><b>${s.lands[t]}</b></div>`).join('')}</div>
      <ul class="srows"><li><span>Contrasti fatti</span><b>${s.counters}</b></li><li><span>Terre avversarie distrutte</span><b>${s.destroyed}</b></li>
        ${s.fastest ? `<li><span>Vittoria più rapida</span><b>${s.fastest} turni</b></li>` : ''}${s.streak > 1 ? `<li><span>Serie attuale</span><b>${s.streak} vittorie</b></li>` : ''}</ul>`
      : `<p class="muted">Ancora nessuna partita con il nome <b>${esc(s.name)}</b>. Gioca contro il computer o con un amico: i risultati compariranno qui.</p>`;
    return `<div class="overlay" data-act="close-stats"><div class="box rules stats" onclick="event.stopPropagation()">
      <h2>Statistiche</h2>
      <p class="muted">Profilo <b>${esc(s.name)}</b>, salvato su questo dispositivo. Le statistiche seguono il nome con cui giochi.</p>
      ${profiles.length ? `<div class="chips">${profiles.map((n) => `<button class="chip" data-profile="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      ${body}
      <h4>Su un altro dispositivo</h4>
      <p class="muted">Copia il codice qui e incollalo nelle statistiche dell'altro telefono o computer.</p>
      <div class="row"><button class="btn small" id="stats-copy">Copia codice</button><input id="stats-code" class="code-input small" placeholder="Incolla un codice"><button class="btn small" id="stats-import">Importa</button></div>
      <button class="btn primary" id="stats-close">Chiudi</button>
    </div></div>`;
  },
  bind() {
    const close = () => { ui.stats = false; render(); };
    const box = $('.box.stats');
    if (!box) return;
    $('#stats-close').onclick = close;
    box.parentElement.onclick = (e) => { if (e.target === box.parentElement) close(); };
    $$('[data-profile]').forEach((b) => { b.onclick = () => { prefs.name = b.dataset.profile; render(); }; });
    $('#stats-copy').onclick = async () => {
      const code = this.exportCode(prefs.name);
      try { await navigator.clipboard.writeText(code); toast('Codice copiato', true); }
      catch { $('#stats-code').value = code; $('#stats-code').select(); toast('Copia il codice dal campo', true); }
    };
    $('#stats-import').onclick = () => {
      try { const n = this.importCode($('#stats-code').value); prefs.name = n; toast(`Statistiche di ${n} importate`, true); render(); }
      catch { toast('Codice non valido'); }
    };
  },
};
