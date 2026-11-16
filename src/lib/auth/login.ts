import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { ensureAdminUser } from "./seed";

export const LOGIN_FAILED = "Usuário ou senha inválidos";

let dummyHash: Promise<string> | undefined;

/** Confere usuário e senha. A mensagem de falha é a mesma se o usuário existe ou não. */
export async function authenticate(username: string, password: string) {
  await ensureAdminUser();
  const user = await prisma.user.findUnique({ where: { username } });
  // Compara mesmo sem usuário para não revelar, pelo tempo de resposta, se ele existe.
  dummyHash ??= hashPassword("senha-inexistente");
  const hash = user?.passwordHash ?? (await dummyHash);
  const ok = await verifyPassword(password, hash);
  // 025-migracao-legado: usuário carregado do legado (senhaRedefinir) não entra até o Administrador definir a senha.
  if (!user || !ok || user.inativo || user.senhaRedefinir) return null;
  await prisma.user.update({ where: { id: user.id }, data: { ultimoLogin: new Date() } });
  return user;
}
