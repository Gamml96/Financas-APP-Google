/**
 * "Lembrar mais tarde" a partir da própria notificação.
 *
 * O service worker chama esta rota (com link assinado) quando o usuário toca
 * na ação. Ela grava `snoozeUntil` no documento do usuário e o cron horário
 * reenvia o lembrete no primeiro ciclo após esse horário.
 */

import process from 'node:process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export const config = { maxDuration: 30 };

const DEFAULT_DB_ID = 'ai-studio-8f364394-09b6-4d90-aa4f-30e9ff874962';
const SNOOZE_MINUTES = 60;

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

function signSnooze(uid: string, exp: number): string {
  return createHmac('sha256', process.env.REMINDER_CRON_SECRET || '')
    .update(`${uid}.${exp}`)
    .digest('base64url');
}

function verifySnooze(uid: string, exp: number, signature: string): boolean {
  if (!process.env.REMINDER_CRON_SECRET || !uid || !Number.isFinite(exp) || !signature) {
    return false;
  }
  const expected = Buffer.from(signSnooze(uid, exp));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Alinha o horário para o próximo ciclo do cron (que roda de hora em hora),
 * para "1 hora" não virar quase 2 horas de espera.
 */
function nextCronSlot(targetMs: number, nowMs: number = Date.now()): number {
  const hour = 60 * 60 * 1000;
  const floor = Math.floor(targetMs / hour) * hour;
  return floor >= nowMs + 15 * 60 * 1000 ? floor : floor + hour;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method-not-allowed' });
  }

  const uid = typeof req.query.uid === 'string' ? req.query.uid : '';
  const exp = Number(req.query.exp);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  const requested = Number(req.query.minutes);

  if (!uid || !sig || !Number.isFinite(exp)) {
    return res.status(400).json({ error: 'invalid-request' });
  }
  if (exp < Date.now()) {
    return res.status(410).json({ error: 'expired-link' });
  }
  if (!verifySnooze(uid, exp, sig)) {
    return res.status(403).json({ error: 'invalid-signature' });
  }

  const minutes = [30, 60, 180].includes(requested) ? requested : SNOOZE_MINUTES;

  try {
    const db = getDb();
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'user-not-found' });

    const now = Date.now();
    const target = nextCronSlot(now + minutes * 60 * 1000, now);
    await ref.update({ snoozeUntil: Timestamp.fromMillis(target) });

    return res.status(200).json({
      ok: true,
      minutes,
      snoozeUntil: new Date(target).toISOString(),
    });
  } catch (error) {
    console.error('Falha ao reagendar lembrete:', error);
    return res.status(500).json({ error: 'snooze-failed' });
  }
}
