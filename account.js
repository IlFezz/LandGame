// Account dei giocatori. Al primo avvio l'app chiede un account ospite («Ospite4821»): riceve un id e
// una chiave segreta che restano sul dispositivo. Con l'account:
// - il nome è unico (due giocatori non possono averlo uguale) e lo si cambia quando si vuole;
// - la classifica della sfida del giorno conta l'account, non il nome scritto;
// - statistiche e sblocchi vengono salvati anche qui (copia di sicurezza del profilo).
// Sul server la chiave non viene salvata: solo la sua impronta (sha256).
//
// POST /api/account  { a: "create", name?, profile? }        → { id, token, name, taken? }
//                    { a: "rename", id, token, name }         → { name } | { error }
//                    { a: "save", id, token, profile }        → { ok }
//                    { a: "load", id, token }                 → { name, profile }
//                    { a: "google", state, id?, token? }      → { wait } finché Google non ha risposto
//                    (google.js); poi l'account Google si collega a quello ospite, oppure, se era già
//                    collegato a un altro account, si passa a quello: { id, token, name, profile, switched }
'use strict';
const crypto = require('crypto');
const Store = require('./store');
const Google = require('./google');

const accKey = (id) => 'atlas:acc:' + id;
const nameKey = (n) => 'atlas:nome:' + n.toLowerCase();
const cleanName = (n) => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 20);
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const MAX_PROFILE = 60000;
const googleKey = (sub) => 'atlas:google:' + sub;

// Al massimo 20 account nuovi all'ora per indirizzo (contro chi ne crea a raffica).
const created = new Map();
function tooMany(ip) {
  const now = Date.now(), list = (created.get(ip) || []).filter((t) => now - t < 3600000);
  if (list.length >= 20) return true;
  list.push(now);
  created.set(ip, list);
  if (created.size > 5000) created.clear();
  return false;
}

function nameProblem(n) {
  if (n.length < 2) return 'Il nome deve avere almeno 2 caratteri.';
  if (/^(bot|maestro|giocatore)$/i.test(n)) return 'Questo nome non si può usare.';
  return null;
}

async function readAcc(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{16}$/.test(id)) return null;
  const v = await Store.get(accKey(id));
  return v ? JSON.parse(v) : null;
}

// L'account se id e chiave sono giusti, altrimenti null.
async function verify(id, token) {
  const acc = await readAcc(id);
  if (!acc || typeof token !== 'string') return null;
  // una chiave per dispositivo (con Google si entra da più dispositivi)
  const b = Buffer.from(hash(token), 'hex');
  const ok = [acc.th, ...(acc.ths || [])].some((th) => {
    const a = Buffer.from(String(th || ''), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  return ok ? acc : null;
}

const save = (acc) => Store.set(accKey(acc.id), JSON.stringify(acc));

// Prende il nome per l'account (true) o dice che è già di un altro (false).
async function claim(name, id) {
  if (await Store.setnx(nameKey(name), id)) return true;
  return (await Store.get(nameKey(name))) === id;
}

async function guestName(id) {
  for (let i = 0; i < 40; i++) {
    const digits = i < 20 ? 4 : 6;
    const n = 'Ospite' + String(crypto.randomInt(10 ** (digits - 1), 10 ** digits));
    if (await claim(n, id)) return n;
  }
  throw new Error('nessun nome ospite libero');
}

function cleanProfile(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  return JSON.stringify(p).length <= MAX_PROFILE ? p : null;
}

// Nuovo account: con il nome che il giocatore usava già, se è libero; altrimenti un nome da ospite.
async function makeAccount(wantName, profile) {
  const id = crypto.randomBytes(8).toString('hex'), token = crypto.randomBytes(24).toString('hex');
  const want = cleanName(wantName);
  let name = null, taken = null;
  if (want && !nameProblem(want) && !/^ospite\d+$/i.test(want)) {
    if (await claim(want, id)) name = want; else taken = want;
  }
  if (!name) name = await guestName(id);
  const acc = { id, th: hash(token), name, profile: cleanProfile(profile), created: Date.now(), updated: Date.now() };
  await save(acc);
  return { acc, token, taken };
}

// Una chiave in più per l'account (nuovo dispositivo): al massimo 10, le più vecchie si perdono.
function newToken(acc) {
  const token = crypto.randomBytes(24).toString('hex');
  acc.ths = [...(acc.ths || []), hash(token)].slice(-10);
  return token;
}

async function google(m) {
  const g = Google.take(m.state);
  if (!g) return { status: 200, body: { wait: true } };
  const cur = await verify(m.id, m.token);
  const linkedId = await Store.get(googleKey(g.sub));
  const linked = linkedId && (await readAcc(linkedId));
  if (linked && (!cur || cur.id !== linked.id)) {
    // questo account Google era già di un altro account: si entra in quello
    const token = newToken(linked);
    linked.google = { sub: g.sub, email: g.email };
    await save(linked);
    return { status: 200, body: { id: linked.id, token, name: linked.name, profile: linked.profile, google: g.email, switched: true } };
  }
  let acc = cur, token = null;
  if (!acc) ({ acc, token } = await makeAccount(g.name, null));
  if (!linked && !(await Store.setnx(googleKey(g.sub), acc.id))) return { status: 409, body: { error: 'Riprova tra un attimo.' } };
  acc.google = { sub: g.sub, email: g.email };
  acc.updated = Date.now();
  await save(acc);
  return { status: 200, body: { id: acc.id, ...(token ? { token } : {}), name: acc.name, google: g.email, linked: true } };
}

async function handle(method, body, ip) {
  if (method !== 'POST') return { status: 405, body: { error: 'Metodo non permesso.' } };
  let m;
  try { m = JSON.parse(body); } catch { return { status: 400, body: { error: 'Richiesta non valida.' } }; }
  if (!m || typeof m !== 'object') return { status: 400, body: { error: 'Richiesta non valida.' } };
  try {
    if (m.a === 'create') {
      if (tooMany(ip || '?')) return { status: 429, body: { error: 'Troppi account nuovi: riprova più tardi.' } };
      const { acc, token, taken } = await makeAccount(m.name, m.profile);
      return { status: 200, body: { id: acc.id, token, name: acc.name, ...(taken ? { taken } : {}) } };
    }
    if (m.a === 'google') return await google(m);
    const acc = await verify(m.id, m.token);
    if (!acc) return { status: 401, body: { error: 'Account non riconosciuto.', unknown: true } };
    if (m.a === 'rename') {
      const name = cleanName(m.name);
      const bad = nameProblem(name);
      if (bad) return { status: 400, body: { error: bad } };
      if (name.toLowerCase() !== acc.name.toLowerCase()) {
        if (!(await claim(name, acc.id))) return { status: 409, body: { error: `Il nome «${name}» è già di un altro giocatore.` } };
        await Store.del(nameKey(acc.name));
      }
      acc.name = name;
      acc.updated = Date.now();
      await save(acc);
      return { status: 200, body: { name } };
    }
    if (m.a === 'save') {
      const p = cleanProfile(m.profile);
      if (!p) return { status: 400, body: { error: 'Profilo non valido.' } };
      acc.profile = p;
      acc.updated = Date.now();
      await save(acc);
      return { status: 200, body: { ok: true } };
    }
    if (m.a === 'load') return { status: 200, body: { name: acc.name, profile: acc.profile, google: acc.google ? acc.google.email : null } };
    return { status: 400, body: { error: 'Richiesta non valida.' } };
  } catch (e) {
    console.error('account:', e.message);
    return { status: 503, body: { error: 'Account non disponibile in questo momento: riprova più tardi.' } };
  }
}

module.exports = { handle, verify };
