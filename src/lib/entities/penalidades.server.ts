import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type Db, type RawBody } from "@/lib/crud/server";
import { withAuthor } from "@/lib/auth/author";
import { ARQUIVO_PENALIDADE, MSG } from "@/lib/rules";
import { requiredInt } from "@/lib/rules/fields";

/**
 * API de Penalidades (016-penalidades). `arquivo` não está no schema: é o kit que o grava
 * (`fileFields`, 024-kit-robustez) com o nome gerado por `savePdf`; nunca vem do cliente.
 */
export const penalidadesSchema = z.object({
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
});

export function preparePenalidade(raw: RawBody): RawBody {
  const out = { ...raw };
  // Autoria pela sessão: userId enviado pelo cliente é descartado (gravado no beforeSave via withAuthor).
  delete out.userId;
  delete out.dataRegistro;
  return out;
}

export const penalidadesApi = crudHandlers({
  resource: "penalidades", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.penalidade,
  schema: penalidadesSchema,
  fileFields: {
    // RK-174d58601890 — "O arquivo anexo deve ser do tipo PDF!" (assinatura %PDF- conferida em savePdf)
    // RK-abb6ac79fad7 — "Não existe arquivo para anexar!" (required: arquivo exigido na inclusão)
    arquivo: { rule: ARQUIVO_PENALIDADE, required: true },
  },
  searchFields: ["arquivo"],
  orderBy: { id: "desc" },
  prepare: (raw) => preparePenalidade(raw),
  beforeSave: async (data, ctx) => {
    const contrato = await prisma.contrato.findUnique({ where: { id: data.contratoId as number } });
    if (!contrato) throw new FieldRuleError({ contratoId: "Contrato não encontrado" });
    if (ctx.mode !== "create") return data; // a autoria e a data de registro da inclusão são preservadas
    return withAuthor({ ...data, dataRegistro: new Date() }, ctx.user);
  },
});
