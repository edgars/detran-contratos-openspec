import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, randomToken, sha256, signToken, verifyToken } from "./token";

export const SESSION_HOURS = 8;

export type SessionUser = { id: number; username: string; superuser: number | null };

export const SECRET_FIELDS = ["password", "passwordHash", "passwordold", "passwordnew", "passwordconfirm"] as const;
const SECRETS = new Set<string>(SECRET_FIELDS);

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Remove os campos de senha em qualquer nível (objetos e arrays). `Date`, `Decimal`, `Buffer` e
 * outras instâncias de classe não são percorridas: saem como estão, e o `toJSON` delas continua valendo.
 */
export function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v)) as T;
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (!SECRETS.has(k)) out[k] = stripSecrets(v);
  return out as T;
}

/** Usuário sem nenhum campo de senha (em qualquer nível). Toda resposta de API que devolve usuário passa por aqui. */
export function publicUser<T extends Record<string, unknown>>(user: T): Omit<T, (typeof SECRET_FIELDS)[number]> {
  return stripSecrets(user);
}

/**
 * Cria uma sessão nova (o identificador é sempre novo a cada login) e grava o cookie.
 * Só o hash do token fica no banco.
 */
export async function createSession(userId: number): Promise<string> {
  const store = await cookies();
  const previous = await verifyToken(store.get(SESSION_COOKIE)?.value);
  if (previous) await prisma.session.deleteMany({ where: { id: await sha256(previous) } });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  await prisma.session.create({ data: { id: await sha256(token), userId, expiresAt } });
  store.set(SESSION_COOKIE, await signToken(token), {
    httpOnly: true,
    // Padrão "lax". "none" só para abrir o app dentro de um iframe (ex.: prévia), sempre com Secure.
    sameSite: process.env.COOKIE_SAMESITE === "none" ? "none" : "lax",
    secure:
      process.env.COOKIE_SAMESITE === "none" ||
      (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false"),
    path: "/",
    expires: expiresAt,
  });
  return token;
}

/** Usuário da sessão atual, lido só do cookie (nunca da URL, do corpo ou de header customizado). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = await verifyToken(store.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: await sha256(token) },
    include: { user: { select: { id: true, username: true, superuser: true, inativo: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.inativo) return null;
  const { id, username, superuser } = session.user;
  return { id, username, superuser };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = await verifyToken(store.get(SESSION_COOKIE)?.value);
  if (token) await prisma.session.deleteMany({ where: { id: await sha256(token) } });
  store.delete(SESSION_COOKIE);
}

export class UnauthorizedError extends Error {}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError("Sessão inválida");
  return user;
}
