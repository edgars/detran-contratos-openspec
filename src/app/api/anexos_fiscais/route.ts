import { anexosFiscaisApi } from "@/lib/entities/anexos_fiscais.server";

export const dynamic = "force-dynamic";
export const GET = anexosFiscaisApi.list;
export const POST = anexosFiscaisApi.create;
