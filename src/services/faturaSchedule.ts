import { addMonths, parseISO, startOfDay } from 'date-fns';

/** Lançamento vindo da fatura (apenas os campos que afetam a data). */
export interface FaturaScheduleInput {
  /** Data da compra no formato YYYY-MM-DD */
  date: string;
  installmentNumber?: number;
  installmentTotal?: number;
  /** 'refund' não gera parcelas futuras */
  type?: string;
}

export interface FaturaScheduleOptions {
  /** Vencimento desta fatura (YYYY-MM-DD) — define em qual fatura os lançamentos entram */
  invoiceDueDate?: string;
  /** Cria as parcelas seguintes (N+1 ... M) nas faturas futuras */
  createFutureInstallments?: boolean;
  /**
   * Fallback usado quando o PDF não traz o vencimento: recebe a data da parcela
   * e devolve o vencimento estimado (dia de fechamento/vencimento do cartão).
   */
  estimateDueDate?: (purchaseDate: Date) => Date;
}

export interface FaturaScheduleEntry {
  /** Data da compra (parcelas futuras mantêm a mesma data) */
  date: Date;
  /** Vencimento da fatura em que a parcela cai */
  dueDate: Date;
  installment?: number;
  totalInstallments?: number;
}

export interface FaturaSchedule {
  /** Parcela que está nesta fatura */
  current: FaturaScheduleEntry;
  /** Parcelas seguintes, nas faturas seguintes */
  future: FaturaScheduleEntry[];
  hasInstallment: boolean;
}

/**
 * Calcula em qual fatura cada parcela cai.
 *
 * - Com `invoiceDueDate`: a parcela atual entra nessa fatura e as futuras avançam
 *   mês a mês (5/6 de uma compra de maio cai na fatura de outubro, não na de junho).
 * - Sem `invoiceDueDate`: usa `estimateDueDate` deslocando pela posição da parcela.
 */
export function buildFaturaSchedule(
  tx: FaturaScheduleInput,
  options: FaturaScheduleOptions = {}
): FaturaSchedule {
  const purchaseDate = startOfDay(new Date(`${tx.date}T00:00:00`));

  const installmentTotal = Number(tx.installmentTotal || 0);
  const installmentCurrent = Number(tx.installmentNumber || 0);
  const hasInstallment = installmentTotal > 1 && installmentCurrent > 0;
  const isRefund = tx.type === 'refund';

  const parsedInvoiceDue = options.invoiceDueDate ? parseISO(options.invoiceDueDate) : null;
  const invoiceDue =
    parsedInvoiceDue && !isNaN(parsedInvoiceDue.getTime()) ? startOfDay(parsedInvoiceDue) : null;

  const dueFor = (installmentNumber: number): Date => {
    if (invoiceDue) {
      const offset = hasInstallment ? Math.max(0, installmentNumber - installmentCurrent) : 0;
      return addMonths(invoiceDue, offset);
    }
    if (options.estimateDueDate) {
      const offset = Math.max(0, installmentNumber - 1);
      return options.estimateDueDate(addMonths(purchaseDate, offset));
    }
    return purchaseDate;
  };

  const currentInstallment = hasInstallment ? installmentCurrent : 1;

  const current: FaturaScheduleEntry = {
    date: purchaseDate,
    dueDate: dueFor(currentInstallment),
  };
  if (hasInstallment) {
    current.installment = installmentCurrent;
    current.totalInstallments = installmentTotal;
  }

  const future: FaturaScheduleEntry[] = [];
  const createFuture = options.createFutureInstallments !== false;

  if (createFuture && hasInstallment && !isRefund && installmentCurrent < installmentTotal) {
    for (let n = installmentCurrent + 1; n <= installmentTotal; n++) {
      future.push({
        date: purchaseDate,
        dueDate: dueFor(n),
        installment: n,
        totalInstallments: installmentTotal,
      });
    }
  }

  return { current, future, hasInstallment };
}
