import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConflictError, FieldRuleError, crudHandlers, handleError, readBody, type Db, type RawBody } from "@/lib/crud/server";
import { pageResponse, parsePagination, validationError } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { ANEXO_CONTRATO, ANEXO_FISCAL, ANEXO_PUBLICACAO, MSG, contratoFields } from "@/lib/rules";
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

// Limites das telas do legado (docs/legado/rk-conferencia.md): contados depois do trim; sem RK.
const maximo = (campo: string, n: number) => z.string().max(n, { error: MSG.maximo(campo, n) });

export const MSG_NUMERO_FISCAIS = "Número de fiscais inválido";
export const MSG_NA_PRESIDENCIA = "Localizado na Presidência inválido";

/**
 * Número de fiscais (020, docs/legado/contratos-complementos.md): inteiro de 0 a 999 gravado como
 * texto (coluna `String?` da fundação), sem zeros à esquerda; vazio vira `null`.
 */
const numeroFiscaisInput = z.preprocess(
  (v) => (v === undefined ? undefined : isBlank(v) ? null : typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : v),
  z
    .string({ error: MSG_NUMERO_FISCAIS })
    .regex(/^\d{1,3}$/, { error: MSG_NUMERO_FISCAIS })
    .transform((v) => String(Number.parseInt(v, 10)))
    .nullish(),
);

/**
 * Localizado na Presidência (020): BOOLEAN `na_presidencia` do legado gravado como 1/0. Vazio (registro
 * antigo com `null`, interruptor não tocado) vira 0; outro valor → 400.
 */
const naPresidenciaInput = z.preprocess(
  (v) => (v === undefined ? undefined : isBlank(v) ? 0 : typeof v === "string" && /^[01]$/.test(v.trim()) ? Number(v.trim()) : v),
  z.union([z.literal(0), z.literal(1)], { error: MSG_NA_PRESIDENCIA }).optional(),
);

// ---------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------

export const contratosSchema = z.object({
  // Limites das telas do legado (docs/legado/rk-conferencia.md): processo/contrato 45, modalidade 12, objeto 200.
  numeroProcesso: requiredString("Informe o número do processo").pipe(maximo("Nº do processo", 45)), // RK-776d8b62d6df
  numeroContrato: requiredString("Informe o número do contrato").pipe(maximo("Nº do contrato", 45)), // RK-04fd1cbfc346
  tipoContratoId: requiredInt("Informe o tipo de contrato"), // RK-79134600b4be
  modalidadeId: optionalId("Modalidade inválida"),
  numeroModalidade: optionalString().pipe(maximo("Nº da modalidade", 12).nullish()),
  // O limite de 200 vale só aqui; o `contratoFields.objeto` compartilhado não muda.
  objeto: contratoFields.objeto.pipe(maximo("Objeto", 200)), // RK-879233539305 RK-ee6cd831c2d4 (aplicada em contratoFields)
  departamentoId: requiredInt("Informe o departamento(unidade gestora)"), // RK-a0660a4fb262
  prestadorServicoId: requiredInt("Informe o fornecedor"), // RK-37f294a3dc8e
  // CPF do gestor/suplente (022-pessoas-fornecedores, D5): com ou sem máscara, gravado com 11 dígitos.
  pessoaFisicaId: optionalCpf("Gestor"),
  suplenteId: optionalCpf("Gestor suplente"),
  numeroFiscais: numeroFiscaisInput,
  naPresidencia: naPresidenciaInput,
  dataInicio: requiredDate("Informe a data de início"), // RK-6b2806cfff8d
  dataTermino: requiredDate("Informe a data de vencimento"), // RK-9d6599f5897d
  valorMensal: moneyInput("Valor mensal"),
  valorTotal: moneyInput("Valor total"),
  situacaoContratualId: optionalId("Situação contratual inválida"),
  // Projeto básico em PDF (020): tratado pelo kit (fileFields), que o tira do schema validado e
  // recusa texto no corpo com "Envie o arquivo em PDF"; aqui fica a forma do valor gravado.
  projetoBasico: storedPdf(),
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

// ---------------------------------------------------------------------------------------------
// Visão restrita (023-perfis-acesso, design.md › Visão restrita do contrato; `visualizar_restrito`)
// ---------------------------------------------------------------------------------------------

/** Campos de `contratos` da visão restrita: dados do contrato, sem anexos, projeto básico nem complementos. */
const CAMPOS_RESUMO = [
  "id",
  "numeroProcesso",
  "numeroContrato",
  "tipoContratoId",
  "modalidadeId",
  "numeroModalidade",
  "objeto",
  "departamentoId",
  "prestadorServicoId",
  "pessoaFisicaId",
  "suplenteId",
  "dataInicio",
  "dataTermino",
  "valorMensal",
  "valorTotal",
  "valorInicial",
  "situacaoContratualId",
  "parentId",
] as const;
const RELACOES_RESUMO = ["tipoContrato", "modalidade", "departamento", "prestadorServico", "situacaoContratual", "parent"] as const;
const CAMPOS_ADITIVO_RESUMO = ["id", "numeroContrato", "dataInicio", "dataTermino", "valorMensal", "valorTotal"] as const;

const pick = <K extends string>(row: Record<string, unknown>, keys: readonly K[]) =>
  Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]])) as Record<K, unknown>;

/**
 * Projeção restrita do contrato (quem tem `contratos_resumo:ver` e não `contratos:ver`, ex.: Consulta):
 * identificação, tipo, modalidade, objeto, unidade gestora, fornecedor, gestor e suplente, vigência,
 * valores, situação e aditivos. Nunca `anexo`, `anexoTipo`, `projetoBasico` nem os registros do contrato.
 */
export function contratoResumo(row: unknown) {
  const r = row as Record<string, unknown>;
  const out: Record<string, unknown> = { ...pick(r, CAMPOS_RESUMO), ...pick(r, RELACOES_RESUMO) };
  if (Array.isArray(r.aditivos)) out.aditivos = r.aditivos.map((a) => pick(a as Record<string, unknown>, CAMPOS_ADITIVO_RESUMO));
  return out;
}

const crud = crudHandlers({
  resource: "contratos", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  restricted: { resource: "contratos_resumo", serialize: contratoResumo },
  delegate: contratoDelegate,
  schema: contratosSchema,
  include: contratoInclude,
  // RK-ed7bc4aaba15 — Erro ao incluir O arquivo anexo deve ser do tipo PDF! (anexo do contrato, opcional)
  // Projeto básico (020): reaproveita a mensagem de RK-ed7bc4aaba15 (ANEXO_CONTRATO), sem RK própria
  // (o legado documentado não traz mensagem para ele; design.md › Open Questions).
  fileFields: { anexo: { rule: ANEXO_CONTRATO }, projetoBasico: { rule: ANEXO_CONTRATO } },
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
    if (mode === "create") {
      data.dataInclusao = new Date(); // data do servidor
      data.naPresidencia ??= 0; // padrão desligado (020)
    }
    return data;
  },
  beforeDelete: (current, { tx, files }) => prepararExclusao(current as { id: number }, tx, files),
});

// ---------------------------------------------------------------------------------------------
// Exclusão (020-contratos-complementos, design.md › Exclusão de contrato; padrão aceito pelo autor
// em 14/11/2026). Roda na transação do kit (`beforeDelete`, 024): o kit apaga o contrato em seguida
// e, depois do commit, os PDFs de `anexo` e `projetoBasico` (fileFields) e os agendados aqui.
// ---------------------------------------------------------------------------------------------

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "2 aditivos, 1 pagamento" — só os tipos com registros; `null` quando nada bloqueia. */
export function vinculosQueBloqueiam(c: { aditivos: number; pagamentos: number; penalidades: number; prestacoes: number }): string | null {
  const partes = [
    c.aditivos && plural(c.aditivos, "aditivo", "aditivos"),
    c.pagamentos && plural(c.pagamentos, "pagamento", "pagamentos"),
    c.penalidades && plural(c.penalidades, "penalidade", "penalidades"),
    c.prestacoes && plural(c.prestacoes, "prestação de contas", "prestações de contas"),
  ].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
}

async function prepararExclusao(current: { id: number }, tx: Db, files: UploadSession) {
  const contratoId = current.id;
  // Bloqueiam: aditivos, pagamentos, penalidades e prestações de contas (nada é apagado).
  const lista = vinculosQueBloqueiam({
    aditivos: await tx.contrato.count({ where: { parentId: contratoId } }),
    pagamentos: await tx.pagamento.count({ where: { contratoId } }),
    penalidades: await tx.penalidade.count({ where: { contratoId } }),
    prestacoes: await tx.prestacaoConta.count({ where: { contratoId } }),
  });
  if (lista) throw new ConflictError(`Não é possível excluir o contrato: há ${lista} vinculados. Exclua-os antes.`);
  // Apagados junto: anexos de publicação e fiscais (PDFs saem do disco depois do commit), andamento,
  // históricos e fiscais do contrato.
  const [publicacoes, anexosFiscais] = [
    await tx.anexoPublicacao.findMany({ where: { contratoId }, select: { anexo: true } }),
    await tx.anexoFiscal.findMany({ where: { contratoId }, select: { anexo: true } }),
  ];
  for (const { anexo } of [...publicacoes, ...anexosFiscais]) files.discard(anexo);
  await tx.anexoPublicacao.deleteMany({ where: { contratoId } });
  await tx.anexoFiscal.deleteMany({ where: { contratoId } });
  await tx.contratoStatus.deleteMany({ where: { contratoId } });
  await tx.historico.deleteMany({ where: { contratoId } });
  await tx.fiscal.deleteMany({ where: { contratoId } });
}

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
  let user;
  try {
    user = await requirePermission("contratos", "listar"); // 023-perfis-acesso
  } catch (error) {
    return handleError(error);
  }
  const original = await findOriginal(ctx);
  if (!original) return notFound();
  const p = parsePagination(new URL(request.url).searchParams);
  const where = { parentId: original.id };
  const [items, total] = await Promise.all([
    prisma.contrato.findMany({ where, orderBy: [{ dataInicio: "asc" }, { id: "asc" }], skip: (p.page - 1) * p.size, take: p.size, include: contratoInclude }),
    prisma.contrato.count({ where }),
  ]);
  // Sem `contratos:ver` (Consulta): aditivos na visão restrita, sem anexos.
  return pageResponse(can(user, "contratos", "ver") ? items : items.map(contratoResumo), total, p);
}

/** `POST /api/contratos/:id/aditivos` — cria um contrato filho (design.md › Decisions). */
async function createAditivo(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("contratos", "criar"); // 023-perfis-acesso: criar aditivo exige criar em contratos
  } catch (error) {
    return handleError(error);
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

/**
 * Dados da visão restrita de `/contratos/[id]` (023-perfis-acesso, Consulta): só os campos da
 * projeção restrita (`contratoResumo`), sem anexos, andamento nem outros registros do contrato.
 */
export async function getContratoResumoDetalhe(id: number) {
  const contrato = await prisma.contrato.findUnique({
    where: { id },
    select: {
      ...Object.fromEntries(CAMPOS_RESUMO.map((k) => [k, true])) as Record<(typeof CAMPOS_RESUMO)[number], true>,
      ...contratoInclude,
      parent: { select: { id: true, numeroContrato: true } },
      aditivos: {
        select: Object.fromEntries(CAMPOS_ADITIVO_RESUMO.map((k) => [k, true])) as Record<(typeof CAMPOS_ADITIVO_RESUMO)[number], true>,
        orderBy: [{ dataInicio: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!contrato) return null;
  const pessoas = await pessoasPorCpf([contrato.pessoaFisicaId, contrato.suplenteId]);
  return {
    contrato,
    gestor: rotuloPessoa(contrato.pessoaFisicaId, pessoas),
    suplente: rotuloPessoa(contrato.suplenteId, pessoas),
    fornecedor: contrato.prestadorServico ? rotuloFornecedor(contrato.prestadorServico) : null,
  };
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
  const [pessoas, publicacoes, fiscais, andamentos] = await Promise.all([
    pessoasPorCpf([contrato.pessoaFisicaId, contrato.suplenteId]),
    prisma.anexoPublicacao.findMany({ where: { contratoId: id }, orderBy: { id: "asc" } }),
    prisma.anexoFiscal.findMany({ where: { contratoId: id }, orderBy: { id: "asc" } }),
    getAndamentos(id),
  ]);
  return {
    contrato,
    gestor: rotuloPessoa(contrato.pessoaFisicaId, pessoas),
    suplente: rotuloPessoa(contrato.suplenteId, pessoas),
    fornecedor: contrato.prestadorServico ? rotuloFornecedor(contrato.prestadorServico) : null,
    publicacoes,
    fiscais,
    andamentos,
  };
}

export type Andamento = {
  id: number;
  dataInclusao: Date | null;
  status: string | null;
  atendido: boolean;
  descricao: string | null;
  usuario: string | null;
};

/**
 * Linha do tempo do andamento (020, `contratos/fluxo` do legado): registros de `contrato_status` do
 * contrato, do mais recente para o mais antigo, com o nome do status e o usuário resolvidos em lote
 * (sem FK, como gestor/suplente).
 */
export async function getAndamentos(contratoId: number): Promise<Andamento[]> {
  const rows = await prisma.contratoStatus.findMany({ where: { contratoId }, orderBy: [{ dataInclusao: "desc" }, { id: "desc" }] });
  const statusIds = [...new Set(rows.map((r) => r.statusId))];
  const userIds = [...new Set(rows.map((r) => r.usuarioId).filter((v): v is number => v !== null))];
  const [status, users] = await Promise.all([
    statusIds.length ? prisma.status.findMany({ where: { id: { in: statusIds } }, select: { id: true, nome: true } }) : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } }) : [],
  ]);
  const nomeStatus = new Map(status.map((s) => [s.id, s.nome]));
  const nomeUsuario = new Map(users.map((u) => [u.id, u.username]));
  return rows.map((r) => ({
    id: r.id,
    dataInclusao: r.dataInclusao,
    status: nomeStatus.get(r.statusId) ?? null,
    atendido: r.atendido === 1,
    descricao: r.descricao,
    usuario: r.usuarioId === null ? null : (nomeUsuario.get(r.usuarioId) ?? null),
  }));
}

// ---------------------------------------------------------------------------------------------
// Painel Início
// ---------------------------------------------------------------------------------------------

const DAY = 86_400_000;

export type ContratoVencendo = {
  id: number;
  numeroContrato: string | null;
  objeto: string;
  fornecedor: string | null;
  vencimento: Date;
  dias: number;
  valorTotal: { toString(): string } | null;
};

/**
 * Contratos originais (`parentId` vazio) cuja `dataTermino` cai até `limite`; `hoje` é a meia-noite
 * UTC do dia do servidor (as datas são gravadas assim). `dias` < 0 = vencido.
 */
export async function contratosVencendoAte(limite: Date, hoje: number): Promise<ContratoVencendo[]> {
  // Vigência só pela data do próprio contrato (diretiva do autor 13/11/2026): aditivos não contam.
  const contratos = await prisma.contrato.findMany({
    where: { parentId: null, dataTermino: { lte: limite } },
    select: {
      id: true,
      numeroContrato: true,
      objeto: true,
      dataTermino: true,
      valorTotal: true,
      prestadorServico: { select: { deRazaoSocial: true } },
    },
  });
  return contratos.flatMap((c) =>
    c.dataTermino
      ? [
          {
            id: c.id,
            numeroContrato: c.numeroContrato,
            objeto: c.objeto,
            fornecedor: c.prestadorServico?.deRazaoSocial ?? null,
            vencimento: c.dataTermino,
            dias: Math.round((c.dataTermino.getTime() - hoje) / DAY),
            valorTotal: c.valorTotal,
          },
        ]
      : [],
  );
}
