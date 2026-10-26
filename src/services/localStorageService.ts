/**
 * Serviço de armazenamento local para o Modo Teste.
 *
 * Simula o Firestore usando `localStorage` para permitir testes
 * sem precisar de uma conta real do Firebase.
 *
 * Dados salvos:
 * - Contas (accounts)
 * - Transações (transactions)
 * - Categorias customizadas (categories)
 * - Orçamentos (budgets)
 * - Perfil do usuário (userProfile)
 */

const STORAGE_KEY = 'vidi_test_data_v1';

interface LocalData {
  accounts: any[];
  transactions: any[];
  categories: any[];
  budgets: any[];
  userProfile: any;
}

/** Carrega os dados do localStorage ou retorna dados iniciais */
function loadData(): LocalData {
  if (typeof window === 'undefined') return getInitialData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Erro ao carregar dados locais:', e);
  }
  return getInitialData();
}

/** Salva os dados no localStorage */
function saveData(data: LocalData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Erro ao salvar dados locais:', e);
  }
}

/** Dados iniciais (contas de exemplo para teste) */
function getInitialData(): LocalData {
  return {
    accounts: [
      {
        id: 'acc-1',
        userId: 'test-user-001',
        name: 'Cartão BTG Black',
        type: 'hybrid',
        balance: 0,
        initialBalance: 0,
        initialBalanceDate: null,
        closingDay: 28,
        dueDay: 5,
        color: '#8b5cf6',
        isFavorite: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'acc-2',
        userId: 'test-user-001',
        name: 'Nubank Platinum',
        type: 'credit',
        balance: 0,
        initialBalance: 0,
        initialBalanceDate: null,
        closingDay: 25,
        dueDay: 10,
        color: '#ec4899',
        isFavorite: false,
        createdAt: new Date().toISOString(),
      },
    ],
    transactions: [],
    categories: [
      { id: 'cat-1', name: 'Alimentação', icon: 'Utensils', color: '#f59e0b', type: 'expense' },
      { id: 'cat-2', name: 'Transporte', icon: 'Car', color: '#6366f1', type: 'expense' },
      { id: 'cat-3', name: 'Compras', icon: 'ShoppingBag', color: '#8b5cf6', type: 'expense' },
      { id: 'cat-4', name: 'Entretenimento', icon: 'Tv', color: '#ec4899', type: 'expense' },
      { id: 'cat-5', name: 'Saúde', icon: 'Heart', color: '#ef4444', type: 'expense' },
      { id: 'cat-6', name: 'Encargos', icon: 'AlertTriangle', color: '#f97316', type: 'expense' },
      { id: 'cat-7', name: 'Outros', icon: 'MoreHorizontal', color: '#6b7280', type: 'both' },
    ],
    budgets: [],
    userProfile: {
      uid: 'test-user-001',
      email: 'teste@exemplo.com',
      displayName: 'teste',
      currency: 'BRL',
      reminderDaysBefore: 3,
      reminderTime: '09:00',
    },
  };
}

/** Gera um ID único para novos documentos */
function generateId(): string {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export const localStorageService = {
  /** Carrega todos os dados */
  get data(): LocalData {
    return loadData();
  },

  /** Salva todos os dados */
  set data(value: LocalData) {
    saveData(value);
  },

  /** Limpa todos os dados (para reset) */
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },

  /** Contas */
  getAccounts(): any[] {
    return loadData().accounts;
  },

  addAccount(account: any): any {
    const data = loadData();
    const newAccount = { ...account, id: generateId(), createdAt: new Date().toISOString() };
    data.accounts.push(newAccount);
    saveData(data);
    return newAccount;
  },

  updateAccount(id: string, updates: any): void {
    const data = loadData();
    const idx = data.accounts.findIndex(a => a.id === id);
    if (idx >= 0) {
      data.accounts[idx] = { ...data.accounts[idx], ...updates };
      saveData(data);
    }
  },

  deleteAccount(id: string): void {
    const data = loadData();
    data.accounts = data.accounts.filter(a => a.id !== id);
    saveData(data);
  },

  /** Transações */
  getTransactions(): any[] {
    return loadData().transactions;
  },

  addTransaction(tx: any): any {
    const data = loadData();
    const newTx = { ...tx, id: generateId() };
    data.transactions.push(newTx);
    saveData(data);
    return newTx;
  },

  addTransactions(txs: any[]): void {
    const data = loadData();
    txs.forEach(tx => {
      data.transactions.push({ ...tx, id: generateId() });
    });
    saveData(data);
  },

  updateTransaction(id: string, updates: any): void {
    const data = loadData();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx >= 0) {
      data.transactions[idx] = { ...data.transactions[idx], ...updates };
      saveData(data);
    }
  },

  deleteTransaction(id: string): void {
    const data = loadData();
    data.transactions = data.transactions.filter(t => t.id !== id);
    saveData(data);
  },

  /** Categorias */
  getCategories(): any[] {
    return loadData().categories;
  },

  addCategory(cat: any): any {
    const data = loadData();
    const newCat = { ...cat, id: generateId() };
    data.categories.push(newCat);
    saveData(data);
    return newCat;
  },

  deleteCategory(id: string): void {
    const data = loadData();
    data.categories = data.categories.filter(c => c.id !== id);
    saveData(data);
  },

  /** Orçamentos */
  getBudgets(): any[] {
    return loadData().budgets;
  },

  addBudget(budget: any): any {
    const data = loadData();
    const newBudget = { ...budget, id: generateId() };
    data.budgets.push(newBudget);
    saveData(data);
    return newBudget;
  },

  deleteBudget(id: string): void {
    const data = loadData();
    data.budgets = data.budgets.filter(b => b.id !== id);
    saveData(data);
  },

  /** Perfil */
  getUserProfile(): any {
    return loadData().userProfile;
  },

  updateUserProfile(updates: any): void {
    const data = loadData();
    data.userProfile = { ...data.userProfile, ...updates };
    saveData(data);
  },
};