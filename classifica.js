// Classifica della sfida del giorno.
// Chi vince manda tutte le mosse della partita: il server la rigioca con lo stesso motore e la stessa
// situazione di partenza (dailyOpts) e la accetta solo se ogni mossa è regolare e la partita è vinta.
// Conta il numero di turni (meno è meglio); a parità, chi ci è arrivato prima.
//
// Dove si salva: se ci sono le variabili UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (database
// Upstash gratuito) la classifica resta anche quando il server si riavvia; altrimenti sta in un file
// (sul piano gratuito di Render il file si perde a ogni riavvio).
'use strict';
const fs = require('fs');
const path = require('path');
const { Game } = require('./game');
const { dailyOpts } = require('./hub');

const FILE = process.env.CLASSIFICA_FILE || path.join(__dirname, 'data', 'classifica.json');
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TOP = 20;

const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
// Si accettano solo le sfide di ieri, oggi e domani (i fusi orari dei giocatori).
const dayOk = (d) => isDay(d) && Math.abs(Date.now() - Date.parse(d + 'T12:00:00Z')) < 40 * 3600 * 1000;
const cleanName = (n) => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 20);
const keyOf = (n) => n.toLowerCase();

// ---------- verifica ----------
function replay(day, steps) {
  const bad = { error: 'Partita non valida.' };
  if (!Array.isArray(steps) || steps.length > 4000) return bad;
  const g = new Game(['Tu', 'BOT'], dailyOpts(day));
  for (const s of steps) {
    if (g.phase !== 'playing') return bad; // mosse dopo la fine
    if (!s || typeof s !== 'object' || g.actor() !== s.p) return bad;
    if (s.timeout) {
      if (g.step === 'choice') {
        // scelta fatta a caso allo scadere del tempo: si ripete quella registrata
        const opts = g.choice.options, i = opts.indexOf(s.choice);
        if (i < 0) return bad;
        const rng = g.rng;
        g.rng = () => (i + 0.5) / opts.length;
        g.autoAct();
        g.rng = rng;
      } else g.autoAct();
    } else if (g.act(s.p, s.a)) return bad;
  }
  if (g.phase !== 'over') return { error: 'La partita non è finita.' };
  if (g.winner !== 0 || g.endReason === 'surrender') return { lost: true };
  return { turns: g.turn };
}

// ---------- archivio ----------
const boards = new Map(); // giorno -> { chiave nome: { name, turns, at } }
let fileData = null;

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

async function load(day) {
  if (boards.has(day)) return boards.get(day);
  let b = {};
  try {
    if (REDIS_URL && REDIS_TOKEN) {
      const v = await redis(['GET', 'atlas:classifica:' + day]);
      if (v) b = JSON.parse(v);
    } else {
      if (!fileData) fileData = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
      b = fileData[day] || {};
    }
  } catch (e) { console.error('classifica: lettura', e.message); }
  boards.set(day, b);
  if (boards.size > 10) boards.delete(boards.keys().next().value); // in memoria solo gli ultimi giorni
  return b;
}

async function save(day, b) {
  try {
    if (REDIS_URL && REDIS_TOKEN) {
      await redis(['SET', 'atlas:classifica:' + day, JSON.stringify(b), 'EX', String(60 * 24 * 3600)]);
    } else {
      if (!fileData) fileData = {};
      fileData[day] = b;
      const days = Object.keys(fileData).sort();
      while (days.length > 60) delete fileData[days.shift()];
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(fileData));
    }
  } catch (e) { console.error('classifica: scrittura', e.message); }
}

const sorted = (b) => Object.values(b).sort((x, y) => x.turns - y.turns || x.at - y.at);

async function view(day, name) {
  const b = await load(day);
  const list = sorted(b);
  const k = keyOf(cleanName(name));
  const i = k ? list.findIndex((e) => keyOf(e.name) === k) : -1;
  return {
    day, total: list.length, store: REDIS_URL && REDIS_TOKEN ? 'database' : 'file',
    top: list.slice(0, TOP).map((e) => ({ name: e.name, turns: e.turns })),
    me: i >= 0 ? { rank: i + 1, turns: list[i].turns } : null,
  };
}

// Restituisce { status, body } per il server HTTP.
async function handle(method, query, body) {
  if (method === 'GET') {
    const day = query.get('day');
    if (!isDay(day)) return { status: 400, body: { error: 'Giorno non valido.' } };
    return { status: 200, body: await view(day, query.get('name')) };
  }
  if (method === 'POST') {
    let m;
    try { m = JSON.parse(body); } catch { return { status: 400, body: { error: 'Richiesta non valida.' } }; }
    const name = cleanName(m && m.name);
    if (!name) return { status: 400, body: { error: 'Serve un nome per la classifica.' } };
    if (!dayOk(m.day)) return { status: 400, body: { error: 'Questa sfida del giorno è scaduta.' } };
    const r = replay(m.day, m.steps);
    if (r.error) return { status: 400, body: { error: r.error } };
    if (r.lost) return { status: 200, body: { ok: false, lost: true } };
    const b = await load(m.day);
    const k = keyOf(name), old = b[k];
    const better = !old || r.turns < old.turns;
    if (better) { b[k] = { name, turns: r.turns, at: Date.now() }; await save(m.day, b); }
    return { status: 200, body: { ok: true, turns: r.turns, best: better, ...(await view(m.day, name)) } };
  }
  return { status: 405, body: { error: 'Metodo non permesso.' } };
}

module.exports = { handle, replay };
