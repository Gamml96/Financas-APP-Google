import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categories: { name: string; amount: number; type: 'income' | 'expense' }[];
  recentTransactions: { description: string; amount: number; category: string; type: 'income' | 'expense'; date: string }[];
  budgets: { category: string; limit: number; spent: number }[];
}

const SYSTEM_INSTRUCTION = `Você é um Consultor Financeiro Pessoal Inteligente e amigável.
Seu objetivo é analisar os dados financeiros do usuário e fornecer insights acionáveis, dicas de economia e alertas.
Sempre seja encorajador e use um tom profissional, mas acessível.
Ao analisar gastos, identifique padrões e sugira onde o usuário pode economizar.
Se o usuário estiver gastando mais do que ganha, dê um alerta suave e sugestões de priorização.
Mantenha suas respostas concisas e úteis.
Use Markdown para formatar suas respostas (negrito, listas, etc.).
Fale sempre em Português do Brasil.`;

export async function getFinancialInsights(summary: FinancialSummary) {
  try {
    const prompt = `Analise meu resumo financeiro atual e me dê 3 a 4 insights ou dicas personalizadas:
    
    Resumo:
    - Receita Total: R$ ${summary.totalIncome.toFixed(2)}
    - Despesa Total: R$ ${summary.totalExpense.toFixed(2)}
    - Saldo: R$ ${summary.balance.toFixed(2)}
    
    Maiores Gastos por Categoria:
    ${summary.categories.filter(c => c.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5).map(c => `- ${c.name}: R$ ${c.amount.toFixed(2)}`).join('\n')}
    
    Orçamentos:
    ${summary.budgets.map(b => `- ${b.category}: Limite R$ ${b.limit.toFixed(2)}, Gasto R$ ${b.spent.toFixed(2)} (${((b.spent / b.limit) * 100).toFixed(1)}%)`).join('\n')}
    
    Transações Recentes:
    ${summary.recentTransactions.slice(0, 5).map(t => `- ${t.date}: ${t.description} (R$ ${t.amount.toFixed(2)})`).join('\n')}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Erro ao obter insights do Gemini:", error);
    return "Desculpe, não consegui analisar seus dados no momento. Tente novamente mais tarde.";
  }
}

export async function chatWithAI(message: string, summary: FinancialSummary, history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  try {
    const contextPrompt = `Contexto Financeiro Atual do Usuário:
    - Receita: R$ ${summary.totalIncome.toFixed(2)}
    - Despesa: R$ ${summary.totalExpense.toFixed(2)}
    - Saldo: R$ ${summary.balance.toFixed(2)}
    - Categorias: ${summary.categories.map(c => `${c.name} (R$ ${c.amount.toFixed(2)})`).join(', ')}
    
    Responda à pergunta do usuário considerando este contexto.`;

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\n\n" + contextPrompt,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message: message });
    return result.text;
  } catch (error) {
    console.error("Erro no chat com Gemini:", error);
    return "Ops, tive um problema ao processar sua pergunta. Pode repetir?";
  }
}
