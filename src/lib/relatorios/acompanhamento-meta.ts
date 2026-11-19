import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SELECT_CONTRATADA, nomesDosGestores, ordemContratada, rotuloGestor } from "./chaves";
import {
  ORIGINAIS,
  SEM_TIPO_CONTRATO,
  TIPO_CONTRATO,
  TIPO_RISCO,
  diasAte,
  existeTipoContrato,
  hojeUtc,
  maisDias,
  somaDecimal,
} from "./comum";
import { semFiltrosParams } from "./params";

/**
 * Acompanhamento de meta (019-relatorios), igual ao legado por decisão do autor.
 * Legado: docs/legado/relatorios.md, tela `meta` — três listas de contratos originais.
 */

// TODO(review): limites de dia e layout de meta.ctp (design.md › Open Questions) — "até 180 dias"
// lido como `≤ 180`; contrato que vence hoje não é vigente nem vencido; resumo + detalhe por lista.

export const params = semFiltrosParams;
export const slug = "acompanhamento-meta";
export const TITULO = "Acompanhamento de meta";
export const JANELA_RISCO = 180;

export type ListaMeta = "total" | "vencidos" | "risco";

export const ROTULOS_LISTA: Record<ListaMeta, string> = {
  total: "Total",
  vencidos: "Vencidos",
  risco: "Em prorrogação/risco",
};

export type LinhaMeta = {
  id: number;
  processo: string | null;
  contrato: string | null;
  objeto: string;
  contratada: string | null;
  gestor: string | null;
  unidade: string | null;
  vencimento: Date | null;
  diasParaVencer: number | null;
  naPresidencia: boolean;
  valorTotal: Prisma.Decimal | null;
};

export type BlocoMeta = { lista: ListaMeta; rotulo: string; valorTotal: Prisma.Decimal; termos: number; linhas: LinhaMeta[] };

const SELECT_META = {
  id: true,
  numeroProcesso: true,
  numeroContrato: true,
  objeto: true,
  dataTermino: true,
  valorTotal: true,
  naPresidencia: true,
  pessoaFisicaId: true,
  departamento: { select: { deDepartamento: true } },
  ...SELECT_CONTRATADA,
} satisfies Prisma.ContratoSelect;

export async function consultar(now = new Date()): Promise<{ titulo: string; listas: BlocoMeta[]; avisos?: string[] }> {
  const hoje = hojeUtc(now);
  const temTipo = await existeTipoContrato();

  const buscar = (where: Prisma.ContratoWhereInput, orderBy: Prisma.ContratoOrderByWithRelationInput[]) =>
    prisma.contrato.findMany({ where: { AND: [ORIGINAIS, where] }, select: SELECT_META, orderBy });

  const [total, vencidos, risco] = await Promise.all([
    // Legado: total — tipo "Contrato", vigentes (`data_termino > hoje`).
    temTipo ? buscar({ ...TIPO_CONTRATO, dataTermino: { gt: hoje } }, [{ dataTermino: "asc" }, { id: "asc" }]) : [],
    // Legado: vencidos — tipo "Contrato", `data_termino < hoje`, ordem por contratada.
    temTipo ? buscar({ ...TIPO_CONTRATO, dataTermino: { lt: hoje } }, [ordemContratada("asc"), { id: "asc" }]) : [],
    // Legado: em prorrogação/risco — tipos com `indicativo_meta_risco = 1`, vencendo em até 180 dias.
    buscar({ ...TIPO_RISCO, dataTermino: { gt: hoje, lte: maisDias(hoje, JANELA_RISCO) } }, [{ dataTermino: "asc" }, { id: "asc" }]),
  ]);

  const nomes = await nomesDosGestores([...total, ...vencidos, ...risco].map((r) => r.pessoaFisicaId));
  const bloco = (lista: ListaMeta, rows: typeof total): BlocoMeta => ({
    lista,
    rotulo: ROTULOS_LISTA[lista],
    valorTotal: somaDecimal(rows.map((r) => r.valorTotal)),
    termos: rows.length,
    linhas: rows.map((r) => ({
      id: r.id,
      processo: r.numeroProcesso,
      contrato: r.numeroContrato,
      objeto: r.objeto,
      contratada: r.prestadorServico?.deRazaoSocial ?? null,
      gestor: rotuloGestor(r.pessoaFisicaId, nomes),
      unidade: r.departamento?.deDepartamento ?? null,
      vencimento: r.dataTermino,
      diasParaVencer: r.dataTermino ? diasAte(r.dataTermino, hoje) : null,
      // `na_presidencia` do legado (020 grava 1/0): 1 → Sim, senão Não.
      naPresidencia: r.naPresidencia === 1,
      valorTotal: r.valorTotal,
    })),
  });

  return {
    titulo: TITULO,
    listas: [bloco("total", total), bloco("vencidos", vencidos), bloco("risco", risco)],
    ...(temTipo ? {} : { avisos: [SEM_TIPO_CONTRATO] }),
  };
}
