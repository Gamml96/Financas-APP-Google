/** REMOVIDO — endpoint de diagnóstico Temporário */
import type { VercelRequest, VercelResponse } from '@vercel/node';
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(404).json({ ok: false, error: { code: 'not-found', message: 'removido' } });
}