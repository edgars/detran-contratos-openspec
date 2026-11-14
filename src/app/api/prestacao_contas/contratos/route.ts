import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { handleError } from "@/lib/crud/server";
import { listarPrestacao } from "@/lib/prestacao/server";

export const dynamic = "force-dynamic";

/** Contratos sujeitos à prestação de contas (021): `situacao`, `campo`/`q`, `ordenar`/`dir`, `tipoContratoId`, `modalidadeId`, `page`/`size`. */
export async function GET(request: Request) {
  try {
    await requirePermission("prestacao_contas", "listar"); // 023-perfis-acesso
    return NextResponse.json(await listarPrestacao(new URL(request.url).searchParams));
  } catch (error) {
    return handleError(error);
  }
}
