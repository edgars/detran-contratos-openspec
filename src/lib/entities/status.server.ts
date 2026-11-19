import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers } from "@/lib/crud/server";
import { requireUser, UnauthorizedError } from "@/lib/auth/session";
import { optionalString } from "@/lib/rules/fields";

const blankToUndefined = (v: unknown) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

/** API de Status (011-status). Nenhum campo obrigatório na tela (design.md). */
export const statusSchema = z.object({
  nome: optionalString(),
  fluxo: optionalString(),
  // Opções do select do legado não rastreadas: aceita o inteiro da coluna `periodo` (Int?).
  periodo: z.preprocess(
    blankToUndefined,
    z.coerce.number({ error: "Período deve ser um número inteiro" }).int({ error: "Período deve ser um número inteiro" }).optional(),
  ),
});

const OPTIONAL = ["nome", "fluxo", "periodo"] as const;

const crud = crudHandlers({
  delegate: () => prisma.status,
  schema: statusSchema,
  // A busca `q` é montada em listWhere: `periodo` é Int e não aceita `contains`.
  listWhere: (params) => {
    const q = (params.get("q") ?? "").trim();
    if (!q) return undefined;
    const or: object[] = [{ nome: { contains: q } }, { fluxo: { contains: q } }];
    if (/^-?\d+$/.test(q)) or.push({ periodo: Number(q) });
    return { OR: or };
  },
  orderBy: { nome: "asc" },
  // PUT substitui o registro: campo apagado no formulário vira null (optionalString o descarta).
  beforeSave: (data, { mode }) => {
    if (mode === "create") return data;
    const out = { ...data };
    for (const k of OPTIONAL) if (out[k] === undefined) out[k] = null;
    return out;
  },
});

export const statusApi = {
  ...crud,
  /**
   * `DELETE /api/status/:id`. Um Status em uso por `contrato_status` não pode ser excluído:
   * o vínculo `contrato_status.status_id` é obrigatório (RK-a7017eb6c42d / RK-067d06861847,
   * aplicadas em status.rules.ts) e o banco não tem FK declarada para barrar a exclusão.
   */
  async remove(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
      await requireUser();
    } catch (error) {
      if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
      throw error;
    }
    const raw = (await ctx.params).id;
    const id = Number.parseInt(raw, 10);
    if (Number.isInteger(id) && String(id) === raw) {
      const emUso = await prisma.contratoStatus.count({ where: { statusId: id } });
      if (emUso > 0) return NextResponse.json({ error: "Registro em uso por outro cadastro" }, { status: 409 });
    }
    return crud.remove(request, ctx);
  },
};
