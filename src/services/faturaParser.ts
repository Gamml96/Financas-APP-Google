/**
 * Parser local de faturas de cartão (sem IA).
 *
 * Suporta os layouts do BTG Pactual e do C6 Bank. A detecção do banco é feita
 * pelo próprio texto da fatura.
 */

export type FaturaTxType = 'purchase' | 'fee' | 'refund' | 'payment';

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: FaturaTxType;
  section: string;
  category: string;
  categoryConfident: boolean;
  installmentNumber?: number;
  installmentTotal?: number;
  compensated: boolean;
}

export interface ParsedFatura {
  bankName: string;
  referenceMonth?: string;
  invoiceDueDate?: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  totals: {
    purchases?: number;
    credits?: number;
    fees?: number;
    total?: number;
    nextInvoice?: number;
  };
  transactions: ParsedTransaction[];
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DATE_RE = /(?<![\d/])(0?[1-9]|[12]\d|3[01])\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+/gi;
const BRL_END_RE = /^(?<desc>.*?)\s+(?:-\s*)?R\$\s*(?<amount>[\d.]+,\d{2})\s*$/;
const FOREIGN_END_RE = /^(?<desc>.*?)\s+(?<cur>USD|EUR|COP|ARS|GBP)\s*(?<amount>[\d.,]+)\s*$/i;
const COTACAO_RE = /^cota[cç][aã]o da moeda\s*-?\s*R\$\s*([\d.]+,\d{2})\s*$/i;
const CONVERSAO_RE = /^convers[aã]o para real\s*-?\s*R\$\s*([\d.]+,\d{2})\s*$/i;
const CONTINUATION_SPLIT_RE =
  /(?:cota[cç][aã]o da moeda|convers[aã]o para real)\s*-?\s*R\$\s*[\d.]+,\d{2}/gi;
const INSTALLMENT_RE = /\(?\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)?\s*$/;

const CATEGORY_RULES: Array<[string, string[]]> = [
  ['Alimentação', [
    'ifood', 'restaurante', 'padaria', 'supermercado', 'mercado', 'mcdonald',
    'burger', 'pizza', 'cafe', 'cafeteria', 'lanche', 'doce', 'chocolate',
    'delivery', 'camarao', 'chocolates', 'padoca', 'acougue', 'hortifruti',
    'starbucks', 'outback', 'sushi', 'bebida', 'vidolce', 'melimais',
    'parcus delivery', 'jd delivery', 'mariene ribei',
  ]],
  ['Transporte', [
    'uber', '99', 'posto', 'combustivel', 'gasolina', 'estacionamento',
    'pedagio', 'passagem', 'avianca', 'latam', 'gol', 'azul', 'shell',
    'ipiranga', 'sem parar', 'veloe', 'estapar', 'decolar', 'airbnb',
    'avis', 'transport',
  ]],
  ['Compras', [
    'amazon', 'mercado livre', 'mercadolivre', 'mercadol', 'shopee', 'magalu', 'americanas', 'shein',
    'aliexpress', 'c&a', 'renner', 'riachuelo', 'zara', 'nike', 'adidas',
    'vinci shoes', 'tiktok', 'materiais para constru', 'leroy', 'madeira',
    'jim.com', 'apple', 'samsung', 'mercado*l', 'sangirardi', 'maesta',
  ]],
  ['Entretenimento', [
    'netflix', 'spotify', 'cinema', 'show', 'ingresso', 'steam', 'playstation',
    'xbox', 'wellhub', 'gympass', 'academia', 'parque', 'turismo', 'eda shows',
    'dragon pass', 'sala vip', 'disney', 'tennis', 'airbnb',
  ]],
  ['Saúde', [
    'farmacia', 'drogaria', 'drogasil', 'raia', 'pacheco', 'consulta', 'exame',
    'laboratorio', 'clinica', 'hospital', 'dentista', 'estetica', 'laser',
  ]],
  ['Aluguel', ['aluguel', 'condominio', 'moradia', 'iptu']],
  ['Encargos', [
    'juros', 'multa', 'mora', 'iof', 'anuidade', 'tarifa', 'encargo',
    'rotativo', 'cobranca', 'cotacao da moeda', 'atraso', 'estorno tarifa',
  ]],
  ['Outros', [
    'vivo', 'claro', 'tim', 'oi', 'internet', 'energia', 'enel', 'sabesp',
    'agua', 'gas', 'seguro', 'assinatura', 'fundacao de apoio', 'feher',
  ]],
];

const SECTION_STARTS: Array<[RegExp, string]> = [
  [/^Pagamentos feitos pelo cliente/i, 'pagamentos'],
  [/^Encargos e juros/i, 'encargos'],
  [/^Lan[cç]amentos do cart[aã]o/i, 'compras'],
  [/^Outros Lan[cç]amentos/i, 'outros'],
];
const CREDITS_TOTAL_RE = /^Total de cr[eé]ditos recebidos/i;
const PURCHASES_TOTAL_RE = /^Total de compras e despesas/i;
const END_MARKERS = [
  /^Taxas e encargos/i,
  /^Cr[eé]dito Rotativo:/i,
  /^BTG Pactual S\.A/i,
];
const TX_SECTIONS = new Set(['compras', 'encargos', 'outros', 'pagamentos']);

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseBrl(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

export function guessCategory(description: string): { category: string; confident: boolean } {
  const d = normalize(description);
  let best: { length: number; category: string } | null = null;

  for (const [category, keywords] of CATEGORY_RULES) {
    for (const keyword of keywords) {
      const k = normalize(keyword).trim();
      if (!k) continue;
      const left = k.length <= 4 ? '(?<![a-z0-9])' : '';
      const pattern = new RegExp(left + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])');
      if (pattern.test(d) && (!best || k.length > best.length)) {
        best = { length: k.length, category };
      }
    }
  }

  return best ? { category: best.category, confident: true } : { category: '?', confident: false };
}

function isoDate(day: number, month: number, year: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonthsIso(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const index = month - 1 + months;
  const y = year + Math.floor(index / 12);
  const m = ((index % 12) + 12) % 12 + 1;
  return isoDate(day, m, y);
}

export function monthLabel(referenceMonth?: string): string {
  if (!referenceMonth) return '';
  const [year, month] = referenceMonth.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]}/${year}`;
}

function detectBank(text: string): 'btg' | 'c6' {
  if (/BANCO C6/i.test(text) || /C6\s*(Bank|Carbon)/i.test(text)) return 'c6';
  return 'btg';
}

function parseHeaderBTG(text: string): Omit<ParsedFatura, 'transactions' | 'warnings' | 'bankName'> & { bankName: string } {
  const info: any = { bankName: 'BTG Pactual', totals: {} };

  const faturaMatch = text.match(/fatura de\s+([A-Za-zçÇãÃéÉêÊ]+)\s+de\s+(\d{4})/i);
  if (faturaMatch) {
    const monthName = normalize(faturaMatch[1]);
    const month = MONTH_NAMES.findIndex((name) => normalize(name) === monthName) + 1;
    if (month > 0) {
      info.referenceMonth = `${faturaMatch[2]}-${String(month).padStart(2, '0')}`;
    }
  }

  const dueMatch = text.match(/Vencimento:\s*(\d{2})\/(\d{2})/);
  if (dueMatch && info.referenceMonth) {
    const [year, month] = info.referenceMonth.split('-').map(Number);
    info.invoiceDueDate = isoDate(Number(dueMatch[1]), month, year);
  }

  const periodMatch = text.match(/Per[ií]odo de compras:\s*(\d{2})\/(\d{2})\s*at[eé]\s*(\d{2})\/(\d{2})/);
  if (periodMatch && info.referenceMonth) {
    const [year, month] = info.referenceMonth.split('-').map(Number);
    const [startDay, startMonth, endDay, endMonth] = periodMatch.slice(1).map(Number);
    info.statementPeriodStart = isoDate(startDay, startMonth, startMonth > month ? year - 1 : year);
    info.statementPeriodEnd = isoDate(endDay, endMonth, endMonth > month ? year - 1 : year);
  }

  const totals: Array<[keyof ParsedFatura['totals'], RegExp]> = [
    ['purchases', /Total de compras e despesas R\$\s*([\d.]+,\d{2})/],
    ['credits', /Total de cr[eé]ditos recebidos -?R\$\s*([\d.]+,\d{2})/],
    ['fees', /Juros e encargos R\$\s*([\d.]+,\d{2})/],
    ['total', /Total a pagar R\$\s*([\d.]+,\d{2})/],
    ['nextInvoice', /Pr[oó]x\.\s*R\$\s*([\d.]+,\d{2})/],
  ];
  for (const [key, pattern] of totals) {
    const match = text.match(pattern);
    if (match) info.totals[key] = parseBrl(match[1]);
  }

  return info;
}

function parseHeaderC6(text: string): Omit<ParsedFatura, 'transactions' | 'warnings' | 'bankName'> & { bankName: string } {
  const info: any = { bankName: 'C6 Bank', totals: {} };

  const vencIso = text.match(/Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (vencIso) {
    const d = Number(vencIso[1]); const m = Number(vencIso[2]); const y = Number(vencIso[3]);
    info.invoiceDueDate = isoDate(d, m, y);
    info.referenceMonth = `${y}-${String(m).padStart(2, '0')}`;
  } else {
    const vencLong = text.match(/(?:Data do vencimento|Vencimento):\s*(\d{1,2})\s+de\s+([A-Za-zçÇãÃéÉêÊ]+)/i);
    const vencMonth = text.match(/fatura com vencimento em ([A-Za-zçÇãÃéÉêÊ]+)/i);
    const monthStr = vencLong ? vencLong[2] : (vencMonth ? vencMonth[1] : null);
    const month = monthStr ? (MONTH_NAMES.findIndex((n) => normalize(n) === normalize(monthStr)) + 1) : 0;
    if (month > 0) {
      const day = vencLong ? Number(vencLong[1]) : 5;
      const yMatch =
        text.match(/Vencimento:\s*\d{2}\/\d{2}\/(\d{4})/) ||
        text.match(/fechamento desta fatura em \d{2}\/\d{2}\/(\d{2})/);
      const year = yMatch
        ? yMatch[1].length === 2
          ? 2000 + Number(yMatch[1])
          : Number(yMatch[1])
        : new Date().getFullYear();
      info.referenceMonth = `${year}-${String(month).padStart(2, '0')}`;
      if (vencLong) info.invoiceDueDate = isoDate(day, month, year);
    }
  }

  const periodEndMatch = text.match(/fechamento desta fatura em (\d{2})\/(\d{2})\/(\d{2})/);
  if (periodEndMatch) {
    info.statementPeriodEnd = isoDate(
      Number(periodEndMatch[1]),
      Number(periodEndMatch[2]),
      2000 + Number(periodEndMatch[3])
    );
  }

  const totalMatch = text.match(/Total a pagar R\$\s*([\d.]+,\d{2})/);
  if (totalMatch) info.totals.total = parseBrl(totalMatch[1]);

  const nac = text.match(/Compras nacionais\s*([\d.]+,\d{2})/);
  const intl = text.match(/Compras internacionais\s*([\d.]+,\d{2})/);
  if (nac || intl) {
    info.totals.purchases = parseBrl(nac?.[1] || '0') + parseBrl(intl?.[1] || '0');
  }

  const credits = text.match(/Estornos\s*\/\s*Crédito na Fatura \(-\)\s*([\d.]+,\d{2})/);
  if (credits) info.totals.credits = parseBrl(credits[1]);

  const anuidade = text.match(/Anuidade diferenciada - Parcela \d+\/\d+\s*([\d.]+,\d{2})/);
  const iof = text.match(/IOF de financiamento e compras internacionais\s*([\d.]+,\d{2})/);
  const fees: number[] = [];
  if (anuidade) fees.push(parseBrl(anuidade[1]));
  if (iof) fees.push(parseBrl(iof[1]));
  if (fees.length) info.totals.fees = fees.reduce((a, b) => a + b, 0);

  return info;
}

interface SegmentContext {
  section: string;
  isCredit: boolean;
  refYear: number;
  refMonth: number;
}

function parseSegment(segment: string, ctx: SegmentContext): ParsedTransaction | null {
  DATE_RE.lastIndex = 0;
  const head = DATE_RE.exec(segment);
  if (!head) return null;

  const day = Number(head[1]);
  const month = MONTHS[head[2].toLowerCase()];
  let rest = segment.slice(head.index + head[0].length).trim();
  if (!rest) return null;

  let currency = 'BRL';
  let amount: number | null = null;
  let description = rest;

  const brlMatch = BRL_END_RE.exec(rest);
  if (brlMatch?.groups) {
    description = brlMatch.groups.desc.trim();
    amount = parseBrl(brlMatch.groups.amount);
  } else {
    const foreign = FOREIGN_END_RE.exec(rest);
    if (foreign?.groups) {
      currency = foreign.groups.cur.toUpperCase();
      description = foreign.groups.desc.trim();
      amount = Number(foreign.groups.amount.replace(/\./g, '').replace(',', '.'));
    }
  }

  if (amount === null || Number.isNaN(amount)) return null;

  let installmentNumber: number | undefined;
  let installmentTotal: number | undefined;
  const inst = INSTALLMENT_RE.exec(description);
  if (inst) {
    const current = Number(inst[1]);
    const total = Number(inst[2]);
    if (total >= 2 && current <= total) {
      installmentNumber = current;
      installmentTotal = total;
      description = description.slice(0, inst.index).trim();
    }
  }

  description = description.replace(/\s{2,}/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '');
  if (!description || /^total/i.test(description)) return null;

  const year = month > ctx.refMonth ? ctx.refYear - 1 : ctx.refYear;
  const guess = guessCategory(description);

  let type: FaturaTxType = 'purchase';
  if (ctx.section === 'encargos' || guess.category === 'Encargos') type = 'fee';
  else if (ctx.section === 'pagamentos') type = 'payment';
  if (ctx.isCredit) type = 'refund';

  return {
    date: isoDate(day, month, year),
    description,
    amount: Math.round(amount * 100) / 100,
    currency,
    type,
    section: ctx.section,
    category: guess.category,
    categoryConfident: guess.confident,
    installmentNumber,
    installmentTotal,
    compensated: false,
  };
}

function splitContinuations(line: string): Array<{ kind: 'text' | 'cont'; value: string }> {
  const parts: Array<{ kind: 'text' | 'cont'; value: string }> = [];
  let pos = 0;
  CONTINUATION_SPLIT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CONTINUATION_SPLIT_RE.exec(line)) !== null) {
    if (match.index > pos) parts.push({ kind: 'text', value: line.slice(pos, match.index).trim() });
    parts.push({ kind: 'cont', value: match[0].trim() });
    pos = match.index + match[0].length;
  }
  if (pos < line.length) parts.push({ kind: 'text', value: line.slice(pos).trim() });
  return parts;
}

function parseTransactionsBTG(pages: string[][], info: ParsedFatura): ParsedTransaction[] {
  const refYear = info.referenceMonth ? Number(info.referenceMonth.slice(0, 4)) : new Date().getFullYear();
  const refMonth = info.referenceMonth ? Number(info.referenceMonth.slice(5, 7)) : new Date().getMonth() + 1;

  const transactions: ParsedTransaction[] = [];
  let section = 'desconhecido';
  let isCredit = false;
  let stopped = false;
  let pendingForeign: ParsedTransaction | null = null;

  const applyContinuation = (text: string): void => {
    if (!pendingForeign) return;
    const conversao = CONVERSAO_RE.exec(text);
    if (conversao) {
      pendingForeign.amount = parseBrl(conversao[1]);
      pendingForeign = null;
      return;
    }
    const cotacao = COTACAO_RE.exec(text);
    if (cotacao) return;
  };

  for (const page of pages) {
    stopped = false;

    for (const raw of page) {
      const line = raw.trim();
      if (!line) continue;

      if (END_MARKERS.some((marker) => marker.test(line))) {
        stopped = true;
        pendingForeign = null;
        continue;
      }

      let matchedSection = false;
      for (const [pattern, name] of SECTION_STARTS) {
        if (pattern.test(line)) {
          section = name;
          isCredit = false;
          stopped = false;
          pendingForeign = null;
          matchedSection = true;
          break;
        }
      }
      if (matchedSection) continue;

      if (CREDITS_TOTAL_RE.test(line)) {
        isCredit = true;
        continue;
      }
      if (PURCHASES_TOTAL_RE.test(line)) {
        isCredit = false;
        continue;
      }

      if (stopped || !TX_SECTIONS.has(section)) continue;

      for (const part of splitContinuations(line)) {
        if (part.kind === 'cont') {
          applyContinuation(part.value);
          continue;
        }
        if (!part.value) continue;

        DATE_RE.lastIndex = 0;
        const starts: number[] = [];
        let m: RegExpExecArray | null;
        while ((m = DATE_RE.exec(part.value)) !== null) starts.push(m.index);
        if (starts.length === 0) {
          applyContinuation(part.value);
          continue;
        }

        const bounds = [...starts, part.value.length];
        for (let i = 0; i < bounds.length - 1; i++) {
          const segment = part.value.slice(bounds[i], bounds[i + 1]).trim();
          const tx = parseSegment(segment, { section, isCredit, refYear, refMonth });
          if (!tx) continue;
          transactions.push(tx);
          if (tx.currency !== 'BRL') pendingForeign = tx;
        }
      }
    }
  }

  return transactions;
}

function parseTransactionsC6(pages: string[][], info: ParsedFatura): ParsedTransaction[] {
  const refYear = info.referenceMonth ? Number(info.referenceMonth.slice(0, 4)) : new Date().getFullYear();
  const refMonth = info.referenceMonth ? Number(info.referenceMonth.slice(5, 7)) : new Date().getMonth() + 1;

  const transactions: ParsedTransaction[] = [];
  let section = 'desconhecido';
  let stopped = false;

  const C6_LINE_RE = /^(?<day>\d{1,2})\s+(?<mon>jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(?<rest>.+?)\s+(?<amount>\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i;
  const INSTALLMENT_RE_C6 = /Parcela\s+(\d{1,2})\s*\/\s*(\d{1,2})/i;

  for (const page of pages) {
    stopped = false;
    for (const raw of page) {
      const line = raw.trim();
      if (!line) continue;

      if (/Transações do cartão/i.test(line)) {
        section = 'compras';
        stopped = false;
        continue;
      }
      if (
        /Resumo da fatura/i.test(line) ||
        /Formas de pagamento/i.test(line) ||
        /Central de relacionamento/i.test(line) ||
        /©\s*2022/i.test(line) ||
        /BANCO C6/i.test(line) ||
        /Limite de cartão/i.test(line)
      ) {
        stopped = true;
        continue;
      }
      if (stopped || section !== 'compras') continue;
      if (/^Subtotal/i.test(line) || /Lembrando:/i.test(line) || /Valores em reais/i.test(line)) continue;

      const m = C6_LINE_RE.exec(line);
      if (!m?.groups) continue;

      const day = Number(m.groups.day);
      const month = MONTHS[m.groups.mon.toLowerCase()];
      if (!month) continue;
      let rest = m.groups.rest.trim();
      const amount = parseBrl(m.groups.amount);

      let installmentNumber: number | undefined;
      let installmentTotal: number | undefined;
      const inst = INSTALLMENT_RE_C6.exec(rest);
      if (inst) {
        const current = Number(inst[1]);
        const total = Number(inst[2]);
        if (total >= 2 && current <= total) {
          installmentNumber = current;
          installmentTotal = total;
        }
        rest = rest.replace(INSTALLMENT_RE_C6, '').replace(/-\s*$/, '').trim();
      }

      let currency = 'BRL';
      const usdMatch = rest.match(/USD\s*([\d.,]+)/i);
      if (usdMatch) {
        currency = 'USD';
        rest = rest.replace(/\s*USD\s*[\d.,]+\s*\|?\s*Cotação\s+\w+:\s*R\$[\d.,]+/i, '').trim();
      }
      rest = rest.replace(/\s*\|\s*Cotação.*$/i, '').trim();

      const description = rest.replace(/\s{2,}/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '').trim();
      if (!description || /^total/i.test(description)) continue;

      const year = month > refMonth ? refYear - 1 : refYear;
      const guess = guessCategory(description);

      let type: FaturaTxType = 'purchase';
      if (/estorno/i.test(description)) type = 'refund';
      else if (/^pag\b/i.test(description) || /pagamento/i.test(description) || /pag fatura/i.test(description)) type = 'payment';
      else if (guess.category === 'Encargos' || /anuidade|iof|tarifa/i.test(description)) type = 'fee';

      transactions.push({
        date: isoDate(day, month, year),
        description,
        amount: Math.round(amount * 100) / 100,
        currency,
        type,
        section: 'compras',
        category: guess.category,
        categoryConfident: guess.confident,
        installmentNumber,
        installmentTotal,
        compensated: false,
      });
    }
  }

  return transactions;
}

export function markCompensated(transactions: ParsedTransaction[]): Array<[ParsedTransaction, ParsedTransaction]> {
  const pairs: Array<[ParsedTransaction, ParsedTransaction]> = [];
  const refunds = transactions.filter((t) => t.type === 'refund');
  const candidates = transactions.filter((t) => t.type === 'purchase' || t.type === 'fee');

  for (const refund of refunds) {
    const match = candidates.find(
      (c) => !c.compensated && Math.abs(c.amount - refund.amount) < 0.005
    );
    if (match) {
      match.compensated = true;
      refund.compensated = true;
      pairs.push([match, refund]);
    }
  }
  return pairs;
}

export function projectNextInvoice(transactions: ParsedTransaction[]): number {
  const total = transactions.reduce((sum, t) => {
    if (t.type !== 'purchase' || t.compensated) return sum;
    const totalInst = t.installmentTotal || 0;
    const currentInst = t.installmentNumber || 0;
    if (totalInst > 1 && currentInst < totalInst) return sum + t.amount;
    return sum;
  }, 0);
  return Math.round(total * 100) / 100;
}

const brl = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function parseFatura(pages: string[][]): ParsedFatura {
  const text = pages.map((page) => page.join('\n')).join('\n');
  const bank = detectBank(text);
  const header = bank === 'c6' ? parseHeaderC6(text) : parseHeaderBTG(text);
  const fatura: ParsedFatura = {
    ...header,
    transactions: [],
    warnings: [],
  };

  fatura.transactions =
    bank === 'c6'
      ? parseTransactionsC6(pages, fatura)
      : parseTransactionsBTG(pages, fatura);

  const pairs = markCompensated(fatura.transactions);

  for (const [purchase, refund] of pairs) {
    fatura.warnings.push(
      `Cobrança e estorno de ${purchase.description} (${brl(purchase.amount)}) compensados — não serão importados.`
    );
  }

  const grossPurchases = fatura.transactions
    .filter((t) => t.type === 'purchase')
    .reduce((sum, t) => sum + t.amount, 0);
  const grossRefunds = fatura.transactions
    .filter((t) => t.type === 'refund')
    .reduce((sum, t) => sum + t.amount, 0);
  const fees = fatura.transactions
    .filter((t) => t.type === 'fee')
    .reduce((sum, t) => sum + t.amount, 0);

  const { purchases, credits, total, nextInvoice } = fatura.totals;
  if (purchases !== undefined && Math.abs(grossPurchases - purchases) > 0.05) {
    fatura.warnings.push(
      `Compras lidas (${brl(grossPurchases)}) não batem com o PDF (${brl(purchases)}). Confira os lançamentos.`
    );
  }
  if (credits !== undefined && Math.abs(grossRefunds - credits) > 0.05) {
    fatura.warnings.push(
      `Estornos lidos (${brl(grossRefunds)}) não batem com o PDF (${brl(credits)}).`
    );
  }
  if (total !== undefined && Math.abs(grossPurchases + fees - grossRefunds - total) > 0.05) {
    fatura.warnings.push(
      `Total calculado (${brl(grossPurchases + fees - grossRefunds)}) não bate com o PDF (${brl(total)}).`
    );
  }
  if (nextInvoice !== undefined) {
    const projected = projectNextInvoice(fatura.transactions);
    if (Math.abs(projected - nextInvoice) > 0.05) {
      fatura.warnings.push(
        `Projeção da próxima fatura (${brl(projected)}) difere do PDF (${brl(nextInvoice)}).`
      );
    }
  }

  const pending = fatura.transactions.filter(
    (t) => t.type !== 'payment' && !t.compensated && !t.categoryConfident
  );
  if (pending.length > 0) {
    fatura.warnings.push(
      `${pending.length} lançamento(s) sem categoria automática — revise na tela de importação.`
    );
  }

  return fatura;
}

export function installmentDueLabel(
  invoiceDueDate: string | undefined,
  remaining: number
): string {
  if (!invoiceDueDate) return '—';
  if (remaining <= 0) return `${monthLabel(invoiceDueDate.slice(0, 7))} (última)`;
  const last = addMonthsIso(invoiceDueDate, remaining);
  return `${monthLabel(invoiceDueDate.slice(0, 7))} → ${monthLabel(last.slice(0, 7))}`;
}
