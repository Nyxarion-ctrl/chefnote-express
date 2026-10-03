// Service worker mínimo: siempre intenta la red primero (así se ven las
// actualizaciones) y usa lo guardado solo si no hay conexión.
const CACHE = 'chefnote-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const peticion = event.request;
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE).then((cache) => cache.put(peticion, copia));
        return respuesta;
      })
      .catch(() => caches.match(peticion).then((guardada) => guardada || caches.match('/')))
  );
});
