const CACHE_NAME = 'to-de-olho-v14';
const APP_ICON = 'https://i.postimg.cc/FsxNpV4m/Gemini-Generated-Image-h73zf3h73zf3h73z-(1).png';
// O Android desenha o ícone da barra de status a partir do `badge`, que precisa
// ser branco sobre transparente (imagem colorida vira um borrão cinza).
const BADGE_ICON = '/badge-96.png';
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
  const data = event.notification.data || {};
  const targetUrl = data.url || DEFAULT_URL;

  // "Lembrar mais tarde": reagenda no servidor e confirma para o usuário.
  if (event.action === 'snooze' && data.snoozeUrl) {
    event.notification.close();
    event.waitUntil(
      (async () => {
        try {
          const response = await fetch(data.snoozeUrl, { method: 'POST' });
          if (!response.ok) throw new Error(`status ${response.status}`);
          await self.registration.showNotification('Vidi', {
            body: 'Tudo bem! Vou te lembrar daqui a pouco.',
            icon: APP_ICON,
            badge: BADGE_ICON,
            tag: 'vidi-snooze',
          });
        } catch (error) {
          await self.registration.showNotification('Vidi', {
            body: 'Não consegui reagendar agora. Abra o app para ver as contas.',
            icon: APP_ICON,
            badge: BADGE_ICON,
            tag: 'vidi-snooze-error',
          });
        }
      })()
    );
    return;
  }

  event.notification.close();

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
    badge: data.badge || BADGE_ICON,
    vibrate: data.vibrate || [100, 50, 100],
    tag: data.tag || 'vidi-reminder',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || DEFAULT_URL,
      ...(data.data || {}),
    },
  };

  // Botões de ação (Android/Chrome). No iOS o Safari ignora e mostra só o toque.
  if (Array.isArray(data.actions) && data.actions.length) {
    options.actions = data.actions;
  }

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
