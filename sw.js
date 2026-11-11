'use strict';
// Increment the version when changing the offline file list.
const CACHE_PREFIX = `electromart-${self.registration.scope}-`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'ccc.js',
  'manifest.webmanifest', 'data/electromart.csv', 'data/assumptions.csv',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(FILES.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) {
        // Wait for the write so an immediate offline reload has current data.
        try { await cache.put(request, response.clone()); } catch { /* Network response still works if storage is full. */ }
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
