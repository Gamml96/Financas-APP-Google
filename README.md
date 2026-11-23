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
- **API pública v1**: Chaves de acesso com escopos para bots e automações criarem, editarem e excluírem lançamentos (veja [API pública v1](#-api-pública-v1)).

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

## 🔌 API pública v1

API HTTP para bots e automações criarem, editarem e excluírem lançamentos em seu nome, sem compartilhar sua conta Google.

- **Base URL**: `https://financas-app-google.vercel.app/api/v1`
- **Formato**: JSON em todas as rotas.
- **Código**: `api/v1.ts` (função serverless única; o roteamento do subcaminho vem do rewrite em `vercel.json`).

### Criando uma chave

No app: **Ajustes → API para bots**. Escolha um nome e os escopos, e copie o token — ele é exibido **uma única vez**.

O token tem o formato `vidi_<keyId>_<secret>` e é guardado no Firestore apenas como **scrypt com salt**, nunca em texto puro.

Envie em qualquer requisição:

```http
Authorization: Bearer vidi_<keyId>_<secret>
```

`X-API-Key: <token>` também é aceito. Revogar uma chave em Ajustes invalida o acesso imediatamente (no request seguinte).

### Escopos

| Escopo | Permite |
|---|---|
| `transactions:write` | Criar lançamentos |
| `transactions:update` | Editar lançamentos (inclusive parcelas futuras) |
| `transactions:delete` | Excluir lançamentos (inclusive parcelas futuras de um grupo) |
| `transactions:read` | Consultar lançamentos |
| `accounts:read` | Listar contas (necessário para descobrir o `accountId`) |
| `categories:read` | Listar categorias válidas |

Ao criar a chave, o padrão é `transactions:write` + `accounts:read` + `categories:read`. Os escopos `transactions:update` e `transactions:delete` são **opcionais** e precisam ser marcados à parte: uma chave de bot criada só para lançar não consegue alterar nem apagar o histórico. É possível ter até **10 chaves ativas** por usuário.

### Rotas

| Método | Rota | Escopo |
|---|---|---|
| `GET` | `/health` | público |
| `GET` | `/` | público (índice com as rotas) |
| `GET` | `/me` | autenticado |
| `GET` | `/accounts` | `accounts:read` |
| `GET` | `/categories` | `categories:read` |
| `POST` | `/transactions` | `transactions:write` |
| `GET` | `/transactions` | `transactions:read` |
| `GET` | `/transactions/:id` | `transactions:read` |
| `PATCH` | `/transactions/:id` | `transactions:update` |
| `DELETE` | `/transactions/:id` | `transactions:delete` |
| `GET` | `/keys` | somente sessão do app |
| `POST` | `/keys` | somente sessão do app |
| `DELETE` | `/keys/:id` | somente sessão do app |

### Criar um lançamento

```bash
curl -X POST https://financas-app-google.vercel.app/api/v1/transactions \
  -H "Authorization: Bearer vidi_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-123" \
  -d '{
    "amount": 47.9,
    "description": "Padaria",
    "category": "Alimentação",
    "accountId": "ID_DA_CONTA",
    "externalId": "pedido-123"
  }'
```

Campos aceitos:

| Campo | Tipo | Detalhes |
|---|---|---|
| `amount` | number | **Obrigatório**, maior que zero (parcela, não o total) |
| `accountId` | string | **Obrigatório**, precisa pertencer ao dono da chave |
| `type` | string | `expense` (padrão) ou `income` |
| `category` | string | Padrão `Outros` |
| `description` | string | Padrão igual à categoria; máx. 200 caracteres |
| `paymentType` | string | `credit` ou `debit`; padrão `credit` em conta de crédito/híbrida, senão `debit` |
| `date` | string | `YYYY-MM-DD` no fuso `America/Sao_Paulo`; padrão hoje |
| `dueDate` | string | Padrão igual a `date`; em compra de crédito sem `dueDate` é calculado pelo fechamento/vencimento da conta |
| `installments` | number | 1 a 48; gera uma transação por mês com `groupId` e `installment`/`totalInstallments` |
| `externalId` | string | Identificador da origem, usado para deduplicar |

Resposta `201`:

```json
{
  "ok": true,
  "installments": 1,
  "totalAmount": 47.9,
  "transactions": [
    {
      "id": "abc123",
      "accountId": "ID_DA_CONTA",
      "amount": 47.9,
      "type": "expense",
      "paymentType": "debit",
      "category": "Alimentação",
      "description": "Padaria",
      "date": "2026-11-16T15:00:00.000Z",
      "dueDate": "2026-11-16T15:00:00.000Z",
      "externalId": "pedido-123",
      "source": "api"
    }
  ]
}
```

Lançamentos criados pela API recebem `source: "api"` e o `apiKeyId` que os originou.

### Editar um lançamento

```bash
curl -X PATCH "https://financas-app-google.vercel.app/api/v1/transactions/abc123" \
  -H "Authorization: Bearer vidi_..." \
  -H "Content-Type: application/json" \
  -d '{"amount": 52.5, "category": "Mercado"}'
```

Para corrigir também as parcelas seguintes do mesmo grupo:

```bash
curl -X PATCH "https://financas-app-google.vercel.app/api/v1/transactions/abc123?scope=future" \
  -H "Authorization: Bearer vidi_..." \
  -H "Content-Type: application/json" \
  -d '{"description": "Compra corrigida"}'
```

| Query | Detalhes |
|---|---|
| `scope` | `single` (padrão) edita só o lançamento; `future` edita ele e as parcelas seguintes do mesmo `groupId` |

Campos aceitos (todos opcionais, mas envie **ao menos um**):

| Campo | Tipo | Detalhes |
|---|---|---|
| `amount` | number | Maior que zero |
| `type` | string | `expense` ou `income` |
| `paymentType` | string | `credit` ou `debit`; validado contra o tipo da conta |
| `category` | string | Máx. 60 caracteres |
| `description` | string | Máx. 200 caracteres |
| `accountId` | string | Precisa pertencer ao dono da chave |
| `date` | string | `YYYY-MM-DD` no fuso `America/Sao_Paulo` |
| `dueDate` | string | `YYYY-MM-DD`; em compra de crédito sem `dueDate`, é recalculado pelo fechamento/vencimento quando a data muda |
| `isRecurring` | boolean | Marca o lançamento como recorrente |
| `frequency` | string | `weekly`, `monthly` ou `yearly` |

Comportamento:

- `scope=single` altera apenas o documento informado.
- `scope=future` replica a regra do app: aplica as mudanças ao lançamento e às parcelas seguintes do mesmo `groupId`, deslocando as datas pelo mesmo intervalo. Exige que o lançamento tenha `groupId` (senão `400`).
- Em compra de crédito, quando a data muda, o vencimento das parcelas futuras é recalculado pelo fechamento/vencimento da conta.
- Ao mudar a `category`, a correção é registrada em `userSettings.categoryMappings` (igual ao app), para as próximas importações de fatura.
- `userId`, `externalId`, `source`, `installment`, `totalInstallments` e `groupId` **não** são alteráveis.
- Lançamento de outro usuário responde `404`, e a conta de outro usuário responde `403`.
- `PATCH` é naturalmente idempotente: repetir a mesma requisição com a mesma `date` não desloca as datas de novo.

Resposta `200`:

```json
{
  "ok": true,
  "scope": "future",
  "updated": 4,
  "transactions": [
    { "id": "abc123", "amount": 52.5, "category": "Mercado", "date": "2026-11-16T15:00:00.000Z" }
  ]
}
```

### Excluir um lançamento

```bash
curl -X DELETE "https://financas-app-google.vercel.app/api/v1/transactions/abc123" \
  -H "Authorization: Bearer vidi_..."
```

Para excluir também as parcelas seguintes do mesmo grupo:

```bash
curl -X DELETE "https://financas-app-google.vercel.app/api/v1/transactions/abc123?scope=future" \
  -H "Authorization: Bearer vidi_..."
```

| Query | Detalhes |
|---|---|
| `scope` | `single` (padrão) exclui só o lançamento; `future` exclui ele e as parcelas seguintes do mesmo `groupId` e tipo com data ≥ a atual |

- `scope=future` replica a regra do app e exige que o lançamento tenha `groupId` (senão `400`).
- Lançamento de outro usuário responde `404`; id inexistente responde `404`.
- `DELETE` é naturalmente idempotente.
- **Não há "Desfazer"** via API — a exclusão é definitiva (no app, o "Desfazer" recria o documento preservando o mesmo id, mas um `DELETE` pela API não deixa backup). Use com cuidado.

Resposta `200`:

```json
{ "ok": true, "deleted": 1, "ids": ["abc123"] }
```

### Idempotência e deduplicação

- **`Idempotency-Key`** (header, 8–200 caracteres): se a mesma chave for repetida em até 24h, a resposta original é devolvida sem criar nada de novo (`Idempotent-Replay: true`). Enquanto a primeira requisição está em andamento, a repetição recebe `409 idempotency-in-progress`.
- **`externalId`**: se já existir um lançamento seu com esse valor, a API responde `200` com `duplicate: true` e o lançamento existente em `transactions`, em vez de duplicar.

Use os dois juntos em integrações: `externalId` protege contra reprocessar a mesma compra; `Idempotency-Key` protege contra retry de rede.

### Listar lançamentos

```bash
curl "https://financas-app-google.vercel.app/api/v1/transactions?limit=20&from=2026-11-01&to=2026-11-30" \
  -H "Authorization: Bearer vidi_..."
```

| Query | Detalhes |
|---|---|
| `limit` | 1 a 200 (padrão 50) |
| `cursor` | Valor de `nextCursor` da página anterior |
| `from` / `to` | `YYYY-MM-DD`, inclusivos, no fuso de São Paulo |
| `accountId` | Filtra por conta |
| `type` | `expense` ou `income` |

Resposta:

```json
{ "ok": true, "transactions": [], "nextCursor": "eyJtcyI6...", "hasMore": true }
```

### Limites e erros

- **Rate limit**: 60 requisições por minuto por chave. As respostas trazem `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset`; ao exceder, vem `429` com `Retry-After`.
- **Corpo**: máximo 32 KB (`413`).
- **Sem cache**: todas as respostas usam `Cache-Control: no-store` e `X-Content-Type-Options: nosniff`.
- **CORS**: liberado apenas para os domínios do app e `localhost`; bots não precisam de CORS.

Erros seguem o formato:

```json
{ "ok": false, "error": { "code": "invalid-request", "message": "O campo \"amount\" deve ser um número maior que zero." } }
```

| HTTP | Códigos comuns |
|---|---|
| `400` | `invalid-request`, `invalid-json`, `invalid-account` |
| `401` | `missing-credentials`, `invalid-key`, `invalid-token` |
| `403` | `insufficient-scope`, `forbidden`, `session-required` |
| `404` | `not-found` |
| `409` | `idempotency-in-progress`, `key-limit-reached` |
| `413` | `payload-too-large` |
| `429` | `rate-limited` |
| `500`/`503` | `server-misconfigured`, `auth-unavailable`, `internal-error` |

### Segurança

- Tokens nunca são gravados em texto puro (scrypt com salt por chave) e nunca voltam em nenhuma resposta.
- `apiKeys` e `apiIdempotency` são **inacessíveis pelo cliente** pelas regras do Firestore (default-deny), então hash, salt e contadores não vazam.
- Cada chave tem escopos próprios, limite de uso e revogação imediata; a lista em Ajustes mostra o último uso de cada uma.
- Uma chave só enxerga, escreve e edita os dados do próprio dono: conta de outro usuário responde `403` na criação/edição e `404` na leitura; lançamento de outro usuário responde `404` também na edição.
- Editar e excluir são escopos separados (`transactions:update` e `transactions:delete`), então uma chave criada apenas para lançar não altera nem apaga o histórico.
- A sessão do app (Firebase ID token) é verificada no servidor com `node:crypto` e os certificados públicos do Google — sem `firebase-admin/auth`, que quebra no runtime da Vercel por causa do `jwks-rsa`.
- Rotas de chave exigem a sessão do app: uma chave de API nunca consegue criar ou revogar outras chaves.



---

## 🔌 API pública v1 — Tutorial completo (leia até aqui se é a primeira vez)

API HTTP para **bots, scripts, automações e integrações** criarem, editarem e excluírem lançamentos no seu app Vidi, sem nunca compartilhar sua conta Google.

---

### 🗺️ Visão geral — o que você precisa saber antes de começar

```
┌──────────────────────────────────────────────────────────────────┐
│                    COMO A API FUNCIONA                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Você (dono da conta)                    Seu bot / automação    │
│        │                                          │              │
│   1. Cria chave em Ajustes      ──→   2. Recebe token (só uma   │
│      → API para bots                    vez!)                   │
│                                          │                      │
│                                          ▼                      │
│                                   3. Guarda o token seguro       │
│                                          │                      │
│                                          ▼                      │
│                                   4. Usa o token nas requisições  │
│                                          │                      │
│                                          ▼                      │
│                                   5. API cria/edita/exclui      │
│                                      lançamentos no seu nome     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Regras de ouro:**
- O token é como uma **senha de único uso**: você só vê ele uma vez na tela. Guarde onde for seguro.
- Cada chave tem **escopos limitados**: um bot criado com apenas `transactions:write` não consegue editar ou apagar nada do passado.
- A API só mexe nos dados **do dono da chave**: impossível um bot seu acessar a conta de outra pessoa.
- Para revogar acesso a qualquer momento: vá em **Ajustes → API para bots** e clique "Revogar". O token para de funcionar no instante seguinte.

---

### 📖 Glossário rápido

| Termo | O que é | Exemplo |
|---|---|---|
| **Token** | Senha longa que autentica seu bot | `vidi_4a3b2c1d_xYz...abc` |
| **Scopo** | Permissão dentro de cada chave | `write`, `update`, `delete`, `read` |
| **accountId** | ID interno de uma conta sua | `VSHTPgqfLJUhCJ9vZ1RD` |
| **groupId** | ID que agrupa parcelas de uma compra | `e0c58ac4e4f8396d9b61db2d` |
| **externalId** | Identificador da origem (evita duplicata) | `"pedido-123"` |
| **Idempotency-Key** | Header opcional que protege contra retries | `"req-abc-001"` |

---

### 1️⃣ Passo 1 — Criar a chave no app (só você faz isso uma vez)

Abra o app Vidi no celular ou navegador:

```
Menu lateral (☰) → Ajustes → API para bots
```

Na tela que abrir:

1. **Nome da chave** — coloque algo que você reconheça depois (ex: "Bot WhatsApp", "Scraper Nubank").
2. **Escopos** — marque os que seu bot precisa (veja a tabela abaixo).
3. Clique **"Criar"**.
4. **NA TELA APARECE O TOKEN COMPLETO.** Copie AGORA. Feche a aba. Não dá para ver de novo.

#### Tabela de escopos — quais marcar?

| Escopo | O que permite | Quando marcar |
|---|---|---|
| `transactions:write` | Criar novos lançamentos | **SEMPRE** — é o básico |
| `accounts:read` | Ver suas contas (para descobrir o `accountId`) | **SEMPRE** — necessário antes do primeiro POST |
| `categories:read` | Ver categorias válidas | **SEMPRE** — recomendado para validar o campo `category` |
| `transactions:read` | Consultar lançamentos existentes | Opcional — útil para auditoria |
| `transactions:update` | Editar lançamentos existentes | Só se seu bot precisa corrigir valores/categorias |
| `transactions:delete` | Excluir lançamentos | Só se seu bot precisa apagar errados |

**Combo mínimo recomendado para um bot que só cria:**
```
✅ transactions:write
✅ accounts:read
✅ categories:read
```

---

### 2️⃣ Passo 2 — Guardar o token com segurança

O token tem o formato `vidi_<keyId>_<secret>`. Exemplo real:

```
vidi_4a3b2c1d8e9f0a1b_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcdefGHIJK
```

**Onde guardar:**
- Variável de ambiente (`TOKEN_VIDI=vidi_...`)
- Gestor de segredos (AWS Secrets Manager, GitHub Actions secrets, etc.)
- Arquivo `.env` **NUNCA commite esse arquivo no git**

**Onde NÃO guardar:**
- Código fonte no repositório
- Logs expostos publicamente
- Mensagens de chat/grupos

---

### 3️⃣ Passo 3 — Testar se a chave funciona

Antes de escrever código, valide o token com este comando simples:

```bash
curl -s https://financas-app-google.vercel.app/api/v1/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

Se estiver tudo certo, a resposta será:

```json
{
  "ok": true,
  "uid": "seu-uid-aqui",
  "kind": "key",
  "scopes": ["transactions:write", "accounts:read", "categories:read"],
  "key": {
    "id": "4a3b2c1d8e9f0a1b",
    "label": "Bot WhatsApp",
    "hint": "vidi_4a3b2c1d8e9f0a1b_…GHIJK",
    "scopes": [...],
    "createdAt": "2026-11-22T...",
    "lastUsedAt": "2026-11-22T..."
  },
  "rateLimit": {
    "limit": 60,
    "remaining": 59,
    "resetAt": "2026-11-22T..."
  }
}
```

**Sinais de problema:**
| Resposta | Significado | Ação |
|---|---|---|
| `missing-credentials` | Header Authorization ausente | Envie o header corretamente |
| `invalid-key` | Token digitado errado ou revogado | Confira o token; na dúvida, crie outro |
| `insufficient-scope` | Falta um escopo para aquela rota | Adicione o escopo faltante na criação da chave |
| `rate-limited` | Muito rápido (mais de 60 req/min) | Aguarde 1 minuto; o retry está indicado no header `Retry-After` |

---

### 4️⃣ Passo 4 — Descobrir suas contas e categorias

Todo POST precisa do **`accountId`** correto. Para listá-las:

```bash
curl -s https://financas-app-google.vercel.app/api/v1/accounts \
  -H "Authorization: Bearer SEU_TOKEN"
```

Resposta:

```json
{
  "ok": true,
  "accounts": [
    {
      "id": "VSHTPgqfLJUhCJ9vZ1RD",
      "name": "Itau",
      "type": "hybrid",
      "color": "#f59e0b",
      "closingDay": 1,
      "dueDay": 5,
      "isCredit": true
    },
    {
      "id": "1dcCkHTpqDj5lMmcKLQd",
      "name": "C6",
      "type": "hybrid",
      "color": "#64748b",
      "closingDay": 29,
      "dueDay": 5,
      "isCredit": true
    }
  ]
}
```

**Anote o `id` da conta que seu bot vai usar.** Esse valor vai no campo `accountId` do POST.

Para listar categorias disponíveis:

```bash
curl -s https://financas-app-google.vercel.app/api/v1/categories \
  -H "Authorization: Bearer SEU_TOKEN"
```

Use nomes exatos retornados (ex: `"Alimentação"`, não `"alimentacao"`).

---

### 5️⃣ Passo 5 — Criar um lançamento (o mais importante)

#### 5.1 — Payload mínimo (funciona em 90% dos casos)

```bash
curl -X POST https://financas-app-google.vercel.app/api/v1/transactions \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 47.90,
    "description": "Padaria Central",
    "category": "Alimentação",
    "accountId": "1dcCkHTpqDj5lMmcKLQd"
  }'
```

**Campos obrigatórios:**
- `amount` — valor da **parcela** (não o total). Sempre maior que zero.
- `accountId` — ID da conta retornado pelo passo 4.
- `description` — texto livre (máx. 200 caracteres). Se omitido, usa o nome da categoria.
- `category` — nome de uma categoria válida (veja passo 4). Se omitido, usa `"Outros"`.

**Campos opcionais comuns:**
- `paymentType` — `"credit"` ou `"debit"`. Padrão: calculado automaticamente com base no tipo da conta.
- `date` — data da compra no formato `YYYY-MM-DD` (fuso de São Paulo). Padrão: hoje.
- `externalId` — identificador único da sua origem (ex: número do pedido). Evita duplicatas.
- `installments` — número de parcelas (1–48). Padrão: 1.

#### 5.2 — Compra parcelada (exemplo: 3x de R$ 10)

```bash
curl -X POST https://financas-app-google.vercel.app/api/v1/transactions \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "description": "Restaurante japonês",
    "category": "Alimentação",
    "accountId": "1dcCkHTpqDj5lMmcKLQd",
    "installments": 3
  }'
```

Resposta:

```json
{
  "ok": true,
  "installments": 3,
  "totalAmount": 30,
  "transactions": [
    {
      "id": "abc123XYZ",
      "amount": 10,
      "description": "Restaurante japonês",
      "category": "Alimentação",
      "installment": 1,
      "totalInstallments": 3,
      "groupId": "xyz789ABC",
      "date": "2026-11-22T15:00:00.000Z",
      ...
    },
    {
      "id": "def456UVW",
      "amount": 10,
      "description": "Restaurante japonês",
      "category": "Alimentação",
      "installment": 2,
      "totalInstallments": 3,
      "groupId": "xyz789ABC",
      "date": "2026-12-22T15:00:00.000Z",
      ...
    },
    {
      "id": "ghi789RST",
      "amount": 10,
      "description": "Restaurante japonês",
      "category": "Alimentação",
      "installment": 3,
      "totalInstallments": 3,
      "groupId": "xyz789ABC",
      "date": "2027-01-22T15:00:00.000Z",
      ...
    }
  ]
}
```

**O que a API fez:** criou 3 documentos no Firestore, todos com o mesmo `groupId`. O app mostra isso como um único lançamento parcelado.

#### 5.3 — Compra no cartão de crédito (data + vencimento automáticos)

```bash
curl -X POST https://financas-app-google.vercel.app/api/v1/transactions \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250,
    "description": "Shoppe compra",
    "category": "Compras",
    "accountId": "VSHTPgqfLJUhCJ9vZ1RD",
    "paymentType": "credit",
    "date": "2026-12-01"
  }'
```

O `dueDate` é **calculado automaticamente** com base no fechamento/vencimento da conta (neste exemplo: fechamento dia 1, vencimento dia 5). Você não precisa enviar `dueDate`.

#### 5.4 — Prevenir duplicatas com externalId + Idempotency-Key

Se seu bot pode tentar criar a mesma compra duas vezes (retry de rede, mensagem duplicada do WhatsApp, etc.), use os dois mecanismos juntos:

```bash
curl -X POST https://financas-app-google.vercel.app/api/v1/transactions \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: pedido-12345-20261122" \
  -d '{
    "amount": 47.90,
    "description": "Padaria Central",
    "category": "Alimentação",
    "accountId": "1dcCkHTpqDj5lMmcKLQd",
    "externalId": "pedido-12345-20261122"
  }'
```

- `externalId` — se já existir um lançamento com esse ID, a API responde `200 {"duplicate": true, "transactions":[...]}` sem criar nada.
- `Idempotency-Key` — se a primeira requisição ainda estiver sendo processada, a repetição recebe `409 idempotency-in-progress`. Se já finalizou, devolve a resposta original (sem criar de novo).

---

### 6️⃣ Passo 6 — Editar um lançamento existente

Imagine que o bot criou um lançamento com valor errado. Para corrigir:

```bash
# Editar só esta transação
curl -X PATCH https://financas-app-google.vercel.app/api/v1/transactions/abc123XYZ \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 52.50, "category": "Mercado"}'
```

```bash
# Editar também as parcelas futuras do mesmo grupo
curl -X PATCH "https://financas-app-google.vercel.app/api/v1/transactions/abc123XYZ?scope=future" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "Mercado"}'
```

**Campos editáveis:** `amount`, `description`, `category`, `type`, `paymentType`, `accountId`, `date`, `dueDate`, `isRecurring`, `frequency`.

**Campos IMUTÁVEIS:** `userId`, `externalId`, `source`, `groupId`, `installment`, `totalInstallments`.

**Regra do `scope=future`:** aplica as mudanças ao lançamento selecionado **e** a todas as parcelas seguintes do mesmo grupo que tenham data ≥ a data do lançamento editado. Também desloca as datas proporcionalmente se você mudou a `date`. Funciona igual ao app.

> ⚠️ **Você precisa do escopo `transactions:update`** na chave para essa operação funcionar. Sem ele, a API responde `403 insufficient-scope`.

---

### 7️⃣ Passo 7 — Excluir um lançamento

```bash
# Excluir só esta transação
curl -X DELETE https://financas-app-google.vercel.app/api/v1/transactions/abc123XYZ \
  -H "Authorization: Bearer SEU_TOKEN"
```

```bash
# Excluir esta + parcelas futuras do grupo
curl -X DELETE "https://financas-app-google.vercel.app/api/v1/transactions/abc123XYZ?scope=future" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Atenção:** exclusão via API é **DEFINITIVA**. Diferente do app (que mostra "Desfazer"), não há likeback. Pense duas vezes antes de usar `DELETE` — prefira sempre o `PATCH` para corrigir erros.

> ⚠️ **Você precisa do escopo `transactions:delete`** na chave. Sem ele, a API responde `403 insufficient-scope`.

---

### 8️⃣ Passo 8 — Consultar lançamentos

```bash
# Últimas 20 transações
curl -s https://financas-app-google.vercel.app/api/v1/transactions?limit=20 \
  -H "Authorization: Bearer SEU_TOKEN"
```

```bash
# Transações de novembro de 2026 na conta BTG
curl -s "https://financas-app-google.vercel.app/api/v1/transactions?from=2026-11-01&to=2026-11-30&accountId=VSHTPgqfLJUhCJ9vZ1RD&limit=50" \
  -H "Authorization: Bearer SEU_TOKEN"
```

```bash
# Paginação: pule para a próxima página
curl -s "https://financas-app-google.vercel.app/api/v1/transactions?limit=20&cursor=eyJtcyI6..." \
  -H "Authorization: Bearer SEU_TOKEN"
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `limit` | number | Não | 1–200 (padrão 50) |
| `from` | YYYY-MM-DD | Não | Data inicial inclusiva (fuso SP) |
| `to` | YYYY-MM-DD | Não | Data final inclusiva (fuso SP) |
| `accountId` | string | Não | Filtra por conta |
| `type` | expense\|income | Não | Filtra por tipo |
| `cursor` | string | Não | Valor de `nextCursor` da resposta anterior |

Resposta paginada:

```json
{
  "ok": true,
  "transactions": [...],
  "nextCursor": "eyJtcyI6MTgzOTg1NDAwMDAwMCwiaWQiOiJrOHFpWjZnd...​",
  "hasMore": true
}
```

Para buscar todas as páginas, repita a chamada passando `nextCursor` até `hasMore` ser `false`.

---

### 9️⃣ Passo 9 — Revogar uma chave (quando quiser)

Volte em **Ajustes → API para bots**, encontre a chave e clique **"Revogar"**. O efeito é imediato: toda requisição posterior com aquele token recebe `401 invalid-key`. Não precisa esperar propagação nem reiniciar nada.

---

### 💻 Exemplos práticos em diferentes linguagens

#### Python (requests)

```python
import requests

TOKEN = "vidi_4a3b2c1d_..."  # sua chave
BASE = "https://financas-app-google.vercel.app/api/v1"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# 1. Listar contas
resp = requests.get(f"{BASE}/accounts", headers=HEADERS)
accounts = resp.json()["accounts"]
print("Contas:", [(a["name"], a["id"]) for a in accounts])

# 2. Criar lançamento simples
payload = {
    "amount": 47.90,
    "description": "Padaria Central",
    "category": "Alimentação",
    "accountId": accounts[0]["id"]
}
resp = requests.post(f"{BASE}/transactions", json=payload, headers=HEADERS)
tx = resp.json()["transactions"][0]
print(f"Criado: {tx['id']} — R${tx['amount']}")

# 3. Criar parcelado
payload_inst = {**payload, "installments": 3}
resp = requests.post(f"{BASE}/transactions", json=payload_inst, headers=HEADERS)
print(f"Total parcelado: R${resp.json()['totalAmount']} em {resp.json()['installments']}x")

# 4. Editar
tx_id = tx["id"]
resp = requests.patch(
    f"{BASE}/transactions/{tx_id}",
    json={"amount": 52.50},
    headers=HEADERS
)
print("Editado:", resp.json())

# 5. Excluir (cuidado — irreversível!)
resp = requests.delete(
    f"{BASE}/transactions/{tx_id}",
    headers=HEADERS
)
print("Excluído:", resp.json())
```

#### JavaScript / Node.js (fetch)

```javascript
const TOKEN = "vidi_4a3b2c1d_...";
const BASE = "https://financas-app-google.vercel.app/api/v1";
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function api(method, path, body = null) {
  const opts = { method, headers: HEADERS };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error?.message}`);
  return json;
}

// Listar contas
const accounts = (await api("GET", "/accounts")).accounts;
console.log("Contas:", accounts.map(a => `${a.name} (${a.id})`));

// Criar
const created = await api("POST", "/transactions", {
  amount: 47.9,
  description: "Padaria Central",
  category: "Alimentação",
  accountId: accounts[0].id,
});
console.log("Criado:", created.transactions[0].id);

// Parcelado
await api("POST", "/transactions", {
  amount: 10,
  description: "Restaurante",
  category: "Alimentação",
  accountId: accounts[0].id,
  installments: 3,
});
console.log("Parcelado: 3x de R$10");

// Editar
await api("PATCH", `/transactions/${created.transactions[0].id}`, {
  amount: 52.5,
});

// Excluir
await api("DELETE", `/transactions/${created.transactions[0].id}`);
```

#### PowerShell (bot Windows)

```powershell
$Token   = "vidi_4a3b2c1d_..."
$Base    = "https://financas-app-google.vercel.app/api/v1"
$Headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }

# Listar contas
$accounts = (Invoke-RestMethod "$Base/accounts" -Headers $Headers).accounts
$accountId = $accounts[0].id

# Criar
$body = @{ amount=47.90; description="Padaria Central"; category="Alimentação"; accountId=$accountId } | ConvertTo-Json
$r = Invoke-RestMethod "$Base/transactions" -Method POST -Headers $Headers -Body $body
Write-Host "Criado: $($r.transactions[0].id)"

# Parcelado
$body2 = @{ amount=10; description="Restaurante"; category="Alimentação"; accountId=$accountId; installments=3 } | ConvertTo-Json
$r2 = Invoke-RestMethod "$Base/transactions" -Method POST -Headers $Headers -Body $body2
Write-Host "Total: R$($r2.totalAmount) em $($r2.installments)x"
```

#### curl (linha de comando — copia e cola)

```bash
# Variável de ambiente (recomendado)
export VIDI_TOKEN="vidi_4a3b2c1d_..."

# Health check
curl -s https://financas-app-google.vercel.app/api/v1/health

# Verificar minha chave
curl -s -H "Authorization: Bearer $VIDI_TOKEN" \
  https://financas-app-google.vercel.app/api/v1/me

# Listar contas
curl -s -H "Authorization: Bearer $VIDI_TOKEN" \
  https://financas-app-google.vercel.app/api/v1/accounts

# Criar
curl -s -X POST https://financas-app-google.vercel.app/api/v1/transactions \
  -H "Authorization: Bearer $VIDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":47.9,"description":"Padaria","category":"Alimentação","accountId":"ID_DA_CONTA"}'

# Parcelado
curl -s -X POST https://financas-app-google.vercel.app/api/v1/transactions \
  -H "Authorization: Bearer $VIDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":10,"description":"Restaurante","category":"Alimentação","accountId":"ID_DA_CONTA","installments":3}'

# Editar
curl -s -X PATCH https://financas-app-google.vercel.app/api/v1/transactions/ID_DO_LANCAMENTO \
  -H "Authorization: Bearer $VIDI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":52.5,"category":"Mercado"}'

# Excluir (cuidado!)
curl -s -X DELETE "https://financas-app-google.vercel.app/api/v1/transactions/ID_DO_LANCAMENTO?scope=future" \
  -H "Authorization: Bearer $VIDI_TOKEN"
```

---

### 🚨 Troubleshooting — erros comuns e como resolver

| Erro que aparece | Causa provável | Como resolver |
|---|---|---|
| `missing-credentials` | Header `Authorization` faltando ou mal formatado | Verifique se está enviando exatamente: `Authorization: Bearer vidi_...` (cuidado com espaços extras) |
| `invalid-key` | Token digitado errado, corrompido ou revogado | Confira o token copiado; se perdeu, crie uma nova chave no app |
| `insufficient-scope` | Falta o escopo para aquela operação | Crie nova chave marcando o escopo correspondente |
| `forbidden` | Tentou acessar conta de outra pessoa | Confirme que o `accountId` pertence ao dono do token |
| `not-found` | ID do lançamento inexistente ou de outro usuário | Confira o ID; edite antes de deletar |
| `invalid-request` | Campo com valor inválido (amount ≤ 0, type errado, etc.) | Leia a mensagem específica no campo `error.message` |
| `invalid-account` | `accountId` não existe | Liste as contas com `GET /accounts` e use o `id` correto |
| `invalid-json` | Corpo da requisição não é JSON válido | Verifique aspas, vírgulas e chaves no payload |
| `payload-too-large` | Corpo > 32 KB | Reduza o tamanho do payload |
| `rate-limited` | Mais de 60 requisições em 1 minuto | Aguarde o tempo indicado em `Retry-After`; considere aumentar o `limitPerMinute` na criação da chave |

**Dica:** sempre inspecione o campo `error.message` da resposta. Ele diz exatamente o que está errado.

---

### 🔒 Segurança — o que você deve saber

1. **Tokens nunca voltam após a criação** — se perder, gere outra chave.
2. **Chaves são scrypt com salt** — o servidor guarda apenas o hash, jamais o token em texto puro.
3. **Escopos são independentes** — uma chave criada com apenas `write` não consegue editar nem excluir nada.
4. **Isolamento por usuário** — um token só acessa os dados do próprio dono. Conta de outro usuário responde `403` ou `404`.
5. **Revogação imediata** — ao revogar, o token para de funcionar no próximo request. Sem delay.
6. **`apiKeys` e `apiIdempotency` são protegidos** pelas regras do Firestore (default-deny), então hashes, salts e contadores de rate-limit não vazam para o cliente.
7. **CORS restrito** — apenas domínios oficiais do Vidi e `localhost` recebem respostas com CORS habilitado. Bots que fazem requisição direta (sem navegador) não precisam de CORS.

---

### 📊 Resumo de rotas

| Método | Caminho | Escopo necessário | O que faz |
|---|---|---|---|
| `GET` | `/health` | nenhum | Status da API |
| `GET` | `/` | nenhum | Índice com todas as rotas e escopos |
| `GET` | `/me` | autenticado | Dados da chave/sessão atual |
| `GET` | `/accounts` | `accounts:read` | Lista suas contas (precisa do `id` para POST) |
| `GET` | `/categories` | `categories:read` | Lista categorias válidas |
| `POST` | `/transactions` | `transactions:write` | Cria 1 ou N parcelas |
| `GET` | `/transactions` | `transactions:read` | Lista (paginado) |
| `GET` | `/transactions/:id` | `transactions:read` | Busca um lançamento específico |
| `PATCH` | `/transactions/:id` | `transactions:update` | Edita campos específicos |
| `PATCH` | `/transactions/:id?scope=future` | `transactions:update` | Edita + parcelas futuras do grupo |
| `DELETE` | `/transactions/:id` | `transactions:delete` | Exclui um lançamento |
| `DELETE` | `/transactions/:id?scope=future` | `transactions:delete` | Exclui + parcelas futuras do grupo |
| `GET` | `/keys` | sessão do app | Lista chaves criadas por você |
| `POST` | `/keys` | sessão do app | Cria nova chave (só app logado) |
| `DELETE` | `/keys/:id` | sessão do app | Revoga chave |

---

### ❓ Perguntas frequentes

**Q: Posso usar a API no meu bot do Discord/Telegram/WhatsApp?**
R: Sim! Basta o bot fazer requisições HTTP com o token no header `Authorization`. Qualquer linguagem que suporte HTTP (Python, JS, Go, Java, PHP, PowerShell, etc.) funciona.

**Q: Preciso de backend próprio?**
R: Não. A API roda na Vercel e fala direto com seu Firebase. Seu bot só precisa saber o token e o `accountId` das contas.

**Q: Quantas chaves posso criar?**
R: Até 10 ativas por usuário. Cada uma com escopos independentes (um bot pode ter só write, outro write+update, outro write+delete, etc.).

**Q: A API salva algum dado no meu computador?**
R: Não. Tudo fica no Firebase (nuvem). O único dado local é o token que você armazena no seu ambiente.

**Q: Posso usar `externalId` para evitar duplicatas?**
R: Sim — é o mecanismo recomendado. Se você enviar o mesmo `externalId` duas vezes, a segunda retorna `{"duplicate":true,...}` com o lançamento existente, em vez de criar outro.

**Q: E se eu quiser desfazer um DELETE?**
R: Via API, não há desfazer. A exclusão é definitiva. No app, o "Desfazer" funciona porque guarda um snapshot antes de deletar — mas esse mecanismo não está disponível pela API. Use com cuidado.

**Q: O token expira?**
R: Não, a menos que você mesmo revogue. Tokens são vitalícios enquanto ativos.

---

*Documento mantido junto com o código-fonte em `api/v1.ts`. Última atualização: novembro de 2026.*