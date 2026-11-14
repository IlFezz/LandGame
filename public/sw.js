// Service worker: rende l'app installabile e carica l'interfaccia anche con rete lenta.
const CACHE = 'blg-v8';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'fx.js', 'art/back.png', 'art/stone.png', 'art/runes.png', 'art/runes-W.png', 'art/runes-U.png', 'art/runes-B.png', 'art/runes-R.png', 'art/runes-G.png', 'art/runes-N.png', 'art/runes-X.png', 'art/tomb.png', 'art/card-W.png', 'art/card-U.png', 'art/card-B.png', 'art/card-R.png', 'art/card-G.png', 'art/simple-W.png', 'art/simple-U.png', 'art/simple-B.png', 'art/simple-R.png', 'art/simple-G.png', 'art/ico-W.png', 'art/ico-U.png', 'art/ico-B.png', 'art/ico-R.png', 'art/ico-G.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Prima la rete (per avere sempre l'ultima versione), poi la cache se offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./')))
  );
});
