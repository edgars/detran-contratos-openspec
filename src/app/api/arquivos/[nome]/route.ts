import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { readStoredPdf } from "@/lib/uploads";

/** Download de anexo, só para sessão válida (001b-security-baseline › "Upload de PDF validado"). */
export async function GET(_request: Request, { params }: { params: Promise<{ nome: string }> }) {
  if (!(await getSessionUser())) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { nome } = await params;
  const file = await readStoredPdf(nome);
  if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"` },
  });
}
