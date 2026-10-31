import { FaturaTransaction } from './faturaService';

/**
 * Formato m��nimo aceito pelas fun����es de deduplica��ǜo.
 * Aceita tanto transa����es extra��das da fatura (installmentNumber/installmentTotal)
 * quanto transa����es jǭ salvas no Firestore (installment/totalInstallments).
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
 * Converte qualquer representa��ǜo de data (string ISO, Date, Timestamp do Firestore)
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
 * Chave determin��stica de uma transa��ǜo avulsa: data + descri��ǜo + valor.
 */
export function transactionKey(tx: DedupTransaction): string {
  return `${toDateKey(tx.date)}|${(tx.description || '').trim().toLowerCase()}|${Number(tx.amount || 0).toFixed(2)}`;
}

/**
 * Chave "suave" de uma transa��ǜo parcelada: descri��ǜo + total de parcelas.
 *
 * O valor por parcela NÃO entra na chave porque os bancos ajustam centavos entre
 * parcelas (arredondamento) e adicionam IOF em parcelas específicas, o que faria
 * a mesma compra ser tratada como lançamentos diferentes. A tolerância de valor
 * é verificada separadamente em `isDuplicate`.
 */
export function hashGroupId(tx: DedupTransaction): string {
  const description = (tx.description || '').trim().toLowerCase();
  const { total } = installmentInfo(tx);
  return `fatura-${description}-${total || 1}`;
}

/** Tolerância de valor para considerar duas parcelas da mesma compra. */
function amountTolerance(amount: number): number {
  return Math.max(0.5, amount * 0.01);
}

/**
 * Verifica se uma transa��ǜo jǭ foi importada anteriormente.
 * Parceladas: mesma descri��ǜo + total de parcelas E valor dentro da tolerância.
 * Avulsas: data + descri��ǜo + valor exatos.
 */
export function isDuplicate(
  existingGroups: Map<string, number[]>,
  existingByDate: Map<string, boolean>,
  tx: DedupTransaction
): boolean {
  const { current, total } = installmentInfo(tx);
  if (current > 0 && total > 1) {
    const key = hashGroupId(tx);
    const amounts = existingGroups.get(key);
    if (amounts && amounts.length > 0) {
      const amt = Number(tx.amount || 0);
      if (amounts.some((a) => Math.abs(a - amt) <= amountTolerance(amt))) return true;
    }
  }

  if (existingByDate.has(transactionKey(tx))) return true;

  return false;
}

/**
 * Marca uma transa��ǜo como importada, atualizando os conjuntos de rastreamento.
 */
export function markImported(
  existingGroups: Map<string, number[]>,
  existingByDate: Map<string, boolean>,
  tx: DedupTransaction
): void {
  const { current, total } = installmentInfo(tx);
  if (current > 0 && total > 1) {
    const key = hashGroupId(tx);
    const amt = Number(tx.amount || 0);
    const list = existingGroups.get(key) || [];
    if (!list.some((a) => Math.abs(a - amt) < 0.005)) list.push(amt);
    existingGroups.set(key, list);
  }
  existingByDate.set(transactionKey(tx), true);
}

/**
 * Filtra transa����es duplicadas, mantendo apenas as que ainda nǜo foram importadas.
 */
export function filterDuplicates(
  transactions: FaturaTransaction[],
  existingGroups: Map<string, number[]>,
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
