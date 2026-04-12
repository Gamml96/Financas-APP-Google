import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, MessageSquare, Bot, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FinancialSummary, getFinancialInsights, chatWithAI } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface AIAssistantProps {
  summary: FinancialSummary;
}

export function AIAssistant({ summary }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatMode) {
      scrollToBottom();
    }
  }, [chatHistory, isChatMode]);

  const handleGenerateInsights = async () => {
    setIsLoading(true);
    setIsOpen(true);
    setIsChatMode(false);
    const result = await getFinancialInsights(summary);
    setInsights(result);
    setIsLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message;
    setMessage('');
    setIsLoading(true);

    const newHistory = [
      ...chatHistory,
      { role: 'user' as const, parts: [{ text: userMessage }] }
    ];
    setChatHistory(newHistory);

    const response = await chatWithAI(userMessage, summary, chatHistory);
    
    setChatHistory([
      ...newHistory,
      { role: 'model' as const, parts: [{ text: response }] }
    ]);
    setIsLoading(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed inset-0 pointer-events-none z-50" ref={constraintsRef}>
        <div className="relative w-full h-full">
          <AnimatePresence>
            {!isOpen && (
              <motion.button
                drag
                dragConstraints={constraintsRef}
                dragElastic={0.1}
                dragMomentum={false}
                whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={handleGenerateInsights}
                className="pointer-events-auto absolute bottom-32 right-4 bg-indigo-600/90 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg shadow-indigo-200/50 dark:shadow-none flex items-center justify-center transition-all cursor-grab active:cursor-grabbing backdrop-blur-sm border border-white/10"
              >
                <Sparkles className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Assistant Window */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ y: 100, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 100, opacity: 0, scale: 0.9 }}
                className="pointer-events-auto absolute bottom-32 right-4 bg-white dark:bg-slate-900 w-[90vw] sm:w-[400px] h-[500px] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
              >
              {/* Header */}
              <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Assistente Gemini</h3>
                    <p className="text-[10px] opacity-80">Online e pronto para ajudar</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsChatMode(!isChatMode)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={isChatMode ? "Ver Insights" : "Abrir Chat"}
                  >
                    {isChatMode ? <Sparkles className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {isLoading && !isChatMode && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-sm font-medium">Analisando suas finanças...</p>
                  </div>
                )}

                {!isChatMode ? (
                  <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                    {insights ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Insights do Mês</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <ReactMarkdown>{insights}</ReactMarkdown>
                        </div>
                        <button 
                          onClick={() => setIsChatMode(true)}
                          className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          Fazer uma pergunta específica
                        </button>
                      </motion.div>
                    ) : !isLoading && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-full">
                          <Sparkles className="w-8 h-8 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">Pronto para analisar?</h4>
                          <p className="text-xs text-slate-500 mt-1">Clique abaixo para gerar insights personalizados sobre seus gastos e economias.</p>
                        </div>
                        <button 
                          onClick={handleGenerateInsights}
                          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                          Gerar Insights Agora
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center p-6 text-slate-400">
                        <Bot className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-xs">Olá! Sou seu consultor financeiro. Como posso te ajudar hoje?</p>
                        <div className="grid grid-cols-1 gap-2 mt-4">
                          {[
                            "Como posso economizar este mês?",
                            "Qual minha maior despesa?",
                            "Estou dentro do meu orçamento?"
                          ].map((q, i) => (
                            <button 
                              key={i}
                              onClick={() => setMessage(q)}
                              className="text-[10px] p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-left transition-colors"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatHistory.map((chat, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "flex",
                          chat.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div 
                          className={cn(
                            "max-w-[85%] p-3 rounded-2xl text-xs",
                            chat.role === 'user' 
                              ? "bg-indigo-600 text-white rounded-tr-none" 
                              : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none"
                          )}
                        >
                          <ReactMarkdown>{chat.parts[0].text}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none flex gap-1">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              {isChatMode && (
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <div className="relative">
                    <input 
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Pergunte algo..."
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-4 pr-12 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-slate-100"
                    />
                    <button 
                      type="submit"
                      disabled={!message.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
