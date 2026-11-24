// Service worker simples: sempre busca a versão nova na internet; só usa a cópia guardada se estiver sem conexão.
const CACHE = 'fs-aluno-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.searchParams.has('nc')) return;
  e.respondWith((async () => {
    try {
      const resp = await fetch(r, { cache: 'no-cache' });
      if (resp.ok) { const c = await caches.open(CACHE); c.put(r, resp.clone()); }
      return resp;
    } catch (err) {
      const hit = await caches.match(r, { ignoreSearch: r.mode === 'navigate' });
      if (hit) return hit;
      throw err;
    }
  })());
});
