// Service worker: rende l'app installabile e utilizzabile anche offline.
const CACHE = 'agenda-ceci-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/store.js', 'js/config.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Prima la rete (così gli aggiornamenti arrivano subito), poi la cache se offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isFirebaseSdk = url.hostname === 'www.gstatic.com';
  if (url.origin !== location.origin && !isFirebaseSdk) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
