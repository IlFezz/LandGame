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
    return 'ATLAS1-' + btoa(unescape(encodeURIComponent(JSON.stringify({ n: s.name, s }))));
  },
  importCode(code) {
    const raw = String(code || '').trim().replace(/\s+/g, '');
    const pre = ['ATLAS1-', 'BLG1-'].find((x) => raw.startsWith(x));
    if (!pre) throw new Error('Codice non valido');
    const d = JSON.parse(decodeURIComponent(escape(atob(raw.slice(pre.length)))));
    if (!d || !d.n || !d.s || typeof d.s.played !== 'number') throw new Error('Codice non valido');
    this.store(d.n, { ...this.blank(), ...d.s });
    return d.n;
  },

  // ---------- la pagina Profilo (anche dentro la finestra del menu in partita) ----------
  // Ha sempre la stessa struttura, piena o vuota, così la pagina non cambia altezza.
  panel(name) {
    const s = this.load(name || prefs.name || 'Giocatore');
    const pct = s.played ? Math.round((s.won / s.played) * 100) : 0;
    const maxLand = Math.max(1, ...TYPES.map((t) => s.lands[t]));
    const C = 2 * Math.PI * 34, dash = (C * pct) / 100;
    const mode = (k, label) => `<li><span>${label}</span><b>${s.modes[k].w}<small> / ${s.modes[k].p}</small></b></li>`;
    const initial = esc((s.name || '?').trim().charAt(0).toUpperCase() || '?');
    return `<div class="prof">
      <div class="prof-head"><div class="avatar">${initial}</div><div class="who2"><h2>${esc(s.name)}</h2>
        <small>${s.played ? `${s.played} ${s.played === 1 ? 'partita giocata' : 'partite giocate'}${s.tutorial ? ' · tutorial completato' : ''}` : 'Ancora nessuna partita: le statistiche si riempiono giocando.'}</small></div></div>
      <div class="prof-top">
        <svg class="ring" viewBox="0 0 80 80" aria-label="${pct}% di partite vinte"><circle cx="40" cy="40" r="34" class="ring-bg"/>
          ${pct ? `<circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/>` : ''}
          <text x="40" y="40" class="ring-n">${pct}%</text><text x="40" y="54" class="ring-l">vinte</text></svg>
        <div class="kpis3"><div><b>${s.won}</b><span>vittorie</span></div><div><b>${s.best}</b><span>serie migliore</span></div><div><b>${s.fastest || '–'}</b><span>turni, vittoria più rapida</span></div></div>
      </div>
      <h4>Terre giocate</h4>
      <div class="lbars">${TYPES.map((t) => `<div class="lbar"><i class="ico ico-${t}"></i><span style="--k:${(s.lands[t] / maxLand).toFixed(3)}"></span><b>${s.lands[t]}</b></div>`).join('')}</div>
      <div class="prof-cols">
        <div><h4>Vittorie</h4><ul class="srows">${mode('easy', 'Facile')}${mode('normal', 'Normale')}${mode('friend', 'Con amici')}</ul></div>
        <div><h4>Come vinci</h4><ul class="srows"><li><span>Cinque diverse</span><b>${s.winBy.domain}</b></li><li><span>Cinque uguali</span><b>${s.winBy.five}</b></li><li><span>Carte finite</span><b>${s.winBy.cards}</b></li></ul></div>
      </div>
      <div class="prof-more"><span>Contrasti fatti <b>${s.counters}</b></span><span>Terre distrutte <b>${s.destroyed}</b></span></div>
      <button class="btn small prof-transfer" data-stats="transfer">Profili e trasferimento</button>
    </div>`;
  },
  // finestra del menu in partita
  html() {
    return `<div class="overlay" data-act="close-stats"><div class="box stats" onclick="event.stopPropagation()">
      ${this.panel(prefs.name)}<button class="btn primary" id="stats-close">Chiudi</button></div></div>`;
  },
  // profili salvati e codice di trasferimento: una finestra piccola, per non allungare la pagina
  transferHtml() {
    const name = prefs.name || 'Giocatore';
    const profiles = Object.values(this.all()).map((p) => p.n).filter((n) => this.keyOf(n) !== this.keyOf(name));
    return `<div class="overlay" id="transfer-ov"><div class="box rules transfer" onclick="event.stopPropagation()">
      <h2>Profili e trasferimento</h2>
      <p class="muted">Le statistiche seguono il nome con cui giochi e restano su questo dispositivo.</p>
      ${profiles.length ? `<h4>Altri profili su questo dispositivo</h4><div class="chips">${profiles.map((n) => `<button class="chip" data-profile="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <h4>Su un altro dispositivo</h4>
      <p class="muted">Copia il codice qui e incollalo nel Profilo dell'altro telefono o computer.</p>
      <div class="row"><button class="btn small" id="stats-copy">Copia codice</button><input id="stats-code" class="code-input small" placeholder="Incolla un codice"><button class="btn small" id="stats-import">Importa</button></div>
      <button class="btn primary" id="transfer-close">Chiudi</button>
    </div></div>`;
  },
  bind() {
    $$('[data-stats="transfer"]').forEach((b) => { b.onclick = () => { ui.transfer = true; Sound.play('click'); render(); }; });
    const close = $('#stats-close');
    if (close) {
      close.onclick = () => { ui.stats = false; render(); };
      close.closest('.overlay').onclick = (e) => { if (e.target === e.currentTarget) { ui.stats = false; render(); } };
    }
    const ov = $('#transfer-ov');
    if (!ov) return;
    const shut = () => { ui.transfer = false; render(); };
    ov.onclick = (e) => { if (e.target === ov) shut(); };
    $('#transfer-close').onclick = shut;
    $$('[data-profile]').forEach((b) => { b.onclick = () => { prefs.name = b.dataset.profile; ui.transfer = false; toast(`Profilo: ${b.dataset.profile}`, true); render(); }; });
    $('#stats-copy').onclick = async () => {
      const code = this.exportCode(prefs.name);
      try { await navigator.clipboard.writeText(code); toast('Codice copiato', true); }
      catch { $('#stats-code').value = code; $('#stats-code').select(); toast('Copia il codice dal campo', true); }
    };
    $('#stats-import').onclick = () => {
      try { const n = this.importCode($('#stats-code').value); prefs.name = n; ui.transfer = false; toast(`Statistiche di ${n} importate`, true); render(); }
      catch { toast('Codice non valido'); }
    };
  },
};
