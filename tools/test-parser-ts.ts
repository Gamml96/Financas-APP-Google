import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';
import { buildLines, type PdfTextItem } from '../src/services/pdfLines';
import { parseFatura, projectNextInvoice } from '../src/services/faturaParser';

const pdfPath = 'C:/Users/Usuario/Documents/Financas-APP-Google/fatura.pdf';
const data = new Uint8Array(fs.readFileSync(pdfPath));

const doc = await pdfjs.getDocument({ data }).promise;
const pages: string[][] = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  pages.push(buildLines(content.items as unknown as PdfTextItem[]));
}

const fatura = parseFatura(pages);

console.log('páginas        :', pages.length);
console.log('vencimento     :', fatura.invoiceDueDate);
console.log('período        :', fatura.statementPeriodStart, '->', fatura.statementPeriodEnd);
console.log('lançamentos    :', fatura.transactions.length);
console.log('totais do PDF  :', JSON.stringify(fatura.totals));

const brl = (v: number) => v.toFixed(2);
const purchases = fatura.transactions.filter((t) => t.type === 'purchase');
const fees = fatura.transactions.filter((t) => t.type === 'fee');
const refunds = fatura.transactions.filter((t) => t.type === 'refund');
const sum = (list: typeof purchases) => list.reduce((s, t) => s + t.amount, 0);

console.log('compras lidas  :', brl(sum(purchases)), '| PDF', fatura.totals.purchases);
console.log('encargos lidos :', brl(sum(fees)), '| PDF', fatura.totals.fees);
console.log('estornos lidos :', brl(sum(refunds)), '| PDF', fatura.totals.credits);
console.log('total calculado:', brl(sum(purchases) + sum(fees) - sum(refunds)), '| PDF', fatura.totals.total);
console.log('próx. fatura   :', brl(projectNextInvoice(fatura.transactions)), '| PDF', fatura.totals.nextInvoice);
console.log('compensados    :', fatura.transactions.filter((t) => t.compensated).map((t) => t.description).join(', ') || 'nenhum');

const parceladas = purchases.filter((t) => (t.installmentTotal || 0) > 1);
console.log('\nparceladas:');
for (const t of parceladas) {
  console.log(`  ${t.date} | ${t.description} | ${t.installmentNumber}/${t.installmentTotal} | ${brl(t.amount)} | ${t.category}`);
}

console.log('\nsem categoria:');
for (const t of fatura.transactions.filter((t) => !t.compensated && t.type !== 'payment' && !t.categoryConfident)) {
  console.log(`  ${t.date} | ${t.description} | ${brl(t.amount)}`);
}

console.log('\navisos:');
for (const w of fatura.warnings) console.log('  -', w);
