/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, useRef } from 'react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  writeBatch,
  Timestamp, 
  onAuthStateChanged,
  User,
  handleFirestoreError,
  OperationType
} from './firebase';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  LogOut, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Trash2, 
  Edit,
  Filter, 
  PieChart as PieChartIcon,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Tag,
  Search,
  X,
  Settings,
  CreditCard,
  Eye,
  LayoutGrid,
  Layers,
  List,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  BellOff,
  RefreshCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Star,
  Utensils,
  Home,
  Car,
  Tv,
  Heart,
  ShoppingBag,
  MoreHorizontal,
  Coffee,
  Bus,
  Plane,
  Music,
  Gamepad2,
  Gift,
  Briefcase,
  GraduationCap,
  Stethoscope,
  Zap,
  Wifi,
  Smartphone,
  Laptop,
  Camera,
  Film,
  Book,
  Dumbbell,
  Palette,
  Scissors,
  Wrench,
  Hammer,
  Truck,
  Package,
  Store,
  Pizza,
  Beer,
  Wine,
  IceCream,
  Apple,
  Leaf,
  Flower2,
  Cloud,
  Umbrella,
  Flame,
  Mountain,
  Waves,
  Smile,
  User as UserIcon,
  Users,
  Shield,
  Lock,
  Key,
  Flag,
  MapPin,
  Globe,
  Rocket,
  Train,
  Bike
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, addMonths, setDate, startOfDay, endOfDay, addDays, addWeeks, addYears, subDays, isAfter, eachDayOfInterval, isSameDay, isBefore, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ADMIN_EMAIL = "gamml1996@gmail.com";

const FINANCIAL_TIPS = [
  "Economizar não é sobre quanto você ganha, mas sobre quanto você não gasta com bobagens. 😉",
  "Seu 'eu do futuro' vai te agradecer por não ter comprado aquele gadget que você só usou uma vez.",
  "Cafézinho na rua é bom, mas já viu como o saldo da conta sorri quando você faz em casa?",
  "Regra de ouro: se você não pode comprar duas vezes, você não pode comprar.",
  "Dinheiro não traz felicidade, mas boletos pagos trazem uma paz inexplicável, né?",
  "Antes de comprar, pergunte-se: 'Eu preciso disso ou só estou entediado?'",
  "Investir é como plantar uma árvore. O melhor momento foi há 20 anos, o segundo melhor é agora! 🌱",
  "Cuidado com as 'pequenas' comprinhas de 10 reais. Elas são as ninjas que esvaziam sua conta.",
  "Ter um fundo de emergência é como ter um guarda-chuva: você espera não usar, mas fica feliz quando tem.",
  "O melhor investimento que você pode fazer é em você mesmo. Mas um CDB também ajuda! 📈",
  "Não compare seu capítulo 1 com o capítulo 20 de outra pessoa. Cada bolso tem sua história.",
  "Promoção só é desconto se você já ia comprar o item. Caso contrário, é gasto! 💸",
  "Organizar as finanças é o primeiro passo para realizar aquele sonho que parece impossível.",
  "Dê nome aos seus bois: cada real deve ter um destino certo no seu orçamento.",
  "A disciplina financeira é a liberdade de amanhã. Aguenta firme! 💪",
  "Pagar-se primeiro é a regra número 1. Guarde uma parte antes de começar a gastar.",
  "Sua saúde financeira é tão importante quanto sua saúde física. Cuide bem dela!",
  "Evite compras por impulso. Espere 24 horas antes de fechar o carrinho. 🛒",
  "O cartão de crédito é um aliado, não um inimigo. Use com sabedoria e pague o total!",
  "Pequenas economias hoje geram grandes conquistas amanhã. Acredite no processo.",
  "Evite ir ao supermercado com fome. Seu estômago é um péssimo consultor financeiro. 🛒",
  "Automatize seus investimentos. O que os olhos não veem, o coração (e o bolso) não sente falta.",
  "Revisar suas assinaturas mensais uma vez por semestre pode revelar gastos fantasmas que você nem usa mais.",
  "A inflação do estilo de vida é real. Se seu salário aumentar, não aumente seus gastos na mesma proporção. 🚀",
  "Comprar à vista com desconto é sempre melhor do que parcelar 'sem juros' (que muitas vezes já estão embutidos).",
  "Um orçamento não te impede de gastar, ele te dá permissão para gastar sem culpa. ✅",
  "Acompanhar seus gastos diariamente te dá o controle que você precisa para mudar seus hábitos.",
  "Não invista em algo que você não entende. O conhecimento é o melhor escudo contra perdas. 🛡️",
  "Pequenas economias geram grandes resultados a longo prazo. O poder dos juros compostos é seu melhor amigo.",
  "Ter metas claras (como uma viagem ou a casa própria) torna o ato de economizar muito mais prazeroso. ✈️",
  "O equilíbrio é a chave. Economize para o futuro, mas não esqueça de viver o presente com responsabilidade.",
  "Dívidas com juros altos (como cheque especial e rotativo) devem ser sua prioridade absoluta de quitação. ⚠️",
  "Aprenda a dizer 'não' para convites que não cabem no seu orçamento atual. Amigos de verdade vão entender.",
  "Seu extrato bancário é o reflexo das suas prioridades. O que ele diz sobre você hoje? 🤔"
];

function calculateDueDate(purchaseDate: Date, closingDay: number, dueDay: number): Date {
  const purchase = startOfDay(purchaseDate);
  
  // Começamos tentando o vencimento do mês atual
  let candidateDueDate = new Date(purchase.getFullYear(), purchase.getMonth(), dueDay);
  
  // Função para calcular o fechamento real de um vencimento específico
  const getClosingDate = (dDate: Date) => {
    let cDate = new Date(dDate.getFullYear(), dDate.getMonth(), closingDay);
    // Se o dia de fechamento for maior que o dia de vencimento, o fechamento é no mês anterior ao vencimento.
    if (closingDay > dDate.getDate()) {
      cDate = addMonths(cDate, -1);
    }
    
    // Ajuste para sexta-feira se cair no final de semana (Sábado -> -1, Domingo -> -2)
    const dayOfWeek = cDate.getDay();
    if (dayOfWeek === 6) return subDays(cDate, 1);
    if (dayOfWeek === 0) return subDays(cDate, 2);
    return cDate;
  };

  // Procuramos o primeiro vencimento cujo fechamento ainda não passou em relação à data da compra
  // Verificamos até 3 meses para garantir que encontramos o ciclo correto
  for (let i = 0; i < 3; i++) {
    const closing = getClosingDate(candidateDueDate);
    // Se a compra for ANTES do fechamento, pertence a esta fatura
    if (isBefore(purchase, startOfDay(closing))) {
      return startOfDay(candidateDueDate);
    }
    candidateDueDate = addMonths(candidateDueDate, 1);
  }
  
  return startOfDay(candidateDueDate);
}

// Types
interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  paymentType: 'credit' | 'debit';
  category: string;
  description: string;
  date: any; 
  dueDate?: any;
  installment?: number;
  totalInstallments?: number;
  isRecurring?: boolean;
  frequency?: 'weekly' | 'monthly' | 'yearly';
  groupId?: string;
  isPaid?: boolean;
  createdAt: any;
}

interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'hybrid';
  balance: number;
  initialBalance: number;
  initialBalanceDate: any;
  closingDay?: number;
  dueDay?: number;
  color: string;
  isFavorite?: boolean;
  createdAt: any;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
  parentId?: string;
}

interface Budget {
  id: string;
  userId: string;
  category: string;
  amount: number;
  month: string;
  createdAt: any;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Salário', icon: 'DollarSign', color: '#10b981', type: 'income' },
  { id: '2', name: 'Alimentação', icon: 'Utensils', color: '#f59e0b', type: 'expense' },
  { id: '3', name: 'Aluguel', icon: 'Home', color: '#3b82f6', type: 'expense' },
  { id: '4', name: 'Transporte', icon: 'Car', color: '#6366f1', type: 'expense' },
  { id: '5', name: 'Entretenimento', icon: 'Tv', color: '#ec4899', type: 'expense' },
  { id: '6', name: 'Saúde', icon: 'Heart', color: '#ef4444', type: 'expense' },
  { id: '7', name: 'Compras', icon: 'ShoppingBag', color: '#8b5cf6', type: 'expense' },
  { id: '8', name: 'Outros', icon: 'MoreHorizontal', color: '#6b7280', type: 'both' },
  { id: '9', name: 'Transferência', icon: 'RefreshCcw', color: '#6366f1', type: 'both' },
];

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-rose-100 p-4 rounded-full text-rose-600 mb-6">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h1>
          <p className="text-slate-600 mb-8 max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página ou fazer login novamente.
          </p>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-left mb-8 w-full max-w-lg overflow-auto max-h-48">
            <code className="text-xs text-rose-600 whitespace-pre-wrap">
              {this.state.error?.message || String(this.state.error)}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function BottomNav({ activeView, setActiveView, onAdd, onAccounts, onCategories, onSettings }: { 
  activeView: string, 
  setActiveView: (v: any) => void, 
  onAdd: () => void,
  onAccounts: () => void,
  onCategories: () => void,
  onSettings: () => void
}) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-1 py-3 z-40 flex justify-between items-center pb-[calc(1.5rem+var(--sab,0px))]">
      <button 
        onClick={() => setActiveView('invoices')}
        className={cn(
          "flex flex-col items-center gap-1 flex-1 transition-colors",
          activeView === 'invoices' ? "text-indigo-600" : "text-slate-400 dark:text-slate-500"
        )}
      >
        <CreditCard className="w-5 h-5" />
        <span className="text-[9px] font-bold">Faturas</span>
      </button>

      <button 
        onClick={onCategories}
        className="flex flex-col items-center gap-1 flex-1 text-slate-400 dark:text-slate-500 active:text-indigo-600 transition-colors"
      >
        <Tag className="w-5 h-5" />
        <span className="text-[9px] font-bold">Categorias</span>
      </button>

      <div className="flex-1 flex justify-center">
        <button 
          onClick={onAdd}
          className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-3 rounded-full -mt-10 shadow-md shadow-indigo-100 dark:shadow-none border-4 border-white dark:border-slate-900 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <button 
        onClick={onAccounts}
        className="flex flex-col items-center gap-1 flex-1 text-slate-400 dark:text-slate-500 active:text-indigo-600 transition-colors"
      >
        <Wallet className="w-5 h-5" />
        <span className="text-[9px] font-bold">Contas</span>
      </button>

      <button 
        onClick={onSettings}
        className="flex flex-col items-center gap-1 flex-1 text-slate-400 dark:text-slate-500 active:text-indigo-600 transition-colors"
      >
        <Settings className="w-5 h-5" />
        <span className="text-[9px] font-bold">Ajustes</span>
      </button>
    </div>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [viewMode, setViewMode] = useState<'purchase' | 'due'>('due');
  const [analysisLevel, setAnalysisLevel] = useState<'category' | 'subcategory'>('subcategory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'invoices'>('dashboard');
  const [listMode, setListMode] = useState<'detailed' | 'compact'>('compact');
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const dailyTip = useMemo(() => {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
      hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % FINANCIAL_TIPS.length;
    return FINANCIAL_TIPS[index];
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Notification Permission Check & SW Registration
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    
    // Register Service Worker for mobile notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(reg => console.log("Service Worker registrado:", reg))
        .catch(err => console.error("Erro ao registrar Service Worker:", err));
    }
  }, []);

  const requestNotificationPermission = async () => {
    console.log("Solicitando permissão de notificação...");
    
    if (!("Notification" in window)) {
      setToast({ message: "Seu navegador não suporta notificações nativas.", type: 'error' });
      return;
    }

    setToast({ message: "Solicitando permissão...", type: 'info' });

    try {
      if (Notification.permission === "denied") {
        setToast({ 
          message: "As notificações foram bloqueadas. Por favor, habilite-as nas configurações do seu navegador.", 
          type: 'error' 
        });
        return;
      }

      // Handle both promise and callback versions of requestPermission
      let permission: NotificationPermission;
      try {
        permission = await Notification.requestPermission();
      } catch (e) {
        // Fallback for older browsers
        permission = await new Promise((resolve) => {
          Notification.requestPermission((p) => resolve(p));
        });
      }

      setNotificationsEnabled(permission === "granted");

      if (permission === "granted") {
        setToast({ message: "Notificações ativadas com sucesso!", type: 'success' });
        
        // Try to use Service Worker for the test notification
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("Tô de Olho", {
              body: "As notificações de contas a vencer estão ativas.",
              icon: "https://www.google.com/favicon.ico",
              badge: "https://www.google.com/favicon.ico"
            });
          }).catch(() => {
            // Fallback to standard notification
            new Notification("Tô de Olho", {
              body: "As notificações de contas a vencer estão ativas.",
              icon: "https://www.google.com/favicon.ico"
            });
          });
        } else {
          new Notification("Tô de Olho", {
            body: "As notificações de contas a vencer estão ativas.",
            icon: "https://www.google.com/favicon.ico"
          });
        }
      } else {
        setToast({ message: "Permissão de notificação negada.", type: 'info' });
      }
    } catch (err) {
      console.error("Erro ao solicitar permissão:", err);
      setToast({ 
        message: "Não foi possível ativar as notificações. Tente abrir o app em uma nova aba.", 
        type: 'error' 
      });
    }
  };

  // Check for upcoming bills
  useEffect(() => {
    if (!notificationsEnabled || transactions.length === 0 || !user) return;

    const checkUpcomingBills = () => {
      const now = new Date();
      const reminderDays = userProfile?.reminderDaysBefore !== undefined ? userProfile.reminderDaysBefore : 3;
      const futureDate = endOfDay(addDays(now, reminderDays));
      const startRange = startOfDay(now);

      transactions.forEach(tx => {
        // Only check expenses with a due date
        if (tx.type === 'expense' && tx.dueDate) {
          const dueDate = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate);
          
          // If due within configured days (including today)
          if (dueDate >= startRange && dueDate <= futureDate) {
            const storageKey = `notified_${user.uid}_${tx.id}`;
            if (!localStorage.getItem(storageKey)) {
              try {
                // Use Service Worker for better mobile support
                if ("serviceWorker" in navigator) {
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification("Conta a vencer em breve!", {
                      body: `A conta "${tx.description || tx.category}" de ${tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vence em ${format(dueDate, 'dd/MM/yyyy')}.`,
                      icon: "https://www.google.com/favicon.ico",
                      badge: "https://www.google.com/favicon.ico",
                      vibrate: [200, 100, 200],
                      tag: tx.id // Prevent duplicate notifications for same transaction
                    } as any);
                  });
                } else {
                  new Notification("Conta a vencer em breve!", {
                    body: `A conta "${tx.description || tx.category}" de ${tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vence em ${format(dueDate, 'dd/MM/yyyy')}.`,
                    icon: "https://www.google.com/favicon.ico"
                  });
                }
                localStorage.setItem(storageKey, 'true');
              } catch (e) {
                console.warn("Falha ao enviar notificação nativa:", e);
              }
            }
          }
        }
      });
    };

    checkUpcomingBills();
    // Check every 1 hour
    const interval = setInterval(checkUpcomingBills, 3600000);
    return () => clearInterval(interval);
  }, [notificationsEnabled, transactions, user, userProfile]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check if user is authorized
        const userEmail = currentUser.email?.toLowerCase() || '';
        if (userEmail === ADMIN_EMAIL) {
          setIsAuthorized(true);
        } else {
          try {
            const allowedDoc = await getDoc(doc(db, 'allowed_users', userEmail));
            setIsAuthorized(allowedDoc.exists());
          } catch (error) {
            console.error("Erro ao verificar autorização:", error);
            setIsAuthorized(false);
          }
        }
      } else {
        setIsAuthorized(null);
      }
      setUser(currentUser);
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Transactions Listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // User Profile Listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      } else {
        // Create initial profile if it doesn't exist
        setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Timestamp.now(),
          currency: 'BRL',
          reminderDaysBefore: 3
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Budgets Listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(
      collection(db, 'budgets'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Budget[];
      setBudgets(bgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'budgets');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Accounts Listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(
      collection(db, 'accounts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Account[];
      setAccounts(accs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Custom Categories Listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(
      collection(db, 'categories'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCustomCategories(cats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Combined Categories
  const allCategories = useMemo(() => {
    return [...DEFAULT_CATEGORIES, ...customCategories];
  }, [customCategories]);

  // Calculations
  const filteredTransactions = useMemo(() => {
    let start: Date;
    let end: Date;

    if (dateRange && dateRange.start && dateRange.end) {
      start = startOfDay(new Date(dateRange.start + 'T00:00:00'));
      end = endOfMonth(new Date(dateRange.end + 'T23:59:59')); // Use endOfMonth or just the date
      // Actually endOfDay is better for end date
      const endDate = new Date(dateRange.end + 'T23:59:59');
      end = endDate;
    } else {
      start = startOfMonth(filterMonth);
      end = endOfMonth(filterMonth);
    }

    return transactions.filter(tx => {
      // Para o dashboard principal (Fluxo de Caixa, Saldo, Lista), sempre usamos a data de vencimento para cartões.
      const dateToUse = (tx.paymentType === 'credit' && tx.dueDate) 
        ? (tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate))
        : (tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date));
      
      return isWithinInterval(dateToUse, { start, end }) && 
             (selectedAccountId === 'all' || tx.accountId === selectedAccountId);
    });
  }, [transactions, filterMonth, dateRange, selectedAccountId]);

  const analysisTransactions = useMemo(() => {
    let start: Date;
    let end: Date;

    if (dateRange && dateRange.start && dateRange.end) {
      start = startOfDay(new Date(dateRange.start + 'T00:00:00'));
      end = new Date(dateRange.end + 'T23:59:59');
    } else {
      start = startOfMonth(filterMonth);
      end = endOfMonth(filterMonth);
    }

    return transactions.filter(tx => {
      // Para análise e orçamento, respeita o viewMode (Compra vs Vencimento)
      const dateToUse = (viewMode === 'due' && tx.paymentType === 'credit' && tx.dueDate) 
        ? (tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate))
        : (tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date));
      
      return isWithinInterval(dateToUse, { start, end }) && 
             (selectedAccountId === 'all' || tx.accountId === selectedAccountId);
    });
  }, [transactions, filterMonth, dateRange, selectedAccountId, viewMode]);

  const displayTransactions = useMemo(() => {
    let filtered = filteredTransactions;
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(tx => tx.category === categoryFilter);
    }

    if (paymentTypeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.paymentType === paymentTypeFilter);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(tx => 
        (tx.description?.toLowerCase().includes(term)) || 
        (tx.category?.toLowerCase().includes(term)) ||
        (tx.amount?.toString().includes(term))
      );
    }
    
    return filtered;
  }, [filteredTransactions, typeFilter, categoryFilter, paymentTypeFilter, searchTerm]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income' && tx.category !== 'Transferência') acc.income += amount;
      else if (tx.type === 'expense' && tx.category !== 'Transferência') acc.expense += amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const previousPeriodTransactions = useMemo(() => {
    let start: Date;
    let end: Date;

    if (dateRange && dateRange.start && dateRange.end) {
      const currentStart = startOfDay(new Date(dateRange.start + 'T00:00:00'));
      const currentEnd = new Date(dateRange.end + 'T23:59:59');
      const duration = currentEnd.getTime() - currentStart.getTime();
      
      start = new Date(currentStart.getTime() - duration - 1000);
      end = new Date(currentEnd.getTime() - duration - 1000);
    } else {
      const prevMonth = subMonths(filterMonth, 1);
      start = startOfMonth(prevMonth);
      end = endOfMonth(prevMonth);
    }

    return transactions.filter(tx => {
      let dateToUse = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      if (tx.paymentType === 'credit' && tx.dueDate) {
        dateToUse = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate);
      }
      return isWithinInterval(dateToUse, { start, end }) && 
             (selectedAccountId === 'all' || tx.accountId === selectedAccountId);
    });
  }, [transactions, filterMonth, dateRange, selectedAccountId]);

  const previousTotals = useMemo(() => {
    return previousPeriodTransactions.reduce((acc, tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income' && tx.category !== 'Transferência') acc.income += amount;
      else if (tx.type === 'expense' && tx.category !== 'Transferência') acc.expense += amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [previousPeriodTransactions]);

  const incomeTrend = useMemo(() => {
    if (previousTotals.income === 0) return totals.income > 0 ? '+100%' : '0%';
    const diff = ((totals.income - previousTotals.income) / previousTotals.income) * 100;
    if (Math.abs(diff) < 0.1) return '0%';
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
  }, [totals.income, previousTotals.income]);

  const expenseTrend = useMemo(() => {
    if (previousTotals.expense === 0) return totals.expense > 0 ? '+100%' : '0%';
    const diff = ((totals.expense - previousTotals.expense) / previousTotals.expense) * 100;
    if (Math.abs(diff) < 0.1) return '0%';
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
  }, [totals.expense, previousTotals.expense]);

  const balance = totals.income - totals.expense;
  const previousBalance = previousTotals.income - previousTotals.expense;
  
  const balanceTrend = useMemo(() => {
    if (previousBalance === 0) return balance > 0 ? '+100%' : '0%';
    const diff = ((balance - previousBalance) / Math.abs(previousBalance)) * 100;
    if (Math.abs(diff) < 0.1) return '0%';
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
  }, [balance, previousBalance]);

  const handleExportCSV = () => {
    if (displayTransactions.length === 0) return;

    const headers = ['Data', 'Vencimento', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor', 'Status'];
    const rows = displayTransactions.map(tx => {
      const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      const dueDate = tx.dueDate ? (tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate)) : null;
      const account = accounts.find(a => a.id === tx.accountId)?.name || 'N/A';
      const type = tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Transferência';
      const status = tx.isPaid ? 'Pago' : (tx.type === 'income' ? 'Recebido' : 'Pendente');
      
      return [
        format(date, 'dd/MM/yyyy'),
        dueDate ? format(dueDate, 'dd/MM/yyyy') : '-',
        tx.description || '-',
        tx.category,
        account,
        type,
        tx.amount.toString().replace('.', ','),
        status
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transacoes_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCurrentBalance = useMemo(() => {
    const today = startOfDay(new Date());
    return accounts
      .filter(acc => selectedAccountId === 'all' || acc.id === selectedAccountId)
      .reduce((sum, acc) => {
      let initialDate: Date;
      if (acc.initialBalanceDate instanceof Timestamp) {
        initialDate = acc.initialBalanceDate.toDate();
      } else if (acc.initialBalanceDate) {
        initialDate = new Date(acc.initialBalanceDate);
      } else {
        initialDate = new Date(0);
      }
      
      if (isNaN(initialDate.getTime())) initialDate = new Date(0);
      
      if (isBefore(today, startOfDay(initialDate)) && !isSameDay(today, initialDate)) return sum;

      let currentAccBalance = Number(acc.initialBalance) || 0;

      transactions.filter(tx => tx.accountId === acc.id).forEach(tx => {
        let txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        if (tx.paymentType === 'credit' && tx.dueDate) {
          txDate = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate);
        }

        if (isNaN(txDate.getTime())) return;

        if (isAfter(startOfDay(txDate), startOfDay(initialDate)) || isSameDay(txDate, initialDate)) {
          if (isBefore(startOfDay(txDate), today) || isSameDay(txDate, today)) {
            const amount = Number(tx.amount) || 0;
            if (tx.type === 'income') currentAccBalance += amount;
            else currentAccBalance -= amount;
          }
        }
      });
      return sum + currentAccBalance;
    }, 0);
  }, [accounts, transactions, selectedAccountId]);

  const categoryData = useMemo(() => {
    const data: Record<string, { name: string, value: number, color: string }> = {};
    analysisTransactions
      .filter(t => t.type === 'expense' && t.category !== 'Transferência')
      .forEach(tx => {
        let categoryName = tx.category;
        let categoryColor = '#64748b';

        const cat = allCategories.find(c => c.name === tx.category);
        
        if (analysisLevel === 'category' && cat?.parentId) {
          const parent = allCategories.find(p => p.id === cat.parentId);
          if (parent) {
            categoryName = parent.name;
            categoryColor = parent.color;
          } else {
            categoryColor = cat.color;
          }
        } else if (cat) {
          categoryColor = cat.color;
        }

        if (!data[categoryName]) {
          data[categoryName] = { name: categoryName, value: 0, color: categoryColor };
        }
        const amount = Number(tx.amount) || 0;
        data[categoryName].value += amount;
      });
    return Object.values(data).sort((a, b) => b.value - a.value);
  }, [analysisTransactions, allCategories, analysisLevel]);

  const budgetProgress = useMemo(() => {
    const monthStr = format(filterMonth, 'yyyy-MM');
    const currentBudgets = budgets.filter(b => b.month === monthStr);
    
    return currentBudgets.map(budget => {
      const spent = categoryData.find(c => c.name === budget.category)?.value || 0;
      const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const cat = allCategories.find(c => c.name === budget.category);
      
      return {
        ...budget,
        spent,
        percent,
        color: cat?.color || '#64748b'
      };
    });
  }, [budgets, categoryData, filterMonth, allCategories]);

  const dailyBalanceData = useMemo(() => {
    const start = startOfMonth(filterMonth);
    const end = endOfMonth(filterMonth);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      let totalBalance = 0;

      accounts
        .filter(acc => selectedAccountId === 'all' || acc.id === selectedAccountId)
        .forEach(acc => {
        let initialDate: Date;
        if (acc.initialBalanceDate instanceof Timestamp) {
          initialDate = acc.initialBalanceDate.toDate();
        } else if (acc.initialBalanceDate) {
          initialDate = new Date(acc.initialBalanceDate);
        } else {
          initialDate = new Date(0);
        }
        
        if (isNaN(initialDate.getTime())) {
          initialDate = new Date(0);
        }
        
        // Se o dia atual for anterior à data do saldo inicial, não contamos essa conta ainda
        if (isBefore(day, startOfDay(initialDate)) && !isSameDay(day, initialDate)) {
          return;
        }

        let currentAccBalance = Number(acc.initialBalance) || 0;

        // Somar todas as transações desta conta que ocorreram entre a data inicial e o dia atual
        transactions.filter(tx => tx.accountId === acc.id).forEach(tx => {
          let txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
          
          // Para cartões de crédito, usamos a data de vencimento para o fluxo de caixa
          if (tx.paymentType === 'credit' && tx.dueDate) {
            txDate = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate);
          }

          if (isNaN(txDate.getTime())) return;

          if (isAfter(startOfDay(txDate), startOfDay(initialDate)) || isSameDay(txDate, initialDate)) {
            if (isBefore(startOfDay(txDate), startOfDay(day)) || isSameDay(txDate, day)) {
              const amount = Number(tx.amount) || 0;
              if (tx.type === 'income') currentAccBalance += amount;
              else currentAccBalance -= amount;
            }
          }
        });

        totalBalance += currentAccBalance;
      });

      return {
        date: format(day, 'dd/MM'),
        balance: totalBalance
      };
    });
  }, [accounts, transactions, filterMonth, selectedAccountId]);

  const chartOffset = useMemo(() => {
    const dataMax = Math.max(...dailyBalanceData.map((i) => i.balance));
    const dataMin = Math.min(...dailyBalanceData.map((i) => i.balance));

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  }, [dailyBalanceData]);

  const handleAddTransaction = async (data: any) => {
    if (!user) return;
    try {
      const { installments, isRecurring, recurringMonths, frequency, toAccountId, ...baseData } = data;
      const numInstallments = parseInt(installments) || 1;
      const numRecurring = isRecurring ? (parseInt(recurringMonths) || 12) : 1;
      const totalIterations = Math.max(numInstallments, numRecurring);
      
      const groupId = totalIterations > 1 ? (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)) : undefined;
      const purchaseDate = parseISO(data.date);
      if (isNaN(purchaseDate.getTime())) throw new Error("Data de compra inválida");
      
      const account = accounts.find(a => a.id === data.accountId);
      const totalAmount = baseData.amount;
      const installmentAmount = numInstallments > 1 ? Math.floor((totalAmount / numInstallments) * 100) / 100 : totalAmount;
      const remainder = numInstallments > 1 ? Math.round((totalAmount - (installmentAmount * numInstallments)) * 100) / 100 : 0;

      for (let i = 0; i < totalIterations; i++) {
        let currentDate: Date;
        
        if (isRecurring) {
          if (frequency === 'weekly') {
            currentDate = addWeeks(purchaseDate, i);
          } else if (frequency === 'yearly') {
            currentDate = addYears(purchaseDate, i);
          } else {
            currentDate = addMonths(purchaseDate, i);
          }
        } else {
          currentDate = purchaseDate;
        }
        
        let dueDate = currentDate;
        if (data.paymentType === 'credit') {
          if (i === 0 && data.dueDate) {
            const parsedDueDate = parseISO(data.dueDate);
            if (!isNaN(parsedDueDate.getTime())) {
              dueDate = parsedDueDate;
            }
          } else if ((account?.type === 'credit' || account?.type === 'hybrid') && account.closingDay && account.dueDay) {
            const baseDateForDueDate = addMonths(purchaseDate, i);
            dueDate = calculateDueDate(baseDateForDueDate, account.closingDay, account.dueDay);
          }
        }

        let currentAmount = installmentAmount;
        if (i === 0 && numInstallments > 1) {
          currentAmount = Math.round((installmentAmount + remainder) * 100) / 100;
        }

        if (data.type === 'transfer') {
          const transferGroupId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
          
          // 1. Create Expense (Source)
          const sourceData: any = {
            ...baseData,
            amount: currentAmount,
            type: 'expense',
            userId: user.uid,
            createdAt: Timestamp.now(),
            date: Timestamp.fromDate(currentDate),
            dueDate: Timestamp.fromDate(dueDate),
            groupId: totalIterations > 1 ? groupId : transferGroupId,
            description: baseData.description || `Transferência para ${accounts.find(a => a.id === toAccountId)?.name}`
          };
          if (isRecurring) {
            sourceData.isRecurring = true;
            sourceData.frequency = frequency;
          }
          await addDoc(collection(db, 'transactions'), sourceData);

          // 2. Create Income (Destination)
          const destData: any = {
            ...baseData,
            amount: currentAmount,
            type: 'income',
            accountId: toAccountId,
            userId: user.uid,
            createdAt: Timestamp.now(),
            date: Timestamp.fromDate(currentDate),
            dueDate: Timestamp.fromDate(dueDate),
            groupId: totalIterations > 1 ? groupId : transferGroupId,
            description: baseData.description || `Transferência de ${accounts.find(a => a.id === baseData.accountId)?.name}`
          };
          if (isRecurring) {
            destData.isRecurring = true;
            destData.frequency = frequency;
          }
          await addDoc(collection(db, 'transactions'), destData);
        } else {
          const transactionData: any = {
            ...baseData,
            amount: currentAmount,
            userId: user.uid,
            createdAt: Timestamp.now(),
            date: Timestamp.fromDate(currentDate),
            dueDate: Timestamp.fromDate(dueDate),
          };

          if (numInstallments > 1) {
            transactionData.installment = i + 1;
            transactionData.totalInstallments = numInstallments;
            transactionData.groupId = groupId;
          } else if (isRecurring) {
            transactionData.isRecurring = true;
            transactionData.frequency = frequency;
            transactionData.groupId = groupId;
          }

          await addDoc(collection(db, 'transactions'), transactionData);
        }
      }
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleAddAccount = async (data: Omit<Account, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      if (data.isFavorite) {
        // Unset other favorites
        const batch = writeBatch(db);
        accounts.forEach(acc => {
          if (acc.isFavorite) {
            batch.update(doc(db, 'accounts', acc.id), { isFavorite: false });
          }
        });
        const newDocRef = doc(collection(db, 'accounts'));
        batch.set(newDocRef, {
          ...data,
          userId: user.uid,
          createdAt: Timestamp.now()
        });
        await batch.commit();
      } else {
        await addDoc(collection(db, 'accounts'), {
          ...data,
          userId: user.uid,
          createdAt: Timestamp.now()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'accounts');
    }
  };

  const handleUpdateAccount = async (id: string, data: Partial<Account>) => {
    if (!user) return;
    try {
      if (data.isFavorite) {
        // Unset other favorites
        const batch = writeBatch(db);
        accounts.forEach(acc => {
          if (acc.id !== id && acc.isFavorite) {
            batch.update(doc(db, 'accounts', acc.id), { isFavorite: false });
          }
        });
        batch.update(doc(db, 'accounts', id), {
          ...data,
          updatedAt: Timestamp.now()
        });
        await batch.commit();
      } else {
        await updateDoc(doc(db, 'accounts', id), {
          ...data,
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `accounts/${id}`);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'accounts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `accounts/${id}`);
    }
  };

  const handleUpdateTransaction = async (data: any) => {
    if (!user || !editingTransaction) return;
    try {
      const { installments, updateFuture, ...baseData } = data;
      const account = accounts.find(a => a.id === data.accountId);
      const purchaseDate = parseISO(data.date);
      
      let dueDate = purchaseDate;
      if (data.paymentType === 'credit') {
        if (data.dueDate) {
          dueDate = parseISO(data.dueDate);
        } else if ((account?.type === 'credit' || account?.type === 'hybrid') && account.closingDay && account.dueDay) {
          dueDate = calculateDueDate(purchaseDate, account.closingDay, account.dueDay);
        }
      }

      if (updateFuture && editingTransaction.groupId) {
        const batch = writeBatch(db);
        const currentTxDate = editingTransaction.date instanceof Timestamp 
          ? editingTransaction.date.toDate() 
          : (typeof editingTransaction.date === 'string' ? parseISO(editingTransaction.date) : new Date(editingTransaction.date));
        
        // Use startOfDay for offset to avoid time drift issues
        const offset = startOfDay(purchaseDate).getTime() - startOfDay(currentTxDate).getTime();
        const dateChanged = offset !== 0;

        // Find all transactions in the group that are on or after the current one's date
        const futureTransactions = transactions.filter(tx => {
          const txDate = tx.date instanceof Timestamp 
            ? tx.date.toDate() 
            : (typeof tx.date === 'string' ? parseISO(tx.date) : new Date(tx.date));
          
          return tx.groupId === editingTransaction.groupId && 
                 txDate >= currentTxDate;
        });

        // Identify what changed in the form compared to the editing transaction
        const changes: any = {};
        if (Number(data.amount) !== Number(editingTransaction.amount)) changes.amount = Number(data.amount);
        if (data.category !== editingTransaction.category) changes.category = data.category;
        if (data.description !== editingTransaction.description) changes.description = data.description;
        if (data.accountId !== editingTransaction.accountId) changes.accountId = data.accountId;
        if (data.paymentType !== editingTransaction.paymentType) changes.paymentType = data.paymentType;
        if (data.type !== editingTransaction.type) changes.type = data.type;
        if (data.isRecurring !== editingTransaction.isRecurring) changes.isRecurring = data.isRecurring;
        if (data.frequency !== editingTransaction.frequency) changes.frequency = data.frequency;

        futureTransactions.forEach(tx => {
          const isCurrent = tx.id === editingTransaction.id;
          const updateData: any = { ...changes };

          const txOriginalDate = tx.date instanceof Timestamp 
            ? tx.date.toDate() 
            : (typeof tx.date === 'string' ? parseISO(tx.date) : new Date(tx.date));
          
          // Handle Date
          let newTxDate = txOriginalDate;
          if (dateChanged) {
            newTxDate = new Date(txOriginalDate.getTime() + offset);
            updateData.date = Timestamp.fromDate(newTxDate);
          } else if (isCurrent) {
            updateData.date = Timestamp.fromDate(purchaseDate);
          }

          // Handle Due Date
          if (isCurrent) {
            updateData.dueDate = Timestamp.fromDate(dueDate);
          } else {
            // For future transactions
            if (data.paymentType === 'credit') {
              const accountChanged = data.accountId !== editingTransaction.accountId;
              
              if (dateChanged || accountChanged) {
                if ((account?.type === 'credit' || account?.type === 'hybrid') && account.closingDay && account.dueDay) {
                  const newTxDueDate = calculateDueDate(newTxDate, account.closingDay, account.dueDay);
                  updateData.dueDate = Timestamp.fromDate(newTxDueDate);
                } else if (tx.dueDate && dateChanged) {
                  const txOriginalDueDate = tx.dueDate instanceof Timestamp 
                    ? tx.dueDate.toDate() 
                    : (typeof tx.dueDate === 'string' ? parseISO(tx.dueDate) : new Date(tx.dueDate));
                  const newTxDueDate = new Date(txOriginalDueDate.getTime() + offset);
                  updateData.dueDate = Timestamp.fromDate(newTxDueDate);
                }
              }
            } else if (dateChanged) {
              updateData.dueDate = Timestamp.fromDate(newTxDate);
            }
          }

          if (Object.keys(updateData).length > 0) {
            batch.update(doc(db, 'transactions', tx.id), updateData);
          }
        });
        
        await batch.commit();
        setToast({ message: `${futureTransactions.length} transações atualizadas com sucesso!`, type: 'success' });
      } else {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), {
          ...baseData,
          date: Timestamp.fromDate(purchaseDate),
          dueDate: Timestamp.fromDate(dueDate)
        });
        setToast({ message: "Transação atualizada com sucesso!", type: 'success' });
      }
      setEditingTransaction(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${editingTransaction.id}`);
      setToast({ message: "Erro ao atualizar transação.", type: 'error' });
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx?.groupId) {
      setTransactionToDelete(tx);
    } else {
      try {
        await deleteDoc(doc(db, 'transactions', id));
        setToast({ message: "Transação excluída com sucesso!", type: 'success' });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
      }
    }
  };

  const handleAddCategory = async (data: Omit<Category, 'id'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'categories'), {
        ...data,
        userId: user.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleResetData = async () => {
    if (!user) return;
    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      transactions.forEach((tx) => {
        batch.delete(doc(db, 'transactions', tx.id));
      });
      await batch.commit();
      setShowResetModal(false);
      setShowSettingsModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions-batch');
    } finally {
      setIsResetting(false);
    }
  };

  const handleUpdateProfile = async (data: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...data,
        updatedAt: Timestamp.now()
      });
      setToast({ message: "Configurações salvas com sucesso!", type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setToast({ message: "Erro ao salvar configurações.", type: 'error' });
    }
  };

  const handleUpdateCategory = async (id: string, data: Partial<Category>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'categories', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const batch = writeBatch(db);
      
      // Clear parentId for any subcategories
      const subcategories = customCategories.filter(c => c.parentId === id);
      subcategories.forEach(sub => {
        batch.update(doc(db, 'categories', sub.id), { parentId: null });
      });
      
      // Delete the category
      batch.delete(doc(db, 'categories', id));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950", theme === 'dark' && 'dark')}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <LoginView onLogin={signInWithGoogle} />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <AccessDeniedView onLogout={logout} userEmail={user.email || ''} />
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300",
      theme === 'dark' && 'dark'
    )}>
      {/* Navbar */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button 
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity active:scale-95"
            >
              <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-lg">
                <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-indigo-900 dark:text-indigo-400 truncate max-w-[120px] sm:max-w-none">Tô de Olho</span>
            </button>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setShowAddModal(true)}
                className="hidden md:flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 px-4 py-2 rounded-xl transition-all font-semibold text-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">Novo Lançamento</span>
              </button>

              <button 
                onClick={requestNotificationPermission}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  notificationsEnabled ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
                title={notificationsEnabled ? "Notificações Ativas" : "Ativar Notificações"}
              >
                {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </button>

              <button 
                onClick={toggleTheme}
                className="p-2 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title={theme === 'light' ? "Modo Escuro" : "Modo Claro"}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              
              <button 
                onClick={() => setActiveView('dashboard')}
                className={cn(
                  "hidden md:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  activeView === 'dashboard' ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-sm font-medium">Dashboard</span>
              </button>
              <button 
                onClick={() => setActiveView('invoices')}
                className={cn(
                  "hidden md:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  activeView === 'invoices' ? "text-indigo-600 bg-indigo-50" : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
                )}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Faturas</span>
              </button>
              <button 
                onClick={() => setShowAccountModal(true)}
                className="hidden sm:flex items-center gap-2 text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Contas</span>
              </button>
              <button 
                onClick={() => setShowCategoryModal(true)}
                className="hidden sm:flex items-center gap-2 text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Categorias</span>
              </button>
              <button 
                onClick={() => setShowBudgetModal(true)}
                className="hidden sm:flex items-center gap-2 text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <PieChartIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Orçamentos</span>
              </button>
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="hidden sm:flex items-center gap-2 text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                title="Configurações"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Ajustes</span>
              </button>
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium">{userProfile?.displayName || user.displayName}</span>
                <span className="text-xs text-slate-500">{user.email}</span>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-8">
        {activeView === 'dashboard' ? (
          <>
            {/* Header & Month Filter */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Painel Financeiro</h1>
                <p className="text-slate-500 dark:text-slate-400">Olá, {(userProfile?.displayName || user.displayName)?.split(' ')[0]}! Veja como estão suas finanças.</p>
              </div>
              
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full lg:w-auto">
                {/* Main Filters Group */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Account Selector */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm min-w-[180px] h-11">
                    <CreditCard className="w-4 h-4 text-indigo-500 shrink-0" />
                    <select 
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="text-sm font-bold border-none bg-transparent focus:ring-0 p-0 w-full cursor-pointer text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">Todas as Contas</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Month Navigator */}
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm h-11">
                    <button 
                      onClick={() => {
                        setFilterMonth(subMonths(filterMonth, 1));
                        setDateRange(null);
                      }}
                      className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="px-4 font-bold min-w-[130px] text-center capitalize text-sm text-slate-700 dark:text-slate-200">
                      {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                    </div>
                    <button 
                      onClick={() => {
                        const nextMonth = new Date(filterMonth);
                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                        setFilterMonth(nextMonth);
                        setDateRange(null);
                      }}
                      className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Secondary Filters Group */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Date Range */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm h-11">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                      <input 
                        type="date"
                        value={dateRange?.start || ''}
                        onChange={(e) => setDateRange({ start: e.target.value, end: dateRange?.end || '' })}
                        className="text-xs font-bold border-none bg-transparent focus:ring-0 p-0 w-[105px] text-slate-600 dark:text-slate-300"
                      />
                      <span className="text-slate-300 dark:text-slate-600 font-bold">→</span>
                      <input 
                        type="date"
                        value={dateRange?.end || ''}
                        onChange={(e) => setDateRange({ start: dateRange?.start || '', end: e.target.value })}
                        className="text-xs font-bold border-none bg-transparent focus:ring-0 p-0 w-[105px] text-slate-600 dark:text-slate-300"
                      />
                    </div>
                    {dateRange && (
                      <button 
                        onClick={() => setDateRange(null)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExportCSV}
                    disabled={displayTransactions.length === 0}
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-bold transition-all hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed h-11"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden xl:inline">Exportar</span>
                  </button>
                </div>
              </div>
            </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
          <SummaryCard 
            title="Saldo Total" 
            amount={totalCurrentBalance} 
            icon={<Wallet className="w-5 h-5 sm:w-6 sm:h-6" />} 
            color="indigo"
            alertOnNegative={true}
          />
          <SummaryCard 
            title="Saldo do Mês" 
            amount={balance} 
            icon={<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />} 
            color="indigo"
            trend={balanceTrend}
            alertOnNegative={true}
          />
          <SummaryCard 
            title="Receita Mensal" 
            amount={totals.income} 
            icon={<ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6" />} 
            color="emerald"
            trend={incomeTrend}
          />
          <SummaryCard 
            title="Despesas Mensais" 
            amount={totals.expense} 
            icon={<ArrowDownRight className="w-5 h-5 sm:w-6 sm:h-6" />} 
            color="rose"
            trend={expenseTrend}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Charts Section */}
          <div className="lg:col-span-2 space-y-8">
            {/* Fluxo de Caixa Diário - MOVED TO TOP */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">Fluxo de Caixa Diário</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyBalanceData}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={chartOffset} stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset={chartOffset} stopColor="#f43f5e" stopOpacity={0.2}/>
                      </linearGradient>
                      <linearGradient id="strokeBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={chartOffset} stopColor="#10b981" stopOpacity={1}/>
                        <stop offset={chartOffset} stopColor="#f43f5e" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      minTickGap={30}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        color: theme === 'dark' ? '#f8fafc' : '#1e293b'
                      }}
                      itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}
                      formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Saldo']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="url(#strokeBalance)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorBalance)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex flex-col gap-6 mb-6">
                {/* Top Row: Title and Main Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Extrato</h3>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => setShowImportModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-semibold text-sm shadow-sm active:scale-95"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      <span>Importar</span>
                    </button>
                    <button 
                      onClick={() => setShowAddModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all font-semibold text-sm active:scale-95 shadow-sm shadow-indigo-200 dark:shadow-none"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nova Transação</span>
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Type Filter */}
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shadow-inner h-10">
                    <button 
                      onClick={() => setTypeFilter('all')}
                      className={cn(
                        "flex-1 text-[10px] font-bold rounded-lg transition-all",
                        typeFilter === 'all' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      Todas
                    </button>
                    <button 
                      onClick={() => setTypeFilter('income')}
                      className={cn(
                        "flex-1 text-[10px] font-bold rounded-lg transition-all",
                        typeFilter === 'income' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      Receitas
                    </button>
                    <button 
                      onClick={() => setTypeFilter('expense')}
                      className={cn(
                        "flex-1 text-[10px] font-bold rounded-lg transition-all",
                        typeFilter === 'expense' ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      Despesas
                    </button>
                  </div>

                  {/* Search Filter */}
                  <div className="relative h-10">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-full pl-9 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition-all text-slate-900 dark:text-slate-100"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter */}
                  <div className="h-10">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full h-full px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <option value="all">Todas Categorias</option>
                      {allCategories.filter(c => !c.parentId).map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Type Filter */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setListMode(prev => prev === 'detailed' ? 'compact' : 'detailed')}
                      className={cn(
                        "p-2 rounded-xl border transition-all",
                        listMode === 'compact' 
                          ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                      )}
                      title={listMode === 'compact' ? "Visualização Detalhada" : "Visualização Compacta"}
                    >
                      {listMode === 'compact' ? <List className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                    </button>
                    <div className="h-10">
                      <select
                        value={paymentTypeFilter}
                        onChange={(e) => setPaymentTypeFilter(e.target.value as any)}
                        className="w-full h-full px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        <option value="all">Todos Pagamentos</option>
                        <option value="debit">Débito / Dinheiro</option>
                        <option value="credit">Cartão de Crédito</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <TransactionList 
                transactions={displayTransactions} 
                categories={allCategories}
                accounts={accounts}
                onDelete={handleDeleteTransaction} 
                onEdit={setEditingTransaction}
                listMode={listMode}
              />
            </div>
          </div>

          {/* Sidebar Section */}
          <div className="space-y-8">
            <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="text-lg font-semibold mb-2">Dica Financeira do Dia</h3>
                <p className="text-indigo-100 text-sm leading-relaxed italic">
                  "{dailyTip}"
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 opacity-10">
                <TrendingUp className="w-24 h-24" />
              </div>
            </div>
          </div>
        </div>

        {/* New Analysis Section at the bottom */}
        <div className="mt-12 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Análise Detalhada</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Entenda seu comportamento de consumo e orçamentos.</p>
            </div>
            
            {/* Analysis Mode Toggles */}
            <div className="flex flex-wrap gap-3">
              {/* View Mode Toggle (Date basis) */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shadow-inner">
                <button
                  onClick={() => setViewMode('due')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    viewMode === 'due' 
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Vencimento</span>
                </button>
                <button
                  onClick={() => setViewMode('purchase')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    viewMode === 'purchase' 
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  )}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Compra</span>
                </button>
              </div>

              {/* Category/Subcategory Toggle */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shadow-inner">
                <button
                  onClick={() => setAnalysisLevel('category')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    analysisLevel === 'category' 
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Categorias</span>
                </button>
                <button
                  onClick={() => setAnalysisLevel('subcategory')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    analysisLevel === 'subcategory' 
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  )}
                >
                  <Layers className="w-4 h-4" />
                  <span>Subcategorias</span>
                </button>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">Análise de Gastos por Categoria</h3>
              <div className="h-[350px] w-full">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc', opacity: 0.1 }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                    Sem dados para este período
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-semibold mb-6 text-slate-900 dark:text-slate-100">Distribuição de Despesas</h3>
                <div className="h-[250px] w-full">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            color: '#f8fafc'
                          }}
                          itemStyle={{ color: '#f8fafc' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                      Nenhuma despesa registrada
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {categoryData.slice(0, 5).map((cat, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-600 dark:text-slate-400">{cat.name}</span>
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{cat.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orçamentos do Mês - MOVED HERE */}
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Orçamentos do Mês</h3>
                  <button 
                    onClick={() => setShowBudgetModal(true)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
                  >
                    Configurar
                  </button>
                </div>
                
                {budgetProgress.length === 0 ? (
                  <div className="text-center py-6">
                    <PieChartIcon className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum orçamento definido para este mês.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {budgetProgress.map((budget) => (
                      <div key={budget.id} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{budget.category}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {budget.spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de {budget.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full",
                            budget.percent >= 100 ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" : 
                            budget.percent >= 80 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : 
                            "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          )}>
                            {Math.round(budget.percent)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(budget.percent, 100)}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              budget.percent >= 100 ? "bg-rose-500" : 
                              budget.percent >= 80 ? "bg-amber-500" : 
                              "bg-emerald-500"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    ) : (
      <InvoiceView 
        transactions={transactions} 
        accounts={accounts} 
        onEdit={setEditingTransaction} 
        onDelete={handleDeleteTransaction}
        categories={allCategories}
      />
    )}
  </main>

      {/* Mobile Navigation Bar - REMOVED redundant one */}

      {/* Bottom Navigation for Mobile */}
      <BottomNav 
        activeView={activeView} 
        setActiveView={setActiveView} 
        onAdd={() => setShowAddModal(true)}
        onAccounts={() => setShowAccountModal(true)}
        onCategories={() => setShowCategoryModal(true)}
        onSettings={() => setShowSettingsModal(true)}
      />

      {/* Modals */}
      <AnimatePresence>
        {showBudgetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBudgetModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Gerenciar Orçamentos</h2>
                  <button onClick={() => setShowBudgetModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <BudgetManager 
                  budgets={budgets}
                  categories={allCategories.filter(c => c.type === 'expense' || c.type === 'both')}
                  currentMonth={format(filterMonth, 'yyyy-MM')}
                  onSave={async (category, amount) => {
                    if (!user) return;
                    const monthStr = format(filterMonth, 'yyyy-MM');
                    const existing = budgets.find(b => b.category === category && b.month === monthStr);
                    if (existing) {
                      await updateDoc(doc(db, 'budgets', existing.id), { amount });
                    } else {
                      await addDoc(collection(db, 'budgets'), {
                        userId: user.uid,
                        category,
                        amount,
                        month: monthStr,
                        createdAt: Timestamp.now()
                      });
                    }
                  }}
                  onDelete={async (id) => {
                    await deleteDoc(doc(db, 'budgets', id));
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={cn(
              "px-6 py-3 rounded-2xl shadow-lg border flex items-center gap-3",
              toast.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
              toast.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-700" :
              "bg-slate-800 border-slate-700 text-white"
            )}>
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Nova Transação</h2>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <TransactionForm 
                  onSubmit={handleAddTransaction} 
                  onCancel={() => setShowAddModal(false)} 
                  categories={allCategories}
                  accounts={accounts}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTransaction(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Editar Transação</h2>
                  <button onClick={() => setEditingTransaction(null)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <TransactionForm 
                  onSubmit={handleUpdateTransaction} 
                  onCancel={() => setEditingTransaction(null)} 
                  categories={allCategories}
                  accounts={accounts}
                  initialData={editingTransaction}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Importar Transações</h2>
                  <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <ImportModal 
                  accounts={accounts}
                  categories={allCategories}
                  onImport={async (transactions) => {
                    if (!user) return;
                    try {
                      for (const tx of transactions) {
                        await addDoc(collection(db, 'transactions'), {
                          ...tx,
                          userId: user.uid,
                          createdAt: Timestamp.now()
                        });
                      }
                      setShowImportModal(false);
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, 'transactions');
                    }
                  }}
                  onCancel={() => setShowImportModal(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Account Management Modal */}
      <AnimatePresence>
        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAccountModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Gerenciar Contas</h2>
                  <button onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <AccountManager 
                  accounts={accounts}
                  onAdd={handleAddAccount}
                  onUpdate={handleUpdateAccount}
                  onDelete={handleDeleteAccount}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {transactionToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Excluir Transação</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
                Esta transação faz parte de um grupo (parcelas ou recorrência). Como deseja prosseguir?
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'transactions', transactionToDelete.id));
                      setToast({ message: "Transação excluída com sucesso!", type: 'success' });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, `transactions/${transactionToDelete.id}`);
                    }
                    setTransactionToDelete(null);
                  }}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
                >
                  Excluir apenas esta
                </button>
                <button
                  onClick={async () => {
                    try {
                      const batch = writeBatch(db);
                      const currentTxDate = transactionToDelete.date instanceof Timestamp 
                        ? transactionToDelete.date.toDate() 
                        : (typeof transactionToDelete.date === 'string' ? parseISO(transactionToDelete.date) : new Date(transactionToDelete.date));
                      const futureTransactions = transactions.filter(tx => {
                        const txDate = tx.date instanceof Timestamp 
                          ? tx.date.toDate() 
                          : (typeof tx.date === 'string' ? parseISO(tx.date) : new Date(tx.date));
                        return tx.groupId === transactionToDelete.groupId && 
                               tx.type === transactionToDelete.type &&
                               txDate >= currentTxDate;
                      });
                      futureTransactions.forEach(tx => {
                        batch.delete(doc(db, 'transactions', tx.id));
                      });
                      await batch.commit();
                      setToast({ message: `${futureTransactions.length} transações excluídas com sucesso!`, type: 'success' });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, 'transactions-batch');
                    }
                    setTransactionToDelete(null);
                  }}
                  className="w-full py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-all text-sm shadow-lg shadow-rose-100 dark:shadow-none"
                >
                  Excluir esta e todas as próximas
                </button>
                <button
                  onClick={() => setTransactionToDelete(null)}
                  className="w-full py-3 text-slate-500 dark:text-slate-400 font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-all text-sm"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategoryModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Gerenciar Categorias</h2>
                  <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <CategoryManager 
                  customCategories={customCategories}
                  allCategories={allCategories}
                  onAdd={handleAddCategory}
                  onUpdate={handleUpdateCategory}
                  onDelete={handleDeleteCategory}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Configurações</h2>
                  <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <SettingsManager 
                  userProfile={userProfile}
                  onUpdateProfile={handleUpdateProfile}
                  onResetData={() => setShowResetModal(true)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isResetting && setShowResetModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh] border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Resetar Dados?</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                  Esta ação irá excluir **todas** as suas transações de receita e despesa permanentemente. As contas e categorias serão mantidas.
                </p>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleResetData}
                    disabled={isResetting}
                    className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCcw className="w-5 h-5 animate-spin" />
                        Resetando...
                      </>
                    ) : (
                      'Sim, excluir tudo'
                    )}
                  </button>
                  <button
                    onClick={() => setShowResetModal(false)}
                    disabled={isResetting}
                    className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-indigo-600 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-400 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center relative z-10 border border-white/10"
      >
        <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Eye className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Tô de Olho</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Assuma o controle de sua vida financeira hoje. Simples, seguro e inteligente.</p>
        
        <button 
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 py-3 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
          Continuar com Google
        </button>
        
        <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </motion.div>
    </div>
  );
}

function AccessDeniedView({ onLogout, userEmail }: { onLogout: () => void, userEmail: string }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-100 dark:border-slate-800 text-center">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          Olá, <span className="font-semibold text-slate-700 dark:text-slate-300">{userEmail}</span>. 
          Seu acesso ainda não foi liberado pelo administrador.
        </p>
        
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl mb-8">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Entre em contato com o proprietário do app para solicitar sua liberação.
          </p>
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}

function SettingsManager({ userProfile, onUpdateProfile, onResetData }: { userProfile: any, onUpdateProfile: (data: any) => Promise<void>, onResetData: () => void }) {
  const [name, setName] = useState(userProfile?.displayName || '');
  const [reminderDays, setReminderDays] = useState(userProfile?.reminderDaysBefore || 3);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const isAdmin = userProfile?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (userProfile?.displayName) {
      setName(userProfile.displayName);
    }
    if (userProfile?.reminderDaysBefore !== undefined) {
      setReminderDays(userProfile.reminderDaysBefore);
    }
  }, [userProfile]);

  const handleSaveName = async () => {
    setIsSavingName(true);
    try {
      await onUpdateProfile({ displayName: name });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveReminders = async () => {
    setIsSavingReminders(true);
    try {
      await onUpdateProfile({ reminderDaysBefore: reminderDays });
    } finally {
      setIsSavingReminders(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Perfil</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Como quer ser chamado?</label>
            <div className="flex gap-2">
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-100"
                disabled={isSavingName}
              />
              <button 
                onClick={handleSaveName}
                disabled={isSavingName}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
              >
                {isSavingName ? '...' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Lembrete de contas (dias antes do vencimento)</label>
            <div className="flex gap-2">
              <input 
                type="number"
                min="0"
                max="30"
                value={reminderDays}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                  setReminderDays(isNaN(val) ? 0 : val);
                }}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-100"
                disabled={isSavingReminders}
              />
              <button 
                onClick={handleSaveReminders}
                disabled={isSavingReminders}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
              >
                {isSavingReminders ? '...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4">Gerenciar Acessos</h3>
          <AllowedUsersManager />
        </div>
      )}

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-4">Zona de Perigo</h3>
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 p-4 rounded-2xl">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">Resetar Lançamentos</h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
                Isso apagará permanentemente todas as suas transações. Contas e categorias não serão afetadas.
              </p>
            </div>
          </div>
          <button 
            onClick={onResetData}
            className="w-full bg-rose-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-sm"
          >
            Resetar Todos os Lançamentos
          </button>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[10px] text-slate-400 dark:text-slate-500">Versão 1.2.0 • Tô de Olho</p>
      </div>
    </div>
  );
}

function AllowedUsersManager() {
  const [email, setEmail] = useState('');
  const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'allowed_users'), (snapshot) => {
      setAllowedUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async () => {
    if (!email || !email.includes('@')) return;
    setIsAdding(true);
    try {
      await setDoc(doc(db, 'allowed_users', email.toLowerCase().trim()), {
        email: email.toLowerCase().trim(),
        addedAt: Timestamp.now(),
        addedBy: auth.currentUser?.email
      });
      setEmail('');
    } catch (error) {
      console.error("Erro ao adicionar usuário:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveUser = async (userEmail: string) => {
    try {
      await deleteDoc(doc(db, 'allowed_users', userEmail));
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input 
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail para liberar"
          className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-100"
        />
        <button 
          onClick={handleAddUser}
          disabled={isAdding || !email}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          {isAdding ? '...' : 'Liberar'}
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
        {allowedUsers.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2">Nenhum usuário liberado além de você.</p>
        ) : (
          allowedUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{u.email}</span>
              <button 
                onClick={() => handleRemoveUser(u.id)}
                className="text-rose-500 hover:text-rose-700 p-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, amount, icon, color, trend, alertOnNegative = false }: { title: string, amount: number, icon: React.ReactNode, color: 'indigo' | 'emerald' | 'rose', trend?: string, alertOnNegative?: boolean }) {
  const colors = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
  };

  const isNegative = amount < 0;

  const getTrendColor = () => {
    if (!trend || trend === '0%') return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    const isPositive = trend.startsWith('+');
    const isNegTrend = trend.startsWith('-');
    
    if (color === 'rose') {
      return isNegTrend ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400';
    }
    return isPositive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400';
  };

  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden",
      isNegative && alertOnNegative ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-900/10" : "border-slate-200 dark:border-slate-800"
    )}>
      {isNegative && alertOnNegative && (
        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
      )}
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className={cn("p-2 sm:p-3 rounded-xl", colors[color])}>
          {icon}
        </div>
        <div className="flex flex-col items-end gap-1.5 sm:gap-2">
          {trend && (
            <span className={cn(
              "text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full",
              getTrendColor()
            )}>
              {trend}
            </span>
          )}
          {isNegative && alertOnNegative && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex items-center gap-1 text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-800"
            >
              <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden xs:inline">Atenção</span>
            </motion.div>
          )}
        </div>
      </div>
      <h4 className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1 truncate">{title}</h4>
      <div className="flex items-baseline gap-1 sm:gap-2">
        <p className={cn(
          "text-base sm:text-2xl font-bold tracking-tight truncate",
          isNegative && alertOnNegative ? "text-rose-700 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
        )}>
          {(Number(amount) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>
    </div>
  );
}

// Category Icon Helper
function CategoryIcon({ iconName, className }: { iconName: string, className?: string }) {
  const icons: Record<string, any> = {
    DollarSign,
    Utensils,
    Home,
    Car,
    Tv,
    Heart,
    ShoppingBag,
    MoreHorizontal,
    RefreshCcw,
    Wallet,
    CreditCard,
    Tag,
    Coffee,
    Bus,
    Plane,
    Music,
    Gamepad2,
    Gift,
    Briefcase,
    GraduationCap,
    Stethoscope,
    Zap,
    Wifi,
    Smartphone,
    Laptop,
    Camera,
    Film,
    Book,
    Dumbbell,
    Palette,
    Scissors,
    Wrench,
    Hammer,
    Truck,
    Package,
    Store,
    Pizza,
    Beer,
    Wine,
    IceCream,
    Apple,
    Leaf,
    Flower2,
    Cloud,
    Umbrella,
    Flame,
    Mountain,
    Waves,
    Smile,
    User: UserIcon,
    Users,
    Shield,
    Lock,
    Key,
    Flag,
    MapPin,
    Globe,
    Rocket,
    Train,
    Bike
  };
  
  const Icon = icons[iconName] || Tag;
  return <Icon className={className} />;
}

// Transaction Item Component
function TransactionItem({ tx, categories, accounts, onEdit, onDelete, isConsolidated, onToggleExpand }: { 
  tx: Transaction, 
  categories: Category[], 
  accounts: Account[],
  onEdit: (tx: Transaction) => void, 
  onDelete: (id: string) => void,
  isConsolidated?: boolean,
  onToggleExpand?: () => void
}) {
  const purchaseDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
  const dueDate = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : (tx.dueDate ? new Date(tx.dueDate) : null);
  const cat = categories.find(c => c.name === tx.category) || DEFAULT_CATEGORIES[7];
  const account = accounts.find(a => a.id === tx.accountId);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onDoubleClick={onToggleExpand}
      className={cn(
        "group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800 gap-3 sm:gap-4",
        isConsolidated && "cursor-pointer"
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: cat.color }}>
          <CategoryIcon iconName={cat.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-0.5">
            <h5 className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[150px] sm:max-w-none">
              {tx.description || tx.category}
            </h5>
            <div className="flex items-center gap-1.5">
              {tx.isRecurring && (
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-1 rounded" title="Recorrente">
                  <RefreshCcw className="w-3 h-3 text-indigo-500" />
                </div>
              )}
              {tx.paymentType === 'credit' && (
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded" title="Cartão de Crédito">
                  <CreditCard className="w-3 h-3 text-slate-400" />
                </div>
              )}
              {tx.installment && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">
                  {tx.installment}/{tx.totalInstallments}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
              <Wallet className="w-2.5 h-2.5" />
              <span className="truncate max-w-[80px] sm:max-w-none font-medium">{account?.name || 'N/A'}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1">
              <Tag className="w-2.5 h-2.5 text-slate-400" />
              <span className="truncate max-w-[80px] sm:max-w-none">{tx.category}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1 shrink-0">
              <Calendar className="w-2.5 h-2.5 text-slate-400" />
              <span>{format(purchaseDate, 'dd/MM/yy', { locale: ptBR })}</span>
              {tx.paymentType === 'credit' && dueDate && (
                <span className="text-rose-500 dark:text-rose-400 font-medium ml-1">
                  (Venc. {format(dueDate, 'dd/MM')})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pl-13 sm:pl-0">
        <span className={cn(
          "font-bold text-lg sm:text-lg",
          tx.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        )}>
          {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
        
        {!isConsolidated && (
          <div className="flex items-center gap-1">
            <button 
              onClick={() => onEdit(tx)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
              title="Editar"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(tx.id)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TransactionList({ transactions, categories, accounts, onDelete, onEdit, listMode }: { transactions: Transaction[], categories: Category[], accounts: Account[], onDelete: (id: string) => void, onEdit: (tx: Transaction) => void, listMode: 'detailed' | 'compact' }) {
  const [expandedConsolidated, setExpandedConsolidated] = useState<Set<string>>(new Set());

  const processedTransactions = useMemo(() => {
    if (listMode !== 'compact') return transactions;

    const consolidated: Record<string, any> = {};
    const result: Transaction[] = [];

    transactions.forEach(tx => {
      if (tx.paymentType === 'credit' && tx.dueDate) {
        const date = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate);
        const dateKey = format(date, 'yyyy-MM-dd');
        const key = `${dateKey}_${tx.accountId}`;
        
        if (!consolidated[key]) {
          consolidated[key] = {
            ...tx,
            id: key,
            description: `Fatura ${accounts.find(a => a.id === tx.accountId)?.name || 'Cartão'}`,
            amount: 0,
            category: 'Cartão',
            type: 'expense',
            isConsolidated: true,
            originalTransactions: []
          };
        }
        consolidated[key].amount += Number(tx.amount) || 0;
        consolidated[key].originalTransactions.push(tx);
      } else {
        result.push(tx);
      }
    });

    const finalResult: Transaction[] = [];
    [...result, ...Object.values(consolidated)].forEach(tx => {
      if ((tx as any).isConsolidated && expandedConsolidated.has(tx.id)) {
        finalResult.push(...(tx as any).originalTransactions);
      } else {
        finalResult.push(tx);
      }
    });

    return finalResult;
  }, [transactions, listMode, accounts, expandedConsolidated]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    
    // Sort transactions by date (descending)
    const sorted = [...processedTransactions].sort((a, b) => {
      const dateA = (a.paymentType === 'credit' && a.dueDate) ? a.dueDate : a.date;
      const dateB = (b.paymentType === 'credit' && b.dueDate) ? b.dueDate : b.date;
      const d1 = dateA instanceof Timestamp ? dateA.toDate() : new Date(dateA);
      const d2 = dateB instanceof Timestamp ? dateB.toDate() : new Date(dateB);
      return d2.getTime() - d1.getTime();
    });

    sorted.forEach(tx => {
      const dateToUse = (tx.paymentType === 'credit' && tx.dueDate) ? tx.dueDate : tx.date;
      const date = dateToUse instanceof Timestamp ? dateToUse.toDate() : new Date(dateToUse);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [processedTransactions]);

  const toggleExpand = (id: string) => {
    setExpandedConsolidated(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-slate-50 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-slate-300 dark:text-slate-700" />
        </div>
        <p className="text-slate-500 dark:text-slate-400">Nenhuma transação encontrada para este período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groupedTransactions.map(([dateKey, txs]) => {
        const date = parseISO(dateKey);
        let dateLabel = format(date, "dd 'de' MMMM", { locale: ptBR });
        
        if (isToday(date)) dateLabel = 'Hoje';
        else if (isYesterday(date)) dateLabel = 'Ontem';

        const dayIncome = txs.reduce((acc, tx) => tx.type === 'income' ? acc + (Number(tx.amount) || 0) : acc, 0);
        const dayExpense = txs.reduce((acc, tx) => tx.type === 'expense' ? acc + (Number(tx.amount) || 0) : acc, 0);
        const dayBalance = dayIncome - dayExpense;

        return (
          <div key={dateKey} className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800 shrink-0">
                {dateLabel}
              </span>
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
              <div className="flex items-center gap-2 sm:gap-4 text-[10px] font-bold">
                {dayIncome > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                    +{dayIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
                {dayExpense > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 hidden sm:inline">
                    -{dayExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
                <span className={cn(
                  "px-2 py-0.5 rounded-md border whitespace-nowrap",
                  dayBalance >= 0 
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800 text-rose-700 dark:text-rose-400"
                )}>
                  {dayBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {txs.map(tx => (
                <TransactionItem 
                  key={tx.id} 
                  tx={tx} 
                  categories={categories} 
                  accounts={accounts}
                  onEdit={onEdit} 
                  onDelete={onDelete}
                  isConsolidated={(tx as any).isConsolidated}
                  onToggleExpand={() => (tx as any).isConsolidated && toggleExpand(tx.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InvoiceView({ transactions, accounts, onEdit, onDelete, categories }: { 
  transactions: Transaction[], 
  accounts: Account[], 
  onEdit: (tx: Transaction) => void, 
  onDelete: (id: string) => void,
  categories: Category[]
}) {
  const creditAccounts = accounts.filter(acc => acc.type === 'credit' || acc.type === 'hybrid');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    const favorite = creditAccounts.find(a => a.isFavorite);
    return favorite?.id || creditAccounts[0]?.id || '';
  });
  const [monthFilter, setMonthFilter] = useState<string>('all');

  useEffect(() => {
    if (!selectedAccountId && creditAccounts.length > 0) {
      const favorite = creditAccounts.find(a => a.isFavorite);
      setSelectedAccountId(favorite?.id || creditAccounts[0].id);
    }
  }, [creditAccounts, selectedAccountId]);

  const invoiceTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return transactions.filter(tx => 
      tx.accountId === selectedAccountId && 
      tx.paymentType === 'credit'
    );
  }, [transactions, selectedAccountId]);

  const allMonths = useMemo(() => {
    const months = new Set<string>();
    invoiceTransactions.forEach(tx => {
      const dateToUse = tx.dueDate || tx.date;
      const date = dateToUse instanceof Timestamp ? dateToUse.toDate() : new Date(dateToUse);
      if (!isNaN(date.getTime())) {
        months.add(format(date, 'yyyy-MM'));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [invoiceTransactions]);

  const invoices = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};
    invoiceTransactions.forEach(tx => {
      const dateToUse = tx.dueDate || tx.date;
      const date = dateToUse instanceof Timestamp ? dateToUse.toDate() : new Date(dateToUse);
      if (isNaN(date.getTime())) return;
      const key = format(date, 'yyyy-MM');
      
      if (monthFilter !== 'all' && key !== monthFilter) return;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(tx);
    });

    return Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, txs]) => ({
        month: key,
        transactions: txs.sort((a, b) => {
          const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
          const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        }),
        total: txs.reduce((sum, tx) => {
          // Para auditoria de faturas, somamos o valor absoluto ou subtraímos se for receita?
          // Geralmente faturas são despesas. Se houver um estorno (receita), ele subtrai do total.
          return sum + (tx.type === 'expense' ? Number(tx.amount) : -Number(tx.amount));
        }, 0)
      }));
  }, [invoiceTransactions, monthFilter]);

  if (creditAccounts.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nenhum cartão de crédito encontrado</h3>
        <p className="text-slate-500 dark:text-slate-400">Adicione uma conta do tipo "Cartão de Crédito" para ver as faturas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Auditoria de Faturas</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Visualize os gastos detalhados por fatura de cartão.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
            <select 
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="text-sm font-semibold border-none bg-transparent focus:ring-0 p-0 w-full cursor-pointer text-slate-700 dark:text-slate-300"
            >
              {creditAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select 
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-sm font-semibold border-none bg-transparent focus:ring-0 p-0 w-full cursor-pointer text-slate-700 dark:text-slate-300 capitalize"
            >
              <option value="all">Todos os Meses</option>
              {allMonths.map(month => (
                <option key={month} value={month}>
                  {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: ptBR })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {invoices.map(invoice => (
          <div key={invoice.month} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 capitalize">
                {format(parseISO(invoice.month + '-01'), 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">Total da Fatura</span>
                <span className="text-lg font-bold text-rose-600 dark:text-rose-400">
                  {invoice.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoice.transactions.map(tx => (
                <TransactionItem 
                  key={tx.id} 
                  tx={tx} 
                  categories={categories}
                  accounts={accounts}
                  onEdit={onEdit} 
                  onDelete={onDelete} 
                />
              ))}
            </div>
          </div>
        ))}
        {invoices.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Nenhuma transação encontrada para este cartão.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionForm({ onSubmit, onCancel, categories: allCategories, accounts, initialData }: { onSubmit: (data: any) => Promise<void>, onCancel: () => void, categories: Category[], accounts: Account[], initialData?: Transaction }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateFuture, setUpdateFuture] = useState(false);
  const [formData, setFormData] = useState({
    amount: initialData ? initialData.amount.toString() : '',
    type: initialData ? initialData.type : 'expense' as 'income' | 'expense' | 'transfer',
    paymentType: initialData ? initialData.paymentType : 'debit' as 'credit' | 'debit',
    category: initialData ? initialData.category : '',
    description: initialData ? initialData.description : '',
    accountId: initialData ? initialData.accountId : (accounts.find(a => a.isFavorite)?.id || accounts[0]?.id || ''),
    toAccountId: '',
    installments: initialData ? (initialData.totalInstallments?.toString() || '1') : '1',
    isRecurring: initialData ? (initialData.isRecurring || false) : false,
    frequency: initialData ? (initialData.frequency || 'monthly') : 'monthly' as 'weekly' | 'monthly' | 'yearly',
    recurringMonths: '12',
    date: (() => {
      if (!initialData) return format(new Date(), 'yyyy-MM-dd');
      const d = initialData.date instanceof Timestamp ? initialData.date.toDate() : new Date(initialData.date);
      return isNaN(d.getTime()) ? format(new Date(), 'yyyy-MM-dd') : format(d, 'yyyy-MM-dd');
    })(),
    dueDate: (() => {
      if (!initialData?.dueDate) return '';
      const d = initialData.dueDate instanceof Timestamp ? initialData.dueDate.toDate() : new Date(initialData.dueDate);
      return isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
    })()
  });

  const categories = useMemo(() => {
    return allCategories
      .filter(c => c.type === (formData.type === 'transfer' ? 'expense' : formData.type) || c.type === 'both')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories, formData.type]);

  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const prevTriggers = useRef({ date: formData.date, accountId: formData.accountId, paymentType: formData.paymentType });

  // Set default category when type changes
  useEffect(() => {
    if (formData.type === 'transfer') {
      if (formData.category !== 'Transferência' || formData.paymentType !== 'debit') {
        setFormData(prev => ({ ...prev, category: 'Transferência', paymentType: 'debit' }));
      }
      return;
    }
    if (categories.length > 0 && !categories.find(c => c.name === formData.category)) {
      setFormData(prev => ({ ...prev, category: categories[0].name }));
    }
  }, [formData.type, categories, formData.category, formData.paymentType]);

  // Sync payment type with account type
  useEffect(() => {
    if (selectedAccount?.type === 'credit' && formData.paymentType !== 'credit') {
      setFormData(prev => ({ ...prev, paymentType: 'credit' }));
    } else if (selectedAccount?.type !== 'credit' && selectedAccount?.type !== 'hybrid' && formData.paymentType !== 'debit') {
      setFormData(prev => ({ ...prev, paymentType: 'debit' }));
    }
  }, [selectedAccount?.id, selectedAccount?.type]);

  // Update due date automatically for credit card transactions
  useEffect(() => {
    // Only recalculate if the triggers (date, account, paymentType) actually changed
    const triggersChanged = prevTriggers.current.date !== formData.date || 
                            prevTriggers.current.accountId !== formData.accountId ||
                            prevTriggers.current.paymentType !== formData.paymentType;

    if (triggersChanged) {
      prevTriggers.current = { 
        date: formData.date, 
        accountId: formData.accountId, 
        paymentType: formData.paymentType 
      };

      if (formData.paymentType === 'credit' && selectedAccount?.closingDay && selectedAccount?.dueDay && formData.date) {
        const dateObj = new Date(formData.date + 'T12:00:00');
        if (!isNaN(dateObj.getTime())) {
          const calculated = calculateDueDate(dateObj, selectedAccount.closingDay, selectedAccount.dueDay);
          const formattedCalculated = format(calculated, 'yyyy-MM-dd');
          
          if (formData.dueDate !== formattedCalculated) {
            setFormData(prev => ({ ...prev, dueDate: formattedCalculated }));
          }
        }
      } else if (formData.paymentType !== 'credit') {
        if (formData.dueDate !== '') {
          setFormData(prev => ({ ...prev, dueDate: '' }));
        }
      }
    }
  }, [formData.date, formData.accountId, formData.paymentType, selectedAccount?.closingDay, selectedAccount?.dueDay]);

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 mb-4">Você precisa criar uma conta primeiro.</p>
        <button 
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (isSubmitting) return;
      
      setError(null);
      const amount = parseFloat(formData.amount.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        setError("Por favor, insira um valor válido maior que zero.");
        return;
      }
      
      if (!formData.category) {
        setError("Por favor, selecione uma categoria.");
        return;
      }

      if (!formData.accountId) {
        setError("Por favor, selecione uma conta.");
        return;
      }

      if (formData.type === 'transfer' && !formData.toAccountId) {
        setError("Por favor, selecione a conta de destino.");
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit({
          ...formData,
          amount,
          updateFuture
        });
      } catch (err: any) {
        setError("Ocorreu um erro ao salvar a transação. Por favor, tente novamente.");
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    }}>
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl">
          {error}
        </div>
      )}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'expense', category: 'Alimentação' })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            formData.type === 'expense' ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'income', category: 'Salário' })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            formData.type === 'income' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Receita
        </button>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'transfer', category: 'Transferência' })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            formData.type === 'transfer' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Transferência
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {formData.type === 'transfer' ? 'Conta de Origem' : 'Conta'}
          </label>
          <select
            value={formData.accountId}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id} className="dark:bg-slate-900">{a.name}</option>
            ))}
          </select>
        </div>
        {formData.type === 'transfer' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Conta de Destino</label>
            <select
              required
              value={formData.toAccountId}
              onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
            >
              <option value="" className="dark:bg-slate-900">Selecione a conta</option>
              {accounts.filter(a => a.id !== formData.accountId).map(a => (
                <option key={a.id} value={a.id} className="dark:bg-slate-900">{a.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Pagamento</label>
            <select
              value={formData.paymentType}
              onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as any })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
            >
              {selectedAccount?.type !== 'credit' && <option value="debit" className="dark:bg-slate-900">Débito / Dinheiro</option>}
              {(selectedAccount?.type === 'credit' || selectedAccount?.type === 'hybrid') && <option value="credit" className="dark:bg-slate-900">Cartão de Crédito</option>}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
            <input
              required
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all text-slate-900 dark:text-slate-100"
              placeholder="0,00"
            />
          </div>
        </div>
        {formData.paymentType === 'credit' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parcelas</label>
            <input
              type="number"
              min="1"
              max="48"
              value={formData.installments}
              onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
          >
            {categories
              .filter(c => !c.parentId && (c.type === 'both' || c.type === formData.type))
              .map(parent => {
                const subs = categories.filter(c => c.parentId === parent.id);
                if (subs.length === 0) {
                  return <option key={parent.id} value={parent.name}>{parent.name}</option>;
                }
                return (
                  <optgroup key={parent.id} label={parent.name} className="dark:bg-slate-900">
                    <option value={parent.name}>{parent.name} (Geral)</option>
                    {subs.map(sub => (
                      <option key={sub.id} value={sub.name}>{sub.name}</option>
                    ))}
                  </optgroup>
                );
              })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
          <input
            required
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
          />
          {formData.paymentType === 'credit' && (
            <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Vencimento da Fatura
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
              />
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">
                Calculado automaticamente, mas você pode ajustar se necessário.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {formData.paymentType !== 'credit' && (
          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCcw className={cn("w-4 h-4", formData.isRecurring ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-600")} />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Repetir</span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isRecurring: !formData.isRecurring })}
                className={cn(
                  "w-10 h-5 rounded-full transition-all relative",
                  formData.isRecurring ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                  formData.isRecurring ? "right-1" : "left-1"
                )} />
              </button>
            </div>
          </div>
        )}
      </div>

      {formData.isRecurring && formData.paymentType !== 'credit' && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800"
        >
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">Frequência</label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-slate-100"
            >
              <option value="weekly" className="dark:bg-slate-900">Semanal</option>
              <option value="monthly" className="dark:bg-slate-900">Mensal</option>
              <option value="yearly" className="dark:bg-slate-900">Anual</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">Repetir por (vezes)</label>
            <input
              type="number"
              min="2"
              max="60"
              value={formData.recurringMonths}
              onChange={(e) => setFormData({ ...formData, recurringMonths: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-slate-100"
            />
          </div>
        </motion.div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição (Opcional)</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none text-slate-900 dark:text-slate-100"
          placeholder="O que foi isso?"
        />
      </div>

      {initialData?.groupId && (
        <div className="p-4 bg-amber-50/50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCcw className={cn("w-4 h-4", updateFuture ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-600")} />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Atualizar próximas?</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Aplicar mudanças a todas as parcelas/repetições futuras</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUpdateFuture(!updateFuture)}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                updateFuture ? "bg-amber-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <div className={cn(
                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                updateFuture ? "right-1" : "left-1"
              )} />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed",
            isSubmitting && "animate-pulse"
          )}
        >
          {isSubmitting ? 'Salvando...' : (initialData ? 'Atualizar Transação' : 'Salvar Transação')}
        </button>
      </div>
    </form>
  );
}

function AccountManager({ accounts, onAdd, onUpdate, onDelete }: { accounts: Account[], onAdd: (data: any) => void, onUpdate: (id: string, data: any) => void, onDelete: (id: string) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAcc, setNewAcc] = useState({
    name: '',
    type: 'checking' as 'checking' | 'savings' | 'credit' | 'hybrid',
    balance: 0,
    initialBalance: '0',
    initialBalanceDate: format(new Date(), 'yyyy-MM-dd'),
    closingDay: '5',
    dueDay: '15',
    color: '#6366f1',
    isFavorite: false
  });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

  const resetForm = () => {
    setEditingId(null);
    setNewAcc({ 
      name: '', 
      type: 'checking', 
      balance: 0, 
      initialBalance: '0',
      initialBalanceDate: format(new Date(), 'yyyy-MM-dd'),
      closingDay: '5', 
      dueDay: '15', 
      color: '#6366f1',
      isFavorite: false
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          {editingId ? 'Editar Conta' : 'Adicionar Nova Conta'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nome</label>
            <input 
              type="text"
              value={newAcc.name}
              onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              placeholder="ex: Conta Corrente"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
            <select
              value={newAcc.type}
              onChange={(e) => setNewAcc({ ...newAcc, type: e.target.value as any })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            >
              <option value="checking" className="dark:bg-slate-900">Corrente</option>
              <option value="savings" className="dark:bg-slate-900">Poupança</option>
              <option value="credit" className="dark:bg-slate-900">Cartão de Crédito</option>
              <option value="hybrid" className="dark:bg-slate-900">Híbrida (Corrente + Cartão)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Saldo Inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
              <input 
                type="number"
                step="0.01"
                value={newAcc.initialBalance}
                onChange={(e) => setNewAcc({ ...newAcc, initialBalance: e.target.value })}
                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                placeholder="0,00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Data do Saldo Inicial</label>
            <input 
              type="date"
              value={newAcc.initialBalanceDate}
              onChange={(e) => setNewAcc({ ...newAcc, initialBalanceDate: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {(newAcc.type === 'credit' || newAcc.type === 'hybrid') && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Dia de Fechamento</label>
              <input 
                type="number"
                min="1"
                max="31"
                value={newAcc.closingDay}
                onChange={(e) => setNewAcc({ ...newAcc, closingDay: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Dia de Vencimento</label>
              <input 
                type="number"
                min="1"
                max="31"
                value={newAcc.dueDay}
                onChange={(e) => setNewAcc({ ...newAcc, dueDay: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}
        
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewAcc({ ...newAcc, color: c })}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  newAcc.color === c ? "border-slate-900 dark:border-slate-100 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewAcc({ ...newAcc, isFavorite: !newAcc.isFavorite })}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
              newAcc.isFavorite 
                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800" 
                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
          >
            <Star className={cn("w-4 h-4", newAcc.isFavorite && "fill-current")} />
            {newAcc.isFavorite ? 'Conta Favorita' : 'Marcar como Favorita'}
          </button>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">A conta favorita será pré-selecionada em novos lançamentos.</p>
        </div>

        <div className="flex gap-3 mt-6">
          {editingId && (
            <button
              onClick={resetForm}
              className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg font-semibold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => {
              if (newAcc.name) {
                const data = {
                  ...newAcc,
                  initialBalance: parseFloat(newAcc.initialBalance) || 0,
                  closingDay: parseInt(newAcc.closingDay) || 5,
                  dueDay: parseInt(newAcc.dueDay) || 15,
                  initialBalanceDate: Timestamp.fromDate(new Date(newAcc.initialBalanceDate + 'T12:00:00'))
                };
                if (editingId) {
                  onUpdate(editingId, data);
                } else {
                  onAdd(data);
                }
                resetForm();
              }
            }}
            className="flex-[2] bg-indigo-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-all"
          >
            {editingId ? 'Atualizar Conta' : 'Adicionar Conta'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Suas Contas</h3>
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: acc.color }}>
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{acc.name}</p>
                  {acc.isFavorite && (
                    <Star className="w-3 h-3 text-amber-500 fill-current" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {acc.type === 'checking' ? 'Corrente' : 
                   acc.type === 'savings' ? 'Poupança' : 
                   acc.type === 'credit' ? 'Cartão de Crédito' : 
                   'Híbrida (Corrente + Cartão)'} 
                  {(acc.type === 'credit' || acc.type === 'hybrid') && ` (Fechamento: ${acc.closingDay}, Vencimento: ${acc.dueDay})`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  let initialDate: Date;
                  if (acc.initialBalanceDate instanceof Timestamp) {
                    initialDate = acc.initialBalanceDate.toDate();
                  } else if (acc.initialBalanceDate) {
                    initialDate = new Date(acc.initialBalanceDate);
                  } else {
                    initialDate = new Date();
                  }

                  if (isNaN(initialDate.getTime())) {
                    initialDate = new Date();
                  }

                  setEditingId(acc.id);
                  setNewAcc({
                    name: acc.name,
                    type: acc.type,
                    balance: acc.balance,
                    initialBalance: (acc.initialBalance || 0).toString(),
                    initialBalanceDate: format(initialDate, 'yyyy-MM-dd'),
                    closingDay: (acc.closingDay || 5).toString(),
                    dueDay: (acc.dueDay || 15).toString(),
                    color: acc.color,
                    isFavorite: acc.isFavorite || false
                  });
                }}
                className="p-2 text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onDelete(acc.id)}
                className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ cat, onEdit, onDelete, isSubcategory = false }: { 
  cat: Category, 
  onEdit: (cat: Category) => void, 
  onDelete: (id: string) => void,
  isSubcategory?: boolean
}) {
  return (
    <div className={cn(
      "group flex items-center justify-between p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-md transition-all",
      isSubcategory && "ml-4 sm:ml-6 border-l-4 border-l-slate-100 dark:border-l-slate-700"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: cat.color }}>
          <CategoryIcon iconName={cat.icon} className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{cat.name}</p>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            {cat.type === 'expense' ? 'Despesa' : cat.type === 'income' ? 'Receita' : 'Ambos'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button 
          onClick={() => onEdit(cat)}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(cat.id)}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CategoryManager({ customCategories, allCategories, onAdd, onUpdate, onDelete }: { 
  customCategories: Category[], 
  allCategories: Category[],
  onAdd: (data: any) => void, 
  onUpdate: (id: string, data: any) => void,
  onDelete: (id: string) => void 
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense' | 'both',
    color: '#6366f1',
    icon: 'Tag',
    parentId: ''
  });
  const [showIconPicker, setShowIconPicker] = useState(false);

  const COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b',
    '#f43f5e', '#d946ef', '#a855f7', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308',
    '#f97316', '#71717a', '#78350f', '#1e3a8a', '#14532d', '#701a75', '#4c1d95', '#451a03'
  ];

  const ICONS = [
    'Tag', 'DollarSign', 'Utensils', 'Home', 'Car', 'Tv', 'Heart', 'ShoppingBag', 
    'Coffee', 'Bus', 'Plane', 'Music', 'Gamepad2', 'Gift', 'Briefcase', 'GraduationCap', 
    'Stethoscope', 'Zap', 'Wifi', 'Smartphone', 'Laptop', 'Camera', 'Film', 'Book', 
    'Dumbbell', 'Palette', 'Scissors', 'Wrench', 'Hammer', 'Truck', 'Package', 'Store', 
    'Pizza', 'Beer', 'Wine', 'IceCream', 'Apple', 'Leaf', 'Flower2', 'Cloud', 
    'Umbrella', 'Flame', 'Mountain', 'Waves', 'Smile', 'User', 'Users', 'Shield', 
    'Lock', 'Key', 'Flag', 'MapPin', 'Globe', 'Rocket', 'Train', 'Bike', 'RefreshCcw', 'Wallet'
  ];

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      type: cat.type,
      color: cat.color,
      icon: cat.icon,
      parentId: cat.parentId || ''
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'expense', color: '#6366f1', icon: 'Tag', parentId: '' });
    setShowIconPicker(false);
  };

  const handleSubmit = () => {
    if (!formData.name) return;
    
    const data = {
      ...formData,
      parentId: formData.parentId || null
    };

    if (editingId) {
      onUpdate(editingId, data);
    } else {
      onAdd(data);
    }
    handleCancel();
  };

  // Group categories for the list
  const parentCategories = allCategories.filter(c => !c.parentId);
  const subCategories = customCategories.filter(c => c.parentId);
  const orphanCustomCategories = customCategories.filter(c => !c.parentId);

  return (
    <div className="space-y-8">
      {/* Form Section */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          {editingId ? <Edit className="w-4 h-4 text-indigo-600" /> : <PlusCircle className="w-4 h-4 text-indigo-600" />}
          {editingId ? 'Editar Categoria' : 'Nova Categoria Personalizada'}
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nome</label>
              <input 
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 transition-all font-medium"
                placeholder="Ex: Academia, Assinaturas..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 transition-all font-medium"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="both">Ambos</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Categoria Pai (Opcional)</label>
            <select
              value={formData.parentId}
              onChange={(e) => {
                const parentId = e.target.value;
                const parent = allCategories.find(c => c.id === parentId);
                setFormData({ 
                  ...formData, 
                  parentId,
                  // Inherit color and icon if it's a new subcategory
                  color: parent ? parent.color : formData.color,
                  icon: parent ? parent.icon : formData.icon,
                  type: parent ? parent.type : formData.type
                });
              }}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 transition-all font-medium"
            >
              <option value="">Nenhuma (Categoria Principal)</option>
              {parentCategories.filter(c => c.id !== editingId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Cor da Categoria</label>
              <div className="grid grid-cols-8 gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: c })}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all hover:scale-110",
                      formData.color === c ? "border-slate-900 dark:border-slate-100 scale-110 ring-2 ring-indigo-500/20" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="sm:w-32">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Ícone</label>
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full aspect-square bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group relative"
                style={{ color: formData.color }}
              >
                <CategoryIcon iconName={formData.icon} className="w-8 h-8" />
                <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1 rounded-full shadow-lg">
                  <RefreshCcw className="w-3 h-3" />
                </div>
              </button>
            </div>
          </div>

          {showIconPicker && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, icon });
                      setShowIconPicker(false);
                    }}
                    className={cn(
                      "p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all",
                      formData.icon === icon ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600" : "text-slate-500"
                    )}
                  >
                    <CategoryIcon iconName={icon} className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {editingId && (
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="flex-[2] bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none active:scale-[0.98]"
            >
              {editingId ? 'Salvar Alterações' : 'Criar Categoria'}
            </button>
          </div>
        </div>
      </div>

      {/* List Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">Suas Categorias</h3>
          <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
            {customCategories.length} TOTAL
          </span>
        </div>
        
        {customCategories.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma categoria personalizada ainda.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grouped View */}
            {parentCategories.map(parent => {
              const children = subCategories.filter(c => c.parentId === parent.id);
              const isCustomParent = customCategories.some(c => c.id === parent.id);
              
              if (!isCustomParent && children.length === 0) return null;

              return (
                <div key={parent.id} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: parent.color }} />
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{parent.name}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {isCustomParent && !parent.parentId && (
                      <CategoryCard 
                        cat={parent} 
                        onEdit={handleEdit} 
                        onDelete={onDelete} 
                      />
                    )}
                    {children.map(child => (
                      <CategoryCard 
                        key={child.id}
                        cat={child} 
                        onEdit={handleEdit} 
                        onDelete={onDelete} 
                        isSubcategory
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Orphan custom categories (shouldn't happen with current logic but good for safety) */}
            {orphanCustomCategories.filter(c => !parentCategories.some(p => p.id === c.id)).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Outras</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {orphanCustomCategories.filter(c => !parentCategories.some(p => p.id === c.id)).map(cat => (
                    <CategoryCard 
                      key={cat.id}
                      cat={cat} 
                      onEdit={handleEdit} 
                      onDelete={onDelete} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Default Categories (Read-only) */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4">Categorias Padrão</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DEFAULT_CATEGORIES.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl opacity-60 border border-slate-100 dark:border-slate-700/50">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: cat.color }}>
                <CategoryIcon iconName={cat.icon} className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BudgetManager({ budgets, categories, currentMonth, onSave, onDelete }: { 
  budgets: Budget[], 
  categories: Category[], 
  currentMonth: string,
  onSave: (category: string, amount: number) => Promise<void>,
  onDelete: (id: string) => Promise<void>
}) {
  const [newBudget, setNewBudget] = useState({
    category: categories[0]?.name || '',
    amount: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const currentBudgets = budgets.filter(b => b.month === currentMonth);

  const handleEdit = (budget: Budget) => {
    setEditingId(budget.id);
    setNewBudget({
      category: budget.category,
      amount: budget.amount.toString()
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewBudget({
      category: categories[0]?.name || '',
      amount: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          {editingId ? 'Editar Orçamento' : `Definir Orçamento para ${format(parseISO(currentMonth + "-01"), 'MMMM yyyy', { locale: ptBR })}`}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
            <select
              value={newBudget.category}
              onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
              disabled={!!editingId}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 disabled:opacity-50"
            >
              {categories.map(c => (
                <option key={c.id} value={c.name} className="dark:bg-slate-900">{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Valor Limite (R$)</label>
            <input 
              type="number"
              value={newBudget.amount}
              onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => {
              if (newBudget.category && newBudget.amount) {
                onSave(newBudget.category, parseFloat(newBudget.amount));
                setNewBudget({ ...newBudget, amount: '' });
                setEditingId(null);
              }
            }}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-all"
          >
            {editingId ? 'Atualizar Orçamento' : 'Salvar Orçamento'}
          </button>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Orçamentos Ativos</h3>
        {currentBudgets.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Nenhum orçamento definido para este mês.</p>
        ) : (
          <div className="space-y-3">
            {currentBudgets.map(budget => {
              const cat = categories.find(c => c.name === budget.category);
              return (
                <div key={budget.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat?.color || '#64748b' }}>
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{budget.category}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Limite: {budget.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEdit(budget)}
                      className="p-2 text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(budget.id)}
                      className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportModal({ accounts, categories, onImport, onCancel }: { 
  accounts: Account[], 
  categories: Category[], 
  onImport: (transactions: any[]) => Promise<void>,
  onCancel: () => void 
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const templateData = [
      {
        data: format(new Date(), 'yyyy-MM-dd'),
        valor: 150.50,
        tipo: 'Despesa',
        categoria: 'Alimentação',
        descricao: 'Exemplo de compra',
        conta: accounts[0]?.name || 'Carteira'
      },
      {
        data: format(new Date(), 'yyyy-MM-dd'),
        valor: 3500.00,
        tipo: 'Receita',
        categoria: 'Salário',
        descricao: 'Salário Mensal',
        conta: accounts[0]?.name || 'Conta Corrente'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "modelo_importacao_financeira.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const processFile = (file: File) => {
    setIsProcessing(true);
    setError(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (file.name.endsWith('.csv')) {
          Papa.parse(data as string, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              setPreview(results.data);
              setIsProcessing(false);
            },
            error: (err) => {
              setError("Erro ao processar CSV: " + err.message);
              setIsProcessing(false);
            }
          });
        } else {
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          setPreview(jsonData);
          setIsProcessing(false);
        }
      } catch (err: any) {
        setError("Erro ao ler arquivo: " + err.message);
        setIsProcessing(false);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleConfirmImport = async () => {
    if (preview.length === 0) return;
    if (accounts.length === 0) {
      setError("Você precisa criar pelo menos uma conta antes de importar transações.");
      return;
    }
    setIsProcessing(true);
    
    try {
      const getRowValue = (row: any, keys: string[]) => {
        const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
        return foundKey ? row[foundKey] : undefined;
      };

      const mappedTransactions = preview.map((row, index) => {
        // Flexible mapping for common column names
        const accountName = String(getRowValue(row, ['conta', 'account', 'bank', 'banco']) || '').toLowerCase().trim();
        const account = accounts.find(a => a.name.toLowerCase().trim() === accountName) || accounts[0];
        
        const categoryName = String(getRowValue(row, ['categoria', 'category', 'tag']) || '').toLowerCase().trim();
        const category = categories.find(c => c.name.toLowerCase().trim() === categoryName) || 
                         categories.find(c => c.name.toLowerCase().trim() === 'outros') || 
                         categories[0];
        
        if (!account) {
          throw new Error(`Conta não encontrada para a linha ${index + 1}`);
        }
        if (!category) {
          throw new Error(`Categoria não encontrada para a linha ${index + 1}`);
        }

        let date: Date;
        const rawDate = getRowValue(row, ['data', 'date', 'dia']);
        
        if (rawDate instanceof Date) {
          date = rawDate;
        } else if (typeof rawDate === 'string' && rawDate.trim()) {
          // Try parsing DD/MM/YYYY or YYYY-MM-DD
          const cleanDate = rawDate.trim();
          const parts = cleanDate.split(/[/|-]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) { // YYYY-MM-DD
              date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else { // DD/MM/YYYY
              date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
          } else {
            date = new Date(cleanDate);
          }
        } else if (typeof rawDate === 'number') {
          // Handle Excel serial dates if they come through as numbers
          date = new Date((rawDate - 25569) * 86400 * 1000);
        } else {
          date = new Date();
        }

        if (isNaN(date.getTime())) {
          throw new Error(`Data inválida na linha ${index + 1}: ${rawDate}`);
        }

        const rawAmount = getRowValue(row, ['valor', 'amount', 'preço', 'price', 'total']) || '0';
        const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[R$\s]/g, '').replace(',', '.'));
        
        if (isNaN(amount)) {
          throw new Error(`Valor inválido na linha ${index + 1}: ${rawAmount}`);
        }

        const rawType = String(getRowValue(row, ['tipo', 'type']) || '').toLowerCase().trim();
        let type: 'income' | 'expense';

        if (rawType.includes('receita') || rawType.includes('income') || rawType.includes('entrada')) {
          type = 'income';
        } else if (rawType.includes('despesa') || rawType.includes('expense') || rawType.includes('saída') || rawType.includes('saida') || rawType.includes('gasto')) {
          type = 'expense';
        } else {
          // Se não houver coluna de tipo clara, usa o sinal do valor
          type = amount > 0 ? 'income' : 'expense';
        }

        const paymentType = account.type === 'credit' ? 'credit' : 'debit';
        let dueDateValue = date;
        if (paymentType === 'credit' && account.closingDay && account.dueDay) {
          dueDateValue = calculateDueDate(date, account.closingDay, account.dueDay);
        }

        return {
          accountId: account.id,
          amount: Math.abs(amount),
          type,
          paymentType,
          category: category.name,
          description: String(getRowValue(row, ['descricao', 'descrição', 'description', 'memo', 'obs']) || 'Importado'),
          date: Timestamp.fromDate(date),
          dueDate: Timestamp.fromDate(dueDateValue)
        };
      });

      await onImport(mappedTransactions);
    } catch (err: any) {
      let displayError = err.message;
      try {
        // Try to parse if it's a Firestore JSON error
        const parsed = JSON.parse(err.message);
        displayError = parsed.error || err.message;
      } catch (e) {
        // Not JSON, use original message
      }
      setError("Erro ao importar: " + displayError);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Use nosso modelo para garantir que os dados sejam importados corretamente.</p>
        <button 
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-semibold bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Baixar Modelo</span>
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
        <input 
          type="file" 
          accept=".csv, .xlsx, .xls" 
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <RefreshCcw className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Clique para selecionar ou arraste o arquivo</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Suporta CSV, XLSX e XLS</p>
          </div>
        </label>
        {file && <p className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">{file.name}</p>}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Prévia ({preview.length} linhas)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Certifique-se que as colunas são: data, valor, tipo, categoria, descricao, conta</p>
          </div>
          <div className="max-h-60 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                <tr>
                  {Object.keys(preview[0]).map(key => (
                    <th key={key} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-slate-50 dark:border-slate-800">
                    {Object.values(row).map((val: any, j) => (
                      <th key={j} className="px-4 py-2 font-normal text-slate-500 dark:text-slate-400">{String(val)}</th>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && <p className="p-2 text-center text-xs text-slate-400 dark:text-slate-500">E mais {preview.length - 5} linhas...</p>}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirmImport}
          disabled={isProcessing || preview.length === 0}
          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Importando...' : 'Confirmar Importação'}
        </button>
      </div>
    </div>
  );
}
