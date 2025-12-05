const CACHE_NAME = "piscina-limpa-v25"; 

const APP_SHELL_FILES = [
  './',
  'index.html',
  'index.tsx',
  'manifest.json',
  'icons/icon-72.png',
  'icons/icon-96.png',
  'icons/icon-128.png',
  'icons/icon-144.png',
  'icons/icon-152.png',
  'icons/icon-192.png',
  'icons/icon-384.png',
  'icons/icon-512.png'
];

self.addEventListener("install", event => {
  console.log(`SW Install: Caching App Shell v${CACHE_NAME.split('-v')[1]}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching files:", APP_SHELL_FILES);
      return cache.addAll(APP_SHELL_FILES);
    }).catch(err => {
      console.error("Failed to cache app shell:", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("SW Activate: Cleaning up old caches");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener("fetch", event => {
    // For navigation requests, try network first, then cache, then offline page.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('index.html');
            })
        );
        return;
    }

    // For all other requests, use a cache-first strategy.
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchResponse => {
                // Optional: cache new assets dynamically
                // if (fetchResponse.ok) {
                //     return caches.open(CACHE_NAME).then(cache => {
                //         cache.put(event.request, fetchResponse.clone());
                //         return fetchResponse;
                //     });
                // }
                return fetchResponse;
            });
        })
    );
});