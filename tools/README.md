# tools/fatura_parse.py

Lê a fatura em PDF **localmente**, sem IA, e gera três arquivos:

| Arquivo | Para que serve |
|---|---|
| `<nome>.md` | Relatório de conferência: totais calculados vs. os do PDF, estornos, compensações, parceladas e a lista de lançamentos. |
| `<nome>.json` | Lançamentos estruturados (data, descrição, valor, tipo, parcela, categoria sugerida). |
| `<nome>.ai.txt` | Lista compacta (≈3 KB) para a IA categorizar — em vez de mandar as 4 páginas do PDF. |

## Instalação

```powershell
py -m venv .venv-tools
.\.venv-tools\Scripts\python.exe -m pip install pdfplumber
```

## Uso

```powershell
.\.venv-tools\Scripts\python.exe tools\fatura_parse.py fatura.pdf --out relatorios/outubro-2026 --ai-input
```

Saída: `relatorios/outubro-2026.md`, `.json` e `.ai.txt`.

## O que ele resolve sozinho (sem gastar token)

- Lê as duas colunas da fatura na ordem correta.
- Identifica seções: pagamentos, encargos, cartão físico (créditos) e cartão virtual (compras).
- Separa **estornos** (seção de créditos) de **compras**.
- Detecta **cobrança + estorno do mesmo valor** e marca os dois como compensados (não importar).
- Compra internacional: pega o valor em reais da linha "Conversão para Real" e ignora "Cotação da moeda".
- Extrai parcela `(N/M)` da descrição.
- Confere os totais contra o PDF (compras, encargos, créditos, total a pagar e projeção da próxima fatura).
- Sugere categoria por palavra-chave; o que ficar `?` é o que a IA (ou você) decide.

## Fluxo sugerido

1. `fatura_parse.py` → `.md` para você conferir e `.ai.txt` para a IA.
2. A IA recebe só o `.ai.txt` e devolve `{"1": "Categoria", ...}` (poucos tokens).
3. O resultado é aplicado no `.json`, que vira a importação no app.

## Limitações

- O parser é ajustado ao layout do BTG; outros bancos precisam de ajuste nas seções/regex.
- Categorias por palavra-chave cobrem o óbvio; nomes de estabelecimento desconhecidos ficam `?`.
