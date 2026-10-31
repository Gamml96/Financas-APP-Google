import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';
import { buildLines, type PdfTextItem } from '../../src/services/pdfLines';
import { parseFatura } from '../../src/services/faturaParser';
import { filterDuplicates, hashGroupId } from '../../src/services/faturaDedup';

async function parsePdf(path: string, password: string) {
  const data = new Uint8Array(fs.readFileSync(path));
  const doc = await pdfjs.getDocument({ data, password }).promise;
  const pages: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(buildLines(content.items as unknown as PdfTextItem[]));
  }
  return parseFatura(pages);
}

const sep = await parsePdf('C:/Users/Usuario/Documents/Financas-APP-Google/Fatura-CPF (1).pdf', '229913');
const oct = await parsePdf('C:/Users/Usuario/Documents/Financas-APP-Google/Fatura-CPF.pdf', '229913');

// Simula o que o app faz ao importar setembro: cria parcelas futuras
const existingGroups = new Map<string, number[]>();
const existingByDate = new Map<string, boolean>();

// Importa as parcelas de setembro (current) + cria futuras
for (const tx of sep.transactions.filter(t => t.type !== 'payment' && !t.compensated)) {
  // current
  const key = hashGroupId(tx as any);
  const amt = Number(tx.amount || 0);
  const list = existingGroups.get(key) || [];
  if (!list.some(a => Math.abs(a - amt) < 0.005)) list.push(amt);
  existingGroups.set(key, list);
  existingByDate.set(`${tx.date}|${tx.description.trim().toLowerCase()}|${tx.amount.toFixed(2)}`, true);

  // future installments
  const total = tx.installmentTotal || 0;
  const current = tx.installmentNumber || 0;
  if (total > 1 && current > 0 && current < total) {
    for (let n = current + 1; n <= total; n++) {
      const futAmt = tx.amount; // app keeps same amount
      const futKey = hashGroupId({ ...tx, installmentNumber: n, amount: futAmt } as any);
      const futList = existingGroups.get(futKey) || [];
      if (!futList.some(a => Math.abs(a - futAmt) < 0.005)) futList.push(futAmt);
      existingGroups.set(futKey, futList);
    }
  }
}

// Now import October
const octImportable = oct.transactions.filter(t => t.type !== 'payment' && !t.compensated);
const { newTransactions, skipped } = filterDuplicates(octImportable as any, existingGroups, existingByDate);

console.log('October parcelas importáveis:', octImportable.length);
console.log('Puladas (dedup):', skipped.length);
console.log('Novas:', newTransactions.length);
console.log('\nPuladas:');
for (const t of skipped) console.log(`  ${t.description} ${t.installmentNumber}/${t.installmentTotal} | ${t.amount}`);
console.log('\nNovas (parceladas):');
for (const t of newTransactions.filter(t => (t.installmentTotal || 0) > 1)) console.log(`  ${t.description} ${t.installmentNumber}/${t.installmentTotal} | ${t.amount}`);
