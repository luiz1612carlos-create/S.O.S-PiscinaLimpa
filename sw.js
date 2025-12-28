
const CACHE_NAME = "piscina-limpa-v30"; 

const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './styles.css'
];

self.addEventListener("install", event => {
  console.log(`SW Install: Caching App Shell ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Usando force fetch para garantir que não pegamos um 404 cacheado
      return cache.addAll(APP_SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener("fetch", event => {
    const requestUrl = new URL(event.request.url);

    // Ignorar requisições externas críticas que não devem ser cacheadas pelo SW
    if (requestUrl.hostname.endsWith('googleapis.com') ||
        requestUrl.hostname.endsWith('gstatic.com') ||
        requestUrl.hostname.includes('firebase')) {
        return;
    }

    // Estratégia para Navegação (Páginas HTML)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Retorna o index.html em caso de falha de rede/offline
                return caches.match('./index.html') || caches.match('index.html');
            })
        );
        return;
    }

    // Estratégia Cache-First para recursos estáticos (CSS, Manifest, etc)
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
