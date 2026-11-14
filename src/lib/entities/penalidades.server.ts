import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type RawBody } from "@/lib/crud/server";
import { withAuthor } from "@/lib/auth/author";
import { ARQUIVO_PENALIDADE, MSG } from "@/lib/rules";
import { optionalString, requiredInt } from "@/lib/rules/fields";
import { UploadError, savePdf } from "@/lib/uploads";

/** API de Penalidades (016-penalidades). */
export const penalidadesSchema = z.object({
  arquivo: optionalString(), // nome gerado por savePdf no prepare; nunca vem do cliente
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
});

async function uploadArquivo(file: unknown): Promise<string> {
  try {
    // RK-174d58601890 — "O arquivo anexo deve ser do tipo PDF!" (assinatura %PDF- conferida em savePdf)
    // RK-abb6ac79fad7 — "Não existe arquivo para anexar!" (savePdf recusa ausência de arquivo)
    return await savePdf(file, ARQUIVO_PENALIDADE);
  } catch (error) {
    if (error instanceof UploadError) throw new FieldRuleError({ arquivo: error.message });
    throw error;
  }
}

export async function preparePenalidade(raw: RawBody, ctx: { mode: "create" | "update" }): Promise<RawBody> {
  const out = { ...raw };
  // Autoria pela sessão: userId enviado pelo cliente é descartado (gravado no beforeSave via withAuthor).
  delete out.userId;
  delete out.dataRegistro;
  if (out.arquivo instanceof Blob || ctx.mode === "create") {
    out.arquivo = await uploadArquivo(out.arquivo);
  } else {
    // Edição sem arquivo novo: o arquivo atual é mantido (campo fora do update).
    delete out.arquivo;
  }
  return out;
}

export const penalidadesApi = crudHandlers({
  delegate: () => prisma.penalidade,
  schema: penalidadesSchema,
  searchFields: ["arquivo"],
  orderBy: { id: "desc" },
  prepare: (raw, ctx) => preparePenalidade(raw, ctx),
  beforeSave: async (data, ctx) => {
    const contrato = await prisma.contrato.findUnique({ where: { id: data.contratoId as number } });
    if (!contrato) throw new FieldRuleError({ contratoId: "Contrato não encontrado" });
    if (ctx.mode !== "create") return data; // a autoria e a data de registro da inclusão são preservadas
    return withAuthor({ ...data, dataRegistro: new Date() }, ctx.user);
  },
});
