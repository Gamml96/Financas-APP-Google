const CACHE_NAME = 'to-de-olho-v12';
const APP_ICON = 'https://i.postimg.cc/MGFSqd7F/1776539933739.png';
const DEFAULT_URL = '/';

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

// Clique na notificação: foca o app (ou abre) e leva para a tela inicial.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || DEFAULT_URL;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if ('focus' in client) {
          try {
            await client.focus();
          } catch {
            /* ignore */
          }
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })()
  );
});

// Push recebido do servidor (funciona com o app fechado).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Vidi';
  const options = {
    body: data.body || 'Lembrete de suas finanças.',
    icon: data.icon || APP_ICON,
    badge: data.badge || APP_ICON,
    vibrate: data.vibrate || [100, 50, 100],
    tag: data.tag || 'vidi-reminder',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || DEFAULT_URL,
      ...(data.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Quando o navegador renova/invalida a assinatura, avisa o app para reenviar.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
        });
      })
  );
});

// Sincronização em segundo plano (mantido para compatibilidade).
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    console.log('Sincronizando transações em segundo plano...');
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-bills') {
    console.log('Verificação periódica de contas...');
  }
});
