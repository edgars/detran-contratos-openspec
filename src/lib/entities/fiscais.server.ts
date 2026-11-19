import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers } from "@/lib/crud/server";
import { applyMask, MASKS } from "@/lib/mask";
import { MSG, fiscalFields } from "@/lib/rules";
import { maskedString, requiredInt, requiredString } from "@/lib/rules/fields";

export const MSG_CPF_INCOMPLETO = `CPF incompleto: use o formato ${MASKS.cpf}`;

const simNao = (schema: z.ZodType, label: string) => schema.pipe(z.enum(["S", "N"], { error: `${label} deve ser S ou N` }));

/** API de Fiscais (010-fiscais). */
export const fiscaisSchema = z.object({
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
  // Vazio → "obrigatório"; preenchido fora da máscara ###.###.###-## → CPF incompleto.
  pessoaFisicaCpf: requiredString(MSG.obrigatorio("Pessoa Física CPF")).pipe(maskedString(MASKS.cpf, MSG_CPF_INCOMPLETO)),
  suplente: simNao(fiscalFields.suplente, "Suplente"), // RK-0f7caf172fab (aplicada em fiscalFields)
  presidente: simNao(fiscalFields.presidente, "Presidente"), // RK-6b60cd49b7ed (aplicada em fiscalFields)
});

/** `busca` (filtro do legado, nunca coluna): dígitos recebem a máscara de CPF antes do `contains`. */
export function buscaWhere(params: URLSearchParams) {
  const busca = (params.get("busca") ?? "").trim();
  if (!busca) return undefined;
  return { pessoaFisicaCpf: { contains: applyMask(busca, MASKS.cpf) || busca } };
}

export const fiscaisApi = crudHandlers({
  delegate: () => prisma.fiscal,
  schema: fiscaisSchema,
  searchFields: ["pessoaFisicaCpf"],
  listWhere: buscaWhere,
  orderBy: { id: "desc" },
  beforeSave: (data, { mode }) => (mode === "create" ? { ...data, dataInclusao: new Date() } : data), // data do servidor
});

type Row = Record<string, unknown> & { contratoId?: number };

/** Acrescenta `contrato: { id, numeroContrato }` (o modelo Fiscal não tem relação com Contrato). */
async function withContrato(rows: Row[]) {
  const ids = [...new Set(rows.map((r) => r.contratoId).filter((v): v is number => typeof v === "number"))];
  const contratos = ids.length
    ? await prisma.contrato.findMany({ where: { id: { in: ids } }, select: { id: true, numeroContrato: true } })
    : [];
  const byId = new Map(contratos.map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, contrato: byId.get(r.contratoId as number) ?? null }));
}

/** `GET /api/fiscais`: lista do kit + rótulo do contrato. */
export async function listFiscais(request: Request) {
  const res = await fiscaisApi.list(request);
  if (!res.ok) return res;
  const body = (await res.json()) as { items: Row[] };
  return NextResponse.json({ ...body, items: await withContrato(body.items) });
}
