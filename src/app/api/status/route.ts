import { statusApi } from "@/lib/entities/status.server";

export const dynamic = "force-dynamic";
export const GET = statusApi.list;
export const POST = statusApi.create;
