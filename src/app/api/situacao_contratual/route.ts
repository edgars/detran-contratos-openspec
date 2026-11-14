import { situacaoContratualsApi } from "@/lib/entities/situacao_contratuals.server";

export const dynamic = "force-dynamic";
export const GET = situacaoContratualsApi.list;
export const POST = situacaoContratualsApi.create;
