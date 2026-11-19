import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { handleError, readBody } from "@/lib/crud/server";
import { gravarValorInicial } from "@/lib/relatorios/acerto-valor";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Grava o valor inicial (019): corpo `{ valorInicial: "1.234,56" }`, só em contrato original sem valor. */
export async function PUT(request: Request, { params }: Ctx) {
  try {
    // 023-perfis-acesso: gravar o valor inicial é só do Administrador (`acerto_valor:editar`).
    await requirePermission("acerto_valor", "editar");
    const { id: raw } = await params;
    const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
    const salvo = Number.isSafeInteger(id) && id > 0 ? await gravarValorInicial(id, await readBody(request)) : null;
    if (!salvo) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
    return NextResponse.json(salvo);
  } catch (error) {
    return handleError(error);
  }
}
