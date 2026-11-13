import { NextResponse } from "next/server";
import { z } from "zod";
import { pageResponse, parsePagination, validationError, type FieldErrors } from "@/lib/api/http";
import { UnauthorizedError, requireUser, type SessionUser } from "@/lib/auth/session";
import { UploadError } from "@/lib/uploads";

/**
 * Kit de CRUD das entidades gerenciadas. Aplica as convenções da fundação (lista paginada com
 * `page`, `size`, `q`; erro 400 por campo) e a base de segurança (sessão obrigatória, schema
 * estrito, nenhum campo fora do schema é gravado).
 */

type Delegate = {
  findMany: (args: object) => Promise<unknown[]>;
  count: (args: object) => Promise<number>;
  findUnique: (args: object) => Promise<unknown | null>;
  create: (args: object) => Promise<unknown>;
  update: (args: object) => Promise<unknown>;
  delete: (args: object) => Promise<unknown>;
};

export type RawBody = Record<string, unknown>;

/** Erro de regra com campo, convertido em `400 { errors: { campo: mensagem } }`. */
export class FieldRuleError extends Error {
  constructor(public readonly errors: FieldErrors) {
    super(Object.values(errors)[0]);
  }
}

export type CrudConfig<S extends z.ZodObject> = {
  /** Delegate do Prisma, ex.: `() => prisma.fase`. Função para não abrir conexão na importação. */
  delegate: () => unknown;
  /** Schema de criação. É aplicado com `.strict()`: campo desconhecido gera 400. */
  schema: S;
  /** Schema de edição (padrão: o de criação). */
  updateSchema?: z.ZodObject;
  /** Campos de texto usados na busca `q` (`contains`, sempre parametrizado). */
  searchFields?: string[];
  /** Filtros extras da lista a partir da query string. */
  listWhere?: (params: URLSearchParams) => object | undefined;
  orderBy?: object;
  include?: object;
  /** Antes de validar: converte multipart, grava anexos com `savePdf`, normaliza valores. */
  prepare?: (raw: RawBody, ctx: { user: SessionUser; id?: number; mode: "create" | "update" }) => Promise<RawBody> | RawBody;
  /** Depois de validar: deriva valores (datas do servidor, autoria, Decimal…). */
  beforeSave?: (
    data: Record<string, unknown>,
    ctx: { user: SessionUser; id?: number; mode: "create" | "update"; current?: unknown },
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** Como cada registro sai na API (ex.: tirar campos de senha). */
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

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  if (error instanceof FieldRuleError) return NextResponse.json({ errors: error.errors }, { status: 400 });
  if (error instanceof UploadError) return NextResponse.json({ errors: { _: error.message } }, { status: 400 });
  if (error instanceof z.ZodError) return validationError(error);
  if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2003") {
    return NextResponse.json({ error: "Registro em uso por outro cadastro" }, { status: 409 });
  }
  throw error;
}

const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 && String(id) === value ? id : null;
};

export function crudHandlers<S extends z.ZodObject>(config: CrudConfig<S>) {
  const d = () => config.delegate() as Delegate;
  const serialize = config.serialize ?? ((row: unknown) => row);
  const createSchema = config.schema.strict();
  const updateSchema = (config.updateSchema ?? config.schema).strict();

  async function save(request: Request, mode: "create" | "update", id?: number) {
    const user = await requireUser();
    const current = id ? await d().findUnique({ where: { id } }) : undefined;
    if (mode === "update" && !current) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    let raw = await readBody(request);
    if (config.prepare) raw = await config.prepare(raw, { user, id, mode });
    const parsed = (mode === "create" ? createSchema : updateSchema).safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    let data = parsed.data as Record<string, unknown>;
    if (config.beforeSave) data = await config.beforeSave(data, { user, id, mode, current });
    const row =
      mode === "create"
        ? await d().create({ data, include: config.include })
        : await d().update({ where: { id }, data, include: config.include });
    return NextResponse.json(serialize(row), { status: mode === "create" ? 201 : 200 });
  }

  return {
    /** `GET /api/<entidade>` */
    async list(request: Request) {
      try {
        await requireUser();
        const params = new URL(request.url).searchParams;
        const p = parsePagination(params);
        const filters: object[] = [];
        if (p.q && config.searchFields?.length) {
          filters.push({ OR: config.searchFields.map((f) => ({ [f]: { contains: p.q } })) });
        }
        const extra = config.listWhere?.(params);
        if (extra) filters.push(extra);
        const where = filters.length ? { AND: filters } : undefined;
        const [items, total] = await Promise.all([
          d().findMany({
            where,
            skip: (p.page - 1) * p.size,
            take: p.size,
            orderBy: config.orderBy ?? { id: "desc" },
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
    /** `DELETE /api/<entidade>/:id` */
    async remove(_request: Request, ctx: { params: Promise<{ id: string }> }) {
      try {
        await requireUser();
        const id = parseId((await ctx.params).id);
        const row = id ? await d().findUnique({ where: { id } }) : null;
        if (!row) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
        await d().delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        return handleError(error);
      }
    },
  };
}
