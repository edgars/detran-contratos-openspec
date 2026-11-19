import { pagamentosApi } from "@/lib/entities/pagamentos.server";

export const dynamic = "force-dynamic";
export const GET = pagamentosApi.list;
export const POST = pagamentosApi.create;
