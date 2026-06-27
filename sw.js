// sw.js — MABS Digital Business & Money — PWA offline (cache-first)
// Guarda para file://: o registro só acontece via http/https (ver index.html),
// e este SW nunca intercepta protocolos não-http.

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força a atualização
});
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Assume o controle da página na hora
});

const CACHE = 'mabs-curriculo-v2';
const ASSETS = [
  './',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './og-image.png'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      // addAll falha graciosamente se algum recurso não existir
      return cache.addAll(ASSETS).catch(function(){});
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const req = e.request;
  // Ignora protocolos não-http (file:, data:, etc.) e requisições não-GET
  if (!req.url.startsWith('http')) return;
  if (req.method !== 'GET') return;

  // Recursos externos (fontes CDN): stale-while-revalidate
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(req).then(function(cached){
        const network = fetch(req).then(function(res){
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, clone); }).catch(function(){});
          }
          return res;
        }).catch(function(){ return cached; });
        return cached || network;
      })
    );
    return;
  }

  // Recursos locais: cache-first (ignora query, ex.: ?source=pwa), fallback network
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function(cached){
      return cached || fetch(req).then(function(res){
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, clone); }).catch(function(){});
        }
        return res;
      }).catch(function(){
        if (req.mode === 'navigate') return caches.match('./');
        return Response.error();
      });
    })
  );
});
