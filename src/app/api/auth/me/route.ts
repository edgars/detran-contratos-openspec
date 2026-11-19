import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { permissoesDe } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Usuário logado com os perfis e as permissões `recurso:ação` (023-perfis-acesso), lidos do banco nesta requisição. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { id, username, perfis } = user;
  return NextResponse.json({ user: { id, username, perfis, permissoes: permissoesDe(perfis) } });
}
