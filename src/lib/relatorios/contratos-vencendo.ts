import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ordemContratada } from "./chaves";
import { ORIGINAIS, compararTexto, hojeUtc, maisDias } from "./comum";
import { COLUNAS_CONTRATO, SELECT_LINHA, paraLinhas, type LinhaContrato } from "./linha-contrato";
import { vencendoParams, type OrdenacaoVencendo, type VencendoParams } from "./params";

/** Contratos vencendo (019-relatorios). Legado: docs/legado/relatorios.md, tela `vencendo`. */

export const params = vencendoParams;
export const colunas = COLUNAS_CONTRATO;
export const slug = "contratos-vencendo";

export const ROTULOS_ORDENACAO: Record<OrdenacaoVencendo, string> = {
  vencimento: "Vencimento",
  contratada: "Contratada",
  gestor: "Gestor",
  unidade: "UN Gestora",
  valor: "Valor total",
};

export function titulo(dias: number) {
  return `Contratos vencendo em ${dias} dias`;
}

function orderBy(sort: OrdenacaoVencendo, dir: "asc" | "desc"): Prisma.ContratoOrderByWithRelationInput[] {
  const by: Record<Exclude<OrdenacaoVencendo, "gestor">, Prisma.ContratoOrderByWithRelationInput> = {
    vencimento: { dataTermino: dir },
    // Fornecedor é FK por `id` (decisão D3 da 022): ordena no banco pela relação.
    contratada: ordemContratada(dir),
    unidade: { departamento: { deDepartamento: dir } },
    valor: { valorTotal: dir },
  };
  return [sort === "gestor" ? by.vencimento : by[sort], { dataTermino: "asc" }, { id: "asc" }];
}

export async function consultar(p: VencendoParams, now = new Date()): Promise<{ titulo: string; linhas: LinhaContrato[] }> {
  const hoje = hojeUtc(now);
  const where: Prisma.ContratoWhereInput = {
    AND: [
      ORIGINAIS,
      // Legado: `data_termino - hoje > 0 AND < Dias` (estrito nos dois lados). Só a dataTermino do
      // próprio contrato, nunca a de um aditivo (diretiva do autor de 13/11/2026).
      { dataTermino: { gt: hoje, lt: maisDias(hoje, p.dias) } },
      // Legado: período informado → `data_termino BETWEEN início AND fim` (inclusive).
      ...(p.inicio && p.fim ? [{ dataTermino: { gte: p.inicio, lte: p.fim } }] : []),
    ],
  };
  const rows = await prisma.contrato.findMany({ where, select: SELECT_LINHA, orderBy: orderBy(p.sort, p.dir) });
  let linhas = await paraLinhas(rows);
  if (p.sort === "gestor") {
    // Gestor é CPF sem FK: ordena em memória pelo nome resolvido (estável: mantém vencimento como desempate).
    const sinal = p.dir === "desc" ? -1 : 1;
    linhas = [...linhas].sort((a, b) => {
      if (!a.gestor || !b.gestor) return compararTexto(a.gestor, b.gestor);
      return sinal * compararTexto(a.gestor, b.gestor);
    });
  }
  return { titulo: titulo(p.dias), linhas };
}
