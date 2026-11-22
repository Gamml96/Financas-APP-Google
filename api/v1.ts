/**
 * API pública v1 do Vidi.
 *
 * Uma única função serverless (catch-all) para não esbarrar no limite de
 * funções do plano e para manter helpers compartilhados no mesmo bundle.
 *
 * Autenticação:
 *  - Chave de API: `Authorization: Bearer vidi_<keyId>_<secret>`
 *    (ou `X-API-Key`). A chave é criada em Ajustes → API para bots.
 *  - Sessão do app: `Authorization: Bearer <Firebase ID token>`.
 *
 * Segurança:
 *  - Chaves são guardadas como scrypt(secret, salt) — nunca em texto puro.
 *  - Escopos por chave, rate limit por minuto, revogação imediata.
 *  - Idempotência por header e deduplicação por `externalId`.
 *  - Nenhuma resposta inclui hash, salt ou o token.
 *
 * Variáveis de ambiente:
 *  - FIREBASE_SERVICE_ACCOUNT (JSON da service account)
 *  - FIRESTORE_DATABASE_ID (opcional)
 */

import process from 'node:process';
import {
  X509Certificate,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  verify as verifySignature,
} from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import type {
  DocumentReference,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

export const config = { maxDuration: 30 };

const TZ = 'America/Sao_Paulo';
const DEFAULT_DB_ID = 'ai-studio-8f364394-09b6-4d90-aa4f-30e9ff874962';

const API_VERSION = '1';
const KEY_REGEX = /^vidi_([a-f0-9]{16})_([A-Za-z0-9_-]{43})$/;
const MAX_KEYS_PER_USER = 10;
const DEFAULT_RATE_LIMIT = 60;
const MAX_BODY_BYTES = 32 * 1024;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const ALL_SCOPES = [
  'transactions:write',
  'transactions:update',
  'transactions:delete',
  'transactions:read',
  'accounts:read',
  'categories:read',
] as const;

type Scope = (typeof ALL_SCOPES)[number];

const DEFAULT_SCOPES: Scope[] = ['transactions:write', 'accounts:read', 'categories:read'];

/** Origens liberadas para chamadas feitas pelo navegador (o bot não precisa de CORS). */
const STATIC_ORIGINS = [
  'https://financas-app-google.vercel.app',
  'https://vidi-fatura-preview.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

const PREVIEW_ORIGIN = /^https:\/\/(financas-app-google|vidi-fatura-preview)[a-z0-9-]*\.vercel\.app$/;

const DEFAULT_CATEGORIES: Array<{ name: string; type: 'income' | 'expense' | 'both' }> = [
  { name: 'Salário', type: 'income' },
  { name: 'Alimentação', type: 'expense' },
  { name: 'Aluguel', type: 'expense' },
  { name: 'Transporte', type: 'expense' },
  { name: 'Entretenimento', type: 'expense' },
  { name: 'Saúde', type: 'expense' },
  { name: 'Compras', type: 'expense' },
  { name: 'Outros', type: 'both' },
  { name: 'Transferência', type: 'both' },
];

// ---------------------------------------------------------------------------
// Tipos e erros
// ---------------------------------------------------------------------------

interface AuthInfo {
  uid: string;
  kind: 'key' | 'session';
  keyId?: string;
  label?: string;
  scopes: Scope[];
  rate?: { limit: number; remaining: number; resetAt: number };
}

class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function applyBaseHeaders(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-API-Version', API_VERSION);
  res.setHeader('Vary', 'Origin');
}

function applyCors(res: VercelResponse, origin: string): void {
  if (!origin) return;
  if (STATIC_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-API-Key');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function ok(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).json({ ok: true, ...body });
}

function fail(res: VercelResponse, error: ApiError): void {
  res.status(error.status).json({
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

function applyRateHeaders(res: VercelResponse, auth: AuthInfo): void {
  if (!auth.rate) return;
  res.setHeader('X-RateLimit-Limit', String(auth.rate.limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, auth.rate.remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(auth.rate.resetAt / 1000)));
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

interface Admin {
  db: Firestore;
  projectId: string;
}

let cachedAdmin: Admin | null = null;

function getAdmin(): Admin {
  if (cachedAdmin) return cachedAdmin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new ApiError(500, 'server-misconfigured', 'Servidor sem credencial do Firebase.');

  let serviceAccount: Record<string, any>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new ApiError(500, 'server-misconfigured', 'Credencial do Firebase inválida.');
  }

  const projectId = String(serviceAccount.project_id || '');
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount as any), projectId });
  }

  cachedAdmin = {
    db: getFirestore(getApps()[0], process.env.FIRESTORE_DATABASE_ID || DEFAULT_DB_ID),
    projectId,
  };
  return cachedAdmin;
}

function getDb(): Firestore {
  return getAdmin().db;
}

// ---------------------------------------------------------------------------
// Sessão do app: ID token do Firebase verificado com node:crypto
// ---------------------------------------------------------------------------
// `firebase-admin/auth` depende de `jwks-rsa`, que faz require() de um pacote
// ESM e quebra no runtime da Vercel (ERR_REQUIRE_ESM). Verificamos o RS256
// diretamente com os certificados públicos do Google, sem essa dependência.

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const CLOCK_SKEW_SECONDS = 60;

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) return certCache.certs;

  const response = await fetch(GOOGLE_CERTS_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new ApiError(503, 'auth-unavailable', 'Não foi possível validar a sessão agora.');
  }

  const certs = (await response.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1] || 0);
  certCache = { certs, expiresAt: now + (maxAge > 0 ? maxAge * 1000 : 30 * 60 * 1000) };
  return certs;
}

function base64UrlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function verifyFirebaseIdToken(token: string, projectId: string): Promise<{ uid: string }> {
  const invalid = () => new ApiError(401, 'invalid-token', 'Sessão inválida ou expirada.');

  const parts = token.split('.');
  if (parts.length !== 3) throw invalid();
  const [headerPart, payloadPart, signaturePart] = parts;

  let header: { alg?: string; kid?: string };
  let payload: Record<string, any>;
  try {
    header = JSON.parse(base64UrlToBuffer(headerPart).toString('utf8'));
    payload = JSON.parse(base64UrlToBuffer(payloadPart).toString('utf8'));
  } catch {
    throw invalid();
  }

  if (header.alg !== 'RS256' || !header.kid) throw invalid();
  if (!projectId) {
    throw new ApiError(500, 'server-misconfigured', 'Servidor sem project id do Firebase.');
  }

  const certs = await getGoogleCerts();
  const certificate = certs[header.kid];
  if (!certificate) throw invalid();

  let valid = false;
  try {
    valid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      new X509Certificate(certificate).publicKey,
      base64UrlToBuffer(signaturePart)
    );
  } catch {
    throw invalid();
  }
  if (!valid) throw invalid();

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw invalid();
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw invalid();
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) throw invalid();
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) throw invalid();
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw invalid();

  return { uid: payload.sub };
}

// ---------------------------------------------------------------------------
// Datas (calendário no fuso de São Paulo, sem depender do TZ do servidor)
// ---------------------------------------------------------------------------

function toCalendar(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day)));
}

/** Converte um dia de calendário em 12:00 de São Paulo (evita virada de dia em UTC). */
function calendarToInstant(day: Date): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 15, 0, 0, 0)
  );
}

/** 00:00 de São Paulo para o dia informado. */
function startOfDaySP(date: Date): Date {
  return new Date(calendarToInstant(toCalendar(date)).getTime() - 12 * 60 * 60 * 1000);
}

/** 23:59:59.999 de São Paulo para o dia informado. */
function endOfDaySP(date: Date): Date {
  return new Date(startOfDaySP(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

function addCalendarMonths(day: Date, months: number): Date {
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();
  const date = day.getUTCDate();
  const first = new Date(Date.UTC(year, month + months, 1));
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date, daysInMonth)));
}

function parseDateInput(value: unknown, field: string, fallback?: Date): Date {
  if (value === undefined || value === null || value === '') {
    if (fallback) return fallback;
    throw new ApiError(400, 'invalid-request', `O campo "${field}" é obrigatório.`);
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" deve ser uma data em texto.`);
  }
  const raw = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (
      calendar.getUTCFullYear() !== year ||
      calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day
    ) {
      throw new ApiError(400, 'invalid-request', `Data inválida em "${field}": ${raw}.`);
    }
    return calendarToInstant(calendar);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, 'invalid-request', `Data inválida em "${field}": ${raw}.`);
  }
  return parsed;
}

/** Mesma regra usada pelo app (App.tsx: calculateDueDate). */
function calculateDueDate(purchase: Date, closingDay: number, dueDay: number): Date {
  const buy = toCalendar(purchase);
  let candidate = new Date(Date.UTC(buy.getUTCFullYear(), buy.getUTCMonth(), dueDay));

  const closingFor = (dueDate: Date): Date => {
    let closing = new Date(
      Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), closingDay)
    );
    if (closingDay > dueDate.getUTCDate()) closing = addCalendarMonths(closing, -1);
    const weekday = closing.getUTCDay();
    if (weekday === 6) return new Date(closing.getTime() - 24 * 60 * 60 * 1000);
    if (weekday === 0) return new Date(closing.getTime() - 2 * 24 * 60 * 60 * 1000);
    return closing;
  };

  for (let i = 0; i < 3; i += 1) {
    if (buy.getTime() < closingFor(candidate).getTime()) return calendarToInstant(candidate);
    candidate = addCalendarMonths(candidate, 1);
  }
  return calendarToInstant(candidate);
}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

function extractToken(req: VercelRequest): string {
  const header = firstHeader(req.headers.authorization);
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return firstHeader(req.headers['x-api-key']).trim();
}

async function consumeRateLimit(
  db: Firestore,
  keyId: string,
  limit: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const ref = db.collection('apiKeys').doc(keyId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(401, 'invalid-key', 'Chave de API inválida.');
    const data = snap.data() || {};
    if (data.revoked === true) throw new ApiError(401, 'invalid-key', 'Chave de API inválida.');

    const now = Date.now();
    let windowStart = Number(data.rlStart) || 0;
    let count = Number(data.rlCount) || 0;
    if (!windowStart || now - windowStart >= 60_000) {
      windowStart = now;
      count = 0;
    }

    if (count >= limit) {
      tx.update(ref, { rlStart: windowStart, rlCount: count });
      return { allowed: false, remaining: 0, resetAt: windowStart + 60_000 };
    }

    tx.update(ref, {
      rlStart: windowStart,
      rlCount: count + 1,
      lastUsedAt: Timestamp.now(),
    });
    return { allowed: true, remaining: limit - count - 1, resetAt: windowStart + 60_000 };
  });
}

async function authenticate(req: VercelRequest, db: Firestore): Promise<AuthInfo> {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(
      401,
      'missing-credentials',
      'Envie uma chave de API em "Authorization: Bearer <chave>".'
    );
  }

  if (token.startsWith('vidi_')) {
    const match = KEY_REGEX.exec(token);
    if (!match) throw new ApiError(401, 'invalid-key', 'Chave de API inválida.');

    const [, keyId, secret] = match;
    const snap = await db.collection('apiKeys').doc(keyId).get();
    if (!snap.exists) throw new ApiError(401, 'invalid-key', 'Chave de API inválida.');

    const data = snap.data() || {};
    if (data.revoked === true) throw new ApiError(401, 'invalid-key', 'Chave de API revogada.');

    const salt = Buffer.from(String(data.salt || ''), 'base64');
    const expected = Buffer.from(String(data.hash || ''), 'base64');
    if (salt.length === 0 || expected.length === 0) {
      throw new ApiError(401, 'invalid-key', 'Chave de API inválida.');
    }

    const received = scryptSync(secret, salt, expected.length);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new ApiError(401, 'invalid-key', 'Chave de API inválida.');
    }

    const limit = Number(data.limitPerMinute) || DEFAULT_RATE_LIMIT;
    const rate = await consumeRateLimit(db, keyId, limit);
    if (!rate.allowed) {
      throw new ApiError(429, 'rate-limited', 'Muitas requisições. Tente novamente em instantes.', {
        retryAfterSeconds: Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)),
      });
    }

    const scopes = Array.isArray(data.scopes)
      ? (data.scopes.filter((s: unknown) => ALL_SCOPES.includes(s as Scope)) as Scope[])
      : [];

    return {
      uid: String(data.uid || ''),
      kind: 'key',
      keyId,
      label: typeof data.label === 'string' ? data.label : undefined,
      scopes,
      rate: { limit, remaining: rate.remaining, resetAt: rate.resetAt },
    };
  }

  try {
    const session = await verifyFirebaseIdToken(token, getAdmin().projectId);
    return { uid: session.uid, kind: 'session', scopes: [...ALL_SCOPES] };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'invalid-token', 'Sessão inválida ou expirada.');
  }
}

function requireScope(auth: AuthInfo, scope: Scope): void {
  if (!auth.scopes.includes(scope)) {
    throw new ApiError(403, 'insufficient-scope', `Esta chave não tem o escopo "${scope}".`);
  }
}

// ---------------------------------------------------------------------------
// Validação de entrada
// ---------------------------------------------------------------------------

function readBody(req: VercelRequest): Record<string, unknown> {
  const length = Number(firstHeader(req.headers['content-length'])) || 0;
  if (length > MAX_BODY_BYTES) {
    throw new ApiError(413, 'payload-too-large', 'Corpo da requisição muito grande (máx. 32 KB).');
  }

  // O SDK do Vercel pode entregar `req.body` de formas diferentes dependendo do
  // runtime e do conteúdo enviado. Normalizamos antes de validar.
  let raw: unknown = req.body;

  if (raw === undefined || raw === null) return {};

  // String
  if (typeof raw === 'string') {
    if (raw.length === 0) return {};
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      throw new ApiError(413, 'payload-too-large', 'Corpo da requisição muito grande (máx. 32 KB).');
    }
    try {
      raw = JSON.parse(raw);
    } catch (_e) {
      throw new ApiError(400, 'invalid-json', 'Corpo da requisição não é um JSON válido.');
    }
  }
  // Buffer → converte para string e faz parse
  else if (Buffer.isBuffer(raw)) {
    const text = raw.toString('utf8');
    if (text.length === 0) return {};
    try {
      raw = JSON.parse(text);
    } catch (_e) {
      throw new ApiError(400, 'invalid-json', 'Corpo da requisição não é um JSON válido.');
    }
  }

  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'invalid-request', 'O corpo deve ser um objeto JSON.');
  }
  return raw as Record<string, unknown>;
}

function readString(
  body: Record<string, unknown>,
  field: string,
  options: { min?: number; max: number; required?: boolean; fallback?: string }
): string {
  const value = body[field];
  if (value === undefined || value === null || value === '') {
    if (options.fallback !== undefined) return options.fallback;
    if (options.required) {
      throw new ApiError(400, 'invalid-request', `O campo "${field}" é obrigatório.`);
    }
    return '';
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" deve ser texto.`);
  }
  const trimmed = value.trim();
  if (options.min !== undefined && trimmed.length < options.min) {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" é muito curto.`);
  }
  if (trimmed.length > options.max) {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" excede ${options.max} caracteres.`);
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Serialização
// ---------------------------------------------------------------------------

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function serializeTransaction(id: string, data: Record<string, any>) {
  return {
    id,
    accountId: data.accountId || null,
    amount: Number(data.amount) || 0,
    type: data.type || 'expense',
    paymentType: data.paymentType || 'debit',
    category: data.category || '',
    description: data.description || '',
    date: tsToIso(data.date),
    dueDate: tsToIso(data.dueDate),
    installment: data.installment ?? null,
    totalInstallments: data.totalInstallments ?? null,
    groupId: data.groupId ?? null,
    externalId: data.externalId ?? null,
    source: data.source ?? null,
    createdAt: tsToIso(data.createdAt),
  };
}

function serializeAccount(id: string, data: Record<string, any>) {
  return {
    id,
    name: data.name || '',
    type: data.type || '',
    color: data.color || null,
    closingDay: data.closingDay ?? null,
    dueDay: data.dueDay ?? null,
    isCredit: data.type === 'credit' || data.type === 'hybrid',
  };
}

// ---------------------------------------------------------------------------
// Rotas: metadados
// ---------------------------------------------------------------------------

function handleIndex(res: VercelResponse): void {
  ok(res, 200, {
    api: 'Vidi API',
    version: API_VERSION,
    docs: {
      auth: 'Authorization: Bearer vidi_<keyId>_<secret>',
      routes: [
        'GET  /api/v1/health',
        'GET  /api/v1/me',
        'GET  /api/v1/accounts',
        'GET  /api/v1/categories',
        'GET  /api/v1/transactions?limit=50&cursor=...&from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=...&type=expense',
        'POST /api/v1/transactions',
        'GET  /api/v1/transactions/:id',
        'PATCH /api/v1/transactions/:id?scope=single|future',
        'DELETE /api/v1/transactions/:id?scope=single|future',
        'GET  /api/v1/keys',
        'POST /api/v1/keys',
        'DELETE /api/v1/keys/:id',
      ],
      scopes: ALL_SCOPES,
    },
  });
}

// ---------------------------------------------------------------------------
// Rotas: conta e catálogos
// ---------------------------------------------------------------------------

async function handleMe(db: Firestore, auth: AuthInfo, res: VercelResponse): Promise<void> {
  const body: Record<string, unknown> = {
    uid: auth.uid,
    kind: auth.kind,
    scopes: auth.scopes,
  };

  if (auth.kind === 'key' && auth.keyId) {
    const snap = await db.collection('apiKeys').doc(auth.keyId).get();
    const data = snap.exists ? snap.data() || {} : {};
    body.key = {
      id: auth.keyId,
      label: data.label || '',
      hint: data.hint || '',
      scopes: auth.scopes,
      createdAt: tsToIso(data.createdAt),
      lastUsedAt: tsToIso(data.lastUsedAt),
    };
  }

  if (auth.rate) {
    body.rateLimit = {
      limit: auth.rate.limit,
      remaining: auth.rate.remaining,
      resetAt: new Date(auth.rate.resetAt).toISOString(),
    };
  }

  ok(res, 200, body);
}

async function handleAccounts(db: Firestore, auth: AuthInfo, res: VercelResponse): Promise<void> {
  requireScope(auth, 'accounts:read');
  const snap = await db.collection('accounts').where('userId', '==', auth.uid).get();
  const accounts = snap.docs
    .map((doc) => serializeAccount(doc.id, doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  ok(res, 200, { accounts });
}

async function handleCategories(db: Firestore, auth: AuthInfo, res: VercelResponse): Promise<void> {
  requireScope(auth, 'categories:read');
  const snap = await db.collection('categories').where('userId', '==', auth.uid).get();
  const custom = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      name: String(data.name || ''),
      type: data.type || 'expense',
      color: data.color || null,
      source: 'custom' as const,
    };
  });

  const seen = new Set(custom.map((c) => c.name));
  const defaults = DEFAULT_CATEGORIES.filter((c) => !seen.has(c.name)).map((c) => ({
    name: c.name,
    type: c.type,
    color: null,
    source: 'default' as const,
  }));

  ok(res, 200, { categories: [...defaults, ...custom] });
}

// ---------------------------------------------------------------------------
// Rotas: transações
// ---------------------------------------------------------------------------

async function handleCreateTransaction(
  db: Firestore,
  auth: AuthInfo,
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  requireScope(auth, 'transactions:write');
  const body = readBody(req);

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    throw new ApiError(400, 'invalid-request', '"amount" deve ser um número maior que zero.');
  }

  const type = readString(body, 'type', { max: 20, fallback: 'expense' });
  if (type !== 'expense' && type !== 'income') {
    throw new ApiError(400, 'invalid-request', '"type" deve ser "expense" ou "income".');
  }

  const accountId = readString(body, 'accountId', { max: 200, required: true });
  const accountSnap = await db.collection('accounts').doc(accountId).get();
  if (!accountSnap.exists) {
    throw new ApiError(400, 'invalid-account', 'Conta não encontrada.');
  }
  const account = accountSnap.data() || {};
  if (account.userId !== auth.uid) {
    throw new ApiError(403, 'forbidden', 'Esta conta não pertence ao usuário da chave.');
  }

  const category = readString(body, 'category', { max: 60, fallback: 'Outros' });
  const description = readString(body, 'description', { max: 200, fallback: category });
  const externalId = readString(body, 'externalId', { max: 100, fallback: '' });

  const accountType = String(account.type || '');
  const isCreditAccount = accountType === 'credit' || accountType === 'hybrid';
  let paymentType = readString(body, 'paymentType', { max: 10, fallback: '' });
  if (!paymentType) paymentType = accountType === 'credit' ? 'credit' : 'debit';
  if (paymentType !== 'credit' && paymentType !== 'debit') {
    throw new ApiError(400, 'invalid-request', '"paymentType" deve ser "credit" ou "debit".');
  }
  if (paymentType === 'credit' && !isCreditAccount) {
    throw new ApiError(400, 'invalid-request', 'A conta informada não é de crédito.');
  }

  const now = new Date();
  const date = parseDateInput(body.date, 'date', now);
  let dueDate = parseDateInput(body.dueDate, 'dueDate', date);
  if (paymentType === 'credit' && !body.dueDate) {
    const closingDay = Number(account.closingDay);
    const dueDay = Number(account.dueDay);
    dueDate =
      Number.isInteger(closingDay) && Number.isInteger(dueDay) && closingDay >= 1 && dueDay >= 1
        ? calculateDueDate(date, closingDay, dueDay)
        : date;
  }

  const installments = body.installments === undefined ? 1 : Number(body.installments);
  if (!Number.isInteger(installments) || installments < 1 || installments > 48) {
    throw new ApiError(400, 'invalid-request', '"installments" deve ser um inteiro entre 1 e 48.');
  }

  // Deduplicação por externalId (o bot deve enviar o id da notificação/pedido).
  if (externalId) {
    const existing = await db
      .collection('transactions')
      .where('userId', '==', auth.uid)
      .where('externalId', '==', externalId)
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      ok(res, 200, {
        duplicate: true,
        transactions: [serializeTransaction(doc.id, doc.data())],
      });
      return;
    }
  }

  // Idempotência por header: reserva antes de criar para evitar corrida.
  const idempotencyKey = firstHeader(req.headers['idempotency-key']).trim();
  let idempotencyRef: DocumentReference | null = null;
  if (idempotencyKey) {
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new ApiError(400, 'invalid-request', '"Idempotency-Key" deve ter entre 8 e 200 caracteres.');
    }
    const hash = createHash('sha256').update(`${auth.uid}|${idempotencyKey}`).digest('hex');
    idempotencyRef = db.collection('apiIdempotency').doc(hash);
    const stored = await idempotencyRef.get();
    if (stored.exists) {
      const data = stored.data() || {};
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0;
      if (data.status && data.body && Date.now() - createdAt < IDEMPOTENCY_TTL_MS) {
        res.setHeader('Idempotent-Replay', 'true');
        res.status(Number(data.status)).json(data.body);
        return;
      }
      if (!data.status) {
        throw new ApiError(
          409,
          'idempotency-in-progress',
          'Já existe uma requisição com esta Idempotency-Key em andamento.'
        );
      }
    } else {
      try {
        await idempotencyRef.create({
          uid: auth.uid,
          keyId: auth.keyId || null,
          status: 0,
          body: null,
          createdAt: Timestamp.now(),
        });
      } catch {
        throw new ApiError(
          409,
          'idempotency-in-progress',
          'Já existe uma requisição com esta Idempotency-Key em andamento.'
        );
      }
    }
  }

  const groupId = installments > 1 ? randomBytes(12).toString('hex') : null;
  const collection = db.collection('transactions');
  const batch = db.batch();
  const refs: Array<{ id: string; payload: Record<string, any> }> = [];

  for (let index = 0; index < installments; index += 1) {
    const docRef = collection.doc();
    const payload: Record<string, any> = {
      userId: auth.uid,
      accountId,
      amount,
      type,
      paymentType,
      category,
      description,
      date: Timestamp.fromDate(calendarToInstant(addCalendarMonths(toCalendar(date), index))),
      dueDate: Timestamp.fromDate(calendarToInstant(addCalendarMonths(toCalendar(dueDate), index))),
      createdAt: Timestamp.now(),
      source: 'api',
      apiKeyId: auth.keyId || null,
    };
    if (externalId) payload.externalId = externalId;
    if (installments > 1) {
      payload.groupId = groupId;
      payload.installment = index + 1;
      payload.totalInstallments = installments;
    }
    batch.set(docRef, payload);
    refs.push({ id: docRef.id, payload });
  }

  try {
    await batch.commit();
  } catch (error) {
    if (idempotencyRef) await idempotencyRef.delete().catch(() => undefined);
    throw error;
  }

  const responseBody = {
    ok: true,
    installments,
    totalAmount: Number((amount * installments).toFixed(2)),
    transactions: refs.map((ref) => serializeTransaction(ref.id, ref.payload)),
  };

  if (idempotencyRef) {
    await idempotencyRef
      .set(
        {
          uid: auth.uid,
          keyId: auth.keyId || null,
          status: 201,
          body: responseBody,
          createdAt: Timestamp.now(),
        },
        { merge: true }
      )
      .catch(() => undefined);
  }

  res.status(201).json(responseBody);
}

async function handleListTransactions(
  db: Firestore,
  auth: AuthInfo,
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  requireScope(auth, 'transactions:read');

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;

  const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : '';
  const type = typeof req.query.type === 'string' ? req.query.type : '';

  let baseQuery: Query = db.collection('transactions').where('userId', '==', auth.uid);

  const fromRaw = typeof req.query.from === 'string' ? req.query.from : '';
  const toRaw = typeof req.query.to === 'string' ? req.query.to : '';
  if (fromRaw) {
    baseQuery = baseQuery.where('date', '>=', Timestamp.fromDate(startOfDaySP(parseDateInput(fromRaw, 'from'))));
  }
  if (toRaw) {
    baseQuery = baseQuery.where('date', '<=', Timestamp.fromDate(endOfDaySP(parseDateInput(toRaw, 'to'))));
  }

  baseQuery = baseQuery.orderBy('date', 'desc').orderBy('__name__', 'desc');

  // Cursor do cliente: (data, id) do último item já entregue.
  let startAfterValues: [Timestamp, string] | null = null;
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : '';
  if (cursorRaw) {
    try {
      const decoded = JSON.parse(Buffer.from(cursorRaw, 'base64url').toString('utf8'));
      const ms = Number(decoded.ms);
      const id = String(decoded.id || '');
      if (!Number.isFinite(ms) || !id) throw new Error('cursor inválido');
      startAfterValues = [Timestamp.fromMillis(ms), id];
    } catch {
      throw new ApiError(400, 'invalid-request', '"cursor" inválido.');
    }
  }

  // `accountId`/`type` são filtros opcionais. Filtrar depois do `limit`
  // descartaria itens válidos (e o cursor pularia registros), então varremos
  // a consulta em blocos até juntar `limit` itens que casem com os filtros.
  const pageSize = Math.min(Math.max(limit, 50), 300);
  const maxScan = 2000;
  const items: Array<{ id: string; data: Record<string, any> }> = [];

  let cursorDoc: QueryDocumentSnapshot | null = null;
  let hasMore = false;
  let scanned = 0;

  while (items.length < limit && scanned < maxScan) {
    let chunkQuery = baseQuery;
    if (cursorDoc) chunkQuery = chunkQuery.startAfter(cursorDoc);
    else if (startAfterValues) chunkQuery = chunkQuery.startAfter(startAfterValues[0], startAfterValues[1]);

    const chunk = await chunkQuery.limit(pageSize).get();
    if (chunk.empty) break;
    scanned += chunk.size;

    let stopped: QueryDocumentSnapshot | null = null;
    for (const doc of chunk.docs) {
      const data = doc.data();
      if (accountId && data.accountId !== accountId) continue;
      if (type && data.type !== type) continue;
      items.push({ id: doc.id, data });
      if (items.length === limit) {
        stopped = doc;
        break;
      }
    }

    if (stopped) {
      cursorDoc = stopped;
      hasMore = chunk.docs.indexOf(stopped) < chunk.docs.length - 1 || chunk.size === pageSize;
      break;
    }

    cursorDoc = chunk.docs[chunk.docs.length - 1];
    if (chunk.size < pageSize) break;
    if (scanned >= maxScan) {
      hasMore = true;
      break;
    }
  }

  const transactions = items.map((item) => serializeTransaction(item.id, item.data));

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    const date = last.data.date;
    const ms = date instanceof Timestamp ? date.toMillis() : 0;
    nextCursor = Buffer.from(JSON.stringify({ ms, id: last.id }), 'utf8').toString('base64url');
  }

  ok(res, 200, { transactions, nextCursor, hasMore });
}

async function handleGetTransaction(
  db: Firestore,
  auth: AuthInfo,
  id: string,
  res: VercelResponse
): Promise<void> {
  requireScope(auth, 'transactions:read');
  const snap = await db.collection('transactions').doc(id).get();
  if (!snap.exists) throw new ApiError(404, 'not-found', 'Lançamento não encontrado.');
  const data = snap.data() || {};
  if (data.userId !== auth.uid) throw new ApiError(404, 'not-found', 'Lançamento não encontrado.');
  ok(res, 200, { transaction: serializeTransaction(snap.id, data) });
}

// ---------------------------------------------------------------------------
// Rotas: edição de transações
// ---------------------------------------------------------------------------

function timestampToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') return new Date(value);
  return null;
}

/** Mesma normalização do app (src/services/faturaParser.ts). */
function normalizeDescription(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function optionalString(
  body: Record<string, unknown>,
  field: string,
  options: { max: number; min?: number }
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" deve ser texto.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" não pode ser vazio.`);
  }
  if (options.min !== undefined && trimmed.length < options.min) {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" é muito curto.`);
  }
  if (trimmed.length > options.max) {
    throw new ApiError(400, 'invalid-request', `O campo "${field}" excede ${options.max} caracteres.`);
  }
  return trimmed;
}

/** Guarda a correção de categoria do mesmo jeito que o app (userSettings.categoryMappings). */
async function learnCategory(
  db: Firestore,
  uid: string,
  description: string,
  category: string
): Promise<void> {
  const key = normalizeDescription(description);
  if (!key) return;
  await db
    .collection('userSettings')
    .doc(uid)
    .set({ categoryMappings: { [key]: category } }, { merge: true });
}

function normalizeInstant(date: Date): Timestamp {
  return Timestamp.fromDate(calendarToInstant(toCalendar(date)));
}

async function handleUpdateTransaction(
  db: Firestore,
  auth: AuthInfo,
  req: VercelRequest,
  id: string,
  res: VercelResponse
): Promise<void> {
  requireScope(auth, 'transactions:update');

  const scopeRaw = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : '';
  const scope = scopeRaw || 'single';
  if (scope !== 'single' && scope !== 'future') {
    throw new ApiError(400, 'invalid-request', '"scope" deve ser "single" ou "future".');
  }

  const ref = db.collection('transactions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError(404, 'not-found', 'Lançamento não encontrado.');
  const current = snap.data() || {};
  if (current.userId !== auth.uid) throw new ApiError(404, 'not-found', 'Lançamento não encontrado.');

  const body = readBody(req);
  const has = (field: string) => body[field] !== undefined;

  const changes: Record<string, any> = {};

  if (has('amount')) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
      throw new ApiError(400, 'invalid-request', '"amount" deve ser um número maior que zero.');
    }
    changes.amount = amount;
  }

  if (has('type')) {
    const type = String(body.type).trim();
    if (type !== 'expense' && type !== 'income') {
      throw new ApiError(400, 'invalid-request', '"type" deve ser "expense" ou "income".');
    }
    changes.type = type;
  }

  if (has('paymentType')) {
    const paymentType = String(body.paymentType).trim();
    if (paymentType !== 'credit' && paymentType !== 'debit') {
      throw new ApiError(400, 'invalid-request', '"paymentType" deve ser "credit" ou "debit".');
    }
    changes.paymentType = paymentType;
  }

  const category = optionalString(body, 'category', { max: 60 });
  if (category !== undefined) changes.category = category;

  const description = optionalString(body, 'description', { max: 200 });
  if (description !== undefined) changes.description = description;

  if (has('isRecurring')) {
    if (typeof body.isRecurring !== 'boolean') {
      throw new ApiError(400, 'invalid-request', '"isRecurring" deve ser booleano.');
    }
    changes.isRecurring = body.isRecurring;
  }

  if (has('frequency')) {
    const frequency = String(body.frequency).trim();
    if (frequency !== 'weekly' && frequency !== 'monthly' && frequency !== 'yearly') {
      throw new ApiError(400, 'invalid-request', '"frequency" deve ser "weekly", "monthly" ou "yearly".');
    }
    changes.frequency = frequency;
  }

  // Conta: se mudou, precisa existir e pertencer ao dono da chave.
  let accountId = String(current.accountId || '');
  let account: Record<string, any> | null = null;
  if (has('accountId')) {
    accountId = optionalString(body, 'accountId', { max: 200, min: 1 }) as string;
    const accountSnap = await db.collection('accounts').doc(accountId).get();
    if (!accountSnap.exists) throw new ApiError(400, 'invalid-account', 'Conta não encontrada.');
    account = accountSnap.data() || {};
    if (account.userId !== auth.uid) {
      throw new ApiError(403, 'forbidden', 'Esta conta não pertence ao usuário da chave.');
    }
    changes.accountId = accountId;
  } else if (has('paymentType') || has('date') || has('dueDate')) {
    const accountSnap = await db.collection('accounts').doc(accountId).get();
    account = accountSnap.exists ? accountSnap.data() || {} : null;
  }

  const accountChanged = has('accountId') && accountId !== String(current.accountId || '');
  const effectivePaymentType = String(changes.paymentType ?? current.paymentType ?? 'debit');
  const accountType = String(account?.type || '');
  const isCreditAccount = accountType === 'credit' || accountType === 'hybrid';
  if (effectivePaymentType === 'credit' && account && !isCreditAccount) {
    throw new ApiError(400, 'invalid-request', 'A conta informada não é de crédito.');
  }

  const closingDay = Number(account?.closingDay);
  const dueDay = Number(account?.dueDay);
  const hasBillingCycle =
    Number.isInteger(closingDay) && Number.isInteger(dueDay) && closingDay >= 1 && dueDay >= 1;

  const currentDate = timestampToDate(current.date) || new Date();
  const newDate =
    has('date') && body.date !== null && body.date !== ''
      ? parseDateInput(body.date, 'date')
      : null;
  const explicitDueDate =
    has('dueDate') && body.dueDate !== null && body.dueDate !== ''
      ? parseDateInput(body.dueDate, 'dueDate')
      : null;

  if (Object.keys(changes).length === 0 && !newDate && !explicitDueDate) {
    throw new ApiError(400, 'invalid-request', 'Informe ao menos um campo para atualizar.');
  }

  const audit: Record<string, any> = {
    updatedAt: Timestamp.now(),
    updatedVia: auth.keyId ? 'api' : 'session',
  };

  let updated: Array<{ id: string; data: Record<string, any> }> = [];

  if (scope === 'single') {
    const payload: Record<string, any> = { ...changes, ...audit };
    if (newDate) payload.date = normalizeInstant(newDate);
    if (explicitDueDate) {
      payload.dueDate = normalizeInstant(explicitDueDate);
    } else if (newDate) {
      const dueDate =
        effectivePaymentType === 'credit' && hasBillingCycle
          ? calculateDueDate(newDate, closingDay, dueDay)
          : newDate;
      payload.dueDate = normalizeInstant(dueDate);
    }

    await ref.update(payload);
    updated = [{ id, data: { ...current, ...payload } }];
  } else {
    const groupId = String(current.groupId || '');
    if (!groupId) {
      throw new ApiError(
        400,
        'invalid-request',
        'Este lançamento não faz parte de um grupo de parcelas; use "scope=single".'
      );
    }

    const groupSnap = await db
      .collection('transactions')
      .where('userId', '==', auth.uid)
      .where('groupId', '==', groupId)
      .get();

    const currentDayStart = startOfDaySP(currentDate).getTime();
    const targets = groupSnap.docs.filter((doc) => {
      const txDate = timestampToDate(doc.data().date);
      return txDate !== null && startOfDaySP(txDate).getTime() >= currentDayStart;
    });
    if (!targets.some((doc) => doc.id === id)) targets.push(snap as any);

    const offset = newDate
      ? startOfDaySP(newDate).getTime() - startOfDaySP(currentDate).getTime()
      : 0;
    const dateChanged = offset !== 0;

    const writes: Array<{ ref: DocumentReference; payload: Record<string, any> }> = [];

    for (const doc of targets) {
      const tx = doc.data() || {};
      const isCurrent = doc.id === id;
      const originalDate = timestampToDate(tx.date) || currentDate;
      const payload: Record<string, any> = { ...changes, ...audit };

      let txNewDate = originalDate;
      if (isCurrent) {
        if (newDate) {
          txNewDate = calendarToInstant(toCalendar(newDate));
          payload.date = Timestamp.fromDate(txNewDate);
        }
      } else if (dateChanged) {
        txNewDate = new Date(originalDate.getTime() + offset);
        payload.date = Timestamp.fromDate(txNewDate);
      }

      if (isCurrent) {
        if (explicitDueDate) {
          payload.dueDate = normalizeInstant(explicitDueDate);
        } else if (newDate) {
          payload.dueDate = normalizeInstant(
            effectivePaymentType === 'credit' && hasBillingCycle
              ? calculateDueDate(newDate, closingDay, dueDay)
              : newDate
          );
        }
      } else if (effectivePaymentType === 'credit') {
        if (dateChanged || accountChanged) {
          if (hasBillingCycle) {
            payload.dueDate = normalizeInstant(calculateDueDate(txNewDate, closingDay, dueDay));
          } else if (dateChanged) {
            const originalDueDate = timestampToDate(tx.dueDate);
            if (originalDueDate) {
              payload.dueDate = Timestamp.fromDate(
                new Date(originalDueDate.getTime() + offset)
              );
            }
          }
        }
      } else if (dateChanged) {
        payload.dueDate = normalizeInstant(txNewDate);
      }

      writes.push({ ref: doc.ref, payload });
    }

    // Firestore aceita até 500 operações por batch.
    for (let index = 0; index < writes.length; index += 400) {
      const batch = db.batch();
      for (const write of writes.slice(index, index + 400)) {
        batch.update(write.ref, write.payload);
      }
      await batch.commit();
    }

    updated = writes.map((write) => {
      const original = targets.find((doc) => doc.id === write.ref.id)?.data() || {};
      return { id: write.ref.id, data: { ...original, ...write.payload } };
    });
  }

  if (category !== undefined && category !== String(current.category || '')) {
    const source = description ?? String(current.description || '');
    await learnCategory(db, auth.uid, source, category).catch(() => undefined);
  }

  ok(res, 200, {
    scope,
    updated: updated.length,
    transactions: updated.map((item) => serializeTransaction(item.id, item.data)),
  });
}

// ---------------------------------------------------------------------------
// Rotas: exclusão de transações
// ---------------------------------------------------------------------------

async function handleDeleteTransaction(
  db: Firestore,
  auth: AuthInfo,
  req: VercelRequest,
  id: string,
  res: VercelResponse
): Promise<void> {
  requireScope(auth, 'transactions:delete');

  const scopeRaw = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : '';
  const scope = scopeRaw || 'single';
  if (scope !== 'single' && scope !== 'future') {
    throw new ApiError(400, 'invalid-request', '"scope" deve ser "single" ou "future".');
  }

  const ref = db.collection('transactions').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError(404, 'not-found', 'Lançamento não encontrado.');
  const current = snap.data() || {};
  if (current.userId !== auth.uid) throw new ApiError(404, 'not-found', 'Lançamento não encontrado.');

  if (scope === 'single') {
    await ref.delete();
    ok(res, 200, { deleted: 1, ids: [id] });
    return;
  }

  const groupId = String(current.groupId || '');
  if (!groupId) {
    throw new ApiError(
      400,
      'invalid-request',
      'Este lançamento não faz parte de um grupo de parcelas; use "scope=single".'
    );
  }

  // Mesma regra do app: exclui o lançamento e as parcelas seguintes do mesmo
  // grupo e tipo com data >= a atual.
  const groupSnap = await db
    .collection('transactions')
    .where('userId', '==', auth.uid)
    .where('groupId', '==', groupId)
    .get();

  const currentDate = timestampToDate(current.date) || new Date();
  const currentDayStart = startOfDaySP(currentDate).getTime();
  const type = String(current.type || '');

  const targets = groupSnap.docs.filter((doc) => {
    const data = doc.data() || {};
    if (String(data.type || '') !== type) return false;
    const txDate = timestampToDate(data.date);
    return txDate !== null && startOfDaySP(txDate).getTime() >= currentDayStart;
  });
  if (!targets.some((doc) => doc.id === id)) targets.push(snap as any);

  const ids = targets.map((doc) => doc.id);
  for (let index = 0; index < targets.length; index += 400) {
    const batch = db.batch();
    for (const doc of targets.slice(index, index + 400)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  ok(res, 200, { deleted: ids.length, ids });
}

// ---------------------------------------------------------------------------
// Rotas: chaves de API (somente sessão)
// ---------------------------------------------------------------------------

function requireSession(auth: AuthInfo): void {
  if (auth.kind !== 'session') {
    throw new ApiError(403, 'session-required', 'Esta rota exige a sessão do app (não uma chave de API).');
  }
}

async function listKeys(db: Firestore, uid: string) {
  const snap = await db.collection('apiKeys').where('uid', '==', uid).get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        label: data.label || '',
        hint: data.hint || '',
        scopes: Array.isArray(data.scopes) ? data.scopes : [],
        revoked: data.revoked === true,
        createdAt: tsToIso(data.createdAt),
        lastUsedAt: tsToIso(data.lastUsedAt),
      };
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function handleListKeys(db: Firestore, auth: AuthInfo, res: VercelResponse): Promise<void> {
  requireSession(auth);
  ok(res, 200, { keys: await listKeys(db, auth.uid) });
}

async function handleCreateKey(
  db: Firestore,
  auth: AuthInfo,
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  requireSession(auth);
  const body = readBody(req);

  const label = readString(body, 'label', { max: 60, min: 1, fallback: 'Bot' });

  let scopes: Scope[] = DEFAULT_SCOPES;
  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes)) {
      throw new ApiError(400, 'invalid-request', '"scopes" deve ser uma lista.');
    }
    const requested = body.scopes.filter((s): s is Scope => ALL_SCOPES.includes(s as Scope));
    if (requested.length !== body.scopes.length) {
      throw new ApiError(400, 'invalid-request', 'Escopo inválido.', { allowed: ALL_SCOPES });
    }
    if (requested.length === 0) {
      throw new ApiError(400, 'invalid-request', 'Escolha pelo menos um escopo.');
    }
    scopes = Array.from(new Set(requested));
  }

  const existing = await listKeys(db, auth.uid);
  const active = existing.filter((key) => !key.revoked);
  if (active.length >= MAX_KEYS_PER_USER) {
    throw new ApiError(
      409,
      'key-limit-reached',
      `Limite de ${MAX_KEYS_PER_USER} chaves ativas. Revogue uma antes de criar outra.`
    );
  }

  const keyId = randomBytes(8).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  const salt = randomBytes(16).toString('base64');
  const hash = scryptSync(secret, Buffer.from(salt, 'base64'), 64).toString('base64');
  const token = `vidi_${keyId}_${secret}`;

  await db.collection('apiKeys').doc(keyId).set({
    uid: auth.uid,
    label,
    hint: `vidi_${keyId}_…${secret.slice(-4)}`,
    salt,
    hash,
    scopes,
    revoked: false,
    limitPerMinute: DEFAULT_RATE_LIMIT,
    rlStart: 0,
    rlCount: 0,
    createdAt: Timestamp.now(),
    lastUsedAt: null,
  });

  res.status(201).json({
    ok: true,
    key: {
      id: keyId,
      label,
      hint: `vidi_${keyId}_…${secret.slice(-4)}`,
      scopes,
      createdAt: new Date().toISOString(),
    },
    token,
    warning: 'Guarde este token agora. Ele não será exibido novamente.',
  });
}

async function handleRevokeKey(
  db: Firestore,
  auth: AuthInfo,
  id: string,
  res: VercelResponse
): Promise<void> {
  requireSession(auth);
  const ref = db.collection('apiKeys').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError(404, 'not-found', 'Chave não encontrada.');
  const data = snap.data() || {};
  if (data.uid !== auth.uid) throw new ApiError(404, 'not-found', 'Chave não encontrada.');

  await ref.set({ revoked: true, revokedAt: Timestamp.now() }, { merge: true });
  ok(res, 200, { revoked: true, id });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function normalizePath(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split('/').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Resolve o caminho depois de /api/v1.
 *
 * O rewrite do vercel.json pode entregar o restante em `__path`, e alguns
 * runtimes mantêm a URL original em `req.url`. Aceitamos os dois formatos.
 */
function resolvePath(req: VercelRequest): string[] {
  // `req.url` mantém o caminho original mesmo depois do rewrite.
  const pathname = String(req.url || '').split('?')[0] || '';
  const withoutBase = pathname.replace(/^\/api\/v1(?=\/|$)/, '');
  const fromUrl = normalizePath(withoutBase);
  if (fromUrl.length > 0) return fromUrl;

  // Fallback: rewrite pode entregar o restante em `__path`.
  for (const candidate of [req.query.__path, req.query.path]) {
    const parsed = normalizePath(candidate);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyBaseHeaders(res);
  applyCors(res, firstHeader(req.headers.origin));

  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const path = resolvePath(req);
    const method = (req.method || 'GET').toUpperCase();

    if (path.length === 0) {
      handleIndex(res);
      return;
    }

    if (path[0] === 'health') {
      ok(res, 200, { status: 'healthy', time: new Date().toISOString() });
      return;
    }

    const db = getDb();
    const auth = await authenticate(req, db);
    applyRateHeaders(res, auth);

    const [resource, id] = path;

    if (resource === 'me' && method === 'GET') {
      await handleMe(db, auth, res);
      return;
    }

    if (resource === 'accounts' && method === 'GET') {
      await handleAccounts(db, auth, res);
      return;
    }

    if (resource === 'categories' && method === 'GET') {
      await handleCategories(db, auth, res);
      return;
    }

    if (resource === 'transactions') {
      if (method === 'POST' && !id) {
        await handleCreateTransaction(db, auth, req, res);
        return;
      }
      if (method === 'GET' && !id) {
        await handleListTransactions(db, auth, req, res);
        return;
      }
      if (method === 'GET' && id) {
        await handleGetTransaction(db, auth, id, res);
        return;
      }
      if (method === 'PATCH' && id) {
        await handleUpdateTransaction(db, auth, req, id, res);
        return;
      }
      if (method === 'DELETE' && id) {
        await handleDeleteTransaction(db, auth, req, id, res);
        return;
      }
    }

    if (resource === 'keys') {
      if (method === 'GET' && !id) {
        await handleListKeys(db, auth, res);
        return;
      }
      if (method === 'POST' && !id) {
        await handleCreateKey(db, auth, req, res);
        return;
      }
      if (method === 'DELETE' && id) {
        await handleRevokeKey(db, auth, id, res);
        return;
      }
    }

    throw new ApiError(404, 'not-found', 'Rota não encontrada.');
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) {
        const retry = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
        if (retry) res.setHeader('Retry-After', String(retry));
      }
      fail(res, error);
      return;
    }

    console.error('[api/v1] erro inesperado:', error);
    fail(res, new ApiError(500, 'internal-error', 'Erro interno. Tente novamente mais tarde.'));
  }
}
