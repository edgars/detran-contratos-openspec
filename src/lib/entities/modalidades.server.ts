import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, type Db } from "@/lib/crud/server";
import { optionalString } from "@/lib/rules/fields";

/** API de Modalidades (007-modalidades). Nenhum campo obrigatório (design.md). */
export const modalidadesSchema = z.object({
  nome: optionalString(),
});

export const modalidadesApi = crudHandlers({
  resource: "cadastros", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.modalidade,
  schema: modalidadesSchema,
  searchFields: ["nome"],
  orderBy: { nome: "asc" },
});
