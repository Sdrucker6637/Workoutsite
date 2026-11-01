/* Service worker: caches the app shell so Forge works fully offline. Bump VERSION on each deploy. */
const VERSION = 'forge-v4';
// Exercise illustrations live in their own cache: it survives app updates, so a demo is
// downloaded once and then always served locally. Bump only if the media files change.
const MEDIA = 'forge-media-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/exercises.js', './js/core.js', './js/engine.js', './js/media.js', './js/icons.js', './js/charts.js',
  './js/ui.js', './js/views-train.js', './js/views-data.js',
  './fonts/inter-latin-opsz-normal.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MEDIA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // YouTube etc. go to the network
  // Demonstrations: cache-first (immutable files), fetched lazily the first time they're shown.
  if (url.pathname.includes('/media/')) {
    e.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  // App shell: stale-while-revalidate.
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    })
  );
});
