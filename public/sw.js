// LEENKIT service worker: makes the app installable and repeat visits fast.
// - Hashed build files (/assets/*) and icons are immutable: cache-first.
// - Page navigations: network-first, falling back to the cached app shell
//   when offline.
// Only same-origin GET requests are handled; Supabase, Paystack and Google
// requests always go straight to the network. Cache failures never break the
// app: every path falls back to the network.
const VERSION = 'leenkit-v1';
const SHELL = '/index.html';

const put = (key, response) => caches.open(VERSION).then((cache) => cache.put(key, response)).catch(() => {});
const match = (key) => caches.match(key).catch(() => undefined);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.add(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) put(SHELL, response.clone());
          return response;
        })
        .catch(() => match(SHELL).then((cached) => cached || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) put(request, response.clone());
        return response;
      }))
    );
  }
});
