// Accesso con Google senza componenti nativi: l'app apre nel browser la pagina di Google con un codice
// casuale (state). Google rimanda qui (POST /api/google) il «biglietto» firmato (id_token); il server
// controlla la firma con le chiavi pubbliche di Google e tiene da parte il risultato per qualche minuto.
// Intanto l'app chiede ogni due secondi ad account.js («google», con lo stesso codice) se è pronto.
// Non serve il codice segreto del client: si usa solo l'ID client Web.
'use strict';
const crypto = require('crypto');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '548261437152-foj6sji9mmh2j1iiil8tle2u987fev4d.apps.googleusercontent.com';

let keys = null, keysAt = 0;
let fetchKeys = async () => {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('chiavi di Google: risposta ' + r.status);
  return (await r.json()).keys;
};
async function googleKeys(force) {
  if (!keys || force || Date.now() - keysAt > 3600000) { keys = await fetchKeys(); keysAt = Date.now(); }
  return keys;
}

const b64 = (s) => Buffer.from(String(s), 'base64url');

// Controlla il biglietto di Google: { sub, email, name } se è vero, per questo gioco e non scaduto.
async function verify(idToken, nonce) {
  try {
    const [h, p, sig] = String(idToken || '').split('.');
    if (!sig) return null;
    const head = JSON.parse(b64(h)), pay = JSON.parse(b64(p));
    if (head.alg !== 'RS256') return null;
    let k = (await googleKeys()).find((x) => x.kid === head.kid);
    if (!k) k = (await googleKeys(true)).find((x) => x.kid === head.kid); // Google ha cambiato chiavi
    if (!k) return null;
    const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: k, format: 'jwk' }), b64(sig));
    if (!ok) return null;
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(pay.iss)) return null;
    if (pay.aud !== CLIENT_ID || !pay.sub) return null;
    if (!(pay.exp * 1000 > Date.now())) return null;
    if (nonce && pay.nonce !== nonce) return null;
    return { sub: String(pay.sub), email: String(pay.email || ''), name: String(pay.name || '') };
  } catch { return null; }
}

// Risultati in attesa che l'app li venga a prendere: codice → { g, at }
const pending = new Map();
const okState = (s) => typeof s === 'string' && /^[a-f0-9]{32}$/.test(s);

function take(state) {
  const e = okState(state) && pending.get(state);
  if (!e) return null;
  pending.delete(state);
  return Date.now() - e.at < 10 * 60000 ? e.g : null;
}

const page = (title, text, back) => `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Atlas</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1d1f47;color:#fdf3e4;font:17px/1.45 system-ui,sans-serif;text-align:center}
main{max-width:360px;padding:28px}h1{font-size:26px;margin:0 0 10px}p{opacity:.85;margin:0 0 22px}
a{display:inline-block;background:#fdf3e4;color:#1d1f47;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px}</style></head>
<body><main><h1>${title}</h1><p>${text}</p>${back ? '<a href="intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=it.atlas.gioco;end">Torna al gioco</a>' : ''}</main></body></html>`;

// Pagina dove Google rimanda il giocatore (dati in un modulo POST).
async function callback(body) {
  const q = new URLSearchParams(body);
  const state = q.get('state');
  if (q.get('error') || !okState(state)) return page('Accesso annullato', 'Torna su Atlas: puoi riprovare quando vuoi.', true);
  const g = await verify(q.get('id_token'), state);
  if (!g) return page('Accesso non riuscito', 'Google non ha confermato l\'accesso. Torna su Atlas e riprova.', true);
  pending.set(state, { g, at: Date.now() });
  if (pending.size > 2000) pending.delete(pending.keys().next().value);
  return page('Fatto!', 'Hai fatto l\'accesso con Google. Torna su Atlas: il gioco se ne accorge da solo. Nel browser puoi chiudere questa scheda.', true);
}

module.exports = { verify, callback, take, CLIENT_ID, _testKeys: (fn) => { fetchKeys = fn; keys = null; } };
