import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers } from "@/lib/crud/server";

/** Texto opcional: vazio vira `null` (permite limpar na edição); ausente não altera. */
const clearableString = () =>
  z.preprocess(
    (v) => (v === undefined ? undefined : v === null || (typeof v === "string" && v.trim() === "") ? null : v),
    z.string().trim().nullish(),
  );

/** API de Modalidades (007-modalidades). Nenhum campo obrigatório (design.md). */
export const modalidadesSchema = z.object({
  nome: clearableString(),
});

export const modalidadesApi = crudHandlers({
  delegate: () => prisma.modalidade,
  schema: modalidadesSchema,
  searchFields: ["nome"],
  orderBy: { nome: "asc" },
});
