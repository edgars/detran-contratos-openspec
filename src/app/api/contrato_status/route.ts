import { contratoStatusApi } from "@/lib/entities/contrato_status.server";

export const dynamic = "force-dynamic";
export const GET = contratoStatusApi.list;
export const POST = contratoStatusApi.create;
