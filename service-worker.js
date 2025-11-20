// Basic Service Worker to enable PWA installability
const CACHE_NAME = 'kl-ai-cache-v1';

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Tell the active service worker to take control of the page immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy (safest for dynamic AI apps)
  // We assume the browser handles HTTP caching for static assets
  event.respondWith(fetch(event.request));
});