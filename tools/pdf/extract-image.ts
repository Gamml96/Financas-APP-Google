import * as fs from 'fs';
import * as pdfjs from 'pdfjs-dist';

const pdfPath = process.argv[2];
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
const page = await doc.getPage(1);

const ops = await page.getOperatorList();
const idx = ops.fnArray.findIndex(
  (fn: number) => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject
);
const objId = ops.argsArray[idx][0];
console.log('objId:', objId, 'tipo:', ops.fnArray[idx]);

const img: any = await new Promise((resolve) => {
  (page as any).objs.get(objId, resolve);
});

console.log('imagem:', img.width, 'x', img.height, '| kind:', img.kind, '| data bytes:', img.data?.length);

// kind 1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP
const channels = img.kind === 2 ? 3 : img.kind === 3 ? 4 : 1;
const header = `P6\n${img.width} ${img.height}\n255\n`;
if (channels === 3) {
  fs.writeFileSync(pdfPath.replace(/\.pdf$/i, '') + '-pagina1.ppm', Buffer.concat([Buffer.from(header, 'ascii'), Buffer.from(img.data)]));
  console.log('ppm salvo');
} else {
  console.log('formato não suportado direto, channels=', channels);
}
