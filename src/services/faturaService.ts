import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = (import.meta as any).env?.GEMINI_API_KEY ||
                       process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const GEMINI_MODEL = 'gemini-3.8-flash';

export interface FaturaTransaction {
  /** Data do lançamento no formato YYYY-MM-DD */
  date: string;
  /** Descrição limpa do estabelecimento (sem o N/M de parcela) */
  description: string;
  /** Valor em reais (sempre positivo, ex: 25.50) */
  amount: number;
  /** Categoria sugerida pela IA */
  category?: string;
  /** Número da parcela atual (ex: 3 de "3/10") */
  installmentNumber?: number;
  /** Total de parcelas (ex: 10 de "3/10") */
  installmentTotal?: number;
  /** Tipo de lançamento: 'purchase' (compra comum), 'fee' (juros/encargos), 'refund' (estorno) */
  type?: 'purchase' | 'fee' | 'refund';
}

export interface FaturaResult {
  bankName: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  totalInvoiceAmount?: number;
  transactions: FaturaTransaction[];
  warnings?: string[];
}

/**
 * Converte um File (PDF) para base64 string.
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo PDF.'));
    reader.readAsDataURL(file);
  });
}

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Compras',
  'Entretenimento',
  'Saúde',
  'Aluguel',
  'Salário',
  'Encargos',
  'Outros'
];

const SYSTEM_INSTRUCTION = [
  'Você é um assistente especializado em extrair lançamentos de faturas de cartões de crédito em PDF para um sistema de controle financeiro.',
  '',
  'Sua tarefa é ler o PDF enviado e retornar SOMENTE um JSON válido contendo:',
  '- bankName: nome do banco emissor (ex: BTG Pactual)',
  '- statementPeriodStart: data de início do período da fatura (YYYY-MM-DD)',
  '- statementPeriodEnd: data de fim do período da fatura (YYYY-MM-DD)',
  '- totalInvoiceAmount: valor total final cobrado na fatura (se disponível)',
  '- transactions: lista de todos os lançamentos de compra, tarifas e juros do usuário',
  '- warnings: (opcional) alertas de estornos/cancelamentos compensados ou ambiguidades',
  '',
  'REGRAS DE EXTRAÇÃO:',
  '',
  '1. INCLUA OS SEGUINTES ITENS:',
  '   - Todas as compras individuais do usuário (lojas, restaurantes, apps, serviços).',
  '   - ENCARGOS E JUROS DO BANCO: Inclua Multa por atraso, Mora, Juros rotativos, IOF, Anuidade, Tarifa de manutenção, Encargos por atraso.',
  '     - Marque a categoria desses como "Encargos".',
  '     - Marque o type como "fee".',
  '',
  '2. REGRAS DE ESTORNO / CANCELAMENTO / REEMBOLSO (NET CALCULATION):',
  '   - RECONHEÇA ESTES TIPOS DE CRÉDITO (que NÃO são despesas):',
  '     Cancelamento, Estorno, Reembolso, Valor devolvido, Isenção, Estorno de compra, Compra cancelada.',
  '   - Se a transação for um crédito, marque o campo type como "refund" e coloque o campo amount como valor POSITIVO (o código subtrai no cálculo final).',
  '',
  '   - Se houver uma cobrança X e no MESMO PERÍODO um estorno de IGUAL valor (-X) para o MESMO estabelecimento:',
  '     -> NÃO INCLUA NENHUM DOS DOIS! Registre em warnings: "Cobrança e estorno de [nome] R$ [X] compensados mutuamente."',
  '   - Se houver um estorno PARCIAL (ex: cobrou R$ 100, estornou R$ 30):',
  '     -> Crie APENAS UMA transação com valor líquido R$ 70, type "purchase".',
  '     -> Adicione um warning explicando o cálculo líquido.',
  '   - Se o estorno não tiver cobrança correspondente na mesma fatura (ex: estorno de compra antiga):',
  '     -> Inclua como type: "refund", amount positivo (será subtraído no total).',
  '',
  '3. IGNORE APENAS:',
  '   - Total da fatura, Saldo anterior, Saldo em aberto (use apenas para preencher totalInvoiceAmount)',
  '   - Pagamento recebido, Pagamento efetuado, Valor pago (pagamentos da fatura anterior)',
  '   - Cabeçalhos, rodapés, limites de crédito, dados bancários',
  '',
  '4. PARSEAMENTO DE PARCELAMENTO:',
  '   - Se a descrição contiver indicação de parcela no formato (N/M) ou N/M (ex: C&A (1/3) ou Mercado Livre 2/10):',
  '     - Extraia N como installmentNumber (número)',
  '     - Extraia M como installmentTotal (número)',
  '     - Remova (N/M) ou N/M do texto da description para mantê-la limpa (ex: C&A).',
  '   - Se não houver indicação de parcela, omita esses campos ou deixe undefined.',
  '',
  '5. CATEGORIZAÇÃO AUTOMÁTICA:',
  '   Classifique cada transação obrigatoriamente em UMA destas categorias:',
  '   - "Alimentação": ifood, restaurantes, padarias, supermercados, mcdonalds, bebidas, doces',
  '   - "Transporte": uber, 99, postos de gasolina, estacionamento, pedágio, passagens aéreas/ônibus',
  '   - "Compras": shoppings, amazons, mercado livre, shopee, lojas de roupas, eletrônicos',
  '   - "Entretenimento": netflix, spotify, cinema, shows, jogos, parques, viagens/turismo, wellhub, academias',
  '   - "Saúde": farmácias, drogasil, consultas, exames, laboratórios, estética/laser',
  '   - "Encargos": juros, multas, IOF, anuidade, tarifas bancárias',
  '   - "Outros": contas de consumo (luz, água, internet, vivo), serviços gerais que não se encaixam acima',
  '',
  '6. FORMATO DE CADA TRANSAÇÃO:',
  '   - date: data no formato YYYY-MM-DD',
  '   - description: texto limpo da loja/estabelecimento (sem indicação de parcela)',
  '   - amount: valor positivo em reais (número com ponto decimal, ex: 25.50)',
  '   - category: uma das categorias listadas acima',
  '   - type: "purchase" (compra), "fee" (juros/multas/tarifas), "refund" (apenas se for um crédito isolado mantido)',
  '   - installmentNumber: número da parcela atual (opcional)',
  '   - installmentTotal: total de parcelas (opcional)',
  '',
  '7. RETORNO:',
  '   - Retorne APENAS o JSON conforme o schema exigido.'
].join('\n');

/**
 * Calcula o total líquido de uma lista de transações.
 * Transactions do tipo "refund" são SUBTRAÍDAS (são créditos/estornos).
 * "purchase" e "fee" são SOMADOS (despesas).
 */
export function computeNetTotal(transactions: FaturaTransaction[]): number {
  return transactions.reduce((sum, t) => {
    if (t.type === 'refund') return sum - t.amount;
    return sum + t.amount;
  }, 0);
}

/**
 * Extrai lançamentos de uma fatura de cartão de crédito em PDF usando o Gemini.
 */
export async function extractFaturaFromPdf(file: File): Promise<FaturaResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada no arquivo .env');
  }

  const base64Data = await fileToBase64(file);

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Extraia todos os lançamentos desta fatura de cartão de crédito aplicando as regras de net calculation, categorização e parcelamento.' },
          {
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf',
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bankName: { type: Type.STRING },
          statementPeriodStart: { type: Type.STRING },
          statementPeriodEnd: { type: Type.STRING },
          totalInvoiceAmount: { type: Type.NUMBER },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['purchase', 'fee', 'refund'] },
                installmentNumber: { type: Type.INTEGER },
                installmentTotal: { type: Type.INTEGER },
              },
              required: ['date', 'description', 'amount', 'category'],
            },
          },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['bankName', 'transactions'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('O Gemini não retornou resposta válida.');
  }

  let parsed: FaturaResult;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Resposta do Gemini inválida. Tente novamente.');
    }
  }

  // Sanitização
  parsed.transactions = parsed.transactions
    .map((t: any) => ({
      date: String(t.date || '').slice(0, 10),
      description: String(t.description || '').trim(),
      amount: Math.abs(Number(t.amount) || 0),
      category: CATEGORIES.includes(t.category || '') ? t.category : 'Outros',
      type: t.type || 'purchase',
      installmentNumber: t.installmentNumber ? Number(t.installmentNumber) : undefined,
      installmentTotal: t.installmentTotal ? Number(t.installmentTotal) : undefined,
    }))
    .filter((t: FaturaTransaction) => t.description && t.amount > 0 && /^\d{4}-\d{2}-\d{2}/.test(t.date));

  return parsed;
}
