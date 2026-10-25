import { FaturaTransaction } from './src/services/faturaService';
import { filterDuplicates, hashGroupId } from './src/services/faturaDedup';

// Simula transações extraídas pela IA (como a fatura real do BTG)
const extracted: FaturaTransaction[] = [
  // Parcelada (3 parcelas)
  { date: '2026-09-12', description: 'C&a', amount: 119.99, category: 'Compras', type: 'purchase', installmentNumber: 1, installmentTotal: 3 },
  { date: '2026-09-12', description: 'C&a', amount: 103.34, category: 'Compras', type: 'purchase', installmentNumber:2, installmentTotal: 3 },
  { date: '2026-09-12', description: 'C&a', amount: 119.99, category: 'Compras', type: 'purchase', installmentNumber: 3, installmentTotal: 3 },
  // Avulsa
  { date: '2026-09-09', description: 'Uber', amount: 50.21, category: 'Transporte', type: 'purchase' },
  // Encargo
  { date: '2026-09-27', description: 'Multa por atraso', amount: 142.61, category: 'Encargos', type: 'fee' },
];

// Simula transações já existentes no Firestore (já importadas na fatura anterior)
const existingGroups = new Set<string>([
  hashGroupId({ date: '2026-08-12', description: 'C&a', amount: 119.99, category: 'Compras', type: 'purchase', installmentNumber: 1, installmentTotal: 3 }),
]);
const existingByDate = new Map<string, boolean>([
  ['2026-09-09|uber|50.21', true],  // Uber já importada
]);

console.log('🔍 Teste de deduplicação:\n');
console.log('Transações extraídas:', extracted.length);
console.log('Já existentes no Firestore:', existingGroups.size + ' grupo(s) parcelado(s) +', existingByDate.size, 'transação(s) avulsa(s)\n');

const { newTransactions, skipped } = filterDuplicates(extracted, existingGroups, existingByDate);

console.log('✅ NOVAS a serem importadas:', newTransactions.length);
newTransactions.forEach((tx, i) => {
  const parcel = tx.installmentNumber && tx.installmentTotal ? `(${tx.installmentNumber}/${tx.installmentTotal})` : '';
  console.log(`  ${i + 1}. ${tx.date} | ${tx.description} ${parcel} | R$ ${tx.amount.toFixed(2)} | ${tx.category}`);
});

console.log('\n⏭️  JÁ EXISTENTES (serão puladas):', skipped.length);
skipped.forEach((tx, i) => {
  const parcel = tx.installmentNumber && tx.installmentTotal ? `(${tx.installmentNumber}/${tx.installmentTotal})` : '';
  console.log(`  ${i + 1}. ${tx.date} | ${tx.description} ${parcel} | R$ ${tx.amount.toFixed(2)} | ${tx.category}`);
});