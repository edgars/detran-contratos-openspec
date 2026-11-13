import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers } from "@/lib/crud/server";

/** Texto opcional: vazio vira `null` (permite limpar na edição); ausente não altera. */
const clearableString = () =>
  z.preprocess(
    (v) => (v === undefined ? undefined : v === null || (typeof v === "string" && v.trim() === "") ? null : v),
    z.string().trim().nullish(),
  );

/** API de Situações contratuais (014-situacao-contratuals). Nenhum campo obrigatório (design.md). */
export const situacaoContratualsSchema = z.object({
  descricao: clearableString(),
});

/**
 * Handlers compartilhados por `/api/situacao_contratuals` (rota da change) e
 * `/api/situacao_contratual` (nome da tabela, usado pelo lookup de 017-contratos).
 */
export const situacaoContratualsApi = crudHandlers({
  delegate: () => prisma.situacaoContratual,
  schema: situacaoContratualsSchema,
  searchFields: ["descricao"],
  orderBy: { descricao: "asc" },
});
