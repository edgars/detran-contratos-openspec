import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, randomToken, sha256, signToken, verifyToken } from "./token";

export const SESSION_HOURS = 8;

export type SessionUser = { id: number; username: string; superuser: number | null };

/** Usuário sem nenhum campo de senha. Toda resposta de API que devolve usuário passa por aqui. */
export function publicUser<T extends Record<string, unknown>>(user: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, password, passwordold, passwordnew, passwordconfirm, ...rest } = user;
  return rest;
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
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
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
