import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, type Db } from "@/lib/crud/server";
import { faseFields } from "@/lib/rules";

/** API de Fases (009-fases). Obrigatórios vêm das regras transversais da fundação. */
export const fasesSchema = z.object({
  nome: faseFields.nome, // RK-13dd23ce5afd (aplicada em faseFields)
  periodo: faseFields.periodo, // RK-877afa57a9f9 (aplicada em faseFields)
});

export const fasesApi = crudHandlers({
  resource: "cadastros", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.fase,
  schema: fasesSchema,
  searchFields: ["nome", "periodo"],
  orderBy: { nome: "asc" },
});
