import { prestacaoContasApi } from "@/lib/entities/prestacao_contas.server";

export const dynamic = "force-dynamic";
// Registros do andamento são só leitura (021-prestacao-contas-fluxo): sem PUT nem DELETE → 405 do Next.
export const GET = prestacaoContasApi.get;
