import { FaturaTransaction } from './faturaService';

/**
 * Gera um identificador determinístico (hash) para uma transação parcelada.
 * Usado para agrupar parcelas da mesma compra em faturas diferentes.
 *
 * Exemplo: "C&a (1/3)" e "C&a (2/3)" e "C&a (3/3)" geram o mesmo groupId
 * porque têm a mesma descrição limpa, mesmo valor por parcela e mesmo total de parcelas.
 */
export function hashGroupId(tx: FaturaTransaction): string {
  const description = (tx.description || '').trim().toLowerCase();
  const amount = Number(tx.amount || 0).toFixed(2);
  const totalInstallments = tx.installmentTotal || 1;
  return `fatura-${description}-${amount}-${totalInstallments}`;
}

/**
 * Verifica se uma transação já foi importada anteriormente.
 * Busca no Firestore por: groupId (para parceladas) OU por data+descrição+valor (para avulso).
 *
 * @param existingGroups Conjunto de groupIds já existentes no Firestore
 * @param existingByDate Valor Map de "date|description|amount" -> true se já existe
 * @param tx Transação a ser verificada
 * @returns true se a transação já foi importada
 */
export function isDuplicate(
  existingGroups: Set<string>,
  existingByDate: Map<string, boolean>,
  tx: FaturaTransaction
): boolean {
  // Caso 1: transação parcelada — verifica pelo groupId
  if (tx.installmentNumber && tx.installmentTotal && tx.installmentTotal > 1) {
    const groupId = hashGroupId(tx);
    if (existingGroups.has(groupId)) return true;
  }

  // Caso 2: transação avulsa — verifica por data + descrição + valor
  const key = `${tx.date}|${(tx.description || '').trim().toLowerCase()}|${Number(tx.amount || 0).toFixed(2)}`;
  if (existingByDate.has(key)) return true;

  return false;
}

/**
 * Marca uma transação como importada, atualizando os conjuntos de rastreamento.
 */
export function markImported(
  existingGroups: Set<string>,
  existingByDate: Map<string, boolean>,
  tx: FaturaTransaction
): void {
  if (tx.installmentNumber && tx.installmentTotal && tx.installmentTotal > 1) {
    existingGroups.add(hashGroupId(tx));
  }
  const key = `${tx.date}|${(tx.description || '').trim().toLowerCase()}|${Number(tx.amount || 0).toFixed(2)}`;
  existingByDate.set(key, true);
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