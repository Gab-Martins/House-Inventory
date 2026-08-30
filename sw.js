// Cache do app shell: o inventário precisa abrir sem internet, dentro do mercado.

const CACHE = 'inventario-v3';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/estilo.css',
  './js/app.js',
  './js/config.js',
  './js/dados.js',
  './js/auth.js',
  './js/inventario.js',
  './js/compras.js',
  './js/exemplos.js',
  './js/util.js',
  './js/scanner.js',
  './js/produtos.js',
  './js/vendor/zxing.min.js',
  './js/vendor/supabase.min.js',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/apple-touch-icon.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(c => c !== CACHE).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

// Responde do cache na hora e atualiza por trás: offline funciona e uma nova
// versão publicada entra sozinha na visita seguinte.
self.addEventListener('fetch', evento => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET' || new URL(requisicao.url).origin !== self.location.origin) return;

  evento.respondWith(
    // ignoreSearch: abrir com ?algo (atalho da tela de início) usa o mesmo cache.
    caches.match(requisicao, { ignoreSearch: true }).then(guardado => {
      const rede = fetch(requisicao)
        .then(resposta => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE).then(cache => cache.put(requisicao, copia));
          }
          return resposta;
        })
        .catch(() => guardado);
      return guardado || rede;
    })
  );
});
