import { z } from "zod";

/**
 * Configuração de produção validada no start (026-producao › design.md › Configuração validada no start).
 * Chamada por `check-env.js` (entrypoint do container, antes do `prisma migrate deploy`) e por
 * `src/instrumentation.ts`. Só vale com `NODE_ENV=production`; fora dele (dev, testes) não recusa nada.
 * A mensagem cita o NOME de cada variável inválida, nunca o valor.
 */

/** Variáveis lidas por esta validação (o teste confere que todas estão no `.env.example`). */
export const VARIAVEIS_VALIDADAS = [
  "AUTH_SECRET",
  "APP_ORIGIN",
  "COOKIE_SECURE",
  "COOKIE_SAMESITE",
  "FRAME_ANCESTORS",
  "UPLOAD_MAX_MB",
  "PROXY_MAX_BODY_MB",
  "DATABASE_URL",
  "ADMIN_PASSWORD",
  "LOG_LEVEL",
] as const;

/**
 * Corpo máximo que o Next entrega às rotas depois do middleware (`experimental.middlewareClientMaxBodySize`
 * em next.config.ts, mesmo valor). O proxy (`PROXY_MAX_BODY_MB`) tem de ficar abaixo dele.
 */
export const CORPO_MAX_MB = 100;

/** Bytes do segredo: base64 válido conta os bytes decodificados; outro texto conta os bytes UTF-8. */
export function bytesDoSegredo(secret: string): number {
  const s = secret.trim();
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(s) && s.length % 4 === 0) return Math.floor((s.length * 3) / 4) - (s.match(/=+$/)?.[0].length ?? 0);
  return new TextEncoder().encode(s).length;
}

/** Uma origem `https://host[:porta]`, sem caminho, query ou fragmento. */
export function isOrigemHttps(valor: string): boolean {
  try {
    const u = new URL(valor);
    return u.protocol === "https:" && u.origin === valor.replace(/\/$/, "") && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Origens de `FRAME_ANCESTORS` (separadas por espaço); vazio → `[]`. */
export function frameAncestors(valor = process.env.FRAME_ANCESTORS): string[] {
  return (valor ?? "").split(/\s+/).filter(Boolean);
}

const vazio = (v: string | undefined) => v === undefined || v.trim() === "";
const inteiroPositivo = (v: string | undefined) => !vazio(v) && /^\d+$/.test(v!.trim()) && Number(v) > 0;

const schema = z
  .object({
    AUTH_SECRET: z
      .string()
      .optional()
      .refine((v) => !vazio(v) && bytesDoSegredo(v!) >= 32, { message: "deve ter ao menos 32 bytes (openssl rand -base64 32)" }),
    APP_ORIGIN: z
      .string()
      .optional()
      .refine((v) => !vazio(v) && v!.startsWith("https://"), { message: "deve começar com https://" }),
    COOKIE_SECURE: z
      .string()
      .optional()
      .refine((v) => v?.trim().toLowerCase() !== "false", { message: "não pode ser false em produção" }),
    COOKIE_SAMESITE: z
      .string()
      .optional()
      .refine((v) => vazio(v) || ["lax", "none"].includes(v!.trim().toLowerCase()), { message: "deve ser vazio, lax ou none" }),
    FRAME_ANCESTORS: z
      .string()
      .optional()
      .refine((v) => frameAncestors(v).every(isOrigemHttps), { message: "cada item deve ser uma origem https://" }),
    UPLOAD_MAX_MB: z
      .string()
      .optional()
      .refine((v) => vazio(v) || inteiroPositivo(v), { message: "deve ser um inteiro positivo" }),
    PROXY_MAX_BODY_MB: z
      .string()
      .optional()
      .refine((v) => inteiroPositivo(v), { message: "deve ser um inteiro positivo" }),
    DATABASE_URL: z
      .string()
      .optional()
      .refine((v) => !vazio(v) && v!.startsWith("file:"), { message: "deve começar com file:" }),
    LOG_LEVEL: z
      .string()
      .optional()
      .refine((v) => vazio(v) || ["debug", "info", "warn", "error"].includes(v!.trim().toLowerCase()), {
        message: "deve ser debug, info, warn ou error",
      }),
  })
  .superRefine((env, ctx) => {
    const upload = vazio(env.UPLOAD_MAX_MB) ? 10 : Number(env.UPLOAD_MAX_MB);
    if (inteiroPositivo(env.PROXY_MAX_BODY_MB) && Number(env.PROXY_MAX_BODY_MB) <= upload) {
      ctx.addIssue({ code: "custom", path: ["PROXY_MAX_BODY_MB"], message: "deve ser maior que UPLOAD_MAX_MB" });
    }
    if (inteiroPositivo(env.PROXY_MAX_BODY_MB) && Number(env.PROXY_MAX_BODY_MB) > CORPO_MAX_MB) {
      ctx.addIssue({ code: "custom", path: ["PROXY_MAX_BODY_MB"], message: `deve ser no máximo ${CORPO_MAX_MB} (limite do corpo no Next)` });
    }
  });

export type ResultadoAmbiente = { ok: boolean; erros: string[]; avisos: string[] };

/**
 * Valida o ambiente. Fora de produção devolve sempre `ok`. Cada erro é `NOME: regra` — o valor nunca
 * entra na mensagem (o schema não usa mensagens do zod que repetem a entrada).
 */
export function validarAmbiente(env: Record<string, string | undefined> = process.env): ResultadoAmbiente {
  if (env.NODE_ENV !== "production") return { ok: true, erros: [], avisos: [] };
  const entrada = Object.fromEntries(VARIAVEIS_VALIDADAS.map((k) => [k, env[k]]));
  const r = schema.safeParse(entrada);
  const erros = r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
  const avisos: string[] = [];
  if (!vazio(env.ADMIN_PASSWORD)) {
    avisos.push("ADMIN_PASSWORD preenchido: só é usado com a tabela users vazia; apague-o do .env depois do primeiro acesso");
  }
  return { ok: erros.length === 0, erros: [...new Set(erros)], avisos };
}

/** Texto da recusa, em pt-BR, com os nomes das variáveis inválidas. */
export function mensagemDeRecusa(erros: string[]): string {
  return `Configuração de produção inválida; o app não sobe. Corrija no .env: ${erros.join("; ")}`;
}
