import type { Prisma } from "@prisma/client";
import { SELECT_CONTRATADA, nomesDosGestores, rotuloGestor } from "./chaves";
import type { ColunaCsv } from "./csv";

/**
 * Linha de contrato de Contratos vencendo e Contratos vencidos (mesmas colunas, nesta ordem:
 * Contratada, Gestor, UN Gestora, Tipo, Contrato, Processo, Objeto, Valor total, Vencimento —
 * docs/legado/relatorios.md, telas `vencendo` e `vencidos`).
 */

export const SELECT_LINHA = {
  id: true,
  numeroContrato: true,
  numeroProcesso: true,
  objeto: true,
  valorTotal: true,
  dataTermino: true,
  pessoaFisicaId: true,
  departamento: { select: { deDepartamento: true } },
  tipoContrato: { select: { nome: true } },
  ...SELECT_CONTRATADA,
} satisfies Prisma.ContratoSelect;

type Row = Prisma.ContratoGetPayload<{ select: typeof SELECT_LINHA }>;

export type LinhaContrato = {
  id: number;
  contratada: string | null;
  gestorCpf: string | null;
  gestor: string | null;
  unidade: string | null;
  tipo: string | null;
  contrato: string | null;
  processo: string | null;
  objeto: string;
  valorTotal: Prisma.Decimal | null;
  vencimento: Date | null;
};

/** Converte as linhas do banco, resolvendo o nome do gestor pelo CPF (uma consulta só). */
export async function paraLinhas(rows: Row[]): Promise<LinhaContrato[]> {
  const nomes = await nomesDosGestores(rows.map((r) => r.pessoaFisicaId));
  return rows.map((r) => ({
    id: r.id,
    contratada: r.prestadorServico?.deRazaoSocial ?? null,
    gestorCpf: r.pessoaFisicaId,
    gestor: rotuloGestor(r.pessoaFisicaId, nomes),
    unidade: r.departamento?.deDepartamento ?? null,
    tipo: r.tipoContrato?.nome ?? null,
    contrato: r.numeroContrato,
    processo: r.numeroProcesso,
    objeto: r.objeto,
    valorTotal: r.valorTotal,
    vencimento: r.dataTermino,
  }));
}

export const COLUNAS_CONTRATO: ColunaCsv<LinhaContrato>[] = [
  { label: "Contratada", valor: (l) => l.contratada },
  { label: "Gestor", valor: (l) => l.gestor },
  { label: "UN Gestora", valor: (l) => l.unidade },
  { label: "Tipo", valor: (l) => l.tipo },
  { label: "Contrato", valor: (l) => l.contrato },
  { label: "Processo", valor: (l) => l.processo },
  { label: "Objeto", valor: (l) => l.objeto },
  { label: "Valor total", valor: (l) => l.valorTotal },
  { label: "Vencimento", valor: (l) => l.vencimento },
];
