/**
 * Reconstrução de linhas a partir dos fragmentos de texto do PDF.
 *
 * Separado do carregamento do PDF para poder ser testado fora do navegador.
 */

export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** Junta fragmentos de uma mesma linha respeitando o espaço entre eles. */
function joinRow(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => a.transform[4] - b.transform[4]);
  let line = '';
  let previousEnd: number | null = null;

  for (const item of sorted) {
    const start = item.transform[4];
    if (previousEnd !== null && start - previousEnd > 1.2) {
      line += ' ';
    }
    line += item.str;
    previousEnd = start + (item.width || 0);
  }

  return line.replace(/\s{2,}/g, ' ').trim();
}

/** Agrupa por altura (linha) e ordena por posição horizontal (coluna). */
export function buildLines(items: PdfTextItem[]): string[] {
  const rows = new Map<number, PdfTextItem[]>();

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    // Tolerância de ~3pt para fragmentos levemente desalinhados.
    const key = Math.round(item.transform[5] / 3);
    const row = rows.get(key);
    if (row) row.push(item);
    else rows.set(key, [item]);
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0]) // topo da página primeiro
    .map(([, row]) => joinRow(row))
    .filter(Boolean);
}
