import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, readBody, type Db, type RawBody } from "@/lib/crud/server";
import { pageResponse, parsePagination, validationError } from "@/lib/api/http";
import { UnauthorizedError, requireUser } from "@/lib/auth/session";
import { ANEXO_CONTRATO, ANEXO_FISCAL, ANEXO_PUBLICACAO, contratoFields } from "@/lib/rules";
import { optionalCpf, optionalString, requiredDate, requiredInt, requiredString } from "@/lib/rules/fields";
import { onlyDigits } from "@/lib/documento";
import { pessoasPorCpf } from "@/lib/reference/pessoas";
import type { UploadSession } from "@/lib/uploads";
import { toDecimal } from "@/lib/money";
import { formatCnpj, formatCpf } from "@/lib/format";

/**
 * API de Contratos (017-contratos): cadastro, filtros da lista, aditivos e anexos do cadastro.
 * Mensagens dos obrigatórios: specs/contratos/spec.md (texto exato do legado).
 */

// ---------------------------------------------------------------------------------------------
// Campos auxiliares
// ---------------------------------------------------------------------------------------------

const isBlank = (v: unknown) => v === null || (typeof v === "string" && v.trim() === "");

/** Id de lookup opcional: vazio vira `null`; ids chegam como string do formulário. */
const optionalId = (message: string) =>
  z.preprocess(
    (v) => (v === undefined ? undefined : isBlank(v) ? null : v),
    z.coerce.number({ error: message }).int({ error: message }).positive({ error: message }).nullish(),
  );

/**
 * Valor digitado no formulário em pt-BR. `toDecimal` lê `1234.56` como decimal com ponto, então
 * `1.234` (milhar sem centavos) seria lido como 1,234; aqui ele vira `1.234,00` antes da conversão.
 * Ver design.md › Decisions.
 */
function normalizeMoney(value: unknown): string {
  const text = String(value).trim();
  return /^-?\d{1,3}(\.\d{3})+$/.test(text) ? `${text},00` : text;
}

/** Dinheiro opcional: só valida o formato; a conversão para Decimal é feita no beforeSave. */
const moneyInput = (label: string) =>
  z.preprocess(
    (v) => (v === undefined ? undefined : isBlank(v) ? null : v),
    z
      .union([z.string(), z.number()], { error: `${label} inválido` })
      .transform((v) => normalizeMoney(v))
      .refine((v) => toDecimal(v) !== null, { error: `${label} inválido` })
      .nullish(),
  );

/** Nome gravado por `savePdf` (o `prepare` troca o arquivo enviado por ele). */
const storedPdf = () => z.string().regex(/^[0-9a-f-]{36}\.pdf$/, { error: "Envie o arquivo em PDF" }).optional();

// ---------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------

export const contratosSchema = z.object({
  numeroProcesso: requiredString("Informe o número do processo"), // RK-776d8b62d6df
  numeroContrato: requiredString("Informe o número do contrato"), // RK-04fd1cbfc346
  tipoContratoId: requiredInt("Informe o tipo de contrato"), // RK-79134600b4be
  modalidadeId: optionalId("Modalidade inválida"),
  numeroModalidade: optionalString(),
  objeto: contratoFields.objeto, // RK-879233539305 RK-ee6cd831c2d4 (aplicada em contratoFields)
  departamentoId: requiredInt("Informe o departamento(unidade gestora)"), // RK-a0660a4fb262
  prestadorServicoId: requiredInt("Informe o fornecedor"), // RK-37f294a3dc8e
  // CPF do gestor/suplente (022-pessoas-fornecedores, D5): com ou sem máscara, gravado com 11 dígitos.
  pessoaFisicaId: optionalCpf("Gestor"),
  suplenteId: optionalCpf("Gestor suplente"),
  dataInicio: requiredDate("Informe a data de início"), // RK-6b2806cfff8d
  dataTermino: requiredDate("Informe a data de vencimento"), // RK-9d6599f5897d
  valorMensal: moneyInput("Valor mensal"),
  valorTotal: moneyInput("Valor total"),
  situacaoContratualId: optionalId("Situação contratual inválida"),
  projetoBasico: optionalString(),
  // `anexo` (coluna de contratos) é tratado pelo kit (fileFields); fica fora do schema.
  // Não são colunas de `contratos`: viram linhas de anexos_publicacao / anexos_fiscais (contratoDelegate).
  anexoPublicacao: storedPdf(),
  anexoFiscal: storedPdf(),
});

/** Aditivo: o operador informa vigência e valores; o resto é copiado do contrato original. */
export const aditivoSchema = z.object({
  dataInicio: contratosSchema.shape.dataInicio, // RK-6b2806cfff8d
  dataTermino: contratosSchema.shape.dataTermino, // RK-9d6599f5897d
  valorMensal: moneyInput("Valor mensal"),
  valorTotal: moneyInput("Valor total"),
});

// ---------------------------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------------------------

/** Converte os valores digitados (`1.234,56`) para Decimal, no ponto único de gravação. */
function convertMoney(data: Record<string, unknown>) {
  // RK-5c46553fce3d — o legado chamava formataValor(valorTotal) antes de gravar.
  if (data.valorTotal !== undefined) data.valorTotal = data.valorTotal === null ? null : toDecimal(data.valorTotal);
  // RK-260f6b933f77 — o legado chamava formataValor(valorMensal) antes de gravar.
  if (data.valorMensal !== undefined) data.valorMensal = data.valorMensal === null ? null : toDecimal(data.valorMensal);
  return data;
}

/**
 * Anexos do cadastro que não são colunas de `contratos` (viram linhas de anexos_publicacao /
 * anexos_fiscais): gravados por `ctx.files.save`, então o rollback do kit os alcança se a
 * gravação falhar (024-kit-robustez › D1). O `anexo` do próprio contrato é do `fileFields`.
 */
async function prepareAnexos(raw: RawBody, files: UploadSession): Promise<RawBody> {
  const out: RawBody = { ...raw };
  for (const field of ["anexoPublicacao", "anexoFiscal"] as const) {
    if (!(field in out)) continue;
    const value = out[field];
    if (value instanceof Blob && value.size > 0) {
      out[field] =
        field === "anexoPublicacao"
          ? await files.save(field, value, ANEXO_PUBLICACAO) // RK-295d296eb4f7 — anexo de publicação só PDF
          : await files.save(field, value, ANEXO_FISCAL); // RK-b6f82ba63c1f — anexo fiscal só PDF
    } else if (value === undefined || value instanceof Blob || isBlank(value)) {
      delete out[field];
    } else {
      // Nome de arquivo informado direto no corpo: só vale o que foi gravado nesta requisição.
      throw new FieldRuleError({ [field]: "Envie o arquivo em PDF" });
    }
  }
  return out;
}

/** Mensagens da conferência das referências (022-pessoas-fornecedores, D5; não vêm do legado). */
export const MSG_GESTOR_NAO_ENCONTRADO = "Gestor não encontrado em pessoas físicas";
export const MSG_SUPLENTE_NAO_ENCONTRADO = "Gestor suplente não encontrado em pessoas físicas";
export const MSG_FORNECEDOR_NAO_ENCONTRADO = "Fornecedor não encontrado";

/**
 * Confere gestor, suplente e fornecedor na referência (022, D5). O CPF só é conferido na criação ou
 * quando muda: o CPF órfão de um contrato do legado não bloqueia a edição de outro campo. O DV não
 * é conferido (D9): existir em `pessoas_fisicas` é a garantia.
 */
async function conferirReferencias(data: Record<string, unknown>, current: Record<string, unknown> | undefined) {
  const errors: Record<string, string> = {};
  const cpfs = [
    ["pessoaFisicaId", MSG_GESTOR_NAO_ENCONTRADO],
    ["suplenteId", MSG_SUPLENTE_NAO_ENCONTRADO],
  ] as const;
  const conferir = cpfs.filter(([campo]) => typeof data[campo] === "string" && (!current || current[campo] !== data[campo]));
  if (conferir.length) {
    const achadas = await pessoasPorCpf(conferir.map(([campo]) => data[campo] as string));
    for (const [campo, msg] of conferir) if (!achadas.has(data[campo] as string)) errors[campo] = msg;
  }
  // RK-37f294a3dc8e (obrigatório) fica no schema; aqui só a existência, em vez de o FK estourar.
  if (typeof data.prestadorServicoId === "number") {
    const existe = await prisma.prestadorServico.findUnique({ where: { id: data.prestadorServicoId }, select: { id: true } });
    if (!existe) errors.prestadorServicoId = MSG_FORNECEDOR_NAO_ENCONTRADO;
  }
  if (Object.keys(errors).length) throw new FieldRuleError(errors);
}

type ContratoArgs = { data: Record<string, unknown>; include?: object };

/**
 * Grava o contrato e, na mesma transação, os anexos de publicação e fiscal enviados no cadastro
 * (`anexos_publicacao`, `anexos_fiscais`), com a data do servidor.
 */
async function saveContrato(id: number | null, { data, include }: ContratoArgs) {
  const { anexoPublicacao, anexoFiscal, ...contrato } = data;
  return prisma.$transaction(async (tx) => {
    const row =
      id === null
        ? await tx.contrato.create({ data: contrato as Prisma.ContratoUncheckedCreateInput, include })
        : await tx.contrato.update({ where: { id }, data: contrato as Prisma.ContratoUncheckedUpdateInput, include });
    if (typeof anexoPublicacao === "string") {
      // RK-295d296eb4f7 — publicação enviada no cadastro do contrato vai para anexos_publicacao.
      await tx.anexoPublicacao.create({ data: { anexo: anexoPublicacao, contratoId: row.id, dataPublicacao: new Date() } });
    }
    if (typeof anexoFiscal === "string") {
      // RK-b6f82ba63c1f — relatório fiscal enviado no cadastro do contrato vai para anexos_fiscais.
      await tx.anexoFiscal.create({ data: { anexo: anexoFiscal, contratoId: row.id, dataRegistro: new Date() } });
    }
    return row;
  });
}

/** Delegate do kit: leitura e exclusão pelo cliente recebido (transação do kit); criação/edição por `saveContrato`. */
const contratoDelegate = (db: Db = prisma) => ({
  findMany: (args: object) => db.contrato.findMany(args),
  count: (args: object) => db.contrato.count(args),
  findUnique: (args: object) => db.contrato.findUnique(args as Prisma.ContratoFindUniqueArgs),
  delete: (args: object) => db.contrato.delete(args as Prisma.ContratoDeleteArgs),
  create: (args: ContratoArgs) => saveContrato(null, args),
  update: (args: ContratoArgs & { where: { id: number } }) => saveContrato(args.where.id, args),
});

export const contratoInclude = {
  departamento: { select: { id: true, deDepartamento: true } },
  prestadorServico: { select: { id: true, deRazaoSocial: true, cnpj: true } },
  situacaoContratual: { select: { id: true, descricao: true } },
  tipoContrato: { select: { id: true, nome: true } },
  modalidade: { select: { id: true, nome: true } },
} satisfies Prisma.ContratoInclude;

const crud = crudHandlers({
  delegate: contratoDelegate,
  schema: contratosSchema,
  include: contratoInclude,
  // RK-ed7bc4aaba15 — Erro ao incluir O arquivo anexo deve ser do tipo PDF! (anexo do contrato, opcional)
  fileFields: { anexo: { rule: ANEXO_CONTRATO } },
  // Filtros do legado (parâmetros de pesquisa, nunca colunas) e a busca `q`.
  listWhere: (params) => contratosWhere(params),
  sortFields: ["dataTermino", "numeroContrato", "valorTotal"],
  prepare: (raw, ctx) => prepareAnexos(raw, ctx.files),
  beforeSave: async (data, { mode, current }) => {
    await conferirReferencias(data, mode === "update" ? (current as Record<string, unknown>) : undefined);
    convertMoney(data);
    const parentId = mode === "update" ? ((current as { parentId: number | null } | undefined)?.parentId ?? null) : null;
    // RK-c3fbde6dbf4a — contrato original (sem parentId): valorInicial = valorTotal.
    // Num aditivo (parentId preenchido) valorInicial não é recalculado.
    if (parentId === null && data.valorTotal !== undefined) data.valorInicial = data.valorTotal;
    if (mode === "create") data.dataInclusao = new Date(); // data do servidor
    return data;
  },
});

// ---------------------------------------------------------------------------------------------
// Lista com os filtros do legado (design.md › Filtros da lista)
// ---------------------------------------------------------------------------------------------

const positiveInt = (value: string | null) => {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number.parseInt(value, 10);
  return n > 0 ? n : null;
};

/** Filtros da lista: parâmetros de pesquisa do legado, nunca colunas. */
export function contratosWhere(params: URLSearchParams, now = new Date()): Prisma.ContratoWhereInput | undefined {
  const and: Prisma.ContratoWhereInput[] = [];
  const q = (params.get("q") ?? "").trim();
  if (q) and.push({ OR: [{ numeroProcesso: { contains: q } }, { numeroContrato: { contains: q } }, { objeto: { contains: q } }] });
  for (const key of ["departamentoId", "prestadorServicoId", "situacaoContratualId"] as const) {
    const id = positiveInt(params.get(key));
    if (id) and.push({ [key]: id });
  }
  // CPF do gestor ou suplente, com ou sem máscara (022-pessoas-fornecedores, D11).
  const gestor = onlyDigits(params.get("gestor"));
  if (gestor) and.push({ OR: [{ pessoaFisicaId: gestor }, { suplenteId: gestor }] });
  const vencendo = params.get("vencendoEm");
  if (vencendo && /^\d+$/.test(vencendo)) {
    // dataTermino é gravada como meia-noite UTC do dia (parseDate): compara pelo dia do servidor.
    const hoje = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const dias = Math.min(Number.parseInt(vencendo, 10), 36500);
    and.push({ dataTermino: { gte: new Date(hoje), lte: new Date(hoje + dias * 86_400_000) } });
  }
  return and.length ? { AND: and } : undefined;
}

function unauthorized(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  throw error;
}

// ---------------------------------------------------------------------------------------------
// Aditivos
// ---------------------------------------------------------------------------------------------

const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 && String(id) === value ? id : null;
};

async function findOriginal(ctx: { params: Promise<{ id: string }> }) {
  const id = parseId((await ctx.params).id);
  return id ? prisma.contrato.findUnique({ where: { id } }) : null;
}

const notFound = () => NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

/** `GET /api/contratos/:id/aditivos` */
async function listAditivos(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (error) {
    return unauthorized(error);
  }
  const original = await findOriginal(ctx);
  if (!original) return notFound();
  const p = parsePagination(new URL(request.url).searchParams);
  const where = { parentId: original.id };
  const [items, total] = await Promise.all([
    prisma.contrato.findMany({ where, orderBy: [{ dataInicio: "asc" }, { id: "asc" }], skip: (p.page - 1) * p.size, take: p.size, include: contratoInclude }),
    prisma.contrato.count({ where }),
  ]);
  return pageResponse(items, total, p);
}

/** `POST /api/contratos/:id/aditivos` — cria um contrato filho (design.md › Decisions). */
async function createAditivo(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (error) {
    return unauthorized(error);
  }
  const original = await findOriginal(ctx);
  if (!original) return notFound();
  const parsed = aditivoSchema.strict().safeParse(await readBody(request));
  if (!parsed.success) return validationError(parsed.error);
  const data = convertMoney({ ...parsed.data });
  const row = await prisma.contrato.create({
    data: {
      ...(data as Pick<Prisma.ContratoUncheckedCreateInput, "dataInicio" | "dataTermino" | "valorMensal" | "valorTotal">),
      parentId: original.id,
      // Copiados do original: tipo, objeto, unidade gestora e fornecedor (design.md); processo e
      // número também, porque RK-776d8b62d6df/RK-04fd1cbfc346 exigem os dois em todo contrato.
      tipoContratoId: original.tipoContratoId,
      objeto: original.objeto,
      departamentoId: original.departamentoId,
      prestadorServicoId: original.prestadorServicoId,
      numeroProcesso: original.numeroProcesso,
      numeroContrato: original.numeroContrato,
      dataInclusao: new Date(),
      // RK-c3fbde6dbf4a — aditivo: valorInicial não é recalculado (nem o do original, que não é tocado).
    },
    include: contratoInclude,
  });
  return NextResponse.json(row, { status: 201 });
}

export const contratosApi = {
  list: crud.list,
  create: crud.create,
  get: crud.get,
  update: crud.update,
  remove: crud.remove,
  listAditivos,
  createAditivo,
};

/**
 * Rótulo do gestor/suplente no detalhe (022, D10): "Nome — 529.982.247-25"; CPF sem pessoa →
 * "390.533.447-05 (não encontrado em pessoas físicas)"; sem valor → `null`.
 */
export function rotuloPessoa(cpf: string | null, pessoas: Map<string, { deNome: string | null }>): string | null {
  if (!cpf) return null;
  const pessoa = pessoas.get(onlyDigits(cpf));
  if (!pessoa) return `${formatCpf(cpf)} (não encontrado em pessoas físicas)`;
  return `${pessoa.deNome ?? "Sem nome"} — ${formatCpf(cpf)}`;
}

/** Rótulo do fornecedor no detalhe (022, D10): "Razão social — 11.222.333/0001-81". */
export function rotuloFornecedor(p: { deRazaoSocial: string; cnpj: string | null }): string {
  return p.cnpj ? `${p.deRazaoSocial} — ${formatCnpj(p.cnpj)}` : p.deRazaoSocial;
}

/** Dados da página de detalhe (`/contratos/[id]`): contrato, original (se aditivo), aditivos e anexos. */
export async function getContratoDetalhe(id: number) {
  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: {
      ...contratoInclude,
      parent: { select: { id: true, numeroContrato: true } },
      aditivos: { orderBy: [{ dataInicio: "asc" }, { id: "asc" }] },
    },
  });
  if (!contrato) return null;
  const [pessoas, publicacoes, fiscais] = await Promise.all([
    pessoasPorCpf([contrato.pessoaFisicaId, contrato.suplenteId]),
    prisma.anexoPublicacao.findMany({ where: { contratoId: id }, orderBy: { id: "asc" } }),
    prisma.anexoFiscal.findMany({ where: { contratoId: id }, orderBy: { id: "asc" } }),
  ]);
  return {
    contrato,
    gestor: rotuloPessoa(contrato.pessoaFisicaId, pessoas),
    suplente: rotuloPessoa(contrato.suplenteId, pessoas),
    fornecedor: contrato.prestadorServico ? rotuloFornecedor(contrato.prestadorServico) : null,
    publicacoes,
    fiscais,
  };
}
