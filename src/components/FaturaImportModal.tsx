import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '../utils/cn';
import { extractFaturaFromPdf, FaturaResult, FaturaTransaction } from '../services/faturaService';

interface FaturaImportModalProps {
  /** Opcional: se for um teste de protótipo (não importa para o Firestore), o botão "Confirmar" pode ser substituído. */
  onClose: () => void;
  onImport: (transactions: FaturaTransaction[]) => Promise<void>;
  isTestMode?: boolean;
}

type Step = 'select' | 'processing' | 'preview' | 'error';

export default function FaturaImportModal({ onClose, onImport, isTestMode = false }: FaturaImportModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<FaturaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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
      const extracted = await extractFaturaFromPdf(selected);
      setResult(extracted);

      if (extracted.transactions.length === 0) {
        setError('Nenhum lançamento foi extraído da fatura. Verifique se o PDF está legível (com texto selecionável, não imagem).');
        setStep('error');
        return;
      }

      setStep('preview');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      setStep('error');
    }
  };

  const removeTransaction = (index: number) => {
    if (!result) return;
    const updated = result.transactions.filter((_, i) => i !== index);
    setResult({ ...result, transactions: updated });
  };

  const handleConfirmImport = async () => {
    if (!result || result.transactions.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(result.transactions);
      onClose();
    } catch (err: any) {
      setError('Erro ao importar: ' + (err?.message || String(err)));
      setStep('error');
    } finally {
      setIsImporting(false);
    }
  };

  const formatValue = (amount: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  const formatTotal = (txs: FaturaTransaction[]) =>
    txs.reduce((sum, t) => sum + (t.amount || 0), 0);

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
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">IA analisando sua fatura...</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Pode levar de 5 a 15 segundos dependendo do tamanho do PDF.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{file?.name}</span>
            </div>
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

          {/* Lista de transações */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Lançamentos detectados</h4>
            <div className="max-h-72 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              {result.transactions.map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 border-t border-slate-50 dark:border-slate-800 first:border-t-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="text-xs text-slate-400 dark:text-slate-500 w-20 flex-shrink-0">{tx.date}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{tx.description}</p>
                  </div>
                  <div className="font-semibold text-sm text-rose-600 dark:text-rose-400 flex-shrink-0">
                    {formatValue(tx.amount)}
                  </div>
                  <button
                    onClick={() => removeTransaction(i)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex-shrink-0"
                    title="Remover lançamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
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
        <button
          onClick={onClose}
          className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          {step === 'preview' ? 'Cancelar' : 'Fechar'}
        </button>
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
