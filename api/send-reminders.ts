/**
 * Envio de lembretes por Web Push (funciona com o app fechado).
 *
 * Executado por um job agendado (GitHub Actions, de hora em hora) e protegido
 * por segredo. Lê os usuários/transações no Firestore com Firebase Admin e
 * envia a notificação para todos os dispositivos inscritos.
 *
 * Variáveis de ambiente necessárias:
 *  - FIREBASE_SERVICE_ACCOUNT (JSON da service account)
 *  - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 *  - REMINDER_CRON_SECRET
 *  - FIRESTORE_DATABASE_ID (opcional)
 */

import process from 'node:process';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import * as webpush from 'web-push';

export const config = { maxDuration: 60 };

const TZ = 'America/Sao_Paulo';
const DEFAULT_DB_ID = 'ai-studio-8f364394-09b6-4d90-aa4f-30e9ff874962';

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface Bill {
  description: string;
  amount: number;
  due: Date;
}

function getDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('missing-service-account');
  const serviceAccount = JSON.parse(raw);
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }
  return getFirestore(getApps()[0], process.env.FIRESTORE_DATABASE_ID || DEFAULT_DB_ID);
}

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.REMINDER_CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || '';
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : '';
  return header === `Bearer ${secret}` || querySecret === secret;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

function startOfZonedDay(dateStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(guess.getTime() - timeZoneOffsetMs(guess, timeZone));
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function timeReached(nowHour: number, nowMinute: number, hhmm: string): boolean {
  const [hour, minute] = hhmm.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true;
  return nowHour > hour || (nowHour === hour && nowMinute >= minute);
}

function normalizeSubscriptions(value: unknown): Array<[string, StoredSubscription]> {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).filter(([, sub]) => {
    const candidate = sub as StoredSubscription | null;
    return Boolean(
      candidate &&
        typeof candidate.endpoint === 'string' &&
        candidate.keys &&
        typeof candidate.keys.p256dh === 'string' &&
        typeof candidate.keys.auth === 'string'
    );
  }) as Array<[string, StoredSubscription]>;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function sendToUser(
  subscriptions: Array<[string, StoredSubscription]>,
  payload: string,
  userRef: DocumentReference
): Promise<{ sent: number; removed: number; errors: number }> {
  let sent = 0;
  let removed = 0;
  let errors = 0;

  const results = await Promise.allSettled(
    subscriptions.map(async ([key, subscription]) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'high' }
        );
        return { key, ok: true as const };
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await userRef.update({ [`pushSubscriptions.${key}`]: null });
          return { key, ok: false as const, removed: true };
        }
        throw error;
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.ok) sent += 1;
      else if (result.value.removed) removed += 1;
    } else {
      errors += 1;
      console.error('Erro ao enviar push:', result.reason);
    }
  }

  return { sent, removed, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return res.status(500).json({ error: 'missing-vapid-keys' });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contato@vidi.app',
    publicKey,
    privateKey
  );

  let db: Firestore;
  try {
    db = getDb();
  } catch (error) {
    console.error('Falha ao inicializar Firebase Admin:', error);
    return res.status(500).json({ error: 'firebase-admin-init-failed' });
  }

  const testUid = typeof req.query.uid === 'string' ? req.query.uid : '';
  const isTest = req.query.test === '1';
  const isDry = req.query.dry === '1';

  // Modo de teste: envia um push imediato para um usuário específico.
  if (isTest && testUid) {
    const userRef = db.collection('users').doc(testUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: 'user-not-found' });

    const subscriptions = normalizeSubscriptions(userSnap.data()?.pushSubscriptions);
    if (!subscriptions.length) {
      return res.status(200).json({ ok: true, sent: 0, reason: 'no-subscriptions' });
    }

    const payload = JSON.stringify({
      title: 'Teste de notificação — Vidi',
      body: 'Se você recebeu isso, as notificações com o app fechado estão funcionando!',
      url: '/',
      tag: 'vidi-test',
    });

    const result = await sendToUser(subscriptions, payload, userRef);
    return res.status(200).json({ ok: true, test: true, ...result });
  }

  const now = new Date();
  const { date: today, hour, minute } = getZonedParts(now, TZ);

  const [usersSnap, transactionsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('transactions').get(),
  ]);

  // Agrupa as contas por usuário uma única vez.
  const billsByUser = new Map<string, Bill[]>();
  for (const doc of transactionsSnap.docs) {
    const data = doc.data();
    if (data.type !== 'expense') continue;
    const due = toDate(data.dueDate);
    if (!due) continue;
    const userId = typeof data.userId === 'string' ? data.userId : '';
    if (!userId) continue;
    const list = billsByUser.get(userId) || [];
    list.push({
      description: String(data.description || data.category || 'Conta'),
      amount: Number(data.amount) || 0,
      due,
    });
    billsByUser.set(userId, list);
  }

  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const shortDate = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TZ,
  });

  const summary = {
    date: today,
    localTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    users: 0,
    notified: 0,
    sent: 0,
    removed: 0,
    errors: 0,
    skipped: 0,
  };
  const dryRun: Array<{ uid: string; title: string; body: string; devices: number }> = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const subscriptions = normalizeSubscriptions(data.pushSubscriptions);
    if (!subscriptions.length) continue;

    summary.users += 1;

    const reminderTime = typeof data.reminderTime === 'string' ? data.reminderTime : '09:00';
    if (!timeReached(hour, minute, reminderTime)) {
      summary.skipped += 1;
      continue;
    }
    if (data.lastPushDate === today) {
      summary.skipped += 1;
      continue;
    }

    const reminderDays = Number.isFinite(Number(data.reminderDaysBefore))
      ? Number(data.reminderDaysBefore)
      : 3;
    const start = startOfZonedDay(today, TZ).getTime();
    const end = startOfZonedDay(addDays(today, reminderDays + 1), TZ).getTime();

    const bills = (billsByUser.get(userDoc.id) || []).filter((bill) => {
      const time = bill.due.getTime();
      return time >= start && time < end;
    });

    if (!bills.length) {
      summary.skipped += 1;
      continue;
    }

    bills.sort((a, b) => a.due.getTime() - b.due.getTime());
    const total = bills.reduce((sum, bill) => sum + bill.amount, 0);

    const title =
      bills.length === 1 ? 'Conta a vencer' : `${bills.length} contas a vencer`;
    const body =
      bills.length === 1
        ? `${bills[0].description} — ${currency.format(bills[0].amount)} vence em ${shortDate.format(
            bills[0].due
          )}.`
        : `Total de ${currency.format(total)} nos próximos ${reminderDays} dias.`;

    const payload = JSON.stringify({
      title,
      body,
      url: '/',
      tag: `vidi-bills-${today}`,
      data: { type: 'bills', date: today },
    });

    if (isDry) {
      dryRun.push({ uid: userDoc.id, title, body, devices: subscriptions.length });
      summary.notified += 1;
      continue;
    }

    const result = await sendToUser(subscriptions, payload, userDoc.ref);
    summary.sent += result.sent;
    summary.removed += result.removed;
    summary.errors += result.errors;

    if (result.sent > 0) {
      summary.notified += 1;
      await userDoc.ref.update({ lastPushDate: today, lastPushAt: Timestamp.now() });
    }
  }

  return res.status(200).json({ ok: true, ...summary, ...(isDry ? { dryRun } : {}) });
}
