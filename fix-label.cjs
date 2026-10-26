const fs = require('fs');

const p = 'C:\\Users\\Usuario\\Documents\\Financas-APP-Google\\src\\components\\FaturaImportModal.tsx';
let c = fs.readFileSync(p, 'utf8');

// Replace the label
const old = "{step === 'preview' ? 'Cancela' : 'Fechar'}";
const newStr = "{step === 'preview' ? 'Voltar' : step === 'account' ? 'Voltar' : 'Fechar'}";

if (c.includes(old)) {
  c = c.replace(old, newStr);
  console.log('✅ Label updated');
} else {
  console.log('⚠️ Label not found');
}

fs.writeFileSync(p, c);
console.log('✅ File saved');