import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Db } from "@/lib/crud/server";
import { FieldRuleError } from "@/lib/crud/server";
import { onlyDigits } from "@/lib/documento";
import { pessoasPorCpf } from "@/lib/reference/pessoas";

/**
 * Critérios e cálculos da prestação de contas (021-prestacao-contas-fluxo).
 * Legado: docs/legado/prestacao-contas.md (`prestacao_contas_controller.php`, `models/prestacao_conta.php`).
 * Nenhuma chave RK-… conhecida para estas regras (docs/legado/rk-conferencia.md); ver design.md › Open Questions.
 */

const DAY = 86_400_000;

/**
 * Legado: docs/legado/prestacao-contas.md — `valor_total > 650.000`. Regra de negócio igual em todos
 * os ambientes: mudar exige uma change e um teste, não configuração.
 */
export const PRESTACAO_VALOR_MINIMO = new Prisma.Decimal("650000.00");

/** Meia-noite UTC do dia do servidor (mesma convenção de `contratosWhere`: `dataTermino` é meia-noite UTC). */
export function hojeUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// ---------------------------------------------------------------------------------------------
// Parâmetros da lista (filtros, nunca colunas — diretiva do autor)
// ---------------------------------------------------------------------------------------------

export const CAMPOS_BUSCA = ["unGestora", "gestor", "contratada", "numeroContrato", "numeroProcesso", "objeto"] as const;
export type CampoBusca = (typeof CAMPOS_BUSCA)[number];

export const ORDENACOES = ["contratada", "vencimento", "valor", "unGestora", "gestor"] as const;
export type Ordenacao = (typeof ORDENACOES)[number];

export type Situacao = "pendentes" | "realizadas";

export type PrestacaoParams = {
  situacao: Situacao;
  campo: CampoBusca;
  q: string;
  ordenar: Ordenacao;
  dir: "asc" | "desc";
  tipoContratoId: number | null;
  modalidadeId: number | null;
};

const positiveInt = (value: string | null) => {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number.parseInt(value, 10);
  return n > 0 ? n : null;
};

/** Lê os parâmetros da lista. `campo` fora da lista → `FieldRuleError` (400); ordenação inválida → padrão. */
export function parsePrestacaoParams(params: URLSearchParams): PrestacaoParams {
  const campoRaw = (params.get("campo") ?? "").trim();
  if (campoRaw && !(CAMPOS_BUSCA as readonly string[]).includes(campoRaw)) {
    throw new FieldRuleError({ campo: "Coluna de busca inválida" });
  }
  const [ordRaw, inlineDir] = (params.get("ordenar") ?? "").trim().split(":");
  const ordenarValido = (ORDENACOES as readonly string[]).includes(ordRaw);
  const dirRaw = (inlineDir ?? params.get("dir") ?? "asc").toLowerCase();
  return {
    situacao: params.get("situacao") === "realizadas" ? "realizadas" : "pendentes",
    campo: (campoRaw || "objeto") as CampoBusca,
    q: (params.get("q") ?? "").trim(),
    // Ordenação desconhecida cai no padrão (vencimento crescente), sem erro.
    ordenar: ordenarValido ? (ordRaw as Ordenacao) : "vencimento",
    dir: ordenarValido && dirRaw === "desc" ? "desc" : "asc",
    tipoContratoId: positiveInt(params.get("tipoContratoId")),
    modalidadeId: positiveInt(params.get("modalidadeId")),
  };
}

// ---------------------------------------------------------------------------------------------
// Gestor (chave em contratos.pessoaFisicaId)
// ---------------------------------------------------------------------------------------------

/**
 * Chaves de `contratos.pessoaFisicaId` dos gestores cujo nome contém `q`. Ponto único da chave do
 * gestor: desde a 022-pessoas-fornecedores, o CPF (11 dígitos) de `pessoas_fisicas.cpf`.
 */
export async function gestorKeysPorNome(q: string, db: Db = prisma): Promise<string[]> {
  const pessoas = await db.pessoaFisica.findMany({ where: { deNome: { contains: q }, cpf: { not: null } }, select: { cpf: true } });
  return [...new Set(pessoas.map((p) => p.cpf as string))];
}

/** Nome do gestor por chave de `contratos.pessoaFisicaId` (CPF), pelo helper da 022 (`pessoasPorCpf`). */
export async function nomesGestores(keys: (string | null)[]): Promise<Map<string, string>> {
  const pessoas = await pessoasPorCpf(keys);
  return new Map([...pessoas].filter(([, p]) => p.deNome).map(([cpf, p]) => [cpf, p.deNome as string]));
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/**
 * Ordena por nome do gestor (o Prisma não ordena por campo sem relação). Sem gestor sempre por
 * último; desempate `id desc`. Devolve os ids na ordem.
 */
export function ordenarPorGestor(
  rows: { id: number; pessoaFisicaId: string | null }[],
  nomes: Map<string, string>,
  dir: "asc" | "desc" = "asc",
): number[] {
  const nome = (r: { pessoaFisicaId: string | null }) => (r.pessoaFisicaId ? (nomes.get(onlyDigits(r.pessoaFisicaId)) ?? null) : null);
  return [...rows]
    .sort((a, b) => {
      const na = nome(a);
      const nb = nome(b);
      if (na === null || nb === null) return na === nb ? b.id - a.id : na === null ? 1 : -1;
      const c = collator.compare(na, nb);
      return c !== 0 ? (dir === "desc" ? -c : c) : b.id - a.id;
    })
    .map((r) => r.id);
}

// ---------------------------------------------------------------------------------------------
// Critério da lista
// ---------------------------------------------------------------------------------------------

/** Busca `q` na coluna `campo` (parametrizada pelo Prisma). */
async function buscaWhere(campo: CampoBusca, q: string, db: Db): Promise<Prisma.ContratoWhereInput> {
  switch (campo) {
    case "unGestora":
      return { departamento: { deDepartamento: { contains: q } } };
    case "contratada":
      return { prestadorServico: { deRazaoSocial: { contains: q } } };
    case "gestor":
      return { pessoaFisicaId: { in: await gestorKeysPorNome(q, db) } };
    default:
      return { [campo]: { contains: q } };
  }
}

/** `where` dos contratos sujeitos à prestação de contas, com situação, filtros e busca. */
export async function prestacaoWhere(
  params: PrestacaoParams,
  now = new Date(),
  db: Db = prisma,
): Promise<Prisma.ContratoWhereInput> {
  const and: Prisma.ContratoWhereInput[] = [
    // Legado: docs/legado/prestacao-contas.md — `tipo_contrato_id IN PrestacaoConta::tiposContratos`;
    // no app novo, tipos marcados com tipo_contrato.prestacaoContas = "S".
    { tipoContrato: { prestacaoContas: "S" } },
    // Legado: docs/legado/prestacao-contas.md — `parent_id IS NULL` (só o contrato original).
    { parentId: null },
    // Legado: docs/legado/prestacao-contas.md — `data_termino < hoje`; só a dataTermino do próprio
    // contrato (diretiva do autor 13/11/2026: aditivos não prorrogam o vencimento).
    { dataTermino: { lt: hojeUtc(now) } },
    // Legado: docs/legado/prestacao-contas.md — `valor_total > 650.000` (estrito; nulo não entra).
    { valorTotal: { gt: PRESTACAO_VALOR_MINIMO } },
    // Legado: docs/legado/prestacao-contas.md — pendentes `prestacao_realizada = 0`, realizadas `= 1`
    // (nulo conta como pendente: a coluna nunca foi gravada antes desta change).
    params.situacao === "realizadas"
      ? { prestacaoRealizada: "1" }
      : { OR: [{ prestacaoRealizada: null }, { prestacaoRealizada: { not: "1" } }] },
  ];
  if (params.tipoContratoId) and.push({ tipoContratoId: params.tipoContratoId });
  if (params.modalidadeId) and.push({ modalidadeId: params.modalidadeId });
  if (params.q) and.push(await buscaWhere(params.campo, params.q, db));
  return { AND: and };
}

/** `orderBy` do Prisma para as ordenações com coluna (gestor é ordenado em memória). */
export function prestacaoOrderBy(ordenar: Ordenacao, dir: "asc" | "desc"): Prisma.ContratoOrderByWithRelationInput[] {
  const by: Record<Exclude<Ordenacao, "gestor">, Prisma.ContratoOrderByWithRelationInput> = {
    contratada: { prestadorServico: { deRazaoSocial: dir } },
    vencimento: { dataTermino: dir },
    valor: { valorTotal: dir },
    unGestora: { departamento: { deDepartamento: dir } },
  };
  return [ordenar === "gestor" ? by.vencimento : by[ordenar], { id: "desc" }];
}

// ---------------------------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------------------------

/** Dias desde o vencimento em datas de calendário (negativo se ainda não venceu). */
export function diasDesdeVencimento(dataTermino: Date | null, now = new Date()): number | null {
  if (!dataTermino) return null;
  const alvo = Date.UTC(dataTermino.getUTCFullYear(), dataTermino.getUTCMonth(), dataTermino.getUTCDate());
  return Math.round((hojeUtc(now).getTime() - alvo) / DAY);
}

/** Legado: docs/legado/prestacao-contas.md — `PERIOD_DIFF(now, data_inicio)`: (ano·12 + mês), ignorando o dia. */
export function mesesDesdeInicio(dataInicio: Date | null, now = new Date()): number | null {
  if (!dataInicio) return null;
  return now.getFullYear() * 12 + now.getMonth() - (dataInicio.getUTCFullYear() * 12 + dataInicio.getUTCMonth());
}

/** Prazos (valores distintos de `fases.periodo`, aparados): numéricos em ordem numérica, depois alfabética. */
export function ordenarPrazos(periodos: string[]): string[] {
  const unicos = [...new Set(periodos.map((p) => p.trim()).filter(Boolean))];
  const num = (p: string) => (/^\d+(\.\d+)?$/.test(p) ? Number(p) : null);
  return unicos.sort((a, b) => {
    const na = num(a);
    const nb = num(b);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return collator.compare(a, b);
  });
}

// ---------------------------------------------------------------------------------------------
// Conclusão
// ---------------------------------------------------------------------------------------------

/** Período da fase final do fluxo. */
export const PERIODO_FINAL = "30";

/**
 * Regra de conclusão, na transação da gravação da fase. Só marca como realizada; nunca desfaz.
 * Devolve `true` quando concluiu.
 */
export async function concluiSeFaseFinal(
  tx: Db,
  fase: { periodo: string } | null,
  atendido: string | null | undefined,
  contratoId: number,
): Promise<boolean> {
  // Legado: docs/legado/prestacao-contas.md — periodo == 30 && atendido == 1 → prestacao_realizada = 1
  if (fase && fase.periodo.trim() === PERIODO_FINAL && atendido === "S") {
    await tx.contrato.update({ where: { id: contratoId }, data: { prestacaoRealizada: "1" } });
    return true;
  }
  return false;
}
