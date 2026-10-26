const fs = require('fs');

const p = 'C:\\Users\\Usuario\\Documents\\Financas-APP-Google\\src\\App.tsx';
let c = fs.readFileSync(p, 'utf8');

// 1. handleDeleteTransaction
const oldDeleteTx = `const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx?.groupId) {
      setTransactionToDelete(tx);
    } else {
      try {
        await deleteDoc(doc(db, 'transactions', id));
        setToast({ message: "Transação excluída com sucesso!", type: 'success' });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, \`transactions/\${id}\`);
      }
    }
  };`;

const newDeleteTx = `const handleDeleteTransaction = async (id: string) => {
    if (isTestMode) {
      localStorageService.deleteTransaction(id);
      setTransactions(localStorageService.getTransactions());
      setToast({ message: "Transação excluída com sucesso!", type: 'success' });
      return;
    }
    const tx = transactions.find(t => t.id === id);
    if (tx?.groupId) {
      setTransactionToDelete(tx);
    } else {
      try {
        await deleteDoc(doc(db, 'transactions', id));
        setToast({ message: "Transação excluída com sucesso!", type: 'success' });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, \`transactions/\${id}\`);
      }
    }
  };`;

if (c.includes(oldDeleteTx)) {
  c = c.replace(oldDeleteTx, newDeleteTx);
  console.log('✅ handleDeleteTransaction updated');
} else {
  console.log('⚠️ handleDeleteTransaction not found');
}

// 2. handleAddCategory
const oldAddCat = `const handleAddCategory = async (data: Omit<Category, 'id'>) => {
    if (!user) return;`;
const newAddCat = `const handleAddCategory = async (data: Omit<Category, 'id'>) => {
    if (isTestMode) {
      localStorageService.addCategory(data);
      setCustomCategories(localStorageService.getCategories());
      return;
    }
    if (!user) return;`;
if (c.includes(oldAddCat)) {
  c = c.replace(oldAddCat, newAddCat);
  console.log('✅ handleAddCategory updated');
} else {
  console.log('⚠️ handleAddCategory not found');
}

// 3. handleDeleteCategory
const oldDelCat = `const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));`;
const newDelCat = `const handleDeleteCategory = async (id: string) => {
    if (isTestMode) {
      localStorageService.deleteCategory(id);
      setCustomCategories(localStorageService.getCategories());
      return;
    }
    try {
      await deleteDoc(doc(db, 'categories', id));`;
if (c.includes(oldDelCat)) {
  c = c.replace(oldDelCat, newDelCat);
  console.log('✅ handleDeleteCategory updated');
} else {
  console.log('⚠️ handleDeleteCategory not found');
}

// 4. handleAddBudget
const oldAddBudget = `const handleAddBudget = async (data: Omit<Budget, 'id'>) => {
    if (!user) return;`;
const newAddBudget = `const handleAddBudget = async (data: Omit<Budget, 'id'>) => {
    if (isTestMode) {
      localStorageService.addBudget(data);
      setBudgets(localStorageService.getBudgets());
      return;
    }
    if (!user) return;`;
if (c.includes(oldAddBudget)) {
  c = c.replace(oldAddBudget, newAddBudget);
  console.log('✅ handleAddBudget updated');
} else {
  console.log('⚠️ handleAddBudget not found');
}

// 5. handleDeleteBudget
const oldDelBudget = `const handleDeleteBudget = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'budgets', id));`;
const newDelBudget = `const handleDeleteBudget = async (id: string) => {
    if (isTestMode) {
      localStorageService.deleteBudget(id);
      setBudgets(localStorageService.getBudgets());
      return;
    }
    try {
      await deleteDoc(doc(db, 'budgets', id));`;
if (c.includes(oldDelBudget)) {
  c = c.replace(oldDelBudget, newDelBudget);
  console.log('✅ handleDeleteBudget updated');
} else {
  console.log('⚠️ handleDeleteBudget not found');
}

fs.writeFileSync(p, c);
console.log('✅ File saved');