const CACHE_NAME = 'to-de-olho-v11';
const APP_ICON = 'https://i.postimg.cc/MGFSqd7F/1776539933739.png';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Cache strategy: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Manipulação de cliques em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já houver uma aba aberta, foca nela
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Suporte para Push Notifications (Backend)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Tô de Olho', body: 'Lembrete de suas finanças.' };
  
  const options = {
    body: data.body,
    icon: APP_ICON,
    badge: APP_ICON,
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Sincronização em segundo plano (Background Sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    console.log('Sincronizando transações em segundo plano...');
    // Aqui poderíamos disparar uma verificação de dados se necessário
  }
});

// Periodic Background Sync (Wakes up occasionally to check for notifications)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-bills') {
    console.log('Verificação periódica de contas...');
    // Disparar uma notificação se houver algo próximo
    // Nota: Requer que o app esteja "instalado" e tenha permissão
  }
});
