import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { uploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Healthcheck do compose (026-producao › Healthcheck): banco responde a `SELECT 1` e a pasta de anexos é
 * gravável → `200 {"status":"ok"}`; senão `503 {"status":"erro"}`. Nada mais na resposta: a causa vai só
 * para o log. Acessível sem sessão só por GET (exceção aceita pelo autor em 14/11/2026, `isPublicPath`
 * em `src/middleware.ts`); o proxy responde 404 a este caminho para quem vem de fora.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await access(uploadDir(), constants.W_OK);
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    log("error", "health", { rota: "/api/health", metodo: "GET", status: 503, erro: error });
    return NextResponse.json({ status: "erro" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
