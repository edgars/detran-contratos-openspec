import { historicosApi } from "@/lib/entities/historicos.server";

export const dynamic = "force-dynamic";
export const GET = historicosApi.list;
export const POST = historicosApi.create;
