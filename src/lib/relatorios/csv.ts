import { Prisma } from "@prisma/client";
import { formatDate } from "@/lib/format";

/**
 * CSV compatível com o Excel pt-BR (019-relatorios, design.md › CSV), no lugar do `criaExcel` do
 * legado: UTF-8 com BOM, separador `;`, linhas CRLF, datas `dd/MM/yyyy`, valores `1234,56`.
 */

export type ValorCelula = string | number | Date | Prisma.Decimal | null | undefined;

export type ColunaCsv<L> = { label: string; valor: (linha: L) => ValorCelula };

const BOM = "﻿";
const CRLF = "\r\n";

/** Início de célula que o Excel interpretaria como fórmula. */
const FORMULA = /^[=+\-@\t\r]/;

function texto(v: ValorCelula): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDate(v);
  // Valor sem `R$` e sem milhar, com vírgula decimal: o Excel pt-BR lê como número.
  if (v instanceof Prisma.Decimal) return v.toFixed(2).replace(".", ",");
  if (typeof v === "number") return String(v).replace(".", ",");
  // Injeção de fórmula: texto que começa com =, +, -, @, tab ou CR recebe "'" na frente.
  return FORMULA.test(v) ? `'${v}` : v;
}

function celula(v: ValorCelula): string {
  const t = texto(v);
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function toCsv<L>(colunas: ColunaCsv<L>[], linhas: L[]): string {
  const cabecalho = colunas.map((c) => celula(c.label)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"));
  return BOM + [cabecalho, ...corpo].map((linha) => linha + CRLF).join("");
}

/** Data de hoje (servidor) como `AAAA-MM-DD`, para o nome do arquivo. */
export function dataArquivo(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Resposta de download do CSV: `<relatorio>-AAAA-MM-DD.csv`. */
export function respostaCsv(relatorio: string, conteudo: string, now = new Date()): Response {
  return new Response(conteudo, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${relatorio}-${dataArquivo(now)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
