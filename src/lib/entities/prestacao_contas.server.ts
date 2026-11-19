import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers } from "@/lib/crud/server";
import { MSG } from "@/lib/rules";
import { optionalString, requiredInt } from "@/lib/rules/fields";
import { withAuthor } from "@/lib/auth/author";

/** API de Prestação de contas (008-prestacao-contas). */
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

export const prestacaoContasApi = crudHandlers({
  delegate: () => prisma.prestacaoConta,
  schema: prestacaoContasSchema,
  searchFields: ["descricao", "atendido"],
  orderBy: { id: "desc" },
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
