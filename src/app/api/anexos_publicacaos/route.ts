import { anexosPublicacaosApi } from "@/lib/entities/anexos_publicacaos.server";

export const dynamic = "force-dynamic";
export const GET = anexosPublicacaosApi.list;
export const POST = anexosPublicacaosApi.create;
