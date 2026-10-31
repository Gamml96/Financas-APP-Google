import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Trash2,
  CreditCard,
  X,
  Info,
  Edit,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { extractFaturaFromPdf, computeNetTotal, FaturaResult, FaturaTransaction } from '../services/faturaService';

export interface ImportSummary {
  imported: number;
  skipped: number;
  futureInstallments: number;
}

interface FaturaImportModalProps {
  /** Lista de contas do usuário para seleção */
  accounts: Array<{ id: string; name: string; type: string; isFavorite?: boolean }>;
  /** Categorias cadastradas pelo usuário (usadas pela IA e nos selects de edição) */
  categories?: string[];
  /** Callback ao confirmar a importação */
  onImport: (
    transactions: FaturaTransaction[],
    accountId: string,
    options?: { createFutureInstallments?: boolean }
  ) => Promise<ImportSummary>;
  /** Callback ao fechar o modal */
  onClose: () => void;
  /** Se true, mostra botão "Ver JSON" em vez de importar */
  isTestMode?: boolean;
}

type Step = 'select' | 'processing' | 'account' | 'preview' | 'done' | 'error';

/** Etapas mostradas enquanto a IA processa a fatura (dá noção de progresso). */
const PROCESSING_STEPS = [
  'Lendo o PDF da fatura...',
  'Identificando os lançamentos...',
  'Separando compras, encargos e estornos...',
  'Conferindo as parcelas de cada compra...',
  'Categorizando os estabelecimentos...',
  'Quase lá: organizando o resultado...',
];

export default function FaturaImportModal({ onClose, onImport, accounts, categories = [], isTestMode = false }: FaturaImportModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<FaturaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [createFutureInstallments, setCreateFutureInstallments] = useState(true);
  const [processingStep, setProcessingStep] = useState(0);

  // Filtra apenas contas de crédito/híbridas
  const creditAccounts = accounts.filter(acc => acc.type === 'credit' || acc.type === 'hybrid');
  // Categorias do usuário (fallback para as padrão quando ainda não carregaram)
  const categoryOptions = categories.length > 0
    ? categories
    : ['Alimentação', 'Transporte', 'Compras', 'Entretenimento', 'Saúde', 'Aluguel', 'Encargos', 'Outros'];
  // Se houver uma conta favorita de crédito, seleciona automaticamente
  const defaultAccount = accounts.find(acc => (acc.type === 'credit' || acc.type === 'hybrid') && acc.isFavorite)?.id || creditAccounts[0]?.id || '';

  useEffect(() => {
    if (defaultAccount && !selectedAccountId) {
      setSelectedAccountId(defaultAccount);
    }
  }, [defaultAccount, selectedAccountId]);

  // Avança as etapas do processamento enquanto a IA trabalha
  useEffect(() => {
    if (step !== 'processing') {
      setProcessingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setProcessingStep((current) => Math.min(current + 1, PROCESSING_STEPS.length - 1));
    }, 7000);
    return () => clearInterval(interval);
  }, [step]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Sanity checks
    if (selected.type !== 'application/pdf') {
      setError('Por favor, selecione um arquivo PDF.');
      setStep('error');
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError('O PDF é grande demais (máx: 20 MB).');
      setStep('error');
      return;
    }

    setFile(selected);
    setError(null);
    setResult(null);
    setStep('processing');

    try {
      const extracted = await extractFaturaFromPdf(selected, { categories: categoryOptions });
      setResult(extracted);

      if (extracted.transactions.length === 0) {
        setError('Nenhum lançamento foi extraído da fatura. Verifique se o PDF está legível (com texto selecionável, não imagem).');
        setStep('error');
        return;
      }

      setStep('account');
    } catch (err: any) {
      const msg = err?.message || String(err);
      // Mensagem amigável para erros temporários do Gemini (503, 429, etc.)
      const friendly = msg.includes('Todos os modelos de fallback falharam')
        ? 'O Gemini está temporariamente com alta demanda. O app tentou 4 modelos diferentes com retries. Tente novamente em alguns minutos.'
        : msg;
      setError(friendly);
      setStep('error');
    }
  };

  const removeTransaction = (index: number) => {
    if (!result) return;
    const updated = result.transactions.filter((_, i) => i !== index);
    setResult({ ...result, transactions: updated });
  };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    description: string;
    amount: string;
    category: string;
    type: 'purchase' | 'fee' | 'refund';
    date: string;
    installmentNumber?: number;
    installmentTotal?: number;
  } | null>(null);

  const startEdit = (index: number) => {
    const tx = result?.transactions[index];
    if (!tx) return;
    setEditingIndex(index);
    setEditForm({
      description: tx.description,
      amount: String(tx.amount),
      category: tx.category || 'Outros',
      type: tx.type || 'purchase',
      date: tx.date,
      installmentNumber: tx.installmentNumber,
      installmentTotal: tx.installmentTotal,
    });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!result || editingIndex === null || !editForm) return;
    const amount = parseFloat(editForm.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      alert('Valor inválido');
      return;
    }
    const updated = [...result.transactions];
    updated[editingIndex] = {
      ...updated[editingIndex],
      description: editForm.description.trim(),
      amount,
      category: editForm.category,
      type: editForm.type,
      date: editForm.date,
      installmentNumber: editForm.installmentNumber,
      installmentTotal: editForm.installmentTotal,
    };
    setResult({ ...result, transactions: updated });
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleConfirmImport = async () => {
    if (!result || result.transactions.length === 0) return;
    if (!selectedAccountId) {
      setError('Por favor, selecione uma conta de crédito para importar.');
      setStep('account');
      return;
    }
    setIsImporting(true);
    try {
      const importSummary = await onImport(result.transactions, selectedAccountId, { createFutureInstallments });
      setSummary(importSummary);
      setStep('done');
    } catch (err: any) {
      setError('Erro ao importar: ' + (err?.message || String(err)));
      setStep('error');
    } finally {
      setIsImporting(false);
    }
  };

  // Quantas parcelas futuras serão criadas (N+1 ... M de cada compra parcelada)
  const futureInstallmentCount = (result?.transactions || []).reduce((acc, tx) => {
    const total = Number(tx.installmentTotal || 0);
    const current = Number(tx.installmentNumber || 0);
    if (tx.type === 'refund' || total <= 1 || current <= 0 || current >= total) return acc;
    return acc + (total - current);
  }, 0);

  const formatValue = (amount: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  const formatTotal = (txs: FaturaTransaction[]) => computeNetTotal(txs);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Importar Fatura (PDF)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Envie o PDF da fatura e uma IA vai extrair os lançamentos automaticamente.
          </p>
        </div>
      </div>

      {/* STEP: Select */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="fatura-pdf-upload"
            />
            <label htmlFor="fatura-pdf-upload" className="cursor-pointer flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Clique para selecionar o PDF da fatura</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF oficial do banco, até 20 MB</p>
              </div>
            </label>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <Info className="w-4 h-4 mt-0.5 text-indigo-500 flex-shrink-0" />
            <span>
              Seu PDF é enviado diretamente ao Google Gemini para extração. O banco de dados fica no seu Firestore — nenhum terceiro tem acesso aos seus dados financeiros além disso.
            </span>
          </div>
        </div>
      )}

      {/* STEP: Processing */}
      {step === 'processing' && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl text-center border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center relative"
            >
              <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-200 dark:border-indigo-800 animate-ping opacity-50"></div>
            </motion.div>
            <div className="space-y-2">
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {PROCESSING_STEPS[processingStep]}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Isso pode levar <strong className="text-slate-700 dark:text-slate-300">até 1 minuto</strong> — faturas com muitos lançamentos demoram mais.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Não feche esta janela: o resultado aparece aqui automaticamente assim que terminar.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {PROCESSING_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-500',
                    i <= processingStep
                      ? 'w-6 bg-indigo-500'
                      : 'w-3 bg-slate-200 dark:bg-slate-700'
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{file?.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP: Select Account */}
      {step === 'account' && result && (
        <div className="space-y-4">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">Selecione a conta para importar</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Os {result.transactions.length} lançamentos extraídos serão vinculados à conta selecionada.
            </p>
          </div>

          <div className="space-y-2">
            {creditAccounts.length > 0 ? (
              creditAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                    selectedAccountId === acc.id
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    selectedAccountId === acc.id
                      ? "border-indigo-600 bg-indigo-600"
                      : "border-slate-300 dark:border-slate-600"
                  )}>
                    {selectedAccountId === acc.id && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{acc.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{acc.type === 'credit' ? 'Cartão de Crédito' : 'Híbrido'}</p>
                  </div>
                  {acc.isFavorite && (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                      Favorita
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                Nenhuma conta de crédito encontrada. Crie uma conta de cartão de crédito primeiro.
              </div>
            )}
          </div>

          {/* Botões de navegação */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('select')}
              className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep('preview')}
              disabled={!selectedAccountId}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Próximo: Revisar Lançamentos
            </button>
          </div>
        </div>
      )}

      {/* STEP: Preview */}
      {step === 'preview' && result && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Banco</span>
              </div>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1 truncate">{result.bankName}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Lançamentos</span>
              </div>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">{result.transactions.length}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800/50">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Total</span>
              </div>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1 truncate">{formatValue(formatTotal(result.transactions))}</p>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-xs rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Observações da IA ({result.warnings.length}):</span>
              </div>
              {result.warnings.map((w, i) => (
                <p key={i} className="pl-5">• {w}</p>
              ))}
            </div>
          )}

          {/* Parcelas futuras */}
          {futureInstallmentCount > 0 && (
            <label className="flex items-start gap-3 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-indigo-50/60 dark:bg-indigo-900/10 cursor-pointer">
              <input
                type="checkbox"
                checked={createFutureInstallments}
                onChange={(e) => setCreateFutureInstallments(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-indigo-600 flex-shrink-0"
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Criar as {futureInstallmentCount} parcelas futuras automaticamente
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  As parcelas seguintes (N+1 até M) das compras parceladas entram nos meses seguintes, no mesmo grupo — assim a próxima fatura não duplica.
                </p>
              </div>
            </label>
          )}

          {/* Lista de transações */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Lançamentos detectados</h4>
            <div className="max-h-72 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              {result.transactions.map((tx, i) => {
                const isRefund = tx.type === 'refund';
                const isFee = tx.type === 'fee';
                const isEditing = editingIndex === i;

                return (
                  <div key={i} className={cn(
                    "border-t border-slate-50 dark:border-slate-800 transition-colors",
                    isEditing ? "bg-indigo-50/50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}>
                    {!isEditing ? (
                      <div className="group flex items-start gap-3 p-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="text-xs text-slate-400 dark:text-slate-500 w-20 flex-shrink-0 pt-0.5">{tx.date}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                            {tx.description}
                            {tx.installmentNumber && tx.installmentTotal ? (
                              <span className="ml-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                                ({tx.installmentNumber}/{tx.installmentTotal})
                              </span>
                            ) : null}
                          </p>
                          {tx.category && (
                            <span className={cn(
                              "inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded-md font-medium",
                              isRefund
                                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                : isFee
                                ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            )}>
                              {isRefund ? '↩️ ' : isFee ? '🏦 ' : ''}{tx.category}
                            </span>
                          )}
                        </div>
                        <div className={cn(
                          "font-semibold text-sm flex-shrink-0 pt-0.5",
                          isRefund ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {isRefund ? '- ' : ''}{formatValue(tx.amount)}
                        </div>
                        <button
                          onClick={() => startEdit(i)}
                          className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 rounded-lg transition-all flex-shrink-0"
                          title="Editar lançamento"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeTransaction(i)}
                          className="p-1.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/60 rounded-lg transition-all flex-shrink-0"
                          title="Remover lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Data</label>
                            <input
                              type="date"
                              value={editForm.date}
                              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Valor</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.amount}
                              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Descrição</label>
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            >
                              {categoryOptions.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            >
                              <option value="purchase">Compra</option>
                              <option value="fee">Encargo</option>
                              <option value="refund">Estorno</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Parcela</label>
                            <input
                              type="text"
                              placeholder="(N/M)"
                              value={`${editForm.installmentNumber ?? ''}/${editForm.installmentTotal ?? ''}`}
                              onChange={(e) => {
                                const [n, m] = e.target.value.split('/');
                                setEditForm({
                                  ...editForm,
                                  installmentNumber: n ? parseInt(n) : undefined,
                                  installmentTotal: m ? parseInt(m) : undefined,
                                });
                              }}
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP: Done */}
      {step === 'done' && summary && (
        <div className="space-y-4">
          <div className={cn(
            "p-6 rounded-2xl border text-center",
            summary.imported > 0
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50"
          )}>
            <div className={cn(
              "w-12 h-12 mx-auto rounded-full flex items-center justify-center",
              summary.imported > 0
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
            )}>
              {summary.imported > 0 ? <CheckCircle2 className="w-6 h-6" /> : <Info className="w-6 h-6" />}
            </div>
            <p className="mt-3 font-bold text-slate-900 dark:text-slate-100">
              {summary.imported > 0 ? 'Importação concluída' : 'Nada novo para importar'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {summary.imported > 0
                ? `${summary.imported} lançamento(s) adicionado(s) ao extrato.`
                : `Os ${summary.skipped} lançamentos desta fatura já estavam importados.`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Importados</p>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">{summary.imported}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Já existiam</p>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">{summary.skipped}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Parcelas futuras</p>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">{summary.futureInstallments}</p>
            </div>
          </div>

          {summary.futureInstallments > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
              As parcelas futuras foram lançadas nos meses seguintes. Quando as próximas faturas chegarem, esses lançamentos serão reconhecidos e ignorados automaticamente.
            </p>
          )}
        </div>
      )}

      {/* STEP: Error */}
      {step === 'error' && error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm rounded-xl space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Não foi possível processar a fatura</p>
              <p className="text-xs mt-1 whitespace-pre-wrap break-words">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setStep('select')}
            className="mt-1 w-full py-2 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        {step === 'done' ? (
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Concluir
          </button>
        ) : (
          <button
            onClick={() => {
              if (step === 'preview') setStep('account');
              else if (step === 'account') setStep('select');
              else onClose();
            }}
            className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            {step === 'preview' ? 'Voltar' : step === 'account' ? 'Voltar' : 'Fechar'}
          </button>
        )}
        {step === 'preview' && (
          <button
            onClick={handleConfirmImport}
            disabled={isImporting || result?.transactions.length === 0}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importando...
              </>
            ) : (
              isTestMode ? 'Mostrar JSON extraído' : 'Importar lançamentos'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
