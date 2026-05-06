const CACHE_NAME = 'nsw-leave-v3';
const ASSETS = ['./', './index.html', './app.js', './manifest.json'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); });
self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('data.gov.au')) {
        e.respondWith(caches.open('api-cache').then(c => fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }).catch(() => c.match(e.request))));
    } else { e.respondWith(caches.match(e.request).then(res => res || fetch(e.request))); }
});
