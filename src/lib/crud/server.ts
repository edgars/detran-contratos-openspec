import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pageResponse, parsePagination, validationError, type FieldErrors } from "@/lib/api/http";
import { UnauthorizedError, requireUser, stripSecrets, type SessionUser } from "@/lib/auth/session";
import type { AttachmentRule } from "@/lib/rules/attachments";
import { UploadError, UploadSession } from "@/lib/uploads";

/**
 * Kit de CRUD das entidades gerenciadas. Aplica as convenções da fundação (lista paginada com
 * `page`, `size`, `q`; erro 400 por campo) e a base de segurança (sessão obrigatória, schema
 * estrito, nenhum campo fora do schema é gravado). 024-kit-robustez: ciclo de vida dos anexos
 * (`fileFields`, `ctx.files`), `beforeDelete`, `listWhere` assíncrono, busca em colunas `int`,
 * ordenação `sort` e respostas sem campos de senha em qualquer nível.
 */

type Delegate = {
  findMany: (args: object) => Promise<unknown[]>;
  count: (args: object) => Promise<number>;
  findUnique: (args: object) => Promise<unknown | null>;
  create: (args: object) => Promise<unknown>;
  update: (args: object) => Promise<unknown>;
  delete: (args: object) => Promise<unknown>;
};

/** Cliente do Prisma ou de uma transação: as entidades declaram `delegate: (db: Db = prisma) => db.x`. */
export type Db = Prisma.TransactionClient;

export type RawBody = Record<string, unknown>;

/** Erro de regra com campo, convertido em `400 { errors: { campo: mensagem } }`. */
export class FieldRuleError extends Error {
  constructor(public readonly errors: FieldErrors) {
    super(Object.values(errors)[0]);
  }
}

/** Recusa de operação por estado do registro (ex.: em uso), convertida em `409 { error }`. */
export class ConflictError extends Error {}

export type FileField = { rule: AttachmentRule; required?: boolean };
export type SearchField = string | { field: string; type: "int" };

type SaveCtx = { user: SessionUser; id?: number; mode: "create" | "update"; current?: unknown; files: UploadSession };

export type CrudConfig<S extends z.ZodObject> = {
  /** Delegate do Prisma, ex.: `(db: Db = prisma) => db.fase`. Recebe o cliente da transação na exclusão. */
  delegate: (tx?: Db) => unknown;
  /** Schema de criação. É aplicado com `.strict()`: campo desconhecido gera 400. */
  schema: S;
  /** Schema de edição (padrão: o de criação). */
  updateSchema?: z.ZodObject;
  /**
   * Campos de anexo PDF processados pelo kit (gravação com `savePdf`, desfeita se a requisição
   * falhar; arquivo substituído ou do registro excluído apagado depois do commit).
   */
  fileFields?: Record<string, FileField>;
  /** Campos da busca `q`: texto com `contains`; `{ field, type: "int" }` por igualdade quando `q` é inteiro. */
  searchFields?: SearchField[];
  /** Termos extras somados ao `OR` da busca `q` (ex.: "sim" → `{ atendido: 1 }`). */
  searchTerms?: (q: string) => object[];
  /** Filtros extras da lista a partir da query string (pode ser assíncrono). */
  listWhere?: (
    params: URLSearchParams,
    ctx: { user: SessionUser; q: string },
  ) => object | undefined | Promise<object | undefined>;
  /** Colunas que o operador pode escolher em `sort=<campo>:asc|desc`. */
  sortFields?: string[];
  /** Ordem padrão (quando `sort` não vem ou não é permitido). Desempate final: `id desc`. */
  orderBy?: object;
  include?: object;
  /** Antes de validar: converte multipart, grava anexos extras com `ctx.files.save`, normaliza valores. */
  prepare?: (raw: RawBody, ctx: SaveCtx) => Promise<RawBody> | RawBody;
  /** Depois de validar: deriva valores (datas do servidor, autoria, Decimal…). */
  beforeSave?: (data: Record<string, unknown>, ctx: SaveCtx) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Na transação da exclusão, antes de apagar: pode lançar `ConflictError` (409) ou apagar vínculos. */
  beforeDelete?: (current: unknown, ctx: { user: SessionUser; tx: Db; files: UploadSession }) => Promise<void> | void;
  /** Como cada registro sai na API. Campos de senha são removidos depois, em qualquer nível. */
  serialize?: (row: unknown) => unknown;
};

export async function readBody(request: Request): Promise<RawBody> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const out: RawBody = {};
    for (const [key, value] of form.entries()) out[key] = value;
    return out;
  }
  return (await request.json().catch(() => ({}))) as RawBody;
}

const prismaCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? (error as { code: unknown }).code : undefined;

export function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  if (error instanceof FieldRuleError) return NextResponse.json({ errors: error.errors }, { status: 400 });
  if (error instanceof UploadError) {
    return NextResponse.json({ errors: { [error.field ?? "_"]: error.message } }, { status: 400 });
  }
  if (error instanceof ConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof z.ZodError) return validationError(error);
  if (prismaCode(error) === "P2003") {
    return NextResponse.json({ error: "Registro em uso por outro cadastro" }, { status: 409 });
  }
  if (prismaCode(error) === "P2002") {
    return NextResponse.json({ error: "Já existe um registro com esse valor" }, { status: 409 });
  }
  throw error;
}

const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 && String(id) === value ? id : null;
};

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** `OR` da busca `q`; `null` quando a entidade não declara busca. */
export function searchWhere(q: string, fields: SearchField[] | undefined, terms?: (q: string) => object[]) {
  if (!q || (!fields?.length && !terms)) return null;
  const or: object[] = [];
  for (const f of fields ?? []) {
    if (typeof f === "string") or.push({ [f]: { contains: q } });
    else if (/^-?\d+$/.test(q)) or.push({ [f.field]: Number(q) });
  }
  if (terms) or.push(...terms(q));
  // Nenhum campo aplicável: `OR: []` não casa com nenhum registro (a busca não é ignorada).
  return { OR: or };
}

/** `sort=campo:asc|desc` (ou `sort=campo&dir=desc`), só para colunas de `sortFields`; desempate `id desc`. */
export function sortOrder(params: URLSearchParams, sortFields: string[] | undefined, fallback: object | undefined): object[] {
  const [field, inline] = (params.get("sort") ?? "").split(/[:.]/);
  const dir = (inline ?? params.get("dir") ?? "asc").toLowerCase() === "desc" ? "desc" : "asc";
  const base = field && sortFields?.includes(field) ? [{ [field]: dir }] : [fallback ?? { id: "desc" }].flat();
  const hasId = base.some((o) => Object.keys(o as object).includes("id"));
  return hasId ? base : [...base, { id: "desc" }];
}

export function crudHandlers<S extends z.ZodObject>(config: CrudConfig<S>) {
  const d = (tx?: Db) => config.delegate(tx) as Delegate;
  const serialize = (row: unknown) => stripSecrets(config.serialize ? config.serialize(row) : row);
  const fileFields = Object.entries(config.fileFields ?? {});
  // Os anexos são tratados pelo kit: saem do schema validado e entram em `data` depois da validação.
  const omitFiles = <T extends z.ZodObject>(schema: T) => {
    const mask = Object.fromEntries(fileFields.filter(([k]) => k in schema.shape).map(([k]) => [k, true as const]));
    return Object.keys(mask).length ? schema.omit(mask as never) : schema;
  };
  const createSchema = omitFiles(config.schema).strict();
  const updateSchema = omitFiles(config.updateSchema ?? config.schema).strict();

  /** Grava os anexos de `fileFields` enviados; devolve os nomes gravados por campo. */
  async function saveFiles(raw: RawBody, mode: "create" | "update", files: UploadSession) {
    const stored: Record<string, string> = {};
    for (const [field, { rule, required }] of fileFields) {
      const value = raw[field];
      delete raw[field];
      if (value instanceof Blob && value.size > 0) {
        stored[field] = await files.save(field, value, rule);
      } else if (value !== undefined && !(value instanceof Blob) && !isBlank(value)) {
        // O cliente não escolhe o nome gravado: só vale o arquivo enviado nesta requisição.
        throw new FieldRuleError({ [field]: "Envie o arquivo em PDF" });
      } else if (mode === "create" && required) {
        throw new UploadError(rule.missing, field);
      }
      // Edição sem arquivo novo: a coluna não entra no update e mantém o valor de `current`.
    }
    return stored;
  }

  async function save(request: Request, mode: "create" | "update", id?: number) {
    const user = await requireUser();
    const current = id ? await d().findUnique({ where: { id } }) : undefined;
    if (mode === "update" && !current) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    const files = new UploadSession();
    let row: unknown;
    let stored: Record<string, string>;
    try {
      let raw = await readBody(request);
      stored = await saveFiles(raw, mode, files);
      const ctx: SaveCtx = { user, id, mode, current: current ?? undefined, files };
      if (config.prepare) raw = await config.prepare(raw, ctx);
      const parsed = (mode === "create" ? createSchema : updateSchema).safeParse(raw);
      if (!parsed.success) throw parsed.error;
      let data = { ...(parsed.data as Record<string, unknown>), ...stored };
      if (config.beforeSave) data = await config.beforeSave(data, ctx);
      row =
        mode === "create"
          ? await d().create({ data, include: config.include })
          : await d().update({ where: { id }, data, include: config.include });
    } catch (error) {
      // Nada gravado no banco: os PDFs desta requisição saem do disco (D1).
      await files.rollback();
      throw error;
    }
    // Gravação confirmada: o anexo substituído sai do disco (D2).
    const before = (current ?? {}) as Record<string, unknown>;
    for (const [field, name] of Object.entries(stored)) if (before[field] !== name) files.discard(before[field] as string | null);
    await files.commit();
    return NextResponse.json(serialize(row), { status: mode === "create" ? 201 : 200 });
  }

  return {
    /** `GET /api/<entidade>` */
    async list(request: Request) {
      try {
        const user = await requireUser();
        const params = new URL(request.url).searchParams;
        const p = parsePagination(params);
        const filters: object[] = [];
        const search = searchWhere(p.q, config.searchFields, config.searchTerms);
        if (search) filters.push(search);
        const extra = await config.listWhere?.(params, { user, q: p.q });
        if (extra) filters.push(extra);
        const where = filters.length ? { AND: filters } : undefined;
        const [items, total] = await Promise.all([
          d().findMany({
            where,
            skip: (p.page - 1) * p.size,
            take: p.size,
            orderBy: sortOrder(params, config.sortFields, config.orderBy),
            include: config.include,
          }),
          d().count({ where }),
        ]);
        return pageResponse(items.map(serialize), total, p);
      } catch (error) {
        return handleError(error);
      }
    },
    /** `POST /api/<entidade>` */
    async create(request: Request) {
      try {
        return await save(request, "create");
      } catch (error) {
        return handleError(error);
      }
    },
    /** `GET /api/<entidade>/:id` */
    async get(_request: Request, ctx: { params: Promise<{ id: string }> }) {
      try {
        await requireUser();
        const id = parseId((await ctx.params).id);
        const row = id ? await d().findUnique({ where: { id }, include: config.include }) : null;
        if (!row) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
        return NextResponse.json(serialize(row));
      } catch (error) {
        return handleError(error);
      }
    },
    /** `PUT /api/<entidade>/:id` */
    async update(request: Request, ctx: { params: Promise<{ id: string }> }) {
      try {
        const id = parseId((await ctx.params).id);
        if (!id) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
        return await save(request, "update", id);
      } catch (error) {
        return handleError(error);
      }
    },
    /** `DELETE /api/<entidade>/:id` — em transação, com `beforeDelete`; anexos apagados depois do commit. */
    async remove(_request: Request, ctx: { params: Promise<{ id: string }> }) {
      try {
        const user = await requireUser();
        const id = parseId((await ctx.params).id);
        const current = id ? await d().findUnique({ where: { id } }) : null;
        if (!current) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
        const files = new UploadSession();
        await prisma.$transaction(async (tx) => {
          if (config.beforeDelete) await config.beforeDelete(current, { user, tx, files });
          await d(tx).delete({ where: { id } });
        });
        const row = current as Record<string, unknown>;
        for (const [field] of fileFields) files.discard(row[field] as string | null);
        await files.commit();
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return handleError(error);
      }
    },
  };
}
