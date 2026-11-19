import { penalidadesApi } from "@/lib/entities/penalidades.server";

export const dynamic = "force-dynamic";
export const GET = penalidadesApi.list;
export const POST = penalidadesApi.create;
