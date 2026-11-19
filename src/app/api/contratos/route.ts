import { contratosApi } from "@/lib/entities/contratos.server";

export const dynamic = "force-dynamic";
export const GET = contratosApi.list;
export const POST = contratosApi.create;
