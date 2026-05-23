const CACHE_VERSION = 'v29';
const CACHE_NAME = `nsw-leave-${CACHE_VERSION}`;
const ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json', './icon.png', './tax-rates.json'];

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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const pathname = url.pathname.replace(/\/$/, '') || '/index.html';
            const isAsset = ASSETS.some((a) => {
              const ap = a.replace('./', '/');
              return pathname === ap || pathname === '/' + ap.replace('/', '');
            });
            if (isAsset) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          }
          return response;
        })
        .catch(() => null);

      return cached || networkFetch;
    })
  );
});
