/**
 * Cliente da API pública do Vidi (v1).
 *
 * As rotas de chave exigem a sessão do app: o Firebase ID token é enviado no
 * lugar da chave. O token da chave em si só aparece uma vez, na criação.
 */

import { auth } from '../firebase';

const BASE = '/api/v1';

export const API_SCOPES = [
  { id: 'transactions:write', label: 'Criar lançamentos', description: 'Permite criar despesas e receitas.' },
  { id: 'transactions:read', label: 'Ler lançamentos', description: 'Permite consultar o histórico.' },
  { id: 'accounts:read', label: 'Ler contas', description: 'Necessário para descobrir o accountId.' },
  { id: 'categories:read', label: 'Ler categorias', description: 'Permite escolher uma categoria válida.' },
] as const;

export const DEFAULT_API_SCOPES = ['transactions:write', 'accounts:read', 'categories:read'];

export interface ApiKeySummary {
  id: string;
  label: string;
  hint: string;
  scopes: string[];
  revoked: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export interface CreatedApiKey {
  key: Omit<ApiKeySummary, 'revoked'>;
  token: string;
}

interface ApiEnvelope<T> {
  ok: boolean;
  error?: { code: string; message: string };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const token = await user.getIdToken();
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const data = (await response.json().catch(() => null)) as (T & ApiEnvelope<T>) | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error?.message || `Falha na requisição (${response.status}).`);
  }
  return data as T;
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const data = await request<{ keys: ApiKeySummary[] }>('/keys');
  return data.keys;
}

export async function createApiKey(label: string, scopes: string[]): Promise<CreatedApiKey> {
  const data = await request<CreatedApiKey>('/keys', {
    method: 'POST',
    body: JSON.stringify({ label, scopes }),
  });
  return data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await request(`/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
