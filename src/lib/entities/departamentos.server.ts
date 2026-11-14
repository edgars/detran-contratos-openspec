import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type Db } from "@/lib/crud/server";
import { MASKS, isMaskComplete } from "@/lib/mask";
import { departamentoFields, MSG } from "@/lib/rules";
import { optionalString, requiredInt } from "@/lib/rules/fields";

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** CEP opcional; quando informado precisa completar a máscara `#####-###` (locale-and-formats). */
const cep = z.preprocess(
  (v) => (v === undefined ? undefined : blank(v) ? null : v),
  z
    .string()
    .refine((v) => isMaskComplete(v, MASKS.cep), { error: "CEP deve estar no formato #####-###" })
    .nullish(),
);

/** API de Departamentos (002-departamentos). */
export const departamentosSchema = z.object({
  codigo: optionalString(),
  diretoriaId: requiredInt(MSG.obrigatorio("Diretoria")),
  deDepartamento: departamentoFields.deDepartamento, // RK-4e6358dbafbf RK-52fdc2d97389 RK-ecfa90099032 (aplicadas em departamentoFields)
  deLogradouro: optionalString(),
  deComplemento: optionalString(),
  deBairro: optionalString(),
  deCidade: optionalString(),
  cep,
});

export const departamentosApi = crudHandlers({
  delegate: (db: Db = prisma) => db.departamento,
  schema: departamentosSchema,
  searchFields: ["deDepartamento", "codigo"],
  // Busca por diretoria (tasks 2.1): filtro da lista, nunca coluna nova.
  listWhere: (params) => {
    const id = Number.parseInt(params.get("diretoriaId") ?? "", 10);
    return Number.isInteger(id) && id > 0 ? { diretoriaId: id } : undefined;
  },
  orderBy: { deDepartamento: "asc" },
  include: { diretoria: { select: { id: true, deDiretoria: true, codigo: true } } },
  beforeSave: async (data) => {
    // FK diretoriaId → diretorias: id inexistente vira 400 no campo (antes do erro do banco).
    const diretoria = await prisma.diretoria.findUnique({ where: { id: data.diretoriaId as number } });
    if (!diretoria) throw new FieldRuleError({ diretoriaId: "Diretoria não encontrada" });
    return data;
  },
});
