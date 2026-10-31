import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';
import { buildLines, type PdfTextItem } from '../../src/services/pdfLines';
import { parseHeaderNubank } from '../../src/services/faturaParser';

const pdfPath = process.argv[2];
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
const pages: string[][] = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  pages.push(buildLines(content.items as unknown as PdfTextItem[]));
}
const text = pages.map(p => p.join('\n')).join('\n');
console.log('text length:', text.length);
console.log('has "Data de vencimento":', text.includes('Data de vencimento'));
const idx = text.indexOf('Data de vencimento');
console.log('around:', JSON.stringify(text.slice(idx, idx + 40)));
console.log('vencMatch test:', text.match(/Data de vencimento:\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/i));
const header = parseHeaderNubank(text);
console.log('header:', JSON.stringify(header, null, 2));
