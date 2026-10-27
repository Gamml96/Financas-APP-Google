const fs = require('fs');

const p = 'C:\\Users\\Usuario\\Documents\\Financas-APP-Google\\src\\App.tsx';
let c = fs.readFileSync(p, 'utf8');

// Remover todos os blocos "if (isTestMode) { ... }" e seus returns
// Padrão: if (isTestMode) { ... return; }

// 1. handleUpdateAccount
c = c.replace(
  `const handleUpdateAccount = async (id: string, data: Partial<Account>) => {
    if (isTestMode) {
      localStorageService.updateAccount(id, data);
      setAccounts(localStorageService.getAccounts());
      return;
    }
    if (!user) return;`,
  `const handleUpdateAccount = async (id: string, data: Partial<Account>) => {
    if (!user) return;`
);

// 2. handleDeleteAccount
c = c.replace(
  `const handleDeleteAccount = async (id: string) => {
    if (isTestMode) {
      localStorageService.deleteAccount(id);
      setAccounts(localStorageService.getAccounts());
      return;
    }
    try {`,
  `const handleDeleteAccount = async (id: string) => {
    try {`
);

// 3. handleUpdateTransaction
c = c.replace(
  `const handleUpdateTransaction = async (data: any) => {
    if (isTestMode) {
      localStorageService.updateTransaction(data.id, data);
      setTransactions(localStorageService.getTransactions());
      return;
    }
    if (!user || !editingTransaction) return;`,
  `const handleUpdateTransaction = async (data: any) => {
    if (!user || !editingTransaction) return;`
);

// 4. handleDeleteTransaction
c = c.replace(
  `const handleDeleteTransaction = async (id: string) => {
    if (isTestMode) {
      localStorageService.deleteTransaction(id);
      setTransactions(localStorageService.getTransactions());
      setToast({ message: "Transação excluída com sucesso!", type: 'success' });
      return;
    }
    const tx = transactions.find(t => t.id === id);`,
  `const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);`
);

// 5. handleAddCategory
c = c.replace(
  `const handleAddCategory = async (data: Omit<Category, 'id'>) => {
    if (isTestMode) {
      localStorageService.addCategory(data);
      setCustomCategories(localStorageService.getCategories());
      return;
    }
    if (!user) return;`,
  `const handleAddCategory = async (data: Omit<Category, 'id'>) => {
    if (!user) return;`
);

// 6. handleDeleteCategory
c = c.replace(
  `const handleDeleteCategory = async (id: string) => {
    if (isTestMode) {
      localStorageService.deleteCategory(id);
      setCustomCategories(localStorageService.getCategories());
      return;
    }
    try {`,
  `const handleDeleteCategory = async (id: string) => {
    try {`
);

// 7. handleImportFatura - remover bloco de Teste
c = c.replace(
  `const handleImportFatura = async (extractedTransactions: any[], selectedAccountId?: string) => {
    if (isTestMode) {
      // Modo Teste: salva no localStorage
      const accountId = selectedAccountId || accounts.find(acc => acc.type === 'credit' || acc.type === 'hybrid')?.id;
      if (!accountId) throw new Error('Nenhuma conta encontrada.');

      const creditAccount = accounts.find(acc => acc.id === accountId);
      const txs = extractedTransactions.map((tx: any) => {
        const purchaseDate = new Date(tx.date + 'T00:00:00');
        let dueDate = purchaseDate;
        if (creditAccount && (creditAccount.type === 'credit' || creditAccount.type === 'hybrid') && creditAccount.closingDay && creditAccount.dueDay) {
          dueDate = calculateDueDate(purchaseDate, creditAccount.closingDay, creditAccount.dueDay);
        }
        const isRefund = tx.type === 'refund';
        const hasInstallment = tx.installmentNumber && tx.installmentTotal && tx.installmentTotal > 1;
        const base: any = {
          accountId,
          amount: Math.abs(Number(tx.amount) || 0),
          type: isRefund ? 'income' : 'expense',
          paymentType: 'credit',
          category: isRefund ? 'Outros' : (tx.category || 'Outros'),
          description: String(tx.description || 'Importado'),
          date: Timestamp.fromDate(purchaseDate),
          dueDate: Timestamp.fromDate(dueDate),
          userId: user?.uid || 'test-user-001',
          createdAt: Timestamp.now(),
        };
        if (hasInstallment) {
          base.installment = Number(tx.installmentNumber);
          base.totalInstallments = Number(tx.installmentTotal);
          base.groupId = hashGroupId(tx);
        }
        return base;
      });
      localStorageService.addTransactions(txs);

      // ✅ Toast de confirmação
      setToast({
        message: \`✅ \${txs.length} lançamento(s) importado(s) com sucesso!\`,
        type: 'success'
      });

      // Atualiza o estado imediatamente
      setTransactions(localStorageService.getTransactions());
      return;
    }

    if (!user) return;`,
  `const handleImportFatura = async (extractedTransactions: any[], selectedAccountId?: string) => {
    if (!user) return;`
);

// Remover importações não usadas
c = c.replace(
  `import { useTestMode, createTestUser } from './hooks/useTestMode';
import { useLocalCollection, useLocalUserProfile } from './hooks/useLocalData';
import { localStorageService } from './services/localStorageService';
`,
  ``
);

// Remover referência ao toggleTestMode na navbar
c = c.replace(
  `const { isTestMode, toggleTestMode } = useTestMode();\n  `,
  ``
);

// Remover botão de Modo Teste na navbar
c = c.replace(
  `              <button 
                onClick={toggleTestMode}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isTestMode
                    ? "text-amber-600 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                )}
                title={isTestMode ? "Desativar Modo Teste" : "Ativar Modo Teste (bypass Firebase)"}
              >
                {isTestMode ? <AlertTriangle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </button>
              `,
  ``
);

// Remover badge "TESTE" do perfil
c = c.replace(
  `{isTestMode && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                      TESTE
                    </span>
                  )}`,
  ``
);

fs.writeFileSync(p, c);
console.log('✅ Modo Teste removido com sucesso');