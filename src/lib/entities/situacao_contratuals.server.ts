import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, type Db } from "@/lib/crud/server";
import { optionalString } from "@/lib/rules/fields";

/** API de Situações contratuais (014-situacao-contratuals). Nenhum campo obrigatório (design.md). */
export const situacaoContratualsSchema = z.object({
  descricao: optionalString(),
});

/**
 * Handlers compartilhados por `/api/situacao_contratuals` (rota da change) e
 * `/api/situacao_contratual` (nome da tabela, usado pelo lookup de 017-contratos).
 */
export const situacaoContratualsApi = crudHandlers({
  resource: "cadastros", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.situacaoContratual,
  schema: situacaoContratualsSchema,
  searchFields: ["descricao"],
  orderBy: { descricao: "asc" },
});
