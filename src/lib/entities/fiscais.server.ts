import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, type Db } from "@/lib/crud/server";
import { MASKS } from "@/lib/mask";
import { MSG, fiscalFields } from "@/lib/rules";
import { requiredCpf, requiredInt } from "@/lib/rules/fields";
import { onlyDigits } from "@/lib/documento";
import { pessoasPorCpf } from "@/lib/reference/pessoas";

export const MSG_CPF_INCOMPLETO = `CPF incompleto: use o formato ${MASKS.cpf}`;
/** 022-pessoas-fornecedores (D5): o CPF do fiscal precisa existir em pessoas_fisicas. */
export const MSG_PESSOA_NAO_ENCONTRADA = "Pessoa física não encontrada para o CPF informado";

const simNao = (schema: z.ZodType, label: string) => schema.pipe(z.enum(["S", "N"], { error: `${label} deve ser S ou N` }));

/** API de Fiscais (010-fiscais). */
export const fiscaisSchema = z.object({
  contratoId: requiredInt(MSG.obrigatorio("Contrato")),
  // Vazio → "obrigatório"; com ou sem máscara, gravado só com dígitos; sem 11 dígitos → CPF incompleto (022, D5).
  pessoaFisicaCpf: requiredCpf(MSG.obrigatorio("Pessoa Física CPF"), MSG_CPF_INCOMPLETO),
  suplente: simNao(fiscalFields.suplente, "Suplente"), // RK-0f7caf172fab (aplicada em fiscalFields)
  presidente: simNao(fiscalFields.presidente, "Presidente"), // RK-6b60cd49b7ed (aplicada em fiscalFields)
});

/** `busca` (filtro do legado, nunca coluna): CPF com ou sem máscara; compara só os dígitos (022). */
export function buscaWhere(params: URLSearchParams) {
  const busca = onlyDigits(params.get("busca"));
  if (!busca) return undefined;
  return { pessoaFisicaCpf: { contains: busca } };
}

export const fiscaisApi = crudHandlers({
  resource: "fiscais", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: (db: Db = prisma) => db.fiscal,
  schema: fiscaisSchema,
  searchFields: ["pessoaFisicaCpf"],
  // `q` com máscara também acha o CPF gravado só com dígitos (022).
  searchTerms: (q) => (/\d/.test(q) && onlyDigits(q) !== q ? [{ pessoaFisicaCpf: { contains: onlyDigits(q) } }] : []),
  listWhere: buscaWhere,
  orderBy: { id: "desc" },
  beforeSave: async (data, { mode, current }) => {
    // Na criação ou quando o CPF muda, ele precisa existir em pessoas_fisicas (022, D5); DV não é conferido (D9).
    const cpf = data.pessoaFisicaCpf as string | undefined;
    const antes = (current as { pessoaFisicaCpf?: string } | undefined)?.pessoaFisicaCpf;
    if (cpf && (mode === "create" || cpf !== antes) && !(await pessoasPorCpf([cpf])).has(cpf)) {
      throw new FieldRuleError({ pessoaFisicaCpf: MSG_PESSOA_NAO_ENCONTRADA });
    }
    return mode === "create" ? { ...data, dataInclusao: new Date() } : data; // data do servidor
  },
});

type Row = Record<string, unknown> & { contratoId?: number };

/**
 * Acrescenta `contrato: { id, numeroContrato }` (o modelo Fiscal não tem relação com Contrato) e
 * `pessoa: { deNome }` pelo CPF (022, D10; CPF sem pessoa → `pessoa: null`).
 */
async function withContratoEPessoa(rows: Row[]) {
  const ids = [...new Set(rows.map((r) => r.contratoId).filter((v): v is number => typeof v === "number"))];
  const [contratos, pessoas] = await Promise.all([
    ids.length ? prisma.contrato.findMany({ where: { id: { in: ids } }, select: { id: true, numeroContrato: true } }) : [],
    pessoasPorCpf(rows.map((r) => (typeof r.pessoaFisicaCpf === "string" ? r.pessoaFisicaCpf : null))),
  ]);
  const byId = new Map(contratos.map((c) => [c.id, c]));
  return rows.map((r) => {
    const pessoa = typeof r.pessoaFisicaCpf === "string" ? pessoas.get(onlyDigits(r.pessoaFisicaCpf)) : undefined;
    return { ...r, contrato: byId.get(r.contratoId as number) ?? null, pessoa: pessoa ? { deNome: pessoa.deNome } : null };
  });
}

/** `GET /api/fiscais`: lista do kit + rótulo do contrato + nome do fiscal. */
export async function listFiscais(request: Request) {
  const res = await fiscaisApi.list(request);
  if (!res.ok) return res;
  const body = (await res.json()) as { items: Row[] };
  return NextResponse.json({ ...body, items: await withContratoEPessoa(body.items) });
}
