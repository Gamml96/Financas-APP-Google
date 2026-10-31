import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';

const pdfPath = process.argv[2];
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;

const meta = await doc.getMetadata();
console.log('metadata:', JSON.stringify(meta.info, null, 2));

const page = await doc.getPage(1);
const ops = await page.getOperatorList();
const viewport = page.getViewport({ scale: 1 });

// Renderiza a página 1 num canvas e salva PNG, para conferir visualmente
const canvasFactory: any = (pdfjs as any).DefaultCanvasFactory;
const canvasAndContext = canvasFactory.create(viewport.width * 1.6, viewport.height * 1.6);
await page.render({
  canvasContext: canvasAndContext.context,
  canvas: canvasAndContext.canvas,
  viewport: page.getViewport({ scale: 1.6 }),
} as any).promise;

const png = canvasAndContext.canvas.toBuffer('image/png');
fs.writeFileSync(pdfPath.replace(/\.pdf$/i, '') + '-pagina1.png', png);
console.log('render salvo, bytes:', png.length, '| ops:', ops.fnArray.length);
