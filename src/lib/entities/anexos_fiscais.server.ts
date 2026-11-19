import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type RawBody } from "@/lib/crud/server";
import { ANEXO_FISCAL, MSG, anexoFiscalFields } from "@/lib/rules";
import { requiredInt } from "@/lib/rules/fields";
import { UploadError, savePdf } from "@/lib/uploads";

/** API de Anexos Fiscais (013-anexos-fiscais). */
export const anexosFiscaisSchema = z.object({
  anexo: anexoFiscalFields.anexo, // RK-9da08201400b RK-0e70b6c81ee9 — anexo is required (aplicada em anexoFiscalFields)
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
});

/** Grava o PDF enviado; erro de upload vira erro inline no campo `anexo`. */
async function uploadAnexo(file: unknown): Promise<string> {
  try {
    // RK-01658245d11b — "O arquivo anexo deve ser do tipo PDF!" (assinatura %PDF- conferida em savePdf)
    // RK-23cdd0c37c3c — "Não existe arquivo para anexar!" (savePdf recusa ausência de arquivo)
    return await savePdf(file, ANEXO_FISCAL);
  } catch (error) {
    if (error instanceof UploadError) throw new FieldRuleError({ anexo: error.message });
    throw error;
  }
}

export async function prepareAnexoFiscal(raw: RawBody, ctx: { id?: number; mode: "create" | "update" }): Promise<RawBody> {
  const out = { ...raw };
  if (out.anexo instanceof Blob || ctx.mode === "create") {
    // Na inclusão o arquivo é sempre exigido; um texto no lugar do arquivo não é aceito como nome.
    out.anexo = await uploadAnexo(out.anexo);
  } else {
    // Edição sem arquivo novo: mantém o anexo atual (o cliente não escolhe o nome gravado).
    const current = await prisma.anexoFiscal.findUnique({ where: { id: ctx.id } });
    out.anexo = current?.anexo;
  }
  return out;
}

export const anexosFiscaisApi = crudHandlers({
  delegate: () => prisma.anexoFiscal,
  schema: anexosFiscaisSchema,
  searchFields: ["anexo"],
  orderBy: { id: "desc" },
  prepare: (raw, ctx) => prepareAnexoFiscal(raw, ctx),
  beforeSave: async (data, ctx) => {
    const contrato = await prisma.contrato.findUnique({ where: { id: data.contratoId as number } });
    if (!contrato) throw new FieldRuleError({ contratoId: "Contrato não encontrado" });
    // dataRegistro é data do servidor (RK-211b91bb389e fora de escopo; coluna NOT NULL).
    return ctx.mode === "create" ? { ...data, dataRegistro: new Date() } : data;
  },
});
