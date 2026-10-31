import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';

const pdfPath = process.argv[2];
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('páginas:', doc.numPages);

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const ops = await page.getOperatorList();
  const viewport = page.getViewport({ scale: 1 });

  const imageOps = ops.fnArray.filter((fn: number) => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject || fn === pdfjs.OPS.paintImageMaskXObject).length;
  const textOps = ops.fnArray.filter((fn: number) => fn === pdfjs.OPS.showText || fn === pdfjs.OPS.showSpacedText).length;

  const rawItems = content.items as any[];
  const nonEmpty = rawItems.filter((it) => typeof it.str === 'string' && it.str.trim().length > 0);
  const fonts = (page as any)._pdfPage?.commonObjs ? 'ok' : 'n/d';

  console.log(
    `pág ${i}: ${Math.round(viewport.width)}x${Math.round(viewport.height)} | itens texto=${rawItems.length} (com texto=${nonEmpty.length}) | showText=${textOps} | imagens=${imageOps} | ${fonts}`
  );
  if (nonEmpty.length > 0) {
    console.log('   amostra:', JSON.stringify(nonEmpty.slice(0, 8).map((it) => it.str)));
  }
}
