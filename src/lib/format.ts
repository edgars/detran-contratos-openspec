/**
 * Locale pt-BR (001-project-foundation › locale-and-formats): datas `dd/MM/yyyy` e moeda `R$`.
 * Todo formulário e toda lista usam estes formatadores; nunca formatar inline.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Formata uma data como `dd/MM/yyyy`. Datas sem hora são tratadas em UTC para não mudar de dia. */
export function formatDate(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

/** Lê `dd/MM/yyyy` e devolve a data (meia-noite UTC), ou `null` se a data não existir. */
export function parseDate(text: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return valid ? date : null;
}

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Formata um valor monetário como `R$ 1.234,56`, sem passar por ponto flutuante.
 * Aceita número, string decimal (`"1234.56"`) ou um Decimal do Prisma (qualquer objeto com `toString()`).
 */
export function formatCurrency(value: number | string | { toString(): string } | null | undefined): string {
  if (value == null || value === "") return "";
  const text = typeof value === "number" ? value.toFixed(2) : value.toString().trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return "";
  const [, sign, intPart, fraction = ""] = match;
  const cents = `${fraction}00`.slice(0, 2);
  const roundUp = fraction.length > 2 && Number(fraction[2]) >= 5;
  const hundred = BigInt(100);
  const totalCents = BigInt(intPart) * hundred + BigInt(cents) + BigInt(roundUp ? 1 : 0);
  const reais = totalCents / hundred;
  const centavos = Number(totalCents % hundred);
  const isZero = totalCents === BigInt(0);
  return `${sign && !isZero ? "-" : ""}R$ ${groupThousands(reais.toString())},${pad(centavos)}`;
}

/** Lê `1.234,56` (ou `R$ 1.234,56`) e devolve a string decimal `"1234.56"`, ou `null` se inválido. */
export function parseCurrency(text: string): string | null {
  const clean = text.replace(/R\$\s?/, "").trim();
  const match = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  const [, sign, intPart, fraction = ""] = match;
  return `${sign}${intPart.replace(/\./g, "")}.${fraction.padEnd(2, "0")}`;
}
