const fs = require('fs');

const p = 'C:\\Users\\Usuario\\Documents\\Financas-APP-Google\\src\\App.tsx';
let c = fs.readFileSync(p, 'utf8');

// Remover todas as linhas que contêm "if (isTestMode)" e seus blocos de return
// Usando regex para remover blocos if(isTestMode) { ... }

// Padrão 1: if (isTestMode) { ... return; }
c = c.replace(/if \(isTestMode\) \{[\s\S]*?return;\s*\}/g, '');

// Padrão 2: if (isTestMode) { ... } sem return (mas com side effects)
c = c.replace(/if \(isTestMode\) \{[\s\S]*?\n\s*\}/g, '');

// Remover referências soltas a isTestMode, localStorageService, toggleTestMode
c = c.replace(/isTestMode/g, 'false'); // Substitui isTestMode por false
c = c.replace(/localStorageService\.[a-zA-Z]+\([^)]*\)/g, ''); // Remove chamadas do localStorageService
c = c.replace(/toggleTestMode/g, '() => {}'); // Remove toggleTestMode

// Limpar linhas em branco duplas
c = c.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(p, c);
console.log('✅ Limpeza automática concluída');