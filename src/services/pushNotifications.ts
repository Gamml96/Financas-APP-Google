/**
 * Notificações push reais (Web Push / VAPID).
 *
 * Diferente das notificações locais (que só aparecem com o app aberto), esta
 * assinatura é enviada para o servidor e permite receber alertas mesmo com o
 * aplicativo fechado — no Android e no iPhone (iOS 16.4+, com o PWA instalado).
 */

import { db, doc, updateDoc, Timestamp } from '../firebase';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
const DEVICE_ID_KEY = 'vidi_device_id';

export type PushSupport = 'supported' | 'unsupported' | 'ios-needs-install' | 'insecure';

export type PushStatus =
  | 'loading'
  | 'enabled'
  | 'disabled'
  | 'denied'
  | 'unsupported'
  | 'ios-needs-install'
  | 'error';

export interface PushActionResult {
  status: PushStatus;
  message: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/** Identifica este dispositivo para guardar várias assinaturas por usuário. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID()) ||
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'default-device';
  }
}

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  // No iOS o Web Push só funciona com o app adicionado à Tela de Início.
  if (isIOS && !isStandalone) return 'ios-needs-install';

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return 'supported';
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('service-worker-unsupported');
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing) {
    await navigator.serviceWorker.register('/sw.js');
  }
  return navigator.serviceWorker.ready;
}

async function saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('invalid-subscription');
  }
  const deviceId = getDeviceId();
  await updateDoc(doc(db, 'users', userId), {
    [`pushSubscriptions.${deviceId}`]: {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      userAgent: navigator.userAgent,
      // A assinatura é vinculada à origem (domínio) que a criou. Guardamos para
      // conseguir limpar assinaturas antigas de outro domínio (ex.: preview).
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      updatedAt: Timestamp.now(),
    },
    pushEnabled: true,
    updatedAt: Timestamp.now(),
  });
}

/** Ativa as notificações neste dispositivo e salva a assinatura no Firestore. */
export async function enablePush(userId: string): Promise<PushActionResult> {
  const support = getPushSupport();
  if (support === 'ios-needs-install') {
    return {
      status: 'ios-needs-install',
      message:
        'No iPhone, adicione o Vidi à Tela de Início (Compartilhar → Adicionar à Tela de Início) e ative as notificações por lá.',
    };
  }
  if (support === 'insecure') {
    return { status: 'unsupported', message: 'As notificações exigem uma conexão segura (HTTPS).' };
  }
  if (support === 'unsupported') {
    return { status: 'unsupported', message: 'Seu navegador não suporta notificações push.' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { status: 'error', message: 'Chave pública de push não configurada no app.' };
  }

  if (Notification.permission === 'denied') {
    return {
      status: 'denied',
      message:
        'As notificações estão bloqueadas. Libere a permissão nas configurações do navegador/app.',
    };
  }

  let permission: NotificationPermission = Notification.permission;
  if (permission !== 'granted') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission((result) => resolve(result));
      });
    }
  }

  if (permission !== 'granted') {
    return { status: 'denied', message: 'Permissão de notificação não concedida.' };
  }

  try {
    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await saveSubscription(userId, subscription);
    return {
      status: 'enabled',
      message: 'Notificações ativadas! Você será avisado mesmo com o app fechado.',
    };
  } catch (error) {
    console.error('Falha ao ativar push:', error);
    return {
      status: 'error',
      message: 'Não foi possível ativar as notificações. Tente novamente.',
    };
  }
}

/** Remove a assinatura deste dispositivo. */
export async function disablePush(userId: string): Promise<PushActionResult> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
    const deviceId = getDeviceId();
    await updateDoc(doc(db, 'users', userId), {
      [`pushSubscriptions.${deviceId}`]: null,
      updatedAt: Timestamp.now(),
    });
    return { status: 'disabled', message: 'Notificações desativadas neste dispositivo.' };
  } catch (error) {
    console.error('Falha ao desativar push:', error);
    return { status: 'error', message: 'Não foi possível desativar as notificações.' };
  }
}

/**
 * Garante que, se a permissão já foi concedida, a assinatura existe e está
 * salva no Firestore. Roda ao abrir o app (sem pedir permissão de novo).
 */
export async function syncPush(userId: string): Promise<PushStatus> {
  const support = getPushSupport();
  if (support === 'ios-needs-install') return 'ios-needs-install';
  if (support === 'insecure' || support === 'unsupported') return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'error';

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'disabled';

  try {
    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await saveSubscription(userId, subscription);
    return 'enabled';
  } catch (error) {
    console.error('Falha ao sincronizar push:', error);
    return 'error';
  }
}
