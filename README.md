# Vidi - Financas APP Google

Aplicação web progressiva (PWA) de gestão financeira pessoal desenvolvida com React, TypeScript, Tailwind CSS e Firebase.

## 🚀 Funcionalidades

- **Autenticação com Google**: Login seguro integrado com Firebase Auth e controle de acessos via Firestore.
- **Gestão de Contas**: Suporte a Contas Correntes, Poupança, Cartões de Crédito e Contas Híbridas.
- **Controle de Transações**:
  - Receitas, Despesas e Transferências entre contas.
  - Compras parceladas e transações recorrentes (semanal, mensal, anual).
  - Cálculo automático de faturas e vencimento de cartão de crédito com base no dia de fechamento.
  - Divisão de gastos (Splits de categorias).
- **Orçamentos e Categorias**:
  - Categorias e subcategorias personalizadas.
  - Definição de limites de orçamento mensais por categoria.
- **Dashboard e Análises**:
  - Relatórios visuais com gráficos interativos (Recharts).
  - Fluxo de caixa diário e comparativos com períodos anteriores.
  - Modo Privado para ocultar valores (`R$ ••••`).
- **PWA & Notificações**:
  - Suporte a instalação como App (iOS/Android/Desktop).
  - Suporte offline com sincronização automática do Firestore.
  - Lembretes e notificações de contas a vencer.
- **Exportação de Dados**: Exportação de transações em formato CSV.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons, Recharts
- **Backend / BaaS**: Firebase (Authentication, Firestore Database, IndexedDB Persistence)
- **Deploy**: Vercel

## ⚙️ Instalação e Execução Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/Gamml96/Financas-APP-Google.git
   cd Financas-APP-Google
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Para gerar a versão de produção:
   ```bash
   npm run build
   ```
