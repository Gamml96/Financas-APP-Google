import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'SUA_CHAVE_AQUI') {
  console.error('❌ ERRO: GEMINI_API_KEY não encontrada no arquivo .env');
  process.exit(1);
}

const pdfPath = process.argv[2] || path.join(__dirname, 'fatura.pdf');

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ ERRO: Arquivo não encontrado: ${pdfPath}`);
  process.exit(1);
}

console.log(`📄 Lendo arquivo: ${pdfPath}`);
const pdfBuffer = fs.readFileSync(pdfPath);
const base64Data = pdfBuffer.toString('base64');

// Importa as funções do serviço
const { extractFaturaFromPdf, computeNetTotal } = await import('../src/services/faturaService.ts');

// Cria um objeto File-like compatível com o serviço (usando Buffer no Node)
const file = new File([pdfBuffer], 'fatura.pdf', { type: 'application/pdf' });

async function main() {
  console.log('🤖 Enviando para o Gemini AI (com retry + fallback entre modelos)...');
  const start = Date.now();

  try {
    const result = await extractFaturaFromPdf(file);

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Tempo de processamento: ${duration}s\n`);

    console.log('=== 🏦 RESULTADO DA EXTRAÇÃO (Aprimorada) ===');
    console.log(`Banco: ${result.bankName}`);
    if (result.statementPeriodStart && result.statementPeriodEnd) {
      console.log(`Período: ${result.statementPeriodStart} a ${result.statementPeriodEnd}`);
    }
    if (result.totalInvoiceAmount) {
      console.log(`Total oficial na fatura: R$ ${result.totalInvoiceAmount.toFixed(2)}`);
    }
    console.log(`Total de lançamentos extraídos: ${result.transactions.length}`);

    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️ Alertas / Observações:');
      result.warnings.forEach((w: string) => console.log(`  • ${w}`));
    }

    console.log('\n📋 Lançamentos Extraídos:');
    let sum = 0;
    result.transactions.forEach((t: any, i: number) => {
      const isRefund = t.type === 'refund';
      sum += isRefund ? -t.amount : t.amount;
      const parcel = (t.installmentNumber && t.installmentTotal)
        ? `[${t.installmentNumber}/${t.installmentTotal}]`
        : '     ';
      const cat = (`[${t.category || 'Outros'}]`).padEnd(16);
      const typeTag = t.type === 'fee' ? '🏦' : t.type === 'refund' ? '↩️ ' : '  ';
      const desc = t.description.padEnd(28);
      const sign = isRefund ? '-' : '+';
      console.log(`  ${String(i + 1).padStart(2, ' ')}. ${t.date} | ${parcel} | ${cat} ${typeTag} | ${desc} | ${sign} R$ ${t.amount.toFixed(2)}`);
    });

    const netTotal = computeNetTotal(result.transactions);
    console.log(`\n💰 Total LÍQUIDO extraído: R$ ${netTotal.toFixed(2)}`);
    if (result.totalInvoiceAmount) {
      const diff = netTotal - result.totalInvoiceAmount;
      const ok = Math.abs(diff) < 0.05;
      console.log(`📊 Total oficial da fatura:  R$ ${result.totalInvoiceAmount.toFixed(2)}`);
      console.log(`📊 Diferença:                R$ ${diff.toFixed(2)}  ${ok ? '✅ BATEU!' : '⚠️ diferença pequena'}`);
    }
  } catch (error: any) {
    console.error('❌ ERRO:', error.message || error);
    process.exit(1);
  }
}

main();
