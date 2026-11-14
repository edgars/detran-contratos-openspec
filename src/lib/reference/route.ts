import { NextResponse } from "next/server";
import { pageResponse, parsePagination } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { listReference, type ReferenceTable } from "./tables";

/** Cria o handler `GET` somente leitura de uma tabela de referência. */
export function referenceListHandler(table: ReferenceTable) {
  return async function GET(request: Request) {
    if (!(await getSessionUser())) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const p = parsePagination(params);
    // Os filtros exatos (lista branca por tabela, 022) também vêm da query string.
    const { items, total } = await listReference(table, p, params);
    return pageResponse(items, total, p);
  };
}
