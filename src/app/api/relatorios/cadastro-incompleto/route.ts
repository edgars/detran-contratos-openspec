import * as relatorio from "@/lib/relatorios/cadastro-incompleto";
import { rotaRelatorio } from "@/lib/relatorios/rota";

export const dynamic = "force-dynamic";

/** Cadastro incompleto (019): sem filtros; `avisos: ["SEM_TIPO_CONTRATO"]` sem tipo marcado como Contrato. */
export const GET = rotaRelatorio({ params: relatorio.params, consultar: () => relatorio.consultar() });
