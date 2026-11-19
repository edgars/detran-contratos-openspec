import { NextResponse } from "next/server";
import { pageResponse, parsePagination } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { listReference, type ReferenceTable } from "./tables";

/** Cria o handler `GET` somente leitura de uma tabela de referência. */
export function referenceListHandler(table: ReferenceTable) {
  return async function GET(request: Request) {
    if (!(await getSessionUser())) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    const p = parsePagination(new URL(request.url).searchParams);
    const { items, total } = await listReference(table, p);
    return pageResponse(items, total, p);
  };
}
