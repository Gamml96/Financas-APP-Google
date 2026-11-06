/**
 * Gera o "badge" monocromático usado nas notificações push.
 *
 * O Android desenha o ícone da barra de status a partir do campo `badge`,
 * que precisa ser branco sobre fundo transparente. Uma imagem colorida vira
 * um borrão cinza — por isso geramos este arquivo.
 *
 * Uso: node scripts/generate-badge.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 96;
const SS = 4; // supersampling para suavizar as bordas

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Um "V" com traços grossos e pontas arredondadas, centralizado.
const STROKE = 13;
const segments = [
  [27, 20, 48, 74],
  [69, 20, 48, 74],
];

const big = SIZE * SS;
const alpha = new Uint8Array(big * big);

for (let y = 0; y < big; y += 1) {
  for (let x = 0; x < big; x += 1) {
    const px = (x + 0.5) / SS;
    const py = (y + 0.5) / SS;
    let inside = false;
    for (const [x1, y1, x2, y2] of segments) {
      if (distanceToSegment(px, py, x1, y1, x2, y2) <= STROKE / 2) {
        inside = true;
        break;
      }
    }
    alpha[y * big + x] = inside ? 255 : 0;
  }
}

// Downsample (média) para suavizar as bordas.
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let sum = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        sum += alpha[(y * SS + sy) * big + (x * SS + sx)];
      }
    }
    const a = Math.round(sum / (SS * SS));
    const i = (y * SIZE + x) * 4;
    out[i] = 255; // R
    out[i + 1] = 255; // G
    out[i + 2] = 255; // B
    out[i + 3] = a; // A
  }
}

// Scanlines com filtro 0.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0;
  out.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync('public/badge-96.png', png);
console.log('public/badge-96.png gerado:', png.length, 'bytes');
