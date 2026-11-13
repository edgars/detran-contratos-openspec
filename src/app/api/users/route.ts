import { usersApi } from "@/lib/entities/users.server";

export const dynamic = "force-dynamic";
export const GET = usersApi.list;
export const POST = usersApi.create;
