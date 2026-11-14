import { prestacaoContasApi } from "@/lib/entities/prestacao_contas.server";

export const dynamic = "force-dynamic";
export const GET = prestacaoContasApi.get;
export const PUT = prestacaoContasApi.update;
export const DELETE = prestacaoContasApi.remove;
