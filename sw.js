const CACHE = 'ao3-reader-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache each file individually so one missing file doesn't kill install
      return Promise.all(
        APP_SHELL.map(url => cache.add(url).catch(err => {
          console.warn('SW: failed to cache', url, err);
        }))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful same-origin and CDN responses
        if (response.ok &&
            (event.request.url.startsWith(self.location.origin) ||
             event.request.url.includes('cdn.jsdelivr.net'))) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Fallback: serve cached index.html if available, else a minimal response
        return caches.match('./index.html').then(r => r || new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        }));
      });
    })
  );
});