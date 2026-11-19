import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type Db } from "@/lib/crud/server";
import { MSG } from "@/lib/rules";
import { optionalString, requiredInt } from "@/lib/rules/fields";
import { withAuthor } from "@/lib/auth/author";
import { concluiSeFaseFinal } from "@/lib/prestacao/criterios";

/**
 * API de Prestação de contas (008-prestacao-contas; 021-prestacao-contas-fluxo): gravação de uma
 * fase do fluxo (sempre um registro novo) com a regra de conclusão, e leitura do andamento.
 * Sem PUT nem DELETE: o andamento gravado é só leitura.
 */
const blankToUndefined = (v: unknown) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

export const PRESTACAO_MSG = {
  fase: MSG.obrigatorio("Fase"),
  contrato: MSG.obrigatorio("Contrato"),
  faseInexistente: "Fase não encontrada",
  contratoInexistente: "Contrato não encontrado",
} as const;

export const prestacaoContasSchema = z.object({
  descricao: optionalString(),
  // Coluna String: toggle grava "S"/"N".
  atendido: z.preprocess(blankToUndefined, z.enum(["S", "N"], { error: "Atendido deve ser S ou N" }).optional()),
  faseId: requiredInt(PRESTACAO_MSG.fase),
  contratoId: requiredInt(PRESTACAO_MSG.contrato),
});

type CreateArgs = { data: Prisma.PrestacaoContaUncheckedCreateInput; include?: object };

/** Delegate do kit: leitura pelo cliente recebido; `create` grava a fase e aplica a conclusão na mesma transação. */
const prestacaoDelegate = (db: Db = prisma) => ({
  findMany: (args: object) => db.prestacaoConta.findMany(args),
  count: (args: object) => db.prestacaoConta.count(args),
  findUnique: (args: object) => db.prestacaoConta.findUnique(args as Prisma.PrestacaoContaFindUniqueArgs),
  update: (args: object) => db.prestacaoConta.update(args as Prisma.PrestacaoContaUpdateArgs),
  delete: (args: object) => db.prestacaoConta.delete(args as Prisma.PrestacaoContaDeleteArgs),
  create: ({ data }: CreateArgs) =>
    prisma.$transaction(async (tx) => {
      const row = await tx.prestacaoConta.create({ data });
      const fase = await tx.fase.findUnique({ where: { id: row.faseId }, select: { periodo: true } });
      // Legado: docs/legado/prestacao-contas.md — fase de período 30 atendida conclui (concluiSeFaseFinal).
      await concluiSeFaseFinal(tx, fase, row.atendido, row.contratoId);
      return row;
    }),
});

export const prestacaoContasApi = crudHandlers({
  resource: "prestacao_contas", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: prestacaoDelegate,
  schema: prestacaoContasSchema,
  searchFields: ["descricao", "atendido"],
  orderBy: { id: "desc" },
  // Histórico de um contrato: ?contratoId=<id> (parâmetro da lista, nunca coluna nova).
  listWhere: (params) => {
    const raw = params.get("contratoId");
    return raw && /^\d+$/.test(raw) ? { contratoId: Number(raw) } : undefined;
  },
  // Autoria e data de inclusão são do servidor: valores enviados pelo cliente são descartados
  // (não geram 400), conforme 001b-security-baseline › "Autoria pela sessão".
  prepare: (raw) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId, dataInclusao, ...rest } = raw;
    return rest;
  },
  beforeSave: async (data, { user, mode }) => {
    const errors: Record<string, string> = {};
    if (!(await prisma.fase.findUnique({ where: { id: data.faseId as number } }))) errors.faseId = PRESTACAO_MSG.faseInexistente;
    if (!(await prisma.contrato.findUnique({ where: { id: data.contratoId as number } }))) {
      errors.contratoId = PRESTACAO_MSG.contratoInexistente;
    }
    if (Object.keys(errors).length) throw new FieldRuleError(errors);
    const withDate = mode === "create" ? { ...data, dataInclusao: new Date() } : data;
    // userId sempre do usuário da sessão (withAuthor), nunca do formulário.
    return withAuthor(withDate, user, "userId");
  },
});
