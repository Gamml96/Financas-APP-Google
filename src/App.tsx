/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component } from 'react';
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
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  BellOff,
  RefreshCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
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
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, addMonths, setDate, startOfDay, addWeeks, addYears, subDays, isAfter, eachDayOfInterval, isSameDay, isBefore } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    if (!isAfter(purchase, startOfDay(closing))) {
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
  createdAt: any;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
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

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

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
            registration.showNotification("FluxiaFinance", {
              body: "As notificações de contas a vencer estão ativas.",
              icon: "https://www.google.com/favicon.ico",
              badge: "https://www.google.com/favicon.ico"
            });
          }).catch(() => {
            // Fallback to standard notification
            new Notification("FluxiaFinance", {
              body: "As notificações de contas a vencer estão ativas.",
              icon: "https://www.google.com/favicon.ico"
            });
          });
        } else {
          new Notification("FluxiaFinance", {
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
      const reminderDays = userProfile?.reminderDaysBefore || 3;
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + reminderDays);

      transactions.forEach(tx => {
        // Only check expenses with a due date
        if (tx.type === 'expense' && tx.dueDate) {
          const dueDate = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate);
          
          // If due within configured days and in the future
          if (dueDate > now && dueDate <= futureDate) {
            const storageKey = `notified_${user.uid}_${tx.id}`;
            if (!localStorage.getItem(storageKey)) {
              try {
                // Use Service Worker for better mobile support
                if ("serviceWorker" in navigator) {
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification("Conta a vencer em breve!", {
                      body: `A conta "${tx.description || tx.category}" de R$${tx.amount.toFixed(2)} vence em ${format(dueDate, 'dd/MM/yyyy')}.`,
                      icon: "https://www.google.com/favicon.ico",
                      badge: "https://www.google.com/favicon.ico",
                      vibrate: [200, 100, 200],
                      tag: tx.id // Prevent duplicate notifications for same transaction
                    } as any);
                  });
                } else {
                  new Notification("Conta a vencer em breve!", {
                    body: `A conta "${tx.description || tx.category}" de R$${tx.amount.toFixed(2)} vence em ${format(dueDate, 'dd/MM/yyyy')}.`,
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
    // Check every 4 hours
    const interval = setInterval(checkUpcomingBills, 14400000);
    return () => clearInterval(interval);
  }, [notificationsEnabled, transactions, user, userProfile]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
      let dateToUse = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      
      // Para cartões de crédito, usamos a data de vencimento para o filtro mensal
      if (tx.paymentType === 'credit' && tx.dueDate) {
        dateToUse = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : new Date(tx.dueDate);
      }
      
      return isWithinInterval(dateToUse, { start, end }) && 
             (selectedAccountId === 'all' || tx.accountId === selectedAccountId);
    });
  }, [transactions, filterMonth, dateRange, selectedAccountId]);

  const displayTransactions = useMemo(() => {
    let filtered = filteredTransactions;
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(tx => 
        (tx.description?.toLowerCase().includes(term)) || 
        (tx.category?.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [filteredTransactions, typeFilter, searchTerm]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') acc.income += amount;
      else acc.expense += amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const balance = totals.income - totals.expense;

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
    filteredTransactions.filter(t => t.type === 'expense').forEach(tx => {
      if (!data[tx.category]) {
        const cat = allCategories.find(c => c.name === tx.category) || DEFAULT_CATEGORIES[7];
        data[tx.category] = { name: tx.category, value: 0, color: cat.color };
      }
      const amount = Number(tx.amount) || 0;
      data[tx.category].value += amount;
    });
    return Object.values(data);
  }, [filteredTransactions, allCategories]);

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

  const handleAddTransaction = async (data: any) => {
    if (!user) return;
    try {
      const { installments, isRecurring, recurringMonths, frequency, toAccountId, ...baseData } = data;
      const numInstallments = parseInt(installments) || 1;
      const numRecurring = isRecurring ? (parseInt(recurringMonths) || 12) : 1;
      const totalIterations = Math.max(numInstallments, numRecurring);
      
      const groupId = totalIterations > 1 ? (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)) : undefined;
      
      // If it's a transfer, we'll handle it specially
      if (data.type === 'transfer') {
        const transferGroupId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const purchaseDate = parseISO(data.date);
        
        // 1. Create Expense (Source)
        await addDoc(collection(db, 'transactions'), {
          ...baseData,
          type: 'expense',
          userId: user.uid,
          createdAt: Timestamp.now(),
          date: Timestamp.fromDate(purchaseDate),
          dueDate: Timestamp.fromDate(purchaseDate),
          groupId: transferGroupId,
          description: baseData.description || `Transferência para ${accounts.find(a => a.id === toAccountId)?.name}`
        });

        // 2. Create Income (Destination)
        await addDoc(collection(db, 'transactions'), {
          ...baseData,
          type: 'income',
          accountId: toAccountId,
          userId: user.uid,
          createdAt: Timestamp.now(),
          date: Timestamp.fromDate(purchaseDate),
          dueDate: Timestamp.fromDate(purchaseDate),
          groupId: transferGroupId,
          description: baseData.description || `Transferência de ${accounts.find(a => a.id === baseData.accountId)?.name}`
        });
      } else {
        const account = accounts.find(a => a.id === data.accountId);
        
        for (let i = 0; i < totalIterations; i++) {
          const purchaseDate = parseISO(data.date);
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
            currentDate = addMonths(purchaseDate, i);
          }
          
          let dueDate = currentDate;
          if (data.paymentType === 'credit') {
            if (i === 0 && data.dueDate) {
              dueDate = parseISO(data.dueDate);
            } else if ((account?.type === 'credit' || account?.type === 'hybrid') && account.closingDay && account.dueDay) {
              dueDate = calculateDueDate(currentDate, account.closingDay, account.dueDay);
            }
          }

          const transactionData: any = {
            ...baseData,
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
      await addDoc(collection(db, 'accounts'), {
        ...data,
        userId: user.uid,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'accounts');
    }
  };

  const handleUpdateAccount = async (id: string, data: Partial<Account>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'accounts', id), {
        ...data,
        updatedAt: Timestamp.now()
      });
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
      const { installments, ...baseData } = data;
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

      await updateDoc(doc(db, 'transactions', editingTransaction.id), {
        ...baseData,
        date: Timestamp.fromDate(purchaseDate),
        dueDate: Timestamp.fromDate(dueDate)
      });
      setEditingTransaction(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${editingTransaction.id}`);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={signInWithGoogle} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-indigo-900">FluxiaFinance</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-semibold text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">Novo Lançamento</span>
              </button>

              <button 
                onClick={requestNotificationPermission}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  notificationsEnabled ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                )}
                title={notificationsEnabled ? "Notificações Ativas" : "Ativar Notificações"}
              >
                {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
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
        {/* Header & Month Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Painel</h1>
            <p className="text-slate-500">Bem-vindo de volta, {(userProfile?.displayName || user.displayName)?.split(' ')[0]}!</p>
          </div>
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm w-full lg:w-auto">
            {/* Account Filter */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 min-w-[160px]">
              <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
              <select 
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="text-sm font-semibold border-none bg-transparent focus:ring-0 p-0 w-full cursor-pointer text-slate-700"
              >
                <option value="all">Todas as Contas</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden lg:block" />

            <div className="flex items-center justify-between bg-slate-50/50 rounded-xl lg:bg-transparent">
              <button 
                onClick={() => {
                  setFilterMonth(subMonths(filterMonth, 1));
                  setDateRange(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-2 font-bold min-w-[120px] text-center capitalize text-sm text-indigo-900">
                {format(filterMonth, 'MMMM yyyy')}
              </div>
              <button 
                onClick={() => {
                  const nextMonth = new Date(filterMonth);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setFilterMonth(nextMonth);
                  setDateRange(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden lg:block" />

            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 overflow-x-auto no-scrollbar">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <input 
                  type="date"
                  value={dateRange?.start || ''}
                  onChange={(e) => setDateRange({ start: e.target.value, end: dateRange?.end || '' })}
                  className="text-[11px] font-medium border-none bg-transparent focus:ring-0 p-0 w-[85px] text-slate-600"
                />
                <span className="text-slate-300 text-[10px] font-bold">→</span>
                <input 
                  type="date"
                  value={dateRange?.end || ''}
                  onChange={(e) => setDateRange({ start: dateRange?.start || '', end: e.target.value })}
                  className="text-[11px] font-medium border-none bg-transparent focus:ring-0 p-0 w-[85px] text-slate-600"
                />
              </div>
              {dateRange && (
                <button 
                  onClick={() => setDateRange(null)}
                  className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 shrink-0"
                  title="Limpar Filtro"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryCard 
            title="Saldo Total" 
            amount={totalCurrentBalance} 
            icon={<Wallet className="w-6 h-6" />} 
            color="indigo"
          />
          <SummaryCard 
            title="Saldo do Mês" 
            amount={balance} 
            icon={<TrendingUp className="w-6 h-6" />} 
            color="indigo"
          />
          <SummaryCard 
            title="Receita Mensal" 
            amount={totals.income} 
            icon={<ArrowUpRight className="w-6 h-6" />} 
            color="emerald"
            trend="+12%"
          />
          <SummaryCard 
            title="Despesas Mensais" 
            amount={totals.expense} 
            icon={<ArrowDownRight className="w-6 h-6" />} 
            color="rose"
            trend="-5%"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Charts Section */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Análise de Gastos</h3>
              <div className="h-[300px] w-full">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    Sem dados para este período
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Transações Recentes</h3>
                  <div className="flex gap-1 mt-2 bg-slate-100 p-1 rounded-lg w-fit">
                    <button 
                      onClick={() => setTypeFilter('all')}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        typeFilter === 'all' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Todas
                    </button>
                    <button 
                      onClick={() => setTypeFilter('income')}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        typeFilter === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Receitas
                    </button>
                    <button 
                      onClick={() => setTypeFilter('expense')}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        typeFilter === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Despesas
                    </button>
                  </div>
                </div>

                <div className="flex-1 max-w-xs relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Buscar transação..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200 transition-all font-medium"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Importar</span>
                  </button>
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Nova</span>
                  </button>
                </div>
              </div>
              
              <TransactionList 
                transactions={displayTransactions} 
                categories={allCategories}
                onDelete={handleDeleteTransaction} 
                onEdit={setEditingTransaction}
              />
            </div>
          </div>

          {/* Sidebar Section */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Fluxo de Caixa Diário</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyBalanceData}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Saldo']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorBalance)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Distribuição de Despesas</h3>
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
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    Nenhuma despesa registrada
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {categoryData.slice(0, 4).map((cat, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-600">{cat.name}</span>
                    </div>
                    <span className="font-medium">${cat.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Orçamentos do Mês</h3>
                <button 
                  onClick={() => setShowBudgetModal(true)}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  Configurar
                </button>
              </div>
              
              {budgetProgress.length === 0 ? (
                <div className="text-center py-6">
                  <PieChartIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Nenhum orçamento definido para este mês.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {budgetProgress.map((budget) => (
                    <div key={budget.id} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{budget.category}</p>
                          <p className="text-xs text-slate-500">
                            R${budget.spent.toFixed(2)} de R${budget.amount.toFixed(2)}
                          </p>
                        </div>
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-full",
                          budget.percent >= 100 ? "bg-rose-100 text-rose-600" : 
                          budget.percent >= 80 ? "bg-amber-100 text-amber-600" : 
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          {Math.round(budget.percent)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
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

            <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="text-lg font-semibold mb-2">Dica Financeira</h3>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  "A melhor maneira de economizar dinheiro é parar de tentar impressionar pessoas que não se importam com você. Foque no seu eu do futuro."
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 opacity-10">
                <TrendingUp className="w-24 h-24" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-40">
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center gap-1 text-indigo-600"
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-medium">Início</span>
        </button>
        <button 
          onClick={() => setShowAccountModal(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600"
        >
          <CreditCard className="w-6 h-6" />
          <span className="text-[10px] font-medium">Contas</span>
        </button>
        <div className="relative -top-8">
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-200 border-4 border-slate-50"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
        <button 
          onClick={() => setShowBudgetModal(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600"
        >
          <PieChartIcon className="w-6 h-6" />
          <span className="text-[10px] font-medium">Metas</span>
        </button>
        <button 
          onClick={() => setShowSettingsModal(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600"
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-medium">Ajustes</span>
        </button>
      </div>

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
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
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
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
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
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
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
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden"
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
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden"
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
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-10 overflow-hidden"
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
                  onAdd={handleAddCategory}
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
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden"
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
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Resetar Dados?</h2>
                <p className="text-slate-500 mb-8">
                  Esta ação irá excluir **todas** as suas transações de receita e despesa permanentemente. As contas e categorias serão mantidas.
                </p>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleResetData}
                    disabled={isResetting}
                    className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
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
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-400 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center relative z-10"
      >
        <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">FluxiaFinance</h1>
        <p className="text-slate-500 mb-8">Assuma o controle de sua vida financeira hoje. Simples, seguro e inteligente.</p>
        
        <button 
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-3 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-indigo-100 transition-all"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continuar com Google
        </button>
        
        <p className="mt-8 text-xs text-slate-400">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </motion.div>
    </div>
  );
}

function SettingsManager({ userProfile, onUpdateProfile, onResetData }: { userProfile: any, onUpdateProfile: (data: any) => void, onResetData: () => void }) {
  const [name, setName] = useState(userProfile?.displayName || '');
  const [reminderDays, setReminderDays] = useState(userProfile?.reminderDaysBefore || 3);

  useEffect(() => {
    if (userProfile?.displayName) {
      setName(userProfile.displayName);
    }
    if (userProfile?.reminderDaysBefore !== undefined) {
      setReminderDays(userProfile.reminderDaysBefore);
    }
  }, [userProfile]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Perfil</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">Como quer ser chamado?</label>
            <div className="flex gap-2">
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button 
                onClick={() => onUpdateProfile({ displayName: name })}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
              >
                Salvar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">Lembrete de contas (dias antes do vencimento)</label>
            <div className="flex gap-2">
              <input 
                type="number"
                min="1"
                max="30"
                value={reminderDays}
                onChange={(e) => setReminderDays(parseInt(e.target.value) || 1)}
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button 
                onClick={() => onUpdateProfile({ reminderDaysBefore: reminderDays })}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100">
        <h3 className="text-sm font-semibold text-rose-600 uppercase tracking-wider mb-4">Zona de Perigo</h3>
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Resetar Lançamentos</h4>
              <p className="text-xs text-rose-700 mt-1">
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

      <div className="pt-6 border-t border-slate-100 text-center">
        <p className="text-[10px] text-slate-400">Versão 1.2.0 • FluxiaFinance</p>
      </div>
    </div>
  );
}

function SummaryCard({ title, amount, icon, color, trend }: { title: string, amount: number, icon: React.ReactNode, color: 'indigo' | 'emerald' | 'rose', trend?: string }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600'
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-xl", colors[color])}>
          {icon}
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded-full",
            trend.startsWith('+') ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          )}>
            {trend}
          </span>
        )}
      </div>
      <h4 className="text-slate-500 text-sm font-medium mb-1">{title}</h4>
      <p className="text-2xl font-bold text-slate-900">
        ${(Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function TransactionList({ transactions, categories, onDelete, onEdit }: { transactions: Transaction[], categories: Category[], onDelete: (id: string) => void, onEdit: (tx: Transaction) => void }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-500">Nenhuma transação encontrada para este período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => {
        const purchaseDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        const dueDate = tx.dueDate instanceof Timestamp ? tx.dueDate.toDate() : (tx.dueDate ? new Date(tx.dueDate) : null);
        const displayDate = (tx.paymentType === 'credit' && dueDate) ? dueDate : purchaseDate;
        const cat = categories.find(c => c.name === tx.category) || DEFAULT_CATEGORIES[7];
        
        return (
          <motion.div 
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={tx.id} 
            className="group flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color }}>
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-semibold text-slate-900 flex items-center gap-2">
                  {tx.description || tx.category}
                  {tx.isRecurring && (
                    <RefreshCcw className="w-3 h-3 text-indigo-500" />
                  )}
                  {tx.installment && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      {tx.installment}/{tx.totalInstallments}
                    </span>
                  )}
                  {tx.paymentType === 'credit' && (
                    <CreditCard className="w-3 h-3 text-slate-400" />
                  )}
                </h5>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{tx.category}</span>
                  <span>•</span>
                  <span className={cn(tx.paymentType === 'credit' && "text-indigo-600 font-medium")}>
                    {format(displayDate, 'MMM dd, yyyy')}
                    {tx.paymentType === 'credit' && dueDate && (
                      <span className="text-[10px] ml-1 opacity-70">(Vencimento)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-bold text-lg mr-2",
                tx.type === 'income' ? "text-emerald-600" : "text-rose-600"
              )}>
                {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
              </span>
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => onEdit(tx)}
                  className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(tx.id)}
                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function TransactionForm({ onSubmit, onCancel, categories: allCategories, accounts, initialData }: { onSubmit: (data: any) => Promise<void>, onCancel: () => void, categories: Category[], accounts: Account[], initialData?: Transaction }) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amount: initialData ? initialData.amount.toString() : '',
    type: initialData ? initialData.type : 'expense' as 'income' | 'expense' | 'transfer',
    paymentType: initialData ? initialData.paymentType : 'debit' as 'credit' | 'debit',
    category: initialData ? initialData.category : '',
    description: initialData ? initialData.description : '',
    accountId: initialData ? initialData.accountId : (accounts[0]?.id || ''),
    toAccountId: '',
    installments: initialData ? (initialData.totalInstallments?.toString() || '1') : '1',
    isRecurring: initialData ? (initialData.isRecurring || false) : false,
    frequency: initialData ? (initialData.frequency || 'monthly') : 'monthly' as 'weekly' | 'monthly' | 'yearly',
    recurringMonths: '12',
    date: initialData 
      ? format(initialData.date instanceof Timestamp ? initialData.date.toDate() : new Date(initialData.date), 'yyyy-MM-dd') 
      : format(new Date(), 'yyyy-MM-dd'),
    dueDate: initialData?.dueDate 
      ? format(initialData.dueDate instanceof Timestamp ? initialData.dueDate.toDate() : new Date(initialData.dueDate), 'yyyy-MM-dd') 
      : ''
  });

  const categories = useMemo(() => {
    return allCategories.filter(c => c.type === (formData.type === 'transfer' ? 'expense' : formData.type) || c.type === 'both');
  }, [allCategories, formData.type]);

  const selectedAccount = accounts.find(a => a.id === formData.accountId);

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

  // Update due date automatically for credit card transactions
  useEffect(() => {
    if (formData.paymentType === 'credit' && selectedAccount?.closingDay && selectedAccount?.dueDay) {
      // Only recalculate if the date or account changed
      const calculated = calculateDueDate(new Date(formData.date + 'T12:00:00'), selectedAccount.closingDay, selectedAccount.dueDay);
      const formattedCalculated = format(calculated, 'yyyy-MM-dd');
      
      if (formData.dueDate !== formattedCalculated) {
        setFormData(prev => ({ ...prev, dueDate: formattedCalculated }));
      }
    } else if (formData.paymentType !== 'credit') {
      if (formData.dueDate !== '') {
        setFormData(prev => ({ ...prev, dueDate: '' }));
      }
    }
  }, [formData.date, formData.accountId, formData.paymentType, selectedAccount?.closingDay, selectedAccount?.dueDay, formData.dueDate]);

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
          amount
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
      <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'expense', category: 'Alimentação' })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            formData.type === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Despesa
        </button>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'income', category: 'Salário' })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            formData.type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Receita
        </button>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, type: 'transfer', category: 'Transferência' })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            formData.type === 'transfer' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Transferência
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {formData.type === 'transfer' ? 'Conta de Origem' : 'Conta'}
          </label>
          <select
            value={formData.accountId}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        {formData.type === 'transfer' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conta de Destino</label>
            <select
              required
              value={formData.toAccountId}
              onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Selecione a conta</option>
              {accounts.filter(a => a.id !== formData.accountId).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Pagamento</label>
            <select
              value={formData.paymentType}
              onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as any })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="debit">Débito / Dinheiro</option>
              {(selectedAccount?.type === 'credit' || selectedAccount?.type === 'hybrid') && <option value="credit">Cartão de Crédito</option>}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
            <input
              required
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="0,00"
            />
          </div>
        </div>
        {formData.paymentType === 'credit' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
            <input
              type="number"
              min="1"
              max="48"
              value={formData.installments}
              onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
          <input
            required
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          {formData.paymentType === 'credit' && (
            <div className="mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <label className="block text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Vencimento da Fatura
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-[10px] text-indigo-500 mt-1">
                Calculado automaticamente, mas você pode ajustar se necessário.
              </p>
            </div>
          )}
        </div>
      </div>

      {formData.paymentType !== 'credit' && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isRecurring}
              onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700">Repetir transação</span>
          </label>

          {formData.isRecurring && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Frequência</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                >
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Repetir por (vezes)</label>
                <input
                  type="number"
                  min="2"
                  max="60"
                  value={formData.recurringMonths}
                  onChange={(e) => setFormData({ ...formData, recurringMonths: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Opcional)</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="O que foi isso?"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed",
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
    initialBalance: 0,
    initialBalanceDate: format(new Date(), 'yyyy-MM-dd'),
    closingDay: 5,
    dueDay: 15,
    color: '#6366f1'
  });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

  const resetForm = () => {
    setEditingId(null);
    setNewAcc({ 
      name: '', 
      type: 'checking', 
      balance: 0, 
      initialBalance: 0,
      initialBalanceDate: format(new Date(), 'yyyy-MM-dd'),
      closingDay: 5, 
      dueDay: 15, 
      color: '#6366f1' 
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          {editingId ? 'Editar Conta' : 'Adicionar Nova Conta'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
            <input 
              type="text"
              value={newAcc.name}
              onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex: Conta Corrente"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
            <select
              value={newAcc.type}
              onChange={(e) => setNewAcc({ ...newAcc, type: e.target.value as any })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="checking">Corrente</option>
              <option value="savings">Poupança</option>
              <option value="credit">Cartão de Crédito</option>
              <option value="hybrid">Híbrida (Corrente + Cartão)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Saldo Inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
              <input 
                type="number"
                step="0.01"
                value={newAcc.initialBalance}
                onChange={(e) => setNewAcc({ ...newAcc, initialBalance: parseFloat(e.target.value) || 0 })}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0,00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data do Saldo Inicial</label>
            <input 
              type="date"
              value={newAcc.initialBalanceDate}
              onChange={(e) => setNewAcc({ ...newAcc, initialBalanceDate: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {(newAcc.type === 'credit' || newAcc.type === 'hybrid') && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Dia de Fechamento</label>
              <input 
                type="number"
                min="1"
                max="31"
                value={isNaN(newAcc.closingDay) ? '' : newAcc.closingDay}
                onChange={(e) => setNewAcc({ ...newAcc, closingDay: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Dia de Vencimento</label>
              <input 
                type="number"
                min="1"
                max="31"
                value={isNaN(newAcc.dueDay) ? '' : newAcc.dueDay}
                onChange={(e) => setNewAcc({ ...newAcc, dueDay: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
        
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-500 mb-2">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewAcc({ ...newAcc, color: c })}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  newAcc.color === c ? "border-slate-900 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {editingId && (
            <button
              onClick={resetForm}
              className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg font-semibold text-sm hover:bg-slate-300 transition-all"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => {
              if (newAcc.name) {
                const data = {
                  ...newAcc,
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
        <h3 className="text-sm font-semibold text-slate-700">Suas Contas</h3>
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: acc.color }}>
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{acc.name}</p>
                <p className="text-xs text-slate-500 capitalize">
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
                    initialBalance: acc.initialBalance || 0,
                    initialBalanceDate: format(initialDate, 'yyyy-MM-dd'),
                    closingDay: acc.closingDay || 5,
                    dueDay: acc.dueDay || 15,
                    color: acc.color
                  });
                }}
                className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onDelete(acc.id)}
                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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

function CategoryManager({ customCategories, onAdd, onDelete }: { customCategories: Category[], onAdd: (data: any) => void, onDelete: (id: string) => void }) {
  const [newCat, setNewCat] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense' | 'both',
    color: '#6366f1',
    icon: 'Tag'
  });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

  return (
    <div className="space-y-8">
      {/* Add Category Form */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Adicionar Categoria Personalizada</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
            <input 
              type="text"
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nome da categoria"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
            <select
              value={newCat.type}
              onChange={(e) => setNewCat({ ...newCat, type: e.target.value as any })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
              <option value="both">Ambos</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-500 mb-2">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewCat({ ...newCat, color: c })}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  newCat.color === c ? "border-slate-900 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            if (newCat.name) {
              onAdd(newCat);
              setNewCat({ name: '', type: 'expense', color: '#6366f1', icon: 'Tag' });
            }
          }}
          className="mt-6 w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-all"
        >
          Adicionar Categoria
        </button>
      </div>

      {/* Custom Categories List */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Suas Categorias Personalizadas</h3>
        {customCategories.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Nenhuma categoria personalizada ainda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {customCategories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{cat.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{cat.type === 'expense' ? 'Despesa' : cat.type === 'income' ? 'Receita' : 'Ambos'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onDelete(cat.id)}
                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Categories (Read-only) */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Categorias Padrão</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DEFAULT_CATEGORIES.map(cat => (
            <div key={cat.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg opacity-60">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: cat.color }}>
                <Tag className="w-3 h-3" />
              </div>
              <span className="text-xs font-medium text-slate-600">{cat.name}</span>
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

  const currentBudgets = budgets.filter(b => b.month === currentMonth);

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Definir Orçamento para {format(parseISO(currentMonth + "-01"), 'MMMM yyyy', { locale: undefined })}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
            <select
              value={newBudget.category}
              onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Valor Limite (R$)</label>
            <input 
              type="number"
              value={newBudget.amount}
              onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
        </div>
        <button
          onClick={() => {
            if (newBudget.category && newBudget.amount) {
              onSave(newBudget.category, parseFloat(newBudget.amount));
              setNewBudget({ ...newBudget, amount: '' });
            }
          }}
          className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-all"
        >
          Salvar Orçamento
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Orçamentos Ativos</h3>
        {currentBudgets.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Nenhum orçamento definido para este mês.</p>
        ) : (
          <div className="space-y-3">
            {currentBudgets.map(budget => {
              const cat = categories.find(c => c.name === budget.category);
              return (
                <div key={budget.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat?.color || '#64748b' }}>
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{budget.category}</p>
                      <p className="text-xs text-slate-500">Limite: R${budget.amount.toFixed(2)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDelete(budget.id)}
                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
        <p className="text-sm text-slate-500">Use nosso modelo para garantir que os dados sejam importados corretamente.</p>
        <button 
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-semibold bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Baixar Modelo</span>
        </button>
      </div>

      <div className="bg-slate-50 p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center">
        <input 
          type="file" 
          accept=".csv, .xlsx, .xls" 
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
            <RefreshCcw className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Clique para selecionar ou arraste o arquivo</p>
            <p className="text-sm text-slate-500 mt-1">Suporta CSV, XLSX e XLS</p>
          </div>
        </label>
        {file && <p className="mt-4 text-sm font-medium text-indigo-600">{file.name}</p>}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl">
          {error}
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">Prévia ({preview.length} linhas)</h3>
            <p className="text-xs text-slate-500">Certifique-se que as colunas são: data, valor, tipo, categoria, descricao, conta</p>
          </div>
          <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {Object.keys(preview[0]).map(key => (
                    <th key={key} className="px-4 py-2 font-semibold text-slate-600">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    {Object.values(row).map((val: any, j) => (
                      <th key={j} className="px-4 py-2 font-normal text-slate-500">{String(val)}</th>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && <p className="p-2 text-center text-xs text-slate-400">E mais {preview.length - 5} linhas...</p>}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirmImport}
          disabled={isProcessing || preview.length === 0}
          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Importando...' : 'Confirmar Importação'}
        </button>
      </div>
    </div>
  );
}
