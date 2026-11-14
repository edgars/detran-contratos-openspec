import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, FieldRuleError, type Db } from "@/lib/crud/server";
import { withAuthor } from "@/lib/auth/author";
import { formatDate } from "@/lib/format";
import { MSG } from "@/lib/rules";
import { optionalString, requiredInt } from "@/lib/rules/fields";

/**
 * API de Históricos (012-historicos). `id`, `dataInclusao` e `usuarioId` não entram no schema:
 * são do servidor (autoincremento, data da criação, usuário da sessão). Corpo com eles → 400.
 */
export const historicosSchema = z.object({
  descricao: optionalString(),
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
});

type Row = Record<string, unknown> & {
  contratoId: number;
  dataInclusao?: Date | string | null;
  usuario?: { id: number; username: string } | null;
};

/** Só `id` e `username` do usuário: nunca `passwordHash`. */
const include = { usuario: { select: { id: true, username: true } } };

const crud = crudHandlers({
  resource: "historicos", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.historico,
  schema: historicosSchema,
  include,
  // Busca `q` pela descrição e pelo contrato (número do contrato, número do processo ou id),
  // resolvida aqui (listWhere assíncrono, 024-kit-robustez › D6); sem parâmetros internos na URL.
  listWhere: async (params, { q }) => {
    const filters: object[] = [];
    if (q) {
      const or: object[] = [{ numeroContrato: { contains: q } }, { numeroProcesso: { contains: q } }];
      if (/^\d+$/.test(q)) or.push({ id: Number(q) });
      const contratos = await prisma.contrato.findMany({ where: { OR: or }, select: { id: true }, take: 1000 });
      filters.push({ OR: [{ descricao: { contains: q } }, { contratoId: { in: contratos.map((c) => c.id) } }] });
    }
    const contratoId = Number.parseInt(params.get("contratoId") ?? "", 10);
    if (Number.isInteger(contratoId) && contratoId > 0) filters.push({ contratoId });
    return filters.length ? { AND: filters } : undefined;
  },
  orderBy: { id: "desc" },
  serialize: (row) => {
    const r = row as Row;
    return { ...r, dataInclusaoTexto: formatDate(r.dataInclusao ?? null), usuarioNome: r.usuario?.username ?? "" };
  },
  beforeSave: async (data, { user, mode }) => {
    const contrato = await prisma.contrato.findUnique({ where: { id: data.contratoId as number }, select: { id: true } });
    if (!contrato) throw new FieldRuleError({ contratoId: "Contrato não encontrado" });
    if (mode === "create") return withAuthor({ ...data, dataInclusao: new Date() }, user, "usuarioId");
    return { ...data, descricao: data.descricao ?? null };
  },
});

/** Acrescenta `contrato { id, numeroContrato }` (o modelo não declara a relação). */
async function withContrato(res: Response): Promise<Response> {
  if (!res.ok) return res;
  const body = await res.json();
  const rows: Row[] = Array.isArray(body.items) ? body.items : [body];
  const ids = [...new Set(rows.map((r) => r.contratoId))];
  const contratos = await prisma.contrato.findMany({ where: { id: { in: ids } }, select: { id: true, numeroContrato: true } });
  const byId = new Map(contratos.map((c) => [c.id, c]));
  for (const r of rows) r.contrato = byId.get(r.contratoId) ?? null;
  return NextResponse.json(body, { status: res.status });
}

export const historicosApi = {
  ...crud,
  async list(request: Request) {
    return withContrato(await crud.list(request));
  },
  async get(request: Request, ctx: { params: Promise<{ id: string }> }) {
    return withContrato(await crud.get(request, ctx));
  },
};
