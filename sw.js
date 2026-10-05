/* =========================================================================
   FLOW FIELD GENERATOR — sw.js (Service Worker)
   ========================================================================= */

const CACHE_NAME = "flow-field-v1"; // Increment this version whenever you update files

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./flow.css",
  "./flow.js",
  "./manifest.webmanifest"
];

// Install Event: Cache all essential files immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Force the waiting service worker to activate immediately
  self.skipWaiting();
});

// Activate Event: Clear out old caches from previous versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Immediately claim all open tabs/clients
  return self.clients.claim();
});

// Fetch Event: Try network first, fall back to cache if offline
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
