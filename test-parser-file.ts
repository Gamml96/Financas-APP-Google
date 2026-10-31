import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';
import { buildLines, type PdfTextItem } from './src/services/pdfLines';
import { parseFatura } from './src/services/faturaParser';

const pdfPath = process.argv[2];
if (!pdfPath) throw new Error('uso: npx tsx test-parser-file.ts <arquivo.pdf>');

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
const pages: string[][] = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  pages.push(buildLines(content.items as unknown as PdfTextItem[]));
}

const fatura = parseFatura(pages);

console.log('arquivo        :', pdfPath);
console.log('páginas        :', pages.length);
console.log('banco          :', fatura.bankName);
console.log('referência     :', fatura.referenceMonth);
console.log('vencimento     :', fatura.invoiceDueDate);
console.log('período        :', fatura.statementPeriodStart, '->', fatura.statementPeriodEnd);
console.log('lançamentos    :', fatura.transactions.length);
console.log('totais do PDF  :', JSON.stringify(fatura.totals));
console.log('\navisos:');
for (const w of fatura.warnings) console.log('  -', w);

console.log('\nprimeiras 15 transações:');
for (const t of fatura.transactions.slice(0, 15)) {
  console.log(`  ${t.date} | ${t.type} | ${t.description} | ${t.amount.toFixed(2)} | ${t.category}`);
}

const out = pdfPath.replace(/\.pdf$/i, '') + '-lines.txt';
fs.writeFileSync(
  out,
  pages.map((p, i) => `===== PÁGINA ${i + 1} =====\n${p.join('\n')}`).join('\n\n'),
  'utf8'
);
console.log('\nlinhas salvas em:', out);
