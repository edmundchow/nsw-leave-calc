@'
const CACHE_VERSION = 'v15';
const CACHE_NAME = `nsw-leave-${CACHE_VERSION}`;
const ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const network = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, network.clone());
      return network;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw new Error('Offline and not cached');
    }
  })());
});
'@ | Set-Content -Path .\sw.js -Encoding UTF8