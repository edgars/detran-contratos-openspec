import { prestacaoContasApi } from "@/lib/entities/prestacao_contas.server";

export const dynamic = "force-dynamic";
export const GET = prestacaoContasApi.list;
export const POST = prestacaoContasApi.create;
