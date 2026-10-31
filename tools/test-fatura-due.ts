import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const pdfPath = 'C:/Users/Usuario/Documents/Financas-APP-Google/fatura.pdf';
const buf = fs.readFileSync(pdfPath);
const file = new File([buf], 'fatura.pdf', { type: 'application/pdf' });

const { extractFaturaFromPdf } = await import('../src/services/faturaService.ts');
const { buildFaturaSchedule } = await import('../src/services/faturaSchedule.ts');

const r = await extractFaturaFromPdf(file, {
  categories: ['Alimentação', 'Transporte', 'Compras', 'Entretenimento', 'Saúde', 'Aluguel', 'Encargos', 'Outros'],
});

const fmt = (d: Date) => d.toISOString().slice(0, 10);

console.log('invoiceDueDate :', r.invoiceDueDate);
console.log('periodo        :', r.statementPeriodStart, '->', r.statementPeriodEnd);
console.log('total fatura   :', r.totalInvoiceAmount);
console.log('lancamentos    :', r.transactions.length);

const parceladas = r.transactions.filter((t) => (t.installmentTotal || 0) > 1);

let problemas = 0;
let futuras = 0;

console.log('\nParceladas (parcela atual + futuras):');
for (const t of parceladas) {
  const s = buildFaturaSchedule(t, { invoiceDueDate: r.invoiceDueDate });
  const futurasTxt = s.future.map((f) => `${f.installment}/${f.totalInstallments}→${fmt(f.dueDate)}`).join(' ');
  futuras += s.future.length;
  console.log(
    `  ${t.date} | ${t.description} (${t.installmentNumber}/${t.installmentTotal}) | ` +
      `atual→${fmt(s.current.dueDate)} | ${futurasTxt}`
  );
  if (fmt(s.current.dueDate) !== r.invoiceDueDate) {
    problemas++;
    console.log(`     ⚠️  esperado ${r.invoiceDueDate}`);
  }
}

// À vista: todas caem na fatura importada
const aVista = r.transactions.filter((t) => !((t.installmentTotal || 0) > 1));
const aVistaErradas = aVista.filter(
  (t) => fmt(buildFaturaSchedule(t, { invoiceDueDate: r.invoiceDueDate }).current.dueDate) !== r.invoiceDueDate
);

console.log('\nResumo:');
console.log(`  à vista na fatura correta : ${aVista.length - aVistaErradas.length}/${aVista.length}`);
console.log(`  parceladas na fatura certa: ${parceladas.length - problemas}/${parceladas.length}`);
console.log(`  parcelas futuras criadas  : ${futuras}`);
console.log(problemas === 0 && aVistaErradas.length === 0 ? '\n✅ OK' : '\n❌ FALHOU');
