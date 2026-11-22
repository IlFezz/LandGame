// Archivio chiave → valore per gli account (account.js).
// Con le variabili UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN usa il database Upstash (resta anche
// quando il server si riavvia); altrimenti un file (STORE_FILE, di solito data/store.json).
// Ogni funzione lancia un errore se il database non risponde: chi la chiama decide cosa dire al giocatore.
'use strict';
const fs = require('fs');
const path = require('path');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = process.env.STORE_FILE || path.join(__dirname, 'data', 'store.json');
const useRedis = () => !!(REDIS_URL && REDIS_TOKEN);

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('database: risposta ' + r.status);
  const j = await r.json();
  if (j.error) throw new Error('database: ' + j.error);
  return j.result;
}

// ---------- file ----------
let data = null;
function fileData() {
  if (!data) data = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  return data;
}
function fileSave() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data));
}

async function get(key) {
  if (useRedis()) return redis(['GET', key]);
  const v = fileData()[key];
  return v === undefined ? null : v;
}

async function set(key, value) {
  if (useRedis()) {
    if ((await redis(['SET', key, value])) !== 'OK') throw new Error('database: scrittura non riuscita');
    return;
  }
  fileData()[key] = value;
  fileSave();
}

// Scrive solo se la chiave non c'è ancora: true se l'ha scritta (serve per i nomi unici).
async function setnx(key, value) {
  if (useRedis()) return (await redis(['SET', key, value, 'NX'])) === 'OK';
  if (fileData()[key] !== undefined) return false;
  data[key] = value;
  fileSave();
  return true;
}

async function del(key) {
  if (useRedis()) return redis(['DEL', key]);
  delete fileData()[key];
  fileSave();
}

module.exports = { get, set, setnx, del, kind: () => (useRedis() ? 'database' : 'file') };
