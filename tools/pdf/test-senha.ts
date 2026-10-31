/**
 * Verifica a leitura de fatura protegida por senha (o que o app faz no navegador).
 *
 *   npx tsx tools/pdf/test-senha.ts <arquivo.pdf> <senha>
 */
import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';
import { buildLines, type PdfTextItem } from '../../src/services/pdfLines';
import { parseFatura } from '../../src/services/faturaParser';

const [pdfPath, password] = process.argv.slice(2);
if (!pdfPath) throw new Error('uso: npx tsx tools/pdf/test-senha.ts <arquivo.pdf> [senha]');

const data = new Uint8Array(fs.readFileSync(pdfPath));

async function abrir(senha?: string) {
  // pdf.js transfere o buffer para o worker: cada tentativa precisa de uma cópia
  const task = pdfjs.getDocument({ data: new Uint8Array(data), password: senha });
  try {
    return await task.promise;
  } catch (err: any) {
    console.log(`  senha "${senha ?? '(nenhuma)'}" -> erro: ${err?.name} code=${err?.code}`);
    return null;
  }
}

console.log('1) sem senha:');
const semSenha = await abrir();
console.log('   abriu?', Boolean(semSenha));

console.log('2) senha errada:');
const errada = await abrir('senha-errada');
console.log('   abriu?', Boolean(errada));

console.log('3) senha correta:');
const doc = await abrir(password);
if (!doc) {
  console.log('   não abriu');
  process.exit(1);
}

const pages: string[][] = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  pages.push(buildLines(content.items as unknown as PdfTextItem[]));
}

const fatura = parseFatura(pages);
console.log('   lançamentos:', fatura.transactions.length);
console.log('   vencimento :', fatura.invoiceDueDate);
console.log('   total PDF  :', fatura.totals.total);
