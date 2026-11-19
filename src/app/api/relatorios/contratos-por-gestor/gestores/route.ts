import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { handleError } from "@/lib/crud/server";
import { gestores } from "@/lib/relatorios/contratos-por-gestor";

export const dynamic = "force-dynamic";

/** Opções do filtro Gestor (019): pessoas gestoras de algum contrato original, `{ value: cpf, label: nome }`. */
export async function GET() {
  try {
    await requirePermission("relatorios", "listar"); // 023-perfis-acesso
    return NextResponse.json({ items: await gestores() });
  } catch (error) {
    return handleError(error);
  }
}
