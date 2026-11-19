/**
 * Logs estruturados (026-producao › design.md › Logs estruturados): uma linha JSON por evento em stdout,
 * `{ ts, level, evento, ... }`, respeitando `LOG_LEVEL`. Nenhuma linha leva senha, hash, cookie,
 * cabeçalho Authorization, token de sessão ou o valor de `AUTH_SECRET`: as chaves proibidas saem
 * recursivamente antes de serializar e o valor do segredo, se aparecer em algum texto, é trocado.
 * Roda no Node e no runtime do middleware (edge), por isso não importa nada do Node.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDEM: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Chaves removidas em qualquer nível (comparação sem diferenciar maiúsculas). */
export const CHAVES_PROIBIDAS = [
  "password",
  "passwordHash",
  "passwordold",
  "passwordnew",
  "passwordconfirm",
  "senha",
  "token",
  "cookie",
  "authorization",
  "AUTH_SECRET",
  "sessionId",
] as const;

const PROIBIDAS = new Set(CHAVES_PROIBIDAS.map((k) => k.toLowerCase()));

function nivelAtual(): LogLevel {
  const v = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return v in ORDEM ? (v as LogLevel) : "info";
}

/** Erro em formato serializável: nome e mensagem; a pilha só com `LOG_LEVEL=debug`. */
function erroParaLog(error: Error) {
  const out: Record<string, unknown> = { name: error.name, message: error.message };
  if (nivelAtual() === "debug" && error.stack) out.stack = error.stack;
  return out;
}

/** Remove as chaves proibidas em qualquer profundidade (objetos e arrays). */
export function semSegredos(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[profundo]";
  if (value instanceof Error) return semSegredos(erroParaLog(value), depth + 1);
  if (Array.isArray(value)) return value.map((v) => semSegredos(v, depth + 1));
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (PROIBIDAS.has(k.toLowerCase())) continue;
      out[k] = semSegredos(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Saida = (linha: string) => void;

/** Escreve em `process.stdout` quando existe (Node); no runtime edge, `console.log`. */
const saidaPadrao: Saida = (linha) => {
  const proc = (globalThis as unknown as { process?: Record<string, unknown> }).process;
  const stdout = proc?.["stdout"] as { write?: (s: string) => unknown } | undefined;
  if (stdout && typeof stdout.write === "function") stdout.write(linha + "\n");
  else console.log(linha);
};

let saida: Saida = saidaPadrao;

/** Só para testes: troca o destino das linhas (`null` volta ao padrão). */
export function setLogOutput(fn: Saida | null) {
  saida = fn ?? saidaPadrao;
}

export type CamposLog = {
  msg?: string;
  rota?: string;
  metodo?: string;
  status?: number;
  userId?: number;
  username?: string;
  erro?: unknown;
  [campo: string]: unknown;
};

export function log(level: LogLevel, evento: string, campos: CamposLog = {}): void {
  if (ORDEM[level] < ORDEM[nivelAtual()]) return;
  const limpo = semSegredos(campos) as Record<string, unknown>;
  let linha = JSON.stringify({ ts: new Date().toISOString(), level, evento, ...limpo });
  // O valor do segredo nunca sai, nem dentro de uma mensagem de erro.
  const segredo = process.env.AUTH_SECRET;
  if (segredo && segredo.length >= 8 && linha.includes(segredo)) linha = linha.split(segredo).join("[removido]");
  try {
    saida(linha);
  } catch {
    // Log nunca derruba a requisição.
  }
}
