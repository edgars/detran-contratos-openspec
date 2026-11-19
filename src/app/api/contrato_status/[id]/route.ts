import { contratoStatusApi } from "@/lib/entities/contrato_status.server";

export const dynamic = "force-dynamic";
export const GET = contratoStatusApi.get;
export const PUT = contratoStatusApi.update;
export const DELETE = contratoStatusApi.remove;
