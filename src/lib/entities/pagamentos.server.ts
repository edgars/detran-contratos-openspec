import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, type Db } from "@/lib/crud/server";
import { toDecimal } from "@/lib/money";
import { MSG, pagamentoFields } from "@/lib/rules";
import { optionalString, requiredInt, requiredString } from "@/lib/rules/fields";
import { GLOSA_OPCOES, MESES } from "./pagamentos";

/** Vazio ou `null` viram `null` (limpa na edição); ausente continua `undefined` (não altera). */
const blankToNull = (v: unknown) => (v === undefined ? undefined : v === null || (typeof v === "string" && v.trim() === "") ? null : v);

/** Valor monetário opcional: texto `1.234,56` que `toDecimal` consiga ler (nunca Number/parseFloat). */
const optionalMoney = (label: string) =>
  optionalString().refine((v) => v === undefined || v === null || toDecimal(v) !== null, { error: `${label} inválido` });

const optionalOption = (values: string[], label: string) =>
  z.preprocess(blankToNull, z.enum(values as [string, ...string[]], { error: `${label} inválido` }).nullish());

/** API de Pagamentos (006-pagamentos). */
export const pagamentosSchema = z.object({
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
  competencia: pagamentoFields.competencia, // RK-774f44ed6df9 (aplicada em pagamentoFields)
  numeroProcesso: requiredString(MSG.obrigatorio("Número Processo")),
  ano: optionalString(),
  notaFiscal: optionalString(),
  empenho: optionalString(),
  notaLiquidacao: optionalString(),
  ordemBancaria: optionalString(),
  valor: optionalMoney("Valor"),
  valorGlosa: optionalMoney("Valor Glosa"),
  mes: optionalOption(MESES.map((o) => o.value), "Mês"),
  glosa: optionalOption(GLOSA_OPCOES.map((o) => o.value), "Glosa"),
});

export const pagamentosApi = crudHandlers({
  delegate: (db: Db = prisma) => db.pagamento,
  schema: pagamentosSchema,
  searchFields: ["numeroProcesso", "ano", "notaFiscal", "empenho", "notaLiquidacao"],
  orderBy: { id: "desc" },
  beforeSave: (data) => {
    const out: Record<string, unknown> = { ...data };
    // Campo esvaziado chega como null (optionalString, 024-kit-robustez) e limpa a coluna; ausente não altera.
    // Dinheiro só com toDecimal (diretiva do autor: colunas Decimal, nunca Float).
    for (const key of ["valor", "valorGlosa"]) if (out[key] !== undefined) out[key] = toDecimal(out[key]);
    return out;
  },
});
