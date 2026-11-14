import { departamentosApi } from "@/lib/entities/departamentos.server";

export const dynamic = "force-dynamic";
export const GET = departamentosApi.list;
export const POST = departamentosApi.create;
