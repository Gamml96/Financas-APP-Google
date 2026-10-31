/**
 * Extração do texto do PDF no próprio navegador (pdf.js).
 * O arquivo nunca sai do dispositivo.
 *
 * O pdf.js é carregado sob demanda: só entra no bundle quando o usuário
 * realmente importa uma fatura, mantendo a abertura do app leve.
 */

import type { PdfTextItem } from './pdfLines';
import { buildLines } from './pdfLines';

/** Devolve as linhas de cada página do PDF. */
export async function extractPdfPages(file: File): Promise<string[][]> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const pages: string[][] = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      pages.push(buildLines(content.items as unknown as PdfTextItem[]));
      page.cleanup();
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
