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
- **API pública v1**: Chaves de acesso com escopos para bots e automações criarem lançamentos (veja [API pública v1](#-api-pública-v1)).

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

API HTTP para bots e automações criarem lançamentos em seu nome, sem compartilhar sua conta Google.

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
| `transactions:read` | Consultar lançamentos |
| `accounts:read` | Listar contas (necessário para descobrir o `accountId`) |
| `categories:read` | Listar categorias válidas |

Ao criar a chave, o padrão é `transactions:write` + `accounts:read` + `categories:read`. É possível ter até **10 chaves ativas** por usuário.

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
- Uma chave só enxerga e escreve os dados do próprio dono: conta de outro usuário responde `403` na criação e `404` na leitura.
- A sessão do app (Firebase ID token) é verificada no servidor com `node:crypto` e os certificados públicos do Google — sem `firebase-admin/auth`, que quebra no runtime da Vercel por causa do `jwks-rsa`.
- Rotas de chave exigem a sessão do app: uma chave de API nunca consegue criar ou revogar outras chaves.

