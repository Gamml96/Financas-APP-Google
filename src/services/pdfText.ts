/**
 * Extração do texto do PDF no próprio navegador (pdf.js).
 * O arquivo nunca sai do dispositivo.
 *
 * O pdf.js é carregado sob demanda: só entra no bundle quando o usuário
 * realmente importa uma fatura, mantendo a abertura do app leve.
 */

import type { PdfTextItem } from './pdfLines';
import { buildLines } from './pdfLines';

/** O PDF está protegido por senha (ou a senha informada está errada). */
export class PdfPasswordError extends Error {
  /** true quando o PDF abriu mas a senha digitada está errada */
  readonly incorrect: boolean;

  constructor(incorrect: boolean) {
    super(
      incorrect
        ? 'Senha incorreta. Confira e tente novamente.'
        : 'Este PDF está protegido por senha.'
    );
    this.name = 'PdfPasswordError';
    this.incorrect = incorrect;
  }
}

/**
 * Devolve as linhas de cada página do PDF.
 * `password` só é necessário para faturas protegidas.
 */
export async function extractPdfPages(file: File, password?: string): Promise<string[][]> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, password });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err: any) {
    // pdf.js sinaliza senha ausente/errada com PasswordException.
    if (err?.name === 'PasswordException' || err?.constructor?.name === 'PasswordException') {
      // code 2 = INCORRECT_PASSWORD
      throw new PdfPasswordError(err?.code === 2 || Boolean(password));
    }
    throw err;
  }

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
