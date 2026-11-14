import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parsePagination } from "@/lib/api/http";
import {
  diasDesdeVencimento,
  mesesDesdeInicio,
  nomesGestores,
  ordenarPorGestor,
  ordenarPrazos,
  parsePrestacaoParams,
  prestacaoOrderBy,
  prestacaoWhere,
} from "./criterios";

/** Consultas da prestação de contas (021-prestacao-contas-fluxo): lista e fluxo por contrato. */

export const prestacaoInclude = {
  departamento: { select: { id: true, deDepartamento: true } },
  prestadorServico: { select: { id: true, deRazaoSocial: true } },
  tipoContrato: { select: { id: true, nome: true } },
  modalidade: { select: { id: true, nome: true } },
} satisfies Prisma.ContratoInclude;

/** `GET /api/prestacao_contas/contratos`: página de contratos sujeitos à prestação de contas. */
export async function listarPrestacao(searchParams: URLSearchParams, now = new Date()) {
  const p = parsePagination(searchParams);
  const params = parsePrestacaoParams(searchParams);
  const where = await prestacaoWhere(params, now);
  const skip = (p.page - 1) * p.size;

  let items;
  let total: number;
  if (params.ordenar === "gestor") {
    // Ordenação por gestor em memória: o conjunto filtrado é pequeno (design.md › Decisions).
    const todos = await prisma.contrato.findMany({ where, select: { id: true, pessoaFisicaId: true } });
    const ids = ordenarPorGestor(todos, await nomesGestores(todos.map((c) => c.pessoaFisicaId)), params.dir).slice(skip, skip + p.size);
    const rows = await prisma.contrato.findMany({ where: { id: { in: ids } }, include: prestacaoInclude });
    items = ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
    total = todos.length;
  } else {
    [items, total] = await Promise.all([
      prisma.contrato.findMany({ where, include: prestacaoInclude, orderBy: prestacaoOrderBy(params.ordenar, params.dir), skip, take: p.size }),
      prisma.contrato.count({ where }),
    ]);
  }
  return {
    items: items.map((c) => ({ ...c, diasDesdeVencimento: diasDesdeVencimento(c.dataTermino, now) })),
    total,
    page: p.page,
    size: p.size,
  };
}

const usuarioSelect = { id: true, username: true } as const;

/** `GET /api/prestacao_contas/contratos/:id`: painel, prazos, fases do prazo e histórico. `null` se não existe. */
export async function getFluxo(id: number, periodoParam: string | null, now = new Date()) {
  const contrato = await prisma.contrato.findUnique({ where: { id }, include: prestacaoInclude });
  if (!contrato) return null;
  const [todasFases, registros] = await Promise.all([
    prisma.fase.findMany({ orderBy: { id: "asc" } }),
    prisma.prestacaoConta.findMany({ where: { contratoId: id }, orderBy: { id: "desc" } }),
  ]);
  // Só `{ id, username }`: nenhum campo de senha sai na resposta.
  const usuarios = await prisma.user.findMany({
    where: { id: { in: [...new Set(registros.map((r) => r.userId))] } },
    select: usuarioSelect,
  });
  const usuario = (userId: number) => usuarios.find((u) => u.id === userId) ?? null;
  const faseDe = (faseId: number) => todasFases.find((f) => f.id === faseId) ?? null;

  const prazos = ordenarPrazos(todasFases.map((f) => f.periodo));
  const pedido = (periodoParam ?? "").trim();
  // O prazo escolhido fica só na tela (parâmetro), nunca é gravado no contrato.
  const periodo = pedido && prazos.includes(pedido) ? pedido : (prazos[0] ?? null);

  const fases = todasFases
    .filter((f) => periodo !== null && f.periodo.trim() === periodo)
    .map((f) => {
      const ultimo = registros.find((r) => r.faseId === f.id);
      return {
        id: f.id,
        nome: f.nome,
        periodo: f.periodo.trim(),
        ultimo: ultimo
          ? { id: ultimo.id, descricao: ultimo.descricao, atendido: ultimo.atendido, dataInclusao: ultimo.dataInclusao, usuario: usuario(ultimo.userId) }
          : null,
      };
    });

  const historico = registros.map((r) => {
    const f = faseDe(r.faseId);
    return {
      id: r.id,
      dataInclusao: r.dataInclusao,
      fase: f ? { id: f.id, nome: f.nome, periodo: f.periodo.trim() } : null,
      descricao: r.descricao,
      atendido: r.atendido,
      usuario: usuario(r.userId),
    };
  });

  const { id: cid, numeroProcesso, numeroContrato, objeto, dataInicio, dataTermino, valorTotal, prestacaoRealizada } = contrato;
  return {
    contrato: {
      id: cid,
      numeroProcesso,
      numeroContrato,
      objeto,
      dataInicio,
      dataTermino,
      valorTotal,
      prestacaoRealizada,
      departamento: contrato.departamento,
      prestadorServico: contrato.prestadorServico,
      tipoContrato: contrato.tipoContrato,
      modalidade: contrato.modalidade,
    },
    diasDesdeVencimento: diasDesdeVencimento(dataTermino, now),
    mesesDesdeInicio: mesesDesdeInicio(dataInicio, now),
    realizada: prestacaoRealizada === "1",
    prazos,
    periodo,
    fases,
    historico,
  };
}

export type Fluxo = NonNullable<Awaited<ReturnType<typeof getFluxo>>>;
