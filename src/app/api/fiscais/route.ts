import { fiscaisApi, listFiscais } from "@/lib/entities/fiscais.server";

export const dynamic = "force-dynamic";
export const GET = listFiscais;
export const POST = fiscaisApi.create;
