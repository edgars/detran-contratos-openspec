import { tipoContratosApi } from "@/lib/entities/tipo_contratos.server";

export const dynamic = "force-dynamic";
export const GET = tipoContratosApi.list;
export const POST = tipoContratosApi.create;
