/**
 * Importação de fatura: leitura 100% local, sem IA.
 *
 * O PDF é lido no próprio navegador (pdf.js), os lançamentos são extraídos por
 * regras (ver `faturaParser.ts`) e conferidos contra os totais impressos na
 * fatura. Nenhum token é gasto e o arquivo não sai do dispositivo.
 */

import { extractPdfPages } from './pdfText';
import { parseFatura } from './faturaParser';

export interface FaturaTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'purchase' | 'fee' | 'refund';
  installmentNumber?: number;
  installmentTotal?: number;
  /** false quando a categoria caiu no fallback (o usuário deve revisar) */
  categoryConfident?: boolean;
}

export interface FaturaResult {
  bankName: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  /** Data de vencimento desta fatura (YYYY-MM-DD) — define em qual fatura os lançamentos entram */
  invoiceDueDate?: string;
  totalInvoiceAmount?: number;
  transactions: FaturaTransaction[];
  warnings?: string[];
  /** Texto bruto extraído do PDF (para diagnóstico/reportar fatura não reconhecida) */
  rawText?: string;
}

/**
 * Calcula o total líquido de uma lista de transações.
 * Transactions do tipo "refund" são SUBTRAÍDAS (são créditos/estornos).
 * "purchase" e "fee" são SOMADOS (despesas).
 */
export function computeNetTotal(transactions: FaturaTransaction[]): number {
  return transactions.reduce((sum, t) => {
    if (t.type === 'refund') return sum - t.amount;
    return sum + t.amount;
  }, 0);
}

/**
 * Extrai os lançamentos de uma fatura em PDF.
 *
 * @param file       PDF escolhido pelo usuário
 * @param options    categorias do usuário (as sugeridas são encaixadas nelas) e senha do PDF
 */
export async function extractFaturaFromPdf(
  file: File,
  options: { categories?: string[]; password?: string } = {}
): Promise<FaturaResult> {
  const pages = await extractPdfPages(file, options.password);
  const parsed = parseFatura(pages);
  const rawText = pages.map((p, i) => `===== PÁGINA ${i + 1} =====\n${p.join('\\n')}`).join('\\n\\n');

  // PDF gerado por impressão ("Microsoft Print to PDF", scanner, foto) vira
  // imagem: não existe texto para ler e nenhum parser consegue extrair valores.
  const textChars = pages.reduce(
    (sum, page) => sum + page.reduce((lineSum, line) => lineSum + line.length, 0),
    0
  );
  if (textChars < 40) {
    throw new Error(
      'Este PDF é uma imagem (foi gerado por impressão ou digitalização), então não tem texto para ler. ' +
        'Baixe o PDF original da fatura no app ou no site do banco — o arquivo que o banco envia por e-mail — e importe esse arquivo.'
    );
  }

  if (parsed.transactions.length === 0) {
    throw new Error(
      'Não encontrei lançamentos neste PDF. Confira se é a fatura completa (não apenas o resumo).'
    );
  }

  const available = options.categories && options.categories.length > 0 ? options.categories : [];
  const fallbackCategory = available.includes('Outros') ? 'Outros' : available[0] || 'Outros';

  /** Encaixa a categoria sugerida na lista real do usuário. */
  const resolveCategory = (suggested: string): string => {
    if (available.length === 0) return suggested === '?' ? 'Outros' : suggested;
    if (suggested !== '?' && available.includes(suggested)) return suggested;
    return fallbackCategory;
  };

  const transactions: FaturaTransaction[] = parsed.transactions
    .filter((tx) => tx.type !== 'payment' && !tx.compensated)
    .map((tx) => ({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: resolveCategory(tx.category),
      type: tx.type as FaturaTransaction['type'],
      installmentNumber: tx.installmentNumber,
      installmentTotal: tx.installmentTotal,
      categoryConfident: tx.categoryConfident,
    }))
    .filter((tx) => tx.description && tx.amount > 0);

  return {
    bankName: parsed.bankName,
    statementPeriodStart: parsed.statementPeriodStart,
    statementPeriodEnd: parsed.statementPeriodEnd,
    invoiceDueDate: parsed.invoiceDueDate,
    totalInvoiceAmount: parsed.totals.total,
    transactions,
    warnings: parsed.warnings,
    rawText,
  };
}
