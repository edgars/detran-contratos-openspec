import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ORIGINAIS } from "./comum";
import { COLUNAS_CONTRATO, SELECT_LINHA, paraLinhas, type LinhaContrato } from "./linha-contrato";
import { vencidosParams, type VencidosParams } from "./params";

/** Contratos vencidos (019-relatorios). Legado: docs/legado/relatorios.md, tela `vencidos`. */

export const params = vencidosParams;
export const colunas = COLUNAS_CONTRATO;
export const slug = "contratos-vencidos";

export function titulo(inicio: Date, fim: Date) {
  return `Contratos vencidos - Período de: ${formatDate(inicio)} até ${formatDate(fim)}`;
}

export async function consultar(p: VencidosParams): Promise<{ titulo: string; linhas: LinhaContrato[] }> {
  const rows = await prisma.contrato.findMany({
    where: {
      ...ORIGINAIS,
      // Legado: `data_termino BETWEEN início AND fim` (inclusive), só pela dataTermino do próprio
      // contrato: um aditivo que prorroga não tira o original do relatório (diretiva do autor).
      dataTermino: { gte: p.inicio, lte: p.fim },
    },
    select: SELECT_LINHA,
    orderBy: [{ dataTermino: "asc" }, { id: "asc" }],
  });
  return { titulo: titulo(p.inicio, p.fim), linhas: await paraLinhas(rows) };
}
