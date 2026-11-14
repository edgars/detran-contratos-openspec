import { z } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, crudHandlers, type Db } from "@/lib/crud/server";
import { optionalString } from "@/lib/rules/fields";

/** Inteiro opcional apagável: vazio ou `null` viram `null` (limpa na edição); ausente não altera. */
const optionalInt = (message: string) =>
  z.preprocess(
    (v) => (v === undefined ? undefined : v === null || (typeof v === "string" && v.trim() === "") ? null : v),
    z.coerce.number({ error: message }).int({ error: message }).nullish(),
  );

/** API de Status (011-status). Nenhum campo obrigatório na tela (design.md). */
export const statusSchema = z.object({
  nome: optionalString(),
  fluxo: optionalString(),
  // Opções do select do legado não rastreadas: aceita o inteiro da coluna `periodo` (Int?).
  periodo: optionalInt("Período deve ser um número inteiro"),
});

export const statusApi = crudHandlers({
  resource: "cadastros", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.status,
  schema: statusSchema,
  // `periodo` é Int: igualdade só quando `q` é inteiro (024-kit-robustez › D7).
  searchFields: ["nome", "fluxo", { field: "periodo", type: "int" }],
  orderBy: { nome: "asc" },
  /**
   * Um Status em uso por `contrato_status` não pode ser excluído: o vínculo
   * `contrato_status.status_id` é obrigatório (RK-a7017eb6c42d / RK-067d06861847, aplicadas em
   * status.rules.ts) e o banco não tem FK declarada para barrar a exclusão.
   */
  beforeDelete: async (current, { tx }) => {
    const emUso = await tx.contratoStatus.count({ where: { statusId: (current as { id: number }).id } });
    if (emUso > 0) throw new ConflictError("Registro em uso por outro cadastro");
  },
});
