import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis do .env
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'SUA_CHAVE_AQUI') {
  console.error('❌ ERRO: GEMINI_API_KEY não encontrada no arquivo .env');
  console.error('Crie um arquivo .env na raiz com: GEMINI_API_KEY="sua_chave_real"');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const GEMINI_MODEL = 'gemini-2.5-flash';

const pdfPath = process.argv[2] || path.join(__dirname, 'fatura.pdf');

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ ERRO: Arquivo não encontrado: ${pdfPath}`);
  console.error('Uso: npx tsx test-fatura.ts <caminho_do_pdf>');
  process.exit(1);
}

console.log(`📄 Lendo arquivo: ${pdfPath}`);
const pdfBuffer = fs.readFileSync(pdfPath);
const base64Data = pdfBuffer.toString('base64');

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
8. Retorne APENAS o JSON, sem texto antes ou depois, sem markdown, sem cercas de código.`;

async function main() {
  console.log('🤖 Enviando para o Gemini AI...');
  const start = Date.now();

  try {
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

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Tempo de processamento: ${duration}s\n`);

    const text = response.text;
    if (!text) {
      console.error('❌ Resposta vazia do Gemini.');
      return;
    }

    const result = JSON.parse(text);

    console.log('=== 🏦 RESULTADO DA EXTRAÇÃO ===');
    console.log(`Banco: ${result.bankName}`);
    if (result.statementPeriodStart && result.statementPeriodEnd) {
      console.log(`Período: ${result.statementPeriodStart} a ${result.statementPeriodEnd}`);
    }
    console.log(`Total de lançamentos: ${result.transactions.length}`);

    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️ Alertas:');
      result.warnings.forEach((w: string) => console.log(`  - ${w}`));
    }

    console.log('\n📋 Lançamentos:');
    let sum = 0;
    result.transactions.forEach((t: any, i: number) => {
      sum += t.amount;
      console.log(`  ${i + 1}. ${t.date} | ${t.description.padEnd(35)} | R$ ${t.amount.toFixed(2)}`);
    });

    console.log(`\n💰 Total dos lançamentos: R$ ${sum.toFixed(2)}`);
  } catch (error: any) {
    console.error('❌ ERRO:', error.message || error);
  }
}

main();
