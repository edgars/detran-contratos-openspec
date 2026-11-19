import { statusApi } from "@/lib/entities/status.server";

export const dynamic = "force-dynamic";
export const GET = statusApi.get;
export const PUT = statusApi.update;
export const DELETE = statusApi.remove;
