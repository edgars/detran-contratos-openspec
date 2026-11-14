import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, type Db } from "@/lib/crud/server";
import { tipoContratoFields } from "@/lib/rules";

/** API de Tipos de contrato (003-tipo-contratos). Obrigatórios vêm das regras transversais da fundação. */
export const tipoContratosSchema = z.object({
  nome: tipoContratoFields.nome, // RK-82de63b47e64 (aplicada em tipoContratoFields)
  // RK-2509b78bd0e0 RK-4564e4e322b6 (obrigatório, aplicada em tipoContratoFields); toggle String grava "S"/"N".
  gerenciamento: tipoContratoFields.gerenciamento.pipe(z.enum(["S", "N"], { error: "Gerenciamento deve ser S ou N" })),
  // 021-prestacao-contas-fluxo: tipo sujeito à prestação de contas ("S"/"N"); vazio/ausente → default "N" do banco.
  prestacaoContas: z.preprocess(
    (v) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z.enum(["S", "N"], { error: "Sujeito à prestação de contas deve ser S ou N" }).optional(),
  ),
});

export const tipoContratosApi = crudHandlers({
  delegate: (db: Db = prisma) => db.tipoContrato,
  schema: tipoContratosSchema,
  searchFields: ["nome", "gerenciamento"],
  // Filtros da lista (parâmetros, nunca colunas): ?gerenciamento=S|N e ?prestacaoContas=S|N (021).
  listWhere: (params) => {
    const where: Record<string, string> = {};
    const g = params.get("gerenciamento");
    if (g === "S" || g === "N") where.gerenciamento = g;
    const pc = params.get("prestacaoContas");
    if (pc === "S" || pc === "N") where.prestacaoContas = pc;
    return Object.keys(where).length ? where : undefined;
  },
  orderBy: { nome: "asc" },
  // indicativoMetaRisco não está no formulário: a coluna tem default "N" no banco.
});
