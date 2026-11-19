import { NextResponse } from "next/server";
import { z } from "zod";
import { validationError } from "@/lib/api/http";
import { LOGIN_FAILED, authenticate } from "@/lib/auth/login";
import { createSession } from "@/lib/auth/session";

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
  if (!user) return NextResponse.json({ error: LOGIN_FAILED }, { status: 401 });
  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
