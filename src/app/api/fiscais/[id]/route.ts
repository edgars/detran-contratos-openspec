import { fiscaisApi } from "@/lib/entities/fiscais.server";

export const dynamic = "force-dynamic";
export const GET = fiscaisApi.get;
export const PUT = fiscaisApi.update;
export const DELETE = fiscaisApi.remove;
