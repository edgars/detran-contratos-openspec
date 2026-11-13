import type { SessionUser } from "./session";

/**
 * Autoria pela sessão: o `userId` gravado é sempre o do usuário logado, e qualquer valor de
 * autoria enviado pelo cliente é descartado (001b-security-baseline › "Autoria pela sessão").
 */
export function withAuthor<T extends Record<string, unknown>>(data: T, user: SessionUser, field = "userId") {
  return { ...data, [field]: user.id };
}
