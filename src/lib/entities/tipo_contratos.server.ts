import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers } from "@/lib/crud/server";
import { tipoContratoFields } from "@/lib/rules";

/** API de Tipos de contrato (003-tipo-contratos). Obrigatórios vêm das regras transversais da fundação. */
export const tipoContratosSchema = z.object({
  nome: tipoContratoFields.nome, // RK-82de63b47e64 (aplicada em tipoContratoFields)
  // RK-2509b78bd0e0 RK-4564e4e322b6 (obrigatório, aplicada em tipoContratoFields); toggle String grava "S"/"N".
  gerenciamento: tipoContratoFields.gerenciamento.pipe(z.enum(["S", "N"], { error: "Gerenciamento deve ser S ou N" })),
});

export const tipoContratosApi = crudHandlers({
  delegate: () => prisma.tipoContrato,
  schema: tipoContratosSchema,
  searchFields: ["nome", "gerenciamento"],
  // Filtro da lista por gerenciamento (tasks 2.1): ?gerenciamento=S|N.
  listWhere: (params) => {
    const g = params.get("gerenciamento");
    return g === "S" || g === "N" ? { gerenciamento: g } : undefined;
  },
  orderBy: { nome: "asc" },
  // indicativoMetaRisco não está no formulário: a coluna tem default "N" no banco.
});
