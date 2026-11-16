// Service worker: rende l'app installabile e carica l'interfaccia anche con rete lenta.
const CACHE = 'atlas-v21';
const ASSETS = ['./', 'index.html', 'style.css', 'art.js', 'fx.js', 'game.js', 'bot.js', 'hub.js', 'stats.js', 'tutorial.js', 'app.js', 'fonts/adventor.woff', 'fonts/adventor-bold.woff', 'fonts/lora-italic.woff', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

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
