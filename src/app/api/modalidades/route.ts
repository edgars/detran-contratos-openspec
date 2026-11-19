import { modalidadesApi } from "@/lib/entities/modalidades.server";

export const dynamic = "force-dynamic";
export const GET = modalidadesApi.list;
export const POST = modalidadesApi.create;
