import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nomesDosGestores, rotuloGestor } from "./chaves";
import { ORIGINAIS, compararTexto, somaDecimal } from "./comum";
import type { ColunaCsv } from "./csv";
import { porGestorParams, type PorGestorParams } from "./params";

/**
 * Contratos por gestor (019-relatorios). Legado: docs/legado/relatorios.md, tela `gestores` —
 * agrupa por gestor, tipo e unidade: `COUNT(id)`, `SUM(valor_total)`.
 */

export const params = porGestorParams;
export const slug = "contratos-por-gestor";
export const TITULO = "Contratos acumulados pelo gestor";
export const SEM_GESTOR = "Sem gestor";

export type LinhaGestor = {
  gestorCpf: string | null;
  gestor: string;
  tipo: string | null;
  unidade: string | null;
  qtde: number;
  valorAcumulado: Prisma.Decimal;
};

export const colunas: ColunaCsv<LinhaGestor>[] = [
  { label: "Qtde", valor: (l) => l.qtde },
  { label: "Tipo", valor: (l) => l.tipo },
  { label: "Valor acumulado", valor: (l) => l.valorAcumulado },
  { label: "Gestor", valor: (l) => l.gestor },
  { label: "UN Gestora", valor: (l) => l.unidade },
];

export async function consultar(p: PorGestorParams) {
  const where: Prisma.ContratoWhereInput = {
    ...ORIGINAIS,
    ...(p.gestor ? { pessoaFisicaId: p.gestor } : {}),
    ...(p.departamentoId ? { departamentoId: p.departamentoId } : {}),
  };
  const rows = await prisma.contrato.findMany({
    where,
    select: {
      pessoaFisicaId: true,
      tipoContratoId: true,
      departamentoId: true,
      valorTotal: true,
      tipoContrato: { select: { nome: true } },
      departamento: { select: { deDepartamento: true } },
    },
  });
  const nomes = await nomesDosGestores(rows.map((r) => r.pessoaFisicaId));

  // Agrupamento em memória: somas em Decimal (o `_sum` do SQLite soma em ponto flutuante).
  // Contrato sem gestor forma o grupo "Sem gestor" (o belongsTo do CakePHP é LEFT JOIN).
  const grupos = new Map<string, { linha: LinhaGestor; valores: (Prisma.Decimal | null)[] }>();
  for (const r of rows) {
    const chave = `${r.pessoaFisicaId ?? ""}|${r.tipoContratoId ?? ""}|${r.departamentoId ?? ""}`;
    let g = grupos.get(chave);
    if (!g) {
      g = {
        linha: {
          gestorCpf: r.pessoaFisicaId,
          gestor: rotuloGestor(r.pessoaFisicaId, nomes) ?? SEM_GESTOR,
          tipo: r.tipoContrato?.nome ?? null,
          unidade: r.departamento?.deDepartamento ?? null,
          qtde: 0,
          valorAcumulado: somaDecimal([]),
        },
        valores: [],
      };
      grupos.set(chave, g);
    }
    g.linha.qtde += 1;
    g.valores.push(r.valorTotal);
  }
  const linhas = [...grupos.values()]
    .map((g) => ({ ...g.linha, valorAcumulado: somaDecimal(g.valores) }))
    .sort((a, b) => {
      // Ordem: gestor, tipo, unidade (alfabética); "Sem gestor" por último.
      const semA = a.gestorCpf ? 0 : 1;
      const semB = b.gestorCpf ? 0 : 1;
      return semA - semB || compararTexto(a.gestor, b.gestor) || compararTexto(a.tipo, b.tipo) || compararTexto(a.unidade, b.unidade);
    });
  return {
    titulo: TITULO,
    linhas,
    totais: { qtde: linhas.reduce((n, l) => n + l.qtde, 0), valorAcumulado: somaDecimal(linhas.map((l) => l.valorAcumulado)) },
  };
}

/** Opções do filtro Gestor: só quem é gestor (`pessoaFisicaId`) de algum contrato original, pelo nome. */
export async function gestores(): Promise<{ value: string; label: string }[]> {
  const rows = await prisma.contrato.findMany({
    where: { ...ORIGINAIS, pessoaFisicaId: { not: null } },
    select: { pessoaFisicaId: true },
    distinct: ["pessoaFisicaId"],
  });
  const cpfs = rows.map((r) => r.pessoaFisicaId).filter((c): c is string => !!c && c.trim() !== "");
  const nomes = await nomesDosGestores(cpfs);
  return cpfs
    .map((cpf) => ({ value: cpf, label: rotuloGestor(cpf, nomes) ?? cpf }))
    .sort((a, b) => compararTexto(a.label, b.label));
}
