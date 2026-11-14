import * as relatorio from "@/lib/relatorios/contratos-vencidos";
import { rotaRelatorio } from "@/lib/relatorios/rota";

export const dynamic = "force-dynamic";

/** Contratos vencidos (019): `inicio` e `fim` (obrigatórios), `formato=csv`. */
export const GET = rotaRelatorio({
  params: relatorio.params,
  consultar: relatorio.consultar,
  csv: { slug: relatorio.slug, colunas: relatorio.colunas, linhas: (r) => r.linhas },
});
