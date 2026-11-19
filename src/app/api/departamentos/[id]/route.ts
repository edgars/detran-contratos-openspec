import { departamentosApi } from "@/lib/entities/departamentos.server";

export const dynamic = "force-dynamic";
export const GET = departamentosApi.get;
export const PUT = departamentosApi.update;
export const DELETE = departamentosApi.remove;
