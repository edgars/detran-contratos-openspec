import { historicosApi } from "@/lib/entities/historicos.server";

export const dynamic = "force-dynamic";
export const GET = historicosApi.get;
export const PUT = historicosApi.update;
export const DELETE = historicosApi.remove;
