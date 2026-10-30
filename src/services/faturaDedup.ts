import { FaturaTransaction } from './faturaService';

/**
 * Formato mínimo aceito pelas funções de deduplicação.
 * Aceita tanto transações extraídas da fatura (installmentNumber/installmentTotal)
 * quanto transações já salvas no Firestore (installment/totalInstallments).
 */
export interface DedupTransaction {
  date?: any;
  description?: string;
  amount?: any;
  installment?: number;
  totalInstallments?: number;
  installmentNumber?: number;
  installmentTotal?: number;
  [key: string]: any;
}

/** Normaliza o par (parcela atual, total de parcelas) dos dois formatos usados no app. */
function installmentInfo(tx: DedupTransaction): { current: number; total: number } {
  const current = Number(tx.installmentNumber ?? tx.installment ?? 0);
  const total = Number(tx.installmentTotal ?? tx.totalInstallments ?? 0);
  return { current, total };
}

/**
 * Converte qualquer representação de data (string ISO, Date, Timestamp do Firestore)
 * em uma chave "YYYY-MM-DD" no fuso local.
 */
export function toDateKey(value: unknown): string {
  if (!value) return '';

  let date: Date | null = null;

  if (typeof value === 'string') {
    date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof (value as any).toDate === 'function') {
    date = (value as any).toDate();
  } else if (typeof (value as any).seconds === 'number') {
    date = new Date((value as any).seconds * 1000);
  }

  if (!date || isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Chave determinística de uma transação avulsa: data + descrição + valor.
 */
export function transactionKey(tx: DedupTransaction): string {
  return `${toDateKey(tx.date)}|${(tx.description || '').trim().toLowerCase()}|${Number(tx.amount || 0).toFixed(2)}`;
}

/**
 * Gera um identificador determinístico (hash) para uma transação parcelada.
 * Usado para agrupar parcelas da mesma compra em faturas diferentes.
 *
 * Exemplo: "C&a (1/3)" e "C&a (2/3)" e "C&a (3/3)" geram o mesmo groupId
 * porque têm a mesma descrição limpa, mesmo valor por parcela e mesmo total de parcelas.
 */
export function hashGroupId(tx: DedupTransaction): string {
  const description = (tx.description || '').trim().toLowerCase();
  const amount = Number(tx.amount || 0).toFixed(2);
  const { total } = installmentInfo(tx);
  return `fatura-${description}-${amount}-${total || 1}`;
}

/**
 * Verifica se uma transação já foi importada anteriormente.
 * Busca por: groupId (para parceladas) OU por data+descrição+valor (para avulsas).
 *
 * @param existingGroups Conjunto de groupIds já existentes no Firestore
 * @param existingByDate Valor Map de "date|description|amount" -> true se já existe
 * @param tx Transação a ser verificada
 * @returns true se a transação já foi importada
 */
export function isDuplicate(
  existingGroups: Set<string>,
  existingByDate: Map<string, boolean>,
  tx: DedupTransaction
): boolean {
  // Caso 1: transação parcelada — verifica pelo groupId
  const { current, total } = installmentInfo(tx);
  if (current > 0 && total > 1) {
    if (existingGroups.has(hashGroupId(tx))) return true;
  }

  // Caso 2: transação avulsa — verifica por data + descrição + valor
  if (existingByDate.has(transactionKey(tx))) return true;

  return false;
}

/**
 * Marca uma transação como importada, atualizando os conjuntos de rastreamento.
 */
export function markImported(
  existingGroups: Set<string>,
  existingByDate: Map<string, boolean>,
  tx: DedupTransaction
): void {
  const { current, total } = installmentInfo(tx);
  if (current > 0 && total > 1) {
    existingGroups.add(hashGroupId(tx));
  }
  existingByDate.set(transactionKey(tx), true);
}

/**
 * Filtra transações duplicadas, mantendo apenas as que ainda não foram importadas.
 *
 * @param transactions Lista de transações extraídas pela IA
 * @param existingGroups Conjunto de groupIds já existentes no Firestore
 * @param existingByDate Map de "date|description|amount" já existentes
 * @returns Objeto com as transações novas e os skipped (já existentes)
 */
export function filterDuplicates(
  transactions: FaturaTransaction[],
  existingGroups: Set<string>,
  existingByDate: Map<string, boolean>
): { newTransactions: FaturaTransaction[]; skipped: FaturaTransaction[] } {
  const newTransactions: FaturaTransaction[] = [];
  const skipped: FaturaTransaction[] = [];

  for (const tx of transactions) {
    if (isDuplicate(existingGroups, existingByDate, tx)) {
      skipped.push(tx);
    } else {
      newTransactions.push(tx);
      markImported(existingGroups, existingByDate, tx);
    }
  }

  return { newTransactions, skipped };
}
