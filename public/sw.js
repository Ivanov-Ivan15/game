const CACHE_NAME = 'space-game-v1';
const ASSETS = ['/', '/index.html', '/dist/main.js', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/ws')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});