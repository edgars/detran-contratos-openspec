import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type Db } from "@/lib/crud/server";
import { ANEXO_FISCAL, MSG, anexoFiscalFields } from "@/lib/rules";
import { requiredInt } from "@/lib/rules/fields";

/**
 * API de Anexos Fiscais (013-anexos-fiscais). O PDF é tratado pelo kit (`fileFields`,
 * 024-kit-robustez): gravado com `savePdf`, desfeito se a gravação falhar, o anterior apagado na
 * troca e o do registro excluído apagado depois da exclusão.
 */
export const anexosFiscaisSchema = z.object({
  // RK-9da08201400b RK-0e70b6c81ee9 — anexo is required (aplicada em anexoFiscalFields; na API, pelo
  // `required: true` de fileFields: o kit tira o campo do schema e exige o arquivo na inclusão)
  anexo: anexoFiscalFields.anexo,
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
});

export const anexosFiscaisApi = crudHandlers({
  resource: "anexos_fiscais", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.anexoFiscal,
  schema: anexosFiscaisSchema,
  fileFields: {
    // RK-01658245d11b — "O arquivo anexo deve ser do tipo PDF!" (assinatura %PDF- conferida em savePdf)
    // RK-23cdd0c37c3c — "Não existe arquivo para anexar!" (required: arquivo exigido na inclusão)
    anexo: { rule: ANEXO_FISCAL, required: true },
  },
  searchFields: ["anexo"],
  orderBy: { id: "desc" },
  beforeSave: async (data, ctx) => {
    const contrato = await prisma.contrato.findUnique({ where: { id: data.contratoId as number } });
    if (!contrato) throw new FieldRuleError({ contratoId: "Contrato não encontrado" });
    // dataRegistro é data do servidor (RK-211b91bb389e fora de escopo; coluna NOT NULL).
    return ctx.mode === "create" ? { ...data, dataRegistro: new Date() } : data;
  },
});
