import * as relatorio from "@/lib/relatorios/acerto-valor";
import { rotaRelatorio } from "@/lib/relatorios/rota";

export const dynamic = "force-dynamic";

/** Acerto de valor (019): contratos originais sem valor inicial, `q` (objeto contém), `page` (20 por página). */
// 023-perfis-acesso: só o Administrador (`acerto_valor:listar`).
export const GET = rotaRelatorio({ params: relatorio.params, consultar: relatorio.consultar, recurso: "acerto_valor" });
