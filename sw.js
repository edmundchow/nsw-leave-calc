const CACHE_NAME = 'nsw-leave-v7'; // Increment this version to force cache bust
const ASSETS = ['./', './index.html', './app.js', './manifest.json'];

// On install, cache all assets
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force the waiting service worker to become active
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// NETWORK-FIRST STRATEGY
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // If network works, update the cache and return the response
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => {
        // If network fails (offline), use the cache
        return caches.match(e.request);
      })
  );
});
