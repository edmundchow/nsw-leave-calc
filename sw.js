const CACHE_NAME = 'nsw-leave-v4';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll but catch individual failures to prevent complete install failure
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => console.warn(`Failed to cache ${url}:`, err)))
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('data.gov.au')) {
    e.respondWith(
      caches.open('api-cache').then(c => 
        fetch(e.request).then(r => {
          c.put(e.request, r.clone());
          return r;
        }).catch(() => c.match(e.request))
      )
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request))
    );
  }
});