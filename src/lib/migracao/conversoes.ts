import { Prisma } from "@prisma/client";
import { isCnpjValido, isCpfValido, onlyDigits } from "@/lib/documento";

/**
 * Conversores do texto do dump para o formato do app (025-migracao-legado, design.md D5).
 * Cada conversor recebe o texto (ou `null`) e devolve `{ valor }` ou `{ erro }`. Quem decide se o
 * erro rejeita a linha ou só anula a coluna é a carga (coluna obrigatória × opcional no modelo).
 */
export type Resultado<T> = { ok: true; valor: T | null; aviso?: string } | { ok: false; erro: string };

const ok = <T>(valor: T | null, aviso?: string): Resultado<T> => ({ ok: true, valor, ...(aviso ? { aviso } : {}) });
const falha = <T>(erro: string): Resultado<T> => ({ ok: false, erro });

const vazio = (v: string | null) => v === null || v.trim() === "";

/** Texto sem alteração (inclusive acima dos limites da 020; o aviso é dado pela carga). */
export function texto(v: string | null): Resultado<string> {
  return ok(v);
}

/** Inteiro em texto (`"12"`, `"-3"`); vazio vira `null`. Não passa por ponto flutuante. */
export function inteiro(v: string | null): Resultado<number> {
  if (vazio(v)) return ok(null);
  const t = v!.trim();
  if (!/^[-+]?\d+$/.test(t)) return falha(`não é inteiro: ${t}`);
  const n = Number.parseInt(t, 10);
  return Number.isSafeInteger(n) ? ok(n) : falha(`inteiro fora do limite: ${t}`);
}

const NUMERO_DUMP = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/**
 * FLOAT do dump → `Prisma.Decimal` com 2 casas, meio para cima. O texto vai direto para o Decimal:
 * nunca passa por number (D5). `arredondado` diz se o valor gravado difere do texto de origem.
 */
export function dinheiro(v: string | null): Resultado<{ decimal: Prisma.Decimal; exato: Prisma.Decimal; arredondado: boolean }> {
  if (vazio(v)) return ok(null);
  const t = v!.trim();
  if (!NUMERO_DUMP.test(t)) return falha(`valor não numérico: ${t}`);
  const exato = new Prisma.Decimal(t);
  const decimal = exato.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return ok({ decimal, exato, arredondado: !decimal.equals(exato) });
}

/** Texto do valor gravado com 2 casas (`1234.57`, `0.10`). */
export const dinheiroTexto = (d: Prisma.Decimal) => d.toFixed(2);

const DATA = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/;

function partesData(t: string) {
  const m = DATA.exec(t.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => (x === undefined ? 0 : Number.parseInt(x, 10)));
  if (y === 0 || mo === 0 || d === 0) return null; // 0000-00-00 e datas zeradas do MySQL
  const teste = new Date(Date.UTC(y, mo - 1, d));
  if (teste.getUTCFullYear() !== y || teste.getUTCMonth() !== mo - 1 || teste.getUTCDate() !== d) return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  return { y, mo, d, h, mi, s };
}

/**
 * `AAAA-MM-DD` → meia-noite UTC (mesma convenção de `parseDate`, `src/lib/format.ts`). Hora, se
 * vier, é descartada. `0000-00-00` ou data impossível → erro (a carga anula ou rejeita).
 */
export function data(v: string | null): Resultado<Date> {
  if (vazio(v)) return ok(null);
  const p = partesData(v!);
  if (!p) return falha(`data inválida: ${v}`);
  return ok(new Date(Date.UTC(p.y, p.mo - 1, p.d)));
}

const TZ = "America/Sao_Paulo";
const fmtTz = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Diferença (ms) entre o relógio de São Paulo e UTC no instante dado. */
function offsetSaoPaulo(instante: number): number {
  const p = Object.fromEntries(fmtTz.formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  const n = (k: string) => Number.parseInt(p[k], 10);
  const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return local - instante;
}

/** `AAAA-MM-DD HH:MM:SS` interpretada em America/Sao_Paulo (horário de verão histórico incluído). */
export function dataHora(v: string | null): Resultado<Date> {
  if (vazio(v)) return ok(null);
  const p = partesData(v!);
  if (!p) return falha(`data inválida: ${v}`);
  const comoUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  let instante = comoUtc - offsetSaoPaulo(comoUtc);
  instante = comoUtc - offsetSaoPaulo(instante);
  return ok(new Date(instante));
}

function documento(v: string | null, tamanho: 11 | 14, nome: "CPF" | "CNPJ"): Resultado<string> {
  if (vazio(v)) return ok(null);
  const digitos = onlyDigits(v);
  if (!digitos || /^0+$/.test(digitos)) return ok(null);
  if (digitos.length > tamanho) return falha(`${nome} com mais de ${tamanho} dígitos: ${v}`);
  const valor = digitos.padStart(tamanho, "0");
  const valido = tamanho === 11 ? isCpfValido(valor) : isCnpjValido(valor);
  return ok(valor, valido ? undefined : "dv_invalido");
}

/** CPF só com dígitos e zeros à esquerda até 11 (022 › D1); DV inválido é aviso. */
export const cpf = (v: string | null) => documento(v, 11, "CPF");
/** CNPJ só com dígitos e zeros à esquerda até 14 (022 › D1); DV inválido é aviso. */
export const cnpj = (v: string | null) => documento(v, 14, "CNPJ");

const SIM = new Set(["1", "S", "s"]);
const NAO = new Set(["0", "N", "n", ""]);

/** Indicador → `"S"`/`"N"` (colunas texto do app). `NULL` e vazio → `"N"`. */
export function simNao(v: string | null): Resultado<string> {
  const t = v === null ? "" : v.trim();
  if (SIM.has(t)) return ok("S");
  if (NAO.has(t)) return ok("N");
  return falha(`indicador inválido: ${t}`);
}

/** Indicador → `1`/`0` (Int). `NULL` continua `null`; vazio → 0. */
export function zeroUm(v: string | null): Resultado<number> {
  if (v === null) return ok(null);
  const t = v.trim();
  if (SIM.has(t)) return ok(1);
  if (NAO.has(t)) return ok(0);
  return falha(`indicador inválido: ${t}`);
}

/** Indicador → `"1"`/`"0"` (String: `contratos.prestacaoRealizada`, 021). `NULL` continua `null`. */
export function zeroUmTexto(v: string | null): Resultado<string> {
  const r = zeroUm(v);
  return r.ok ? ok(r.valor === null ? null : String(r.valor)) : r;
}
