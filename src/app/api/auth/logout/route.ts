import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { log } from "@/lib/log";

export async function POST() {
  const user = await getSessionUser();
  await destroySession();
  if (user) log("info", "logout", { rota: "/api/auth/logout", metodo: "POST", userId: user.id, username: user.username });
  return NextResponse.json({ ok: true });
}
