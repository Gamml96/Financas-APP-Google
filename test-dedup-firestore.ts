import { hashGroupId, filterDuplicates, transactionKey, toDateKey } from './src/services/faturaDedup';

// Simula um Timestamp do Firestore
const ts = (iso: string) => ({
  seconds: Math.floor(new Date(iso + 'T00:00:00').getTime() / 1000),
  toDate: () => new Date(iso + 'T00:00:00'),
  toMillis: () => new Date(iso + 'T00:00:00').getTime(),
});

// Documento como está salvo no Firestore (installment / totalInstallments / Timestamp)
const saved = [
  { date: ts('2026-10-05'), description: 'C&a', amount: 119.99, installment: 3, totalInstallments: 6, groupId: 'x' },
  { date: ts('2026-09-09'), description: 'Uber', amount: 50.21 },
];

// Extraído da fatura
const extracted = [
  { date: '2026-10-05', description: 'C&a', amount: 119.99, installmentNumber: 3, installmentTotal: 6, category: 'Compras', type: 'purchase' as const },
  { date: '2026-09-09', description: 'Uber', amount: 50.21, category: 'Transporte', type: 'purchase' as const },
  { date: '2026-10-07', description: 'Padaria', amount: 22.5, category: 'Alimentação', type: 'purchase' as const },
];

const groups = new Set<string>();
const byDate = new Map<string, boolean>();
saved.forEach((tx: any) => {
  if (Number(tx.totalInstallments) > 1) groups.add(hashGroupId(tx));
  byDate.set(transactionKey(tx), true);
});

const { newTransactions, skipped } = filterDuplicates(extracted as any, groups, byDate);

const checks = [
  ['hashGroupId igual entre Firestore e fatura', hashGroupId(saved[0]) === hashGroupId(extracted[0])],
  ['toDateKey(Timestamp) = YYYY-MM-DD', toDateKey(ts('2026-10-05')) === '2026-10-05'],
  ['parcela 3/6 já importada é ignorada', skipped.some(t => t.description === 'C&a')],
  ['avulsa com Timestamp é ignorada', skipped.some(t => t.description === 'Uber')],
  ['lançamento novo é mantido', newTransactions.length === 1 && newTransactions[0].description === 'Padaria'],
];

checks.forEach(([label, ok]) => console.log(`${ok ? '✅' : '❌'} ${label}`));
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? '\nTodos os testes passaram.' : `\n${failed} teste(s) falharam.`);
process.exit(failed === 0 ? 0 : 1);
