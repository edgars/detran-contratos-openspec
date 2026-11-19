import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

/** Cria o usuário inicial a partir de ADMIN_USERNAME/ADMIN_PASSWORD, só com `users` vazia, com o perfil Administrador (023). */
export async function ensureAdminUser(): Promise<boolean> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return false;
  if ((await prisma.user.count()) > 0) return false;
  await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), superuser: 1, perfis: { create: { perfil: "ADMINISTRADOR" } } },
  });
  return true;
}
