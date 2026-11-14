import * as relatorio from "@/lib/relatorios/acompanhamento-meta";
import { rotaRelatorio } from "@/lib/relatorios/rota";

export const dynamic = "force-dynamic";

/** Acompanhamento de meta (019): três listas com resumo (valor total e nº de termos) e detalhe. */
export const GET = rotaRelatorio({ params: relatorio.params, consultar: () => relatorio.consultar() });
