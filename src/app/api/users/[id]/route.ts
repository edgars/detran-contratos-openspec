import { removeUser, usersApi } from "@/lib/entities/users.server";

export const dynamic = "force-dynamic";
export const GET = usersApi.get;
export const PUT = usersApi.update;
export const DELETE = removeUser;
