import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type RawBody } from "@/lib/crud/server";
import { ANEXO_PUBLICACAO, MSG } from "@/lib/rules";
import { optionalString, requiredDate, requiredInt } from "@/lib/rules/fields";
import { UploadError, savePdf } from "@/lib/uploads";

/** API de Anexos de Publicação (015-anexos-publicacaos). */
export const anexosPublicacaosSchema = z.object({
  anexo: optionalString(), // nome gerado por savePdf no prepare; nunca vem do cliente
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
  dataPublicacao: requiredDate(MSG.obrigatorio("Data de publicação")),
});

async function uploadAnexo(file: unknown): Promise<string> {
  try {
    // RK-9aa2ad64672e — "O arquivo anexo deve ser do tipo PDF!" (assinatura %PDF- conferida em savePdf)
    // RK-e2b53b79c3c2 — "Não existe arquivo para anexar!" (savePdf recusa ausência de arquivo)
    return await savePdf(file, ANEXO_PUBLICACAO);
  } catch (error) {
    if (error instanceof UploadError) throw new FieldRuleError({ anexo: error.message });
    throw error;
  }
}

export async function prepareAnexoPublicacao(raw: RawBody, ctx: { mode: "create" | "update" }): Promise<RawBody> {
  const out = { ...raw };
  if (out.anexo instanceof Blob || ctx.mode === "create") {
    // Na inclusão o arquivo é exigido (regra do legado); texto no lugar do arquivo não é aceito.
    out.anexo = await uploadAnexo(out.anexo);
  } else {
    // Edição sem arquivo novo: o anexo atual é mantido (campo fora do update).
    delete out.anexo;
  }
  return out;
}

export const anexosPublicacaosApi = crudHandlers({
  delegate: () => prisma.anexoPublicacao,
  schema: anexosPublicacaosSchema,
  searchFields: ["anexo"],
  orderBy: { id: "desc" },
  prepare: (raw, ctx) => prepareAnexoPublicacao(raw, ctx),
  beforeSave: async (data) => {
    const contrato = await prisma.contrato.findUnique({ where: { id: data.contratoId as number } });
    if (!contrato) throw new FieldRuleError({ contratoId: "Contrato não encontrado" });
    return data;
  },
});
