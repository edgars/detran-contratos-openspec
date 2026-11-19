import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { requireUser } from "@/lib/auth/session";
import { findAttachmentOwner } from "@/lib/auth/arquivos";
import { handleError } from "@/lib/crud/server";
import { readStoredPdf } from "@/lib/uploads";

const naoEncontrado = () => NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

/** Download de anexo, só para sessão válida (001b) com `ver` no registro dono do arquivo (023). */
export async function GET(_request: Request, { params }: { params: Promise<{ nome: string }> }) {
  try {
    await requireUser();
    const { nome } = await params;
    const dono = await findAttachmentOwner(nome);
    if (!dono) return naoEncontrado();
    await requirePermission(dono, "ver");
    const file = await readStoredPdf(nome);
    if (!file) return naoEncontrado();
    return new NextResponse(new Uint8Array(file), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"` },
    });
  } catch (error) {
    return handleError(error);
  }
}
