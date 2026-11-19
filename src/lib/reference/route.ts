import { pageResponse, parsePagination } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/guard";
import { handleError } from "@/lib/crud/server";
import { listReference, type ReferenceTable } from "./tables";

/** Grupos e associação usuário–grupo do legado: só o Administrador (recurso `users`, 023-perfis-acesso). */
const DE_USUARIOS: readonly ReferenceTable[] = ["groups", "groups_users"];

/** Cria o handler `GET` somente leitura de uma tabela de referência (`referencia:listar`; groups → `users:listar`). */
export function referenceListHandler(table: ReferenceTable) {
  return async function GET(request: Request) {
    try {
      await requirePermission(DE_USUARIOS.includes(table) ? "users" : "referencia", "listar");
      const params = new URL(request.url).searchParams;
      const p = parsePagination(params);
      // Os filtros exatos (lista branca por tabela, 022) também vêm da query string.
      const { items, total } = await listReference(table, p, params);
      return pageResponse(items, total, p);
    } catch (error) {
      return handleError(error);
    }
  };
}
