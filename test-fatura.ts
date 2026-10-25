import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'SUA_CHAVE_AQUI') {
  console.error('❌ ERRO: GEMINI_API_KEY não encontrada no arquivo .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const GEMINI_MODEL = process.argv[3] || 'gemini-3.8-flash';

const pdfPath = process.argv[2] || path.join(__dirname, 'fatura.pdf');

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ ERRO: Arquivo não encontrado: ${pdfPath}`);
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
- totalInvoiceAmount: valor total final cobrado na fatura (se disponível)
- transactions: lista de todos os lançamentos de compra, tarifas e juros do usuário
- warnings: (opcional) alertas de estornos/cancelamentos compensados ou ambiguidades

REGRAS DE EXTRAÇÃO:

1. INCLUA OS SEGUINTES ITENS:
   - Todas as compras individuais do usuário (lojas, restaurantes, apps, serviços).
   - ENCARGOS E JUROS DO BANCO: Inclua "Multa por atraso", "Mora", "Juros rotativos", "IOF", "Anuidade", "Tarifa de manutenção", "Encargos por atraso".
     - Marque a categoria desses como "Encargos".
     - Marque o type como "fee".

2. REGRAS DE ESTORNO / CANCELAMENTO / REEMBOLSO (NET CALCULATION):
   - Se houver uma cobrança X e no mesmo período um estorno/cancelamento de igual valor (-X) para o mesmo estabelecimento:
     -> NÃO INCLUA NENHUM DOS DOIS na lista final de transações!
     -> Adicione uma observação nos warnings: "Cobrança e estorno de [nome] no valor de R$ [X] foram compensados mutuamente."
   - Se houver um estorno parcial (ex: cobrou R$ 100, estornou R$ 30):
     -> Crie UMA ÚNICA transação com o valor líquido (net) de R$ 70.
     -> Adicione um warning explicando o cálculo líquido.

3. IGNORE APENAS:
   - "Total da fatura", "Saldo anterior", "Saldo em aberto" (use apenas para preencher totalInvoiceAmount)
   - "Pagamento recebido", "Pagamento efetuado", "Valor pago" (pagamentos da fatura anterior)
   - Cabeçalhos, rodapés, limites de crédito, dados bancários

4. PARSEAMENTO DE PARCELAMENTO:
   - Se a descrição contiver indicação de parcela no formato "(N/M)" ou "N/M" (ex: "C&A (1/3)" ou "Mercado Livre 2/10"):
     - Extraia N como installmentNumber (número)
     - Extraia M como installmentTotal (número)
     - Remova "(N/M)" ou "N/M" do texto da description para mantê-la limpa (ex: "C&A").
   - Se não houver indicação de parcela, omita esses campos ou deixe undefined.

5. CATEGORIZAÇÃO AUTOMÁTICA:
   Classifique cada transação obrigatoriamente em UMA destas categorias:
   - "Alimentação": ifood, restaurantes, padarias, supermercados, mcdonalds, bebidas, doces
   - "Transporte": uber, 99, postos de gasolina, estacionamento, pedágio, passagens aéreas/ônibus
   - "Compras": shoppings, amazons, mercado livre, shopee, lojas de roupas, eletrônicos
   - "Entretenimento": netflix, spotify, cinema, shows, jogos, parques, viagens/turismo, wellhub, academias
   - "Saúde": farmácias, drogasil, consultas, exames, laboratórios, estética/laser
   - "Encargos": juros, multas, IOF, anuidade, tarifas bancárias
   - "Outros": contas de consumo (luz, água, internet, vivo), serviços gerais que não se encaixam acima

6. FORMATO DE CADA TRANSAÇÃO:
   - date: data no formato YYYY-MM-DD
   - description: texto limpo da loja/estabelecimento (sem indicação de parcela)
   - amount: valor positivo em reais (número com ponto decimal, ex: 25.50)
   - category: uma das categorias listadas acima
   - type: "purchase" (compra), "fee" (juros/multas/tarifas), "refund" (apenas se for um crédito isolado mantido)
   - installmentNumber: número da parcela atual (opcional)
   - installmentTotal: total de parcelas (opcional)

7. RETORNO:
   - Retorne APENAS o JSON conforme o schema exigido.`;

async function main() {
  console.log('🤖 Enviando para o Gemini AI (modelo:', GEMINI_MODEL, ')...');
  const start = Date.now();

  try {
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

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Tempo de processamento: ${duration}s\n`);

    const text = response.text;
    if (!text) {
      console.error('❌ Resposta vazia do Gemini.');
      return;
    }

    const result = JSON.parse(text);

    console.log('=== 🏦 RESULTADO DA EXTRAÇÃO (Aprimorada) ===');
    console.log(`Banco: ${result.bankName}`);
    if (result.statementPeriodStart && result.statementPeriodEnd) {
      console.log(`Período: ${result.statementPeriodStart} a ${result.statementPeriodEnd}`);
    }
    if (result.totalInvoiceAmount) {
      console.log(`Total oficial na fatura: R$ ${result.totalInvoiceAmount.toFixed(2)}`);
    }
    console.log(`Total de lançamentos extraídos: ${result.transactions.length}`);

    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️ Alertas / Observações:');
      result.warnings.forEach((w: string) => console.log(`  • ${w}`));
    }

    console.log('\n📋 Lançamentos Extraídos:');
    let sum = 0;
    result.transactions.forEach((t: any, i: number) => {
      const isRefund = t.type === 'refund';
      sum += isRefund ? -t.amount : t.amount;
      const parcel = (t.installmentNumber && t.installmentTotal)
        ? `[${t.installmentNumber}/${t.installmentTotal}]`
        : '     ';
      const cat = (`[${t.category || 'Outros'}]`).padEnd(16);
      const typeTag = t.type === 'fee' ? '🏦' : t.type === 'refund' ? '↩️ ' : '  ';
      const desc = t.description.padEnd(28);
      const sign = isRefund ? '-' : '+';
      console.log(`  ${String(i + 1).padStart(2, ' ')}. ${t.date} | ${parcel} | ${cat} ${typeTag} | ${desc} | ${sign} R$ ${t.amount.toFixed(2)}`);
    });

    console.log(`\n💰 Total LÍQUIDO extraído: R$ ${sum.toFixed(2)}`);
    if (result.totalInvoiceAmount) {
      const diff = sum - result.totalInvoiceAmount;
      const ok = Math.abs(diff) < 0.05;
      console.log(`📊 Total oficial da fatura:  R$ ${result.totalInvoiceAmount.toFixed(2)}`);
      console.log(`📊 Diferença:                R$ ${diff.toFixed(2)}  ${ok ? '✅ BATEU!' : '⚠️ diferença pequena'}`);
    }
  } catch (error: any) {
    console.error('❌ ERRO:', error.message || error);
  }
}

main();
