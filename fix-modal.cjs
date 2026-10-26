const fs = require('fs');

const p = 'C:\\Users\\Usuario\\Documents\\Financas-APP-Google\\src\\components\\FaturaImportModal.tsx';
let c = fs.readFileSync(p, 'utf8');

// 1. Replace the onClick handler
const oldHandler = 'onClick={onClose}';
const newHandler = `onClick={() => {
            if (step === 'preview') setStep('account');
            else if (step === 'account') setStep('select');
            else onClose();
          }}`;

if (c.includes(oldHandler)) {
  c = c.replace(oldHandler, newHandler);
  console.log('✅ onClick handler updated');
} else {
  console.log('⚠️ onClick handler not found');
}

// 2. Replace the label
const oldLabel = `{step === 'preview' ? 'Cancela' : 'Fechar'}`;
const newLabel = `{step === 'preview' ? 'Voltar' : step === 'account' ? 'Voltar' : 'Fechar'}`;

if (c.includes(oldLabel)) {
  c = c.replace(oldLabel, newLabel);
  console.log('✅ Label updated');
} else {
  console.log('⚠️ Label not found');
}

fs.writeFileSync(p, c);
console.log('✅ File saved');