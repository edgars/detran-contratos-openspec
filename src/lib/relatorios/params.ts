import { z } from "zod";
import { fieldErrors, type FieldErrors } from "@/lib/api/http";
import { parseDate } from "@/lib/format";

/**
 * Parâmetros dos relatórios (019-relatorios, design.md › Parâmetros): lidos da query string e
 * validados por schema zod `.strict()` — parâmetro desconhecido gera 400. São filtros, nunca
 * colunas (diretiva do autor). `formato` é o único extra aceito por todos.
 */

export const MSG = {
  dias: "Informe o número de dias",
  diasFaixa: "Informe um número inteiro de dias entre 1 e 3650",
  inicio: "Informe a data inicial",
  fim: "Informe a data final",
  ordem: "Data inicial posterior à data final",
  periodo: "Informe as duas datas do período",
  data: "Data inválida: use dd/mm/aaaa",
  gestor: "Gestor inválido",
  departamento: "Unidade gestora inválida",
} as const;

/** "" e espaços contam como ausente (o formulário `method="get"` envia campos vazios). */
const vazioParaAusente = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);

const opcional = <T extends z.ZodType>(schema: T) => z.preprocess(vazioParaAusente, schema.optional());

/** Data `dd/MM/yyyy` → `Date` (meia-noite UTC). */
const data = (requiredMsg: string = MSG.data) =>
  z.string({ error: requiredMsg }).transform((text, ctx) => {
    const d = parseDate(text);
    if (!d) {
      ctx.addIssue({ code: "custom", message: MSG.data });
      return z.NEVER;
    }
    return d;
  });

const formato = opcional(z.enum(["csv"], { error: "Formato inválido" }));

const inteiroPositivo = (msg: string) =>
  z
    .string({ error: msg })
    .regex(/^\d+$/, msg)
    .transform(Number)
    .pipe(z.number().int().min(1, msg));

type Periodo = { inicio?: Date; fim?: Date };

/** `inicio` e `fim` juntos e em ordem (inclusive). */
function conferePeriodo(p: Periodo, ctx: z.RefinementCtx) {
  if (p.inicio && !p.fim) ctx.addIssue({ code: "custom", path: ["fim"], message: MSG.periodo });
  if (!p.inicio && p.fim) ctx.addIssue({ code: "custom", path: ["inicio"], message: MSG.periodo });
  if (p.inicio && p.fim && p.inicio.getTime() > p.fim.getTime()) {
    ctx.addIssue({ code: "custom", path: ["inicio"], message: MSG.ordem });
  }
}

export const porGestorParams = z
  .object({
    gestor: opcional(z.string().regex(/^\d{11}$/, MSG.gestor)),
    departamentoId: opcional(inteiroPositivo(MSG.departamento)),
    formato,
  })
  .strict();

export const ORDENACOES_VENCENDO = ["vencimento", "contratada", "gestor", "unidade", "valor"] as const;
export type OrdenacaoVencendo = (typeof ORDENACOES_VENCENDO)[number];

export const vencendoParams = z
  .object({
    dias: z.preprocess(
      vazioParaAusente,
      z
        .string({ error: MSG.dias })
        .regex(/^\d+$/, MSG.diasFaixa)
        .transform(Number)
        .pipe(z.number().int().min(1, MSG.diasFaixa).max(3650, MSG.diasFaixa)),
    ),
    inicio: opcional(data()),
    fim: opcional(data()),
    sort: z.preprocess(vazioParaAusente, z.enum(ORDENACOES_VENCENDO, { error: "Ordenação inválida" }).default("vencimento")),
    dir: z.preprocess(vazioParaAusente, z.enum(["asc", "desc"], { error: "Direção inválida" }).default("asc")),
    formato,
  })
  .strict()
  .superRefine(conferePeriodo);

export const vencidosParams = z
  .object({
    inicio: z.preprocess(vazioParaAusente, data(MSG.inicio)),
    fim: z.preprocess(vazioParaAusente, data(MSG.fim)),
    formato,
  })
  .strict()
  .superRefine(conferePeriodo);

export const semFiltrosParams = z.object({ formato }).strict();

export const acertoValorParams = z
  .object({
    q: opcional(z.string().max(200, "Busca muito longa")),
    page: z.preprocess(vazioParaAusente, inteiroPositivo("Página inválida").default(1)),
  })
  .strict();

export type PorGestorParams = z.output<typeof porGestorParams>;
export type VencendoParams = z.output<typeof vencendoParams>;
export type VencidosParams = z.output<typeof vencidosParams>;
export type AcertoValorParams = z.output<typeof acertoValorParams>;

export type QueryInput = URLSearchParams | Record<string, string | string[] | undefined>;

/** Query string como objeto simples (valor repetido: vale o último). */
export function queryObject(input: QueryInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (input instanceof URLSearchParams) {
    for (const [k, v] of input.entries()) out[k] = v;
    return out;
  }
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? (v[v.length - 1] ?? "") : v;
  }
  return out;
}

export type Lido<T> = { ok: true; data: T; raw: Record<string, string> } | { ok: false; errors: FieldErrors; error: z.ZodError; raw: Record<string, string> };

/** Valida a query com o schema do relatório. Erro → mensagens por campo (para a tela) e o `ZodError` (para a API). */
export function lerParams<S extends z.ZodType>(schema: S, input: QueryInput): Lido<z.output<S>> {
  const raw = queryObject(input);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data, raw };
  return { ok: false, errors: fieldErrors(parsed.error), error: parsed.error, raw };
}

/** A query tem algum valor preenchido (além de `formato`)? Usado para abrir vencidos sem consultar. */
export function temFiltro(raw: Record<string, string>): boolean {
  return Object.entries(raw).some(([k, v]) => k !== "formato" && v.trim() !== "");
}

/** Link do CSV com os mesmos parâmetros da tela (`formato=csv`). */
export function csvHref(slug: string, raw: Record<string, string>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (k !== "formato" && v.trim() !== "") qs.set(k, v);
  qs.set("formato", "csv");
  return `/api/relatorios/${slug}?${qs.toString()}`;
}
