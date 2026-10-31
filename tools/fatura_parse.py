#!/usr/bin/env python3
"""
fatura_parse.py — leitor local de faturas de cartão (PDF), sem IA.

Extrai os lançamentos direto do texto do PDF e gera:
  - <nome>.md    : relatório para conferência humana (tabelas + conferência de totais)
  - <nome>.json  : lançamentos estruturados, prontos para categorização/importação

Por que existe: o PDF inteiro custa tokens (cada página vira imagem para o modelo).
Com o texto já estruturado localmente, a IA recebe só uma lista curta de
"data | descrição | valor" e gasta uma fração dos tokens — só para categorizar.

Uso:
    python tools/fatura_parse.py fatura.pdf
    python tools/fatura_parse.py fatura.pdf --out relatorios/outubro
    python tools/fatura_parse.py fatura.pdf --json-only

Requisitos: pip install pdfplumber
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    sys.exit("Instale a dependência: pip install pdfplumber")

# --------------------------------------------------------------------------- #
# Constantes
# --------------------------------------------------------------------------- #

MONTHS = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}
MONTH_NAMES = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
    7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
}

# Início de um lançamento: "21 Mai ..."
DATE_RE = re.compile(
    r"(?<![\d/])(0?[1-9]|[12]\d|3[01])\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+",
    re.IGNORECASE,
)
BRL_END_RE = re.compile(r"^(?P<desc>.*?)\s+(?:-\s*)?R\$\s*(?P<amount>[\d.]+,\d{2})\s*$")
FOREIGN_END_RE = re.compile(
    r"^(?P<desc>.*?)\s+(?P<cur>USD|EUR|COP|ARS|GBP)\s*(?P<amount>[\d.,]+)\s*$",
    re.IGNORECASE,
)
COTACAO_RE = re.compile(r"^cota[cç][aã]o da moeda\s*-?\s*R\$\s*([\d.]+,\d{2})\s*$", re.IGNORECASE)
CONVERSAO_RE = re.compile(r"^convers[aã]o para real\s*-?\s*R\$\s*([\d.]+,\d{2})\s*$", re.IGNORECASE)
# As duas colunas podem dividir a mesma linha: "08 Set Ifood R$ 7,95 Conversão para Real - R$ 68,34"
CONTINUATION_SPLIT_RE = re.compile(
    r"(?:Cota[cç][aã]o da moeda|Convers[aã]o para Real)\s*-?\s*R\$\s*[\d.]+,\d{2}",
    re.IGNORECASE,
)
INSTALLMENT_RE = re.compile(r"\(?\s*(\d{1,2})\s*/\s*(\d{1,2})\s*\)?\s*$")

# Categorias: chute local por palavra-chave. A IA (ou você) revisa o que ficar "?".
CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("Alimentação", (
        "ifood", "restaurante", "padaria", "supermercado", "mercado", "mcdonald",
        "burger", "pizza", "cafe", "cafeteria", "lanche", "doce", "chocolate",
        "delivery", "camarao", "chocolates", "padoca", "acougue", "hortifruti",
        "starbucks", "outback", "sushi", "bar ", "bebida", "vidolce", "melimais",
        "parcus delivery", "jd delivery", "mariene ribei",
    )),
    ("Transporte", (
        "uber", "99", "posto", "combustivel", "gasolina", "estacionamento",
        "pedagio", "passagem", "avianca", "latam", "gol", "azul", "shell",
        "ipiranga", "sem parar", "veloe", "estapar",
    )),
    ("Compras", (
        "amazon", "mercado livre", "shopee", "magalu", "americanas", "shein",
        "aliexpress", "c&a", "renner", "riachuelo", "zara", "nike", "adidas",
        "vinci shoes", "tiktok", "materiais para constru", "leroy", "madeira",
        "jim.com", "apple", "samsung",
    )),
    ("Entretenimento", (
        "netflix", "spotify", "cinema", "show", "ingresso", "steam", "playstation",
        "xbox", "wellhub", "gympass", "academia", "parque", "turismo", "eda shows",
        "dragon pass", "sala vip", "disney", "tennis",
    )),
    ("Saúde", (
        "farmacia", "drogaria", "drogasil", "raia", "pacheco", "consulta", "exame",
        "laboratorio", "clinica", "hospital", "dentista", "estetica", "laser",
    )),
    ("Aluguel", ("aluguel", "condominio", "moradia", "iptu")),
    ("Encargos", (
        "juros", "multa", "mora", "iof", "anuidade", "tarifa", "encargo",
        "rotativo", "cobranca", "cotacao da moeda", "atraso",
    )),
    ("Outros", (
        "vivo", "claro", "tim ", "oi ", "internet", "energia", "enel", "sabesp",
        "agua", "gas ", "seguro", "assinatura",
    )),
]


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #

def norm(text: str) -> str:
    """Minúsculo e sem acento, para comparação de palavras-chave."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower()


def brl(value: str) -> float:
    """'1.234,56' -> 1234.56"""
    return float(value.replace(".", "").replace(",", "."))


def guess_category(description: str) -> tuple[str, bool]:
    """
    Devolve (categoria, confiança). confiança=False quando não houve palavra-chave.

    Ganha a palavra-chave mais específica (mais longa): "mercado livre" vence "mercado".
    """
    d = norm(description)
    best: tuple[int, str] | None = None

    for category, keywords in CATEGORY_RULES:
        for keyword in keywords:
            k = norm(keyword).strip()
            if not k:
                continue
            # Palavras curtas exigem limite nas duas pontas ("99" não casa com "199").
            # Palavras longas podem aparecer coladas ("laser" em "P14espacolaser").
            left = r"(?<![a-z0-9])" if len(k) <= 4 else ""
            pattern = left + re.escape(k) + r"(?![a-z0-9])"
            if re.search(pattern, d):
                if best is None or len(k) > best[0]:
                    best = (len(k), category)

    if best is None:
        return "?", False
    return best[1], True


def add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


# --------------------------------------------------------------------------- #
# Leitura do PDF
# --------------------------------------------------------------------------- #

def page_lines(page, split_x: float = 300.0) -> list[str]:
    """
    Reconstrói as linhas na ordem de leitura.

    A fatura tem duas colunas; agrupamos as palavras por linha (top) e depois
    ordenamos por x, o que naturalmente devolve "esquerda depois direita".
    """
    words = page.extract_words(use_text_flow=False)
    rows: dict[int, list[dict]] = {}
    for w in words:
        rows.setdefault(round(w["top"] / 3), []).append(w)

    lines = []
    for key in sorted(rows):
        row = sorted(rows[key], key=lambda w: w["x0"])
        lines.append(" ".join(w["text"] for w in row))
    return lines


def extract_text(pdf_path: Path) -> list[list[str]]:
    """Devolve as linhas separadas por página (o layout se repete a cada página)."""
    pages: list[list[str]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(page_lines(page))
    return pages


def parse_header(text: str) -> dict:
    """Banco, mês de referência, vencimento, período e totais do resumo."""
    info: dict = {}

    m = re.search(r"fatura de\s+([A-Za-zçÇãÃéÉ]+)\s+de\s+(\d{4})", text, re.IGNORECASE)
    if m:
        month_name = norm(m.group(1))
        for num, name in MONTH_NAMES.items():
            if norm(name) == month_name:
                info["referenceMonth"] = f"{m.group(2)}-{num:02d}"
                break

    m = re.search(r"Vencimento:\s*(\d{2})/(\d{2})", text)
    if m and info.get("referenceMonth"):
        year, month = map(int, info["referenceMonth"].split("-"))
        info["invoiceDueDate"] = f"{year:04d}-{month:02d}-{int(m.group(1)):02d}"

    m = re.search(r"Per[ií]odo de compras:\s*(\d{2}/\d{2})\s*at[eé]\s*(\d{2}/\d{2})", text)
    if m and info.get("referenceMonth"):
        year, month = map(int, info["referenceMonth"].split("-"))
        start_day, start_month = map(int, m.group(1).split("/"))
        end_day, end_month = map(int, m.group(2).split("/"))
        start_year = year - 1 if start_month > month else year
        end_year = year - 1 if end_month > month else year
        info["statementPeriodStart"] = f"{start_year:04d}-{start_month:02d}-{start_day:02d}"
        info["statementPeriodEnd"] = f"{end_year:04d}-{end_month:02d}-{end_day:02d}"

    totals = {
        "purchases": r"Total de compras e despesas R\$\s*([\d.]+,\d{2})",
        "credits": r"Total de cr[eé]ditos recebidos -?R\$\s*([\d.]+,\d{2})",
        "fees": r"Juros e encargos R\$\s*([\d.]+,\d{2})",
        "total": r"Total a pagar R\$\s*([\d.]+,\d{2})",
        "nextInvoice": r"Pr[oó]x\.\s*R\$\s*([\d.]+,\d{2})",
    }
    for key, pattern in totals.items():
        m = re.search(pattern, text)
        if m:
            info[key] = brl(m.group(1))

    return info


# --------------------------------------------------------------------------- #
# Extração dos lançamentos
# --------------------------------------------------------------------------- #

SECTION_STARTS = [
    (re.compile(r"^Pagamentos feitos pelo cliente", re.I), "pagamentos"),
    (re.compile(r"^Encargos e juros", re.I), "encargos"),
    (re.compile(r"^Lan[cç]amentos do cart[aã]o", re.I), "compras"),
    (re.compile(r"^Outros Lan[cç]amentos", re.I), "outros"),
]
CREDITS_TOTAL_RE = re.compile(r"^Total de cr[eé]ditos recebidos", re.I)
PURCHASES_TOTAL_RE = re.compile(r"^Total de compras e despesas", re.I)
END_MARKERS = [
    re.compile(r"^Taxas e encargos", re.I),
    re.compile(r"^Cr[eé]dito Rotativo:", re.I),
    re.compile(r"^BTG Pactual S\.A", re.I),
]


TX_SECTIONS = {"compras", "encargos", "outros", "pagamentos"}


def split_continuations(line: str) -> list[tuple[str, str]]:
    """
    Separa a linha em pedaços de texto e continuações ("Cotação da moeda" / "Conversão para Real").
    Necessário porque as duas colunas podem se juntar na mesma linha.
    """
    parts: list[tuple[str, str]] = []
    pos = 0
    for match in CONTINUATION_SPLIT_RE.finditer(line):
        if match.start() > pos:
            parts.append(("text", line[pos:match.start()].strip()))
        parts.append(("cont", match.group(0).strip()))
        pos = match.end()
    if pos < len(line):
        parts.append(("text", line[pos:].strip()))
    return parts


def parse_transactions(pages: list[list[str]], info: dict) -> list[dict]:
    reference_month = info.get("referenceMonth")
    ref_year = int(reference_month.split("-")[0]) if reference_month else date.today().year
    ref_month = int(reference_month.split("-")[1]) if reference_month else date.today().month

    transactions: list[dict] = []
    section = "desconhecido"
    is_credit = False
    # Compra internacional aguardando a linha "Conversão para Real"
    pending_foreign: dict | None = None

    def apply_continuation(text: str) -> bool:
        """Aplica 'Cotação da moeda' / 'Conversão para Real' na compra internacional pendente."""
        nonlocal pending_foreign
        if pending_foreign is None:
            return False
        m = CONVERSAO_RE.match(text)
        if m:
            pending_foreign["amount"] = brl(m.group(1))
            pending_foreign["converted"] = True
            pending_foreign = None
            return True
        m = COTACAO_RE.match(text)
        if m:
            pending_foreign["currencyFee"] = brl(m.group(1))
            return True
        return False

    def process_chunk(chunk: str) -> None:
        """Extrai os lançamentos de um pedaço de linha (pode conter 1 ou 2 lançamentos)."""
        nonlocal pending_foreign
        starts = [m.start() for m in DATE_RE.finditer(chunk)]
        if not starts:
            apply_continuation(chunk)
            return

        starts.append(len(chunk))
        for i in range(len(starts) - 1):
            segment = chunk[starts[i]:starts[i + 1]].strip()
            tx = parse_segment(segment, section, is_credit, ref_year, ref_month)
            if tx is None:
                continue
            transactions.append(tx)
            if tx["currency"] != "BRL":
                pending_foreign = tx

    stopped = False

    for page in pages:
        # A lista de lançamentos continua na página seguinte, mesmo depois do
        # bloco de "Taxas e encargos" que encerra a página anterior.
        stopped = False

        for raw in page:
            line = raw.strip()
            if not line:
                continue

            # --- marcadores de seção ---------------------------------------
            if any(marker.search(line) for marker in END_MARKERS):
                stopped = True
                pending_foreign = None
                continue

            matched_section = False
            for pattern, name in SECTION_STARTS:
                if pattern.search(line):
                    section = name
                    is_credit = False
                    pending_foreign = None
                    stopped = False
                    matched_section = True
                    break
            if matched_section:
                continue

            if CREDITS_TOTAL_RE.search(line):
                is_credit = True
                continue
            if PURCHASES_TOTAL_RE.search(line):
                is_credit = False
                continue

            # Fora das seções de lançamentos (resumo, taxas, rodapé) não há o que extrair.
            if stopped or section not in TX_SECTIONS:
                continue

            for kind, chunk in split_continuations(line):
                if kind == "cont":
                    apply_continuation(chunk)
                    continue
                if not chunk:
                    continue
                process_chunk(chunk)

    return transactions


def parse_segment(segment: str, section: str, is_credit: bool,
                  ref_year: int, ref_month: int) -> dict | None:
    m = DATE_RE.match(segment)
    if not m:
        return None
    day = int(m.group(1))
    month = MONTHS[m.group(2).lower()]
    rest = segment[m.end():].strip()
    if not rest:
        return None

    currency = "BRL"
    amount: float | None = None
    description = rest

    brl_match = BRL_END_RE.match(rest)
    if brl_match:
        description = brl_match.group("desc").strip()
        amount = brl(brl_match.group("amount"))
    else:
        foreign = FOREIGN_END_RE.match(rest)
        if foreign:
            currency = foreign.group("cur").upper()
            description = foreign.group("desc").strip()
            # valor estrangeiro; o valor em reais vem na linha "Conversão para Real"
            raw_amount = foreign.group("amount")
            amount = float(raw_amount.replace(".", "").replace(",", "."))

    if amount is None:
        return None

    # Parcelas "(5/6)"
    inst = INSTALLMENT_RE.search(description)
    installment_number = installment_total = None
    if inst:
        installment_number = int(inst.group(1))
        installment_total = int(inst.group(2))
        if installment_total < 2 or installment_number > installment_total:
            installment_number = installment_total = None
        else:
            description = description[:inst.start()].strip()

    description = re.sub(r"\s{2,}", " ", description).strip(" -")
    if not description or description.lower().startswith("total"):
        return None

    year = ref_year - 1 if month > ref_month else ref_year
    category, confident = guess_category(description)

    tx_type = "purchase"
    if section == "encargos" or category == "Encargos":
        tx_type = "fee"
    elif section == "pagamentos":
        tx_type = "payment"
    if is_credit:
        tx_type = "refund"

    return {
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "description": description,
        "amount": round(amount, 2),
        "currency": currency,
        "type": tx_type,
        "section": section,
        "category": category,
        "categoryConfident": confident,
        "installmentNumber": installment_number,
        "installmentTotal": installment_total,
        "converted": False,
        "compensated": False,
    }


def mark_compensated(transactions: list[dict]) -> list[tuple[dict, dict]]:
    """
    Cobrança + estorno de mesmo valor na mesma fatura se anulam.
    Marca os dois como `compensated` para não importar lançamento fantasma.
    """
    pairs: list[tuple[dict, dict]] = []
    refunds = [t for t in transactions if t["type"] == "refund"]
    purchases = [t for t in transactions if t["type"] == "purchase"]

    for refund in refunds:
        for purchase in purchases:
            if purchase["compensated"]:
                continue
            # Valor tem que bater exatamente: 32,99 x 33,00 é outra compra, não compensação.
            if abs(purchase["amount"] - refund["amount"]) < 0.005:
                purchase["compensated"] = True
                refund["compensated"] = True
                pairs.append((purchase, refund))
                break
    return pairs


# --------------------------------------------------------------------------- #
# Relatório
# --------------------------------------------------------------------------- #

def fmt_brl(value: float) -> str:
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


def fmt_date(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


def month_label(reference_month: str | None) -> str:
    if not reference_month:
        return ""
    year, month = reference_month.split("-")
    return f"{MONTH_NAMES.get(int(month), '')}/{year}"


def project_next_invoice(transactions: list[dict]) -> float:
    """Soma das parcelas que caem na próxima fatura (uma por compra parcelada em andamento)."""
    total = 0.0
    for t in transactions:
        if t["type"] != "purchase" or t["compensated"]:
            continue
        total_inst = t["installmentTotal"] or 0
        current_inst = t["installmentNumber"] or 0
        if total_inst > 1 and current_inst < total_inst:
            total += t["amount"]
    return round(total, 2)


def build_report(transactions: list[dict], info: dict, source: str) -> str:
    purchases = [t for t in transactions if t["type"] == "purchase" and not t["compensated"]]
    fees = [t for t in transactions if t["type"] == "fee"]
    refunds = [t for t in transactions if t["type"] == "refund" and not t["compensated"]]
    payments = [t for t in transactions if t["type"] == "payment"]
    compensated = [t for t in transactions if t["compensated"]]

    # Conferência usa os valores BRUTOS (incluindo os compensados), que é como o PDF soma.
    gross_purchases = sum(t["amount"] for t in transactions if t["type"] == "purchase")
    gross_refunds = sum(t["amount"] for t in transactions if t["type"] == "refund")
    total_fees = sum(t["amount"] for t in fees)
    computed_total = gross_purchases + total_fees - gross_refunds

    out: list[str] = []
    out.append(f"# Fatura {month_label(info.get('referenceMonth'))} — conferência")
    out.append("")
    out.append(f"- **Arquivo:** `{Path(source).name}`")
    if info.get("statementPeriodStart"):
        out.append(
            f"- **Período:** {fmt_date(info['statementPeriodStart'])} → "
            f"{fmt_date(info['statementPeriodEnd'])}"
        )
    if info.get("invoiceDueDate"):
        out.append(f"- **Vencimento:** {fmt_date(info['invoiceDueDate'])}")
    out.append(f"- **Lançamentos lidos:** {len(transactions)}")
    out.append("")

    # Conferência
    out.append("## Conferência de totais")
    out.append("")
    out.append("| Item | Calculado | No PDF | OK |")
    out.append("|---|---:|---:|---|")

    def row(label: str, calc: float, expected: float | None, tolerance: float = 0.05) -> None:
        if expected is None:
            out.append(f"| {label} | {fmt_brl(calc)} | — | — |")
            return
        ok = abs(calc - expected) <= tolerance
        out.append(f"| {label} | {fmt_brl(calc)} | {fmt_brl(expected)} | {'✅' if ok else '❌'} |")

    row("Compras", gross_purchases, info.get("purchases"))
    row("Encargos e juros", total_fees, info.get("fees"))
    row("Créditos/estornos", gross_refunds, info.get("credits"))
    row("Total a pagar", computed_total, info.get("total"))
    if info.get("nextInvoice") is not None:
        row("Projeção próxima fatura", project_next_invoice(transactions), info["nextInvoice"])
    out.append("")

    # Compensados
    if compensated:
        out.append("## Cobranças e estornos compensados (não importar)")
        out.append("")
        out.append("| Data | Descrição | Valor |")
        out.append("|---|---|---:|")
        for t in compensated:
            sign = "+" if t["type"] == "purchase" else "−"
            out.append(
                f"| {fmt_date(t['date'])} | {t['description']} | {sign} {fmt_brl(t['amount'])} |"
            )
        out.append("")

    # Estornos
    if refunds:
        out.append("## Estornos / créditos")
        out.append("")
        out.append("| Data | Descrição | Valor |")
        out.append("|---|---|---:|")
        for t in refunds:
            out.append(f"| {fmt_date(t['date'])} | {t['description']} | {fmt_brl(t['amount'])} |")
        out.append("")

    # Pagamentos (ignorados na importação)
    if payments:
        out.append("## Pagamentos da fatura anterior (ignorados)")
        out.append("")
        for t in payments:
            out.append(f"- {fmt_date(t['date'])} — {t['description']} — {fmt_brl(t['amount'])}")
        out.append("")

    # Parceladas
    installments = [t for t in purchases if (t["installmentTotal"] or 0) > 1]
    if installments:
        out.append("## Compras parceladas")
        out.append("")
        out.append("| Compra | Descrição | Parcela | Valor | Faturas | Restantes |")
        out.append("|---|---|---:|---:|---|---:|")
        due = info.get("invoiceDueDate")
        for t in installments:
            remaining = t["installmentTotal"] - t["installmentNumber"]
            if due:
                y, m, d = map(int, due.split("-"))
                first = date(y, m, 1)
                if remaining > 0:
                    last = add_months(first, remaining)
                    faturas = (
                        f"{month_label(f'{y:04d}-{m:02d}')} → "
                        f"{month_label(last.strftime('%Y-%m'))}"
                    )
                else:
                    faturas = f"{month_label(f'{y:04d}-{m:02d}')} (última)"
            else:
                faturas = "—"
            out.append(
                f"| {fmt_date(t['date'])} | {t['description']} | "
                f"{t['installmentNumber']}/{t['installmentTotal']} | {fmt_brl(t['amount'])} | "
                f"{faturas} | {remaining} |"
            )
        out.append("")

    # Lançamentos
    out.append("## Lançamentos")
    out.append("")
    out.append("| Data | Descrição | Parcela | Valor | Tipo | Categoria |")
    out.append("|---|---|---|---:|---|---|")
    for t in transactions:
        if t["type"] == "payment":
            continue
        inst = f"{t['installmentNumber']}/{t['installmentTotal']}" if t["installmentNumber"] else ""
        category = t["category"] if t["categoryConfident"] else "**?**"
        if t["compensated"]:
            category = "_compensado_"
        sign = "−" if t["type"] == "refund" else ""
        extra = f" ({t['currency']})" if t["currency"] != "BRL" else ""
        out.append(
            f"| {fmt_date(t['date'])} | {t['description']}{extra} | {inst} | "
            f"{sign}{fmt_brl(t['amount'])} | {t['type']} | {category} |"
        )
    out.append("")

    pending = [
        t for t in transactions
        if t["type"] not in ("payment",) and not t["categoryConfident"]
    ]
    out.append("## Para revisar")
    out.append("")
    if pending:
        out.append(f"- {len(pending)} lançamento(s) sem categoria óbvia: " +
                   ", ".join(f"`{t['description']}`" for t in pending))
    else:
        out.append("- Nenhum: todas as categorias foram inferidas por palavra-chave.")
    out.append("- Categorias marcadas com **?** precisam de decisão (humana ou da IA).")
    out.append("")
    return "\n".join(out)


def build_ai_input(transactions: list[dict], info: dict) -> str:
    """
    Lista compacta para a IA categorizar.
    ~3 KB de texto em vez das 4 páginas do PDF (que viram imagem e custam muito mais tokens).
    """
    rows = [t for t in transactions if t["type"] != "payment" and not t["compensated"]]
    out = [
        f"FATURA {month_label(info.get('referenceMonth'))} | vencimento {info.get('invoiceDueDate')}",
        "Formato: indice|data|descricao|valor|tipo|parcela|categoria_sugerida",
        "",
    ]
    for index, t in enumerate(rows, start=1):
        inst = (
            f"{t['installmentNumber']}/{t['installmentTotal']}"
            if t["installmentNumber"] else ""
        )
        out.append(
            f"{index}|{t['date']}|{t['description']}|{t['amount']:.2f}|{t['type']}|{inst}|{t['category']}"
        )
    out.append("")
    out.append("Responda apenas com JSON: {\"1\": \"Categoria\", \"2\": \"Categoria\", ...}")
    return "\n".join(out)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai lançamentos de fatura PDF (sem IA).")
    parser.add_argument("pdf", type=Path, help="caminho do PDF da fatura")
    parser.add_argument("--out", type=Path, default=None,
                        help="caminho base da saída (sem extensão). Padrão: ao lado do PDF")
    parser.add_argument("--json-only", action="store_true", help="gera apenas o .json")
    parser.add_argument("--ai-input", action="store_true",
                        help="gera também <nome>.ai.txt (lista compacta para a IA categorizar)")
    args = parser.parse_args()

    if not args.pdf.exists():
        return f"Arquivo não encontrado: {args.pdf}"  # type: ignore[return-value]

    pages = extract_text(args.pdf)
    text = "\n".join(line for page in pages for line in page)
    info = parse_header(text)
    transactions = parse_transactions(pages, info)
    compensated_pairs = mark_compensated(transactions)
    info["compensatedPairs"] = len(compensated_pairs)

    base = args.out or args.pdf.with_suffix("")
    base = Path(base)
    base.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "source": str(args.pdf),
        "bankName": "BTG Pactual" if "BTG" in text else None,
        **info,
        "transactions": transactions,
    }
    base.with_suffix(".json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if not args.json_only:
        base.with_suffix(".md").write_text(
            build_report(transactions, info, str(args.pdf)), encoding="utf-8"
        )
    if args.ai_input:
        base.with_suffix(".ai.txt").write_text(
            build_ai_input(transactions, info), encoding="utf-8"
        )

    purchases = sum(t["amount"] for t in transactions if t["type"] in ("purchase", "fee"))
    refunds = sum(t["amount"] for t in transactions if t["type"] == "refund")
    print(f"Lançamentos: {len(transactions)} | compras {fmt_brl(purchases)} | "
          f"estornos {fmt_brl(refunds)} | líquido {fmt_brl(purchases - refunds)}")
    print(f"Saída: {base.with_suffix('.json')}" + ("" if args.json_only else f" e {base.with_suffix('.md')}")
          + (f" e {base.with_suffix('.ai.txt')}" if args.ai_input else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
