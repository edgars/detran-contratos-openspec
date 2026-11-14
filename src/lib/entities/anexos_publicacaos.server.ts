import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type Db } from "@/lib/crud/server";
import { ANEXO_PUBLICACAO, MSG } from "@/lib/rules";
import { requiredDate, requiredInt } from "@/lib/rules/fields";

/**
 * API de Anexos de Publicação (015-anexos-publicacaos). `anexo` não está no schema: é o kit que o
 * grava (`fileFields`, 024-kit-robustez) com o nome gerado por `savePdf`; nunca vem do cliente.
 */
export const anexosPublicacaosSchema = z.object({
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
  dataPublicacao: requiredDate(MSG.obrigatorio("Data de publicação")),
});

export const anexosPublicacaosApi = crudHandlers({
  delegate: (db: Db = prisma) => db.anexoPublicacao,
  schema: anexosPublicacaosSchema,
  fileFields: {
    // RK-9aa2ad64672e — "O arquivo anexo deve ser do tipo PDF!" (assinatura %PDF- conferida em savePdf)
    // RK-e2b53b79c3c2 — "Não existe arquivo para anexar!" (required: arquivo exigido na inclusão)
    anexo: { rule: ANEXO_PUBLICACAO, required: true },
  },
  searchFields: ["anexo"],
  orderBy: { id: "desc" },
  beforeSave: async (data) => {
    const contrato = await prisma.contrato.findUnique({ where: { id: data.contratoId as number } });
    if (!contrato) throw new FieldRuleError({ contratoId: "Contrato não encontrado" });
    return data;
  },
});
