import { getSessionUser, requireUser, type SessionUser } from "./session";
import { ForbiddenError, can, type Acao, type Recurso } from "./permissions";

/**
 * Checagem de permissão no servidor (023-perfis-acesso › security "Acesso negado responde 403").
 * Fica fora de `permissions.ts` para aquele módulo continuar puro (importável por componentes cliente).
 */

/** Sessão primeiro (`401`), depois a permissão (`ForbiddenError` → `403`). Perfis lidos do banco nesta requisição. */
export async function requirePermission(recurso: Recurso, acao: Acao): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, recurso, acao)) throw new ForbiddenError();
  return user;
}

/** Como `requirePermission`, aceitando qualquer uma das permissões dadas (ex.: `contratos:ver` ou `contratos_resumo:ver`). */
export async function requireAnyPermission(...opcoes: [Recurso, Acao][]): Promise<SessionUser> {
  const user = await requireUser();
  if (!opcoes.some(([recurso, acao]) => can(user, recurso, acao))) throw new ForbiddenError();
  return user;
}

/**
 * Página da área logada: devolve o usuário quando ele tem a permissão, ou `null` — a página então
 * renderiza `<SemPermissao />` e não busca os dados do recurso. Sem sessão o layout já redireciona.
 */
export async function guardPage(recurso: Recurso, acao: Acao, ...outras: [Recurso, Acao][]): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const opcoes: [Recurso, Acao][] = [[recurso, acao], ...outras];
  return opcoes.some(([r, a]) => can(user, r, a)) ? user : null;
}
