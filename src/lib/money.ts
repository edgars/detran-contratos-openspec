import { Prisma } from "@prisma/client";
import { parseCurrency } from "@/lib/format";

/**
 * Converte valor monetário vindo do formulário (`1.234,56`, `R$ 10` ou `1234.56`) para Decimal,
 * sem passar por número de ponto flutuante (001b-security-baseline › "Valores monetários em Decimal").
 */
export function toDecimal(input: unknown): Prisma.Decimal | null {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Prisma.Decimal) return input;
  const text = String(input).trim();
  const decimal = /^-?\d+(\.\d+)?$/.test(text) ? text : parseCurrency(text);
  return decimal === null ? null : new Prisma.Decimal(decimal);
}
