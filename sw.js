
const CACHE_NAME = "piscina-limpa-v29"; 

const APP_SHELL_FILES = [
  './',
  './index.html',
  './index.tsx',
  './manifest.json',
  './styles.css'
];

self.addEventListener("install", event => {
  console.log(`SW Install: Caching App Shell ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
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

    // Ignorar requisições para o Firebase e Google APIs
    if (requestUrl.hostname.endsWith('googleapis.com') ||
        requestUrl.hostname.endsWith('gstatic.com') ||
        requestUrl.hostname.includes('firebase')) {
        return;
    }

    // Estratégia para Navegação (Páginas)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Se falhar (offline ou erro), retorna o index.html do cache
                return caches.match('./index.html') || caches.match('index.html');
            })
        );
        return;
    }

    // Estratégia Cache-First para outros recursos
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchResponse => {
                // Não cacheamos tudo dinamicamente para evitar inflar o storage sem necessidade,
                // apenas servimos o que vem da rede.
                return fetchResponse;
            });
        })
    );
});
