import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = (import.meta as any).env?.GEMINI_API_KEY ||
                       process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const GEMINI_MODEL = 'gemini-2.5-flash';

export interface FaturaTransaction {
  /** Data do lançamento no formato YYYY-MM-DD */
  date: string;
  /** Descrição do estabelecimento/lançamento como aparece na fatura */
  description: string;
  /** Valor em reais (sempre positivo, ex: 25.50) */
  amount: number;
}

export interface FaturaResult {
  bankName: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  transactions: FaturaTransaction[];
  warnings?: string[];
}

interface FaturaResponseSchema {
  type: 'object';
  properties: {
    bankName: { type: 'string' };
    statementPeriodStart: { type: 'string' };
    statementPeriodEnd: { type: 'string' };
    transactions: {
      type: 'array';
      items: {
        type: 'object';
        properties: {
          date: { type: 'string' };
          description: { type: 'string' };
          amount: { type: 'number' };
        };
        required: ['date', 'description', 'amount'];
      };
    };
    warnings: {
      type: 'array';
      items: { type: 'string' };
    };
  };
  required: ['bankName', 'transactions'];
}

/**
 * Converte um File (PDF) para base64 string.
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // O resultado vem como "data:application/pdf;base64,...." — removemos o prefixo
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo PDF.'));
    reader.readAsDataURL(file);
  });
}

const SYSTEM_INSTRUCTION = `Você é um assistente especializado em extrair lançamentos de faturas de cartões de crédito em PDF para um sistema de controle financeiro.

Sua tarefa é ler o PDF enviado e retornar SOMENTE um JSON válido contendo:
- bankName: nome do banco emissor (ex: "BTG Pactual")
- statementPeriodStart: data de início do período da fatura (YYYY-MM-DD)
- statementPeriodEnd: data de fim do período da fatura (YYYY-MM-DD)
- transactions: lista de todos os lançamentos individuais de compra/débito feitos pelo usuário
- warnings: (opcional) alertas de lançamentos que você não conseguiu interpretar ou que parecem ambíguos

REGRAS IMPORTANTES:
1. IGNORE os seguintes itens — eles NÃO são lançamentos do usuário:
   - "Total da fatura", "Saldo anterior", "Saldo em aberto"
   - "Pagamento recebido", "Valor pago", "Pagamento efetuado"
   - "Juros de juros", "Juros rotativo", "Tarifa de manutenção", "Anuidade" (a menos que seja um lançamento de compra)
   - "Transferência para débito"
   - "Data de vencimento", "Data de emissão", cabeçalhos e rodapés
2. INCLUA todos os lançamentos individuais do usuário (compras em lojas, apps, assinaturas, etc.)
3. Cada transação deve ter:
   - date: a data do lançamento na fatura (YYYY-MM-DD). Se não for possível identificar, use a data de vencimento da fatura.
   - description: a descrição exatamente como aparece na fatura (sem alterar). Pode ser estabelecimento, loja ou código.
   - amount: valor positivo em reais, sem "R$", sem pontos de milhar, vírgula decimal. Ex: 25.50
4. NÃO INVENTE dados. Se algo não estiver claro ou houver ambiguidade:
   - Não inclua a transação na lista.
   - Adicione um item em warnings descrevendo o que você viu.
5. Não inclua transações duplicadas (mesma data, mesmo valor, mesma descrição).
6. Para lançamentos em cartão de crédito, normalmente todos os valores são positivos (saídas).
7. Responda em PORTUGUÊS do Brasil quando for escrever warnings.
8. Retorne APENAS o JSON, sem texto antes ou depois, sem markdown, sem cercas de código.

Formato esperado:
{
  "bankName": "BTG Pactual",
  "statementPeriodStart": "2025-09-01",
  "statementPeriodEnd": "2025-09-30",
  "transactions": [
    { "date": "2025-09-05", "description": "UBER TRIP", "amount": 25.50 },
    { "date": "2025-09-10", "description": "AMAZON.COM.BR", "amount": 149.90 }
  ],
  "warnings": []
}`;

/**
 * Extrai lançamentos de uma fatura de cartão de crédito em PDF usando o Gemini.
 */
export async function extractFaturaFromPdf(file: File): Promise<FaturaResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada. Crie uma em https://aistudio.google.com/apikey e adicione em um arquivo .env na raiz do projeto.');
  }

  const base64Data = await fileToBase64(file);

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Extraia todos os lançamentos desta fatura de cartão de crédito.' },
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
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
              },
              required: ['date', 'description', 'amount'],
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
    // Último recurso: tentar limpar cercas de markdown que o modelo às vezes adiciona mesmo com schema
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Resposta do Gemini inválida. Tente novamente com outra fatura.');
    }
  }

  // Sanitização: garante que amount seja número e description/date não vazios
  parsed.transactions = parsed.transactions
    .map((t) => ({
      date: String(t.date || '').slice(0, 10),
      description: String(t.description || '').trim(),
      amount: Math.abs(Number(t.amount) || 0),
    }))
    .filter((t) => t.description && t.amount > 0 && /^\d{4}-\d{2}-\d{2}/.test(t.date));

  return parsed;
}
