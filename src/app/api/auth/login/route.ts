import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api/http";
import { LOGIN_FAILED, authenticate } from "@/lib/auth/login";
import { createSession } from "@/lib/auth/session";
import { log } from "@/lib/log";

const loginSchema = z
  .object({
    username: z.string({ error: "Informe o usuário" }).trim().min(1, { error: "Informe o usuário" }),
    password: z.string({ error: "Informe a senha" }).min(1, { error: "Informe a senha" }),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);
  const user = await authenticate(parsed.data.username, parsed.data.password);
  if (!user) {
    // 026-producao: só o usuário digitado vai para o log, nunca a senha.
    log("warn", "login.falha", { rota: "/api/auth/login", metodo: "POST", status: 401, username: parsed.data.username });
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 401 });
  }
  await createSession(user.id);
  log("info", "login.ok", { rota: "/api/auth/login", metodo: "POST", status: 200, userId: user.id, username: user.username });
  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
