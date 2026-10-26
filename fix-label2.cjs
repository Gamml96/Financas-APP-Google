const fs = require('fs');

const p = 'C:\\Users\\Usuario\\Documents\\Financas-APP-Google\\src\\components\\FaturaImportModal.tsx';
let c = fs.readFileSync(p, 'utf8');

// Replace the label on line 554
const oldLabel = "{step === 'preview' ? 'Cancela' : 'Fechar'}";
const newLabel = "{step === 'preview' ? 'Voltar' : step === 'account' ? 'Voltar' : 'Fechar'}";

if (c.includes(oldLabel)) {
  c = c.replace(oldLabel, newLabel);
  console.log('✅ Label updated');
} else {
  // Try alternative: the file might have different quote characters
  // Let's find the line and replace it
  const lines = c.split('\n');
  const idx = lines.findIndex(l => l.includes('Cancela') && l.includes('Fechar'));
  if (idx >= 0) {
    lines[idx] = "          {step === 'preview' ? 'Voltar' : step === 'account' ? 'Voltar' : 'Fechar'}";
    c = lines.join('\n');
    console.log('✅ Label updated via line replacement');
  } else {
    console.log('⚠️ Label not found');
  }
}

fs.writeFileSync(p, c);
console.log('✅ File saved');