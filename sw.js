/* 極簡 Service Worker：優先走網路（內容永遠最新），沒網路時用快取（出國離線也能開） */
const CACHE = 'trip-handbook-v2.1.0';
const ASSETS = ['./', './index.html', './app.js', './editor.js', './companion-core.js', './companion.js', './companion.css', './sync.js', './data/trip.js', './data/presets.js', './manifest.webmanifest', './version.json', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('trip-handbook-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const path = new URL(req.url).pathname;
  if (path.startsWith('/admin/') || path.startsWith('/auth/') || path === '/login') return;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
