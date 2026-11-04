// Le mode hors ligne a été retiré (travail à la maison, avec une connexion).
// Ce fichier reste pour effacer l'ancien cache des navigateurs qui l'avaient installé, puis se désinscrit.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
})()));
