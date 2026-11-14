import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleError } from "@/lib/crud/server";
import { getFluxo } from "@/lib/prestacao/server";

export const dynamic = "force-dynamic";

/** Fluxo de prestação de contas de um contrato (021): painel, prazos, fases do prazo (`?periodo=`) e histórico. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const raw = (await ctx.params).id;
    const id = /^\d+$/.test(raw) ? Number(raw) : null;
    const fluxo = id ? await getFluxo(id, new URL(request.url).searchParams.get("periodo")) : null;
    if (!fluxo) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
    return NextResponse.json(fluxo);
  } catch (error) {
    return handleError(error);
  }
}
