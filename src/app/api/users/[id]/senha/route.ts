import { requirePermission } from "@/lib/auth/guard";
import { handleError } from "@/lib/crud/server";
import { definirSenha } from "@/lib/entities/users.server";

export const dynamic = "force-dynamic";

/**
 * 025-migracao-legado: o Administrador define a senha e ativa o usuário (vindo do legado).
 * Permissão `users:editar` (023: só Administrador) antes de ler o corpo; `definirSenha` confere de novo.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("users", "editar");
  } catch (error) {
    return handleError(error);
  }
  return definirSenha(request, ctx);
}
