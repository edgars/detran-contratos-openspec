import { pagamentosApi } from "@/lib/entities/pagamentos.server";

export const dynamic = "force-dynamic";
export const GET = pagamentosApi.get;
export const PUT = pagamentosApi.update;
export const DELETE = pagamentosApi.remove;
