import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, FieldRuleError, type Db } from "@/lib/crud/server";
import { withAuthor } from "@/lib/auth/author";
import { contratoStatusFields, MSG } from "@/lib/rules";
import { requiredInt } from "@/lib/rules/fields";
import { statusIdField } from "@/lib/entities/status.rules";

const blankToUndefined = (v: unknown) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

/** API de Status do contrato (004-contrato-status). */
export const contratoStatusSchema = z.object({
  descricao: contratoStatusFields.descricao, // RK-f0ce91a53de9 (aspas duplas → simples, aplicada em contratoStatusFields)
  // Coluna Int: o toggle envia 1/0.
  atendido: z.preprocess(
    blankToUndefined,
    z.coerce.number({ error: "Atendido inválido" }).int().min(0, { error: "Atendido inválido" }).max(1, { error: "Atendido inválido" }).optional(),
  ),
  // NOT NULL no modelo, ausente da tela da spec: lookup obrigatório (design.md §Decisions).
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
  statusId: statusIdField, // RK-a7017eb6c42d RK-067d06861847 (aplicadas em status.rules.ts, change 011-status)
});

const OPTIONAL = ["descricao", "atendido"] as const;

export const contratoStatusApi = crudHandlers({
  resource: "contrato_status", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.contratoStatus,
  schema: contratoStatusSchema,
  // `atendido` é Int: igualdade quando `q` é inteiro (kit, 024-kit-robustez › D7); "sim"/"não" viram 1/0.
  searchFields: ["descricao", { field: "atendido", type: "int" }],
  searchTerms: (q) => (/^sim$/i.test(q) ? [{ atendido: 1 }] : /^n[aã]o$/i.test(q) ? [{ atendido: 0 }] : []),
  listWhere: (params) => {
    const contratoId = Number.parseInt(params.get("contratoId") ?? "", 10);
    return Number.isInteger(contratoId) && contratoId > 0 ? { contratoId } : undefined;
  },
  orderBy: { id: "desc" },
  beforeSave: async (data, { user, mode }) => {
    const errors: Record<string, string> = {};
    if (!(await prisma.contrato.findUnique({ where: { id: data.contratoId as number }, select: { id: true } }))) {
      errors.contratoId = "Contrato não encontrado";
    }
    if (!(await prisma.status.findUnique({ where: { id: data.statusId as number }, select: { id: true } }))) {
      errors.statusId = "Status não encontrado";
    }
    if (Object.keys(errors).length) throw new FieldRuleError(errors);
    if (mode === "create") {
      // Data do servidor e autor da sessão; o cliente não envia (schema estrito).
      return withAuthor({ ...data, dataInclusao: new Date() }, user, "usuarioId");
    }
    // PUT substitui o registro: campo apagado no formulário vira null.
    const out = { ...data };
    for (const k of OPTIONAL) if (out[k] === undefined) out[k] = null;
    return out;
  },
});
