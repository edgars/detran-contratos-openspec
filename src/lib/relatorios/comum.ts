import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Peças comuns dos relatórios gerenciais (019-relatorios). Legado: docs/legado/relatorios.md
 * (`relatorios_controller.php`). Nenhuma regra `RK-…` do legado está associada aos relatórios
 * (docs/legado/rk-conferencia.md); os comentários citam o arquivo de evidência.
 */

export const DAY = 86_400_000;

/** Meia-noite UTC do dia do servidor: mesma convenção da lista de contratos (`dataTermino` é meia-noite UTC). */
export function hojeUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Soma `n` dias a uma data (meia-noite UTC continua meia-noite UTC). */
export function maisDias(data: Date, n: number): Date {
  return new Date(data.getTime() + n * DAY);
}

/** Dias de calendário de `hoje` até `data` (vence hoje = 0; vencido = negativo). */
export function diasAte(data: Date, hoje: Date): number {
  const alvo = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  return Math.round((alvo - hoje.getTime()) / DAY);
}

/**
 * Legado: docs/legado/relatorios.md — todas as consultas usam `parent_id IS NULL` (só o contrato
 * original). Vencimento só pela `dataTermino` do próprio contrato (diretiva do autor de 13/11/2026).
 */
export const ORIGINAIS = { parentId: null } satisfies Prisma.ContratoWhereInput;

/** Legado `tipo_contrato_id = Contrato::tipoContratoId` (id fixo) → tipos marcados com `contratoPrincipal = 'S'`. */
export const TIPO_CONTRATO = { tipoContrato: { contratoPrincipal: "S" } } satisfies Prisma.ContratoWhereInput;

/** Legado `indicativo_meta_risco = 1` → tipos marcados com `indicativoMetaRisco = 'S'`. */
export const TIPO_RISCO = { tipoContrato: { indicativoMetaRisco: "S" } } satisfies Prisma.ContratoWhereInput;

/** Aviso devolvido quando nenhum tipo está marcado como Contrato (design.md › Decisions). */
export const SEM_TIPO_CONTRATO = "SEM_TIPO_CONTRATO";
export const AVISO_SEM_TIPO_CONTRATO = "Nenhum tipo de contrato está marcado como Contrato.";

/** Há algum tipo de contrato marcado como "Contrato"? */
export async function existeTipoContrato(): Promise<boolean> {
  return (await prisma.tipoContrato.count({ where: { contratoPrincipal: "S" } })) > 0;
}

/** Soma em `Decimal` (nunca `Number` nem `_sum` do SQLite, que soma em ponto flutuante). Nulo soma zero. */
export function somaDecimal(valores: (Prisma.Decimal | null | undefined)[]): Prisma.Decimal {
  return valores.reduce<Prisma.Decimal>((acc, v) => (v ? acc.plus(v) : acc), new Prisma.Decimal(0));
}

export const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Compara textos em pt-BR; nulo/vazio por último. */
export function compararTexto(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return !a && !b ? 0 : !a ? 1 : -1;
  return collator.compare(a, b);
}
