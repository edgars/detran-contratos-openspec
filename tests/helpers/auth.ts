import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { resetCookies } from "./next-headers-mock";

/**
 * Cria (ou reusa) um usuário e abre uma sessão para ele no cookie store de teste.
 * Exige `vi.mock("next/headers", () => import("./helpers/next-headers-mock"))` no arquivo de teste.
 */
export async function loginAs(username = "teste") {
  resetCookies();
  const user =
    (await prisma.user.findUnique({ where: { username } })) ??
    (await prisma.user.create({ data: { username, passwordHash: await hashPassword("senha-de-teste") } }));
  await createSession(user.id);
  return user;
}

export function logout() {
  resetCookies();
}

/** Monta um Request JSON. */
export function jsonRequest(url: string, method = "GET", body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Contexto de rota dinâmica `[id]` do Next.js 15. */
export function idParams(id: number | string) {
  return { params: Promise.resolve({ id: String(id) }) };
}

/** Bytes mínimos de um PDF válido e de um PNG (para testar a assinatura). */
export const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\n%teste\n");
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
