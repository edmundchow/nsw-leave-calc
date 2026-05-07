const CACHE_NAME = 'nsw-leave-v10'; 
const ASSETS = ['./', './index.html', './app.js', './manifest.json'];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); }))));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).then((res) => {
    const resClone = res.clone();
    caches.open(CACHE_NAME).then((cache) => { cache.put(e.request, resClone); });
    return res;
  }).catch(() => caches.match(e.request)));
});
