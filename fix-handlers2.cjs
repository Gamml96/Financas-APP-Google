const fs = require('fs');

const p = 'C:\\Users\\Usuario\\Documents\\Financas-APP-Google\\src\\App.tsx';
let c = fs.readFileSync(p, 'utf8');

// Função para adicionar bypass no início de um handler
function addBypass(handlerName, bypassCode) {
  // Encontra a função pelo nome
  const regex = new RegExp(`(const ${handlerName} = async \\([^)]+\\) => \\{)\\s*`);
  const match = c.match(regex);
  if (match) {
    const replacement = `${match[1]}\n    if (isTestMode) {\n      ${bypassCode}\n      return;\n    }\n    `;
    c = c.replace(regex, replacement);
    console.log(`✅ ${handlerName} updated`);
    return true;
  }
  console.log(`⚠️ ${handlerName} not found`);
  return false;
}

// 1. handleDeleteTransaction
addBypass('handleDeleteTransaction',
  `localStorageService.deleteTransaction(id);
      setTransactions(localStorageService.getTransactions());
      setToast({ message: "Transação excluída com sucesso!", type: 'success' });`);

// 2. handleAddCategory
addBypass('handleAddCategory',
  `localStorageService.addCategory(data);
      setCustomCategories(localStorageService.getCategories());`);

// 3. handleDeleteCategory
addBypass('handleDeleteCategory',
  `localStorageService.deleteCategory(id);
      setCustomCategories(localStorageService.getCategories());`);

// 4. handleAddBudget
addBypass('handleAddBudget',
  `localStorageService.addBudget(data);
      setBudgets(localStorageService.getBudgets());`);

// 5. handleDeleteBudget
addBypass('handleDeleteBudget',
  `localStorageService.deleteBudget(id);
      setBudgets(localStorageService.getBudgets());`);

fs.writeFileSync(p, c);
console.log('✅ File saved');