import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const pdfPath = 'C:/Users/Usuario/Documents/Financas-APP-Google/fatura.pdf';
const buf = fs.readFileSync(pdfPath);
const file = new File([buf], 'fatura.pdf', { type: 'application/pdf' });

const { extractFaturaFromPdf } = await import('./src/services/faturaService.ts');

const r = await extractFaturaFromPdf(file, {
  categories: ['Alimentação', 'Transporte', 'Compras', 'Entretenimento', 'Saúde', 'Aluguel', 'Encargos', 'Outros'],
});

console.log('invoiceDueDate :', r.invoiceDueDate);
console.log('periodo        :', r.statementPeriodStart, '->', r.statementPeriodEnd);
console.log('total fatura   :', r.totalInvoiceAmount);
console.log('lancamentos    :', r.transactions.length);
console.log('categorias     :', [...new Set(r.transactions.map((t) => t.category))].join(', '));

const parceladas = r.transactions.filter((t) => (t.installmentTotal || 0) > 1);
console.log('\nParceladas:');
parceladas.forEach((t) => {
  console.log(`  ${t.date} | ${t.description} (${t.installmentNumber}/${t.installmentTotal}) | R$ ${t.amount}`);
});
