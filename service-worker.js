const CACHE_VERSION = 'unclecollage-pwa-v1.0.1';
const STATIC_CACHE = CACHE_VERSION + '-static';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/gallery.html',
  '/post.html',
  '/assets/styles.css',
  '/assets/pwa.js',
  '/manifest.webmanifest',
  '/logo.png',
  '/logo1.png',
  '/logo2.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/ic_launcher-playstore.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { cache: 'reload' })));
    }).catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('unclecollage-pwa-') && key !== STATIC_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        return response;
      }).catch(async () => {
        return (await caches.match(request)) || (await caches.match('/index.html'));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
