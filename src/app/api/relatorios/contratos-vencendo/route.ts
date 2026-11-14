import * as relatorio from "@/lib/relatorios/contratos-vencendo";
import { rotaRelatorio } from "@/lib/relatorios/rota";

export const dynamic = "force-dynamic";

/** Contratos vencendo (019): `dias` (obrigatório), `inicio`/`fim`, `sort`/`dir`, `formato=csv`. */
export const GET = rotaRelatorio({
  params: relatorio.params,
  consultar: (p) => relatorio.consultar(p),
  csv: { slug: relatorio.slug, colunas: relatorio.colunas, linhas: (r) => r.linhas },
});
