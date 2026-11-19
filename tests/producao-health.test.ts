import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync } from "node:fs";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { prisma } from "@/lib/db";
import { setLogOutput } from "@/lib/log";
import { uploadDir } from "@/lib/uploads";
import * as health from "@/app/api/health/route";
import * as tipoContratos from "@/app/api/tipo_contratos/route";
import { jsonRequest, logout } from "./helpers/auth";

// 026-producao › producao "Healthcheck" e security "Healthcheck sem sessão restrito" / "Login obrigatório".

let linhas: string[] = [];
const saidaLog = () => linhas.join("\n");
beforeEach(() => {
  linhas = [];
  setLogOutput((l) => linhas.push(l));
  mkdirSync(uploadDir(), { recursive: true });
});
afterEach(() => {
  setLogOutput(null);
  vi.restoreAllMocks();
});

describe("026-producao › Healthcheck", () => {
  it("Saudável: banco responde e pasta gravável → 200 {status:ok}", async () => {
    const res = await health.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("Banco indisponível: 503 {status:erro} e o motivo só no log", async () => {
    // Banco ilegível simulado: a próxima consulta do Prisma lança (troca direta, desfeita no finally).
    const original = prisma.$queryRaw;
    Object.assign(prisma, { $queryRaw: () => Promise.reject(new Error("SQLITE_CANTOPEN: unable to open database file /app/data/app.db")) });
    let res: Response;
    try {
      res = await health.GET();
    } finally {
      Object.assign(prisma, { $queryRaw: original });
    }
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ status: "erro" });
    expect(body).not.toContain("SQLITE");
    const linha = linhas.map((l) => JSON.parse(l)).find((l) => l.evento === "health");
    expect(linha).toMatchObject({ level: "error", evento: "health", status: 503 });
    expect(JSON.stringify(linha.erro)).toContain("SQLITE_CANTOPEN");
  });

  it("pasta de anexos não gravável também dá 503", async () => {
    vi.stubEnv("UPLOAD_DIR", "/caminho/que/nao/existe-026");
    try {
      const res = await health.GET();
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ status: "erro" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("Outras rotas continuam protegidas: POST /api/health e GET /api/healthz sem sessão → 401", async () => {
    expect((await middleware(new NextRequest("http://localhost/api/health", { method: "POST" }))).status).toBe(401);
    expect((await middleware(new NextRequest("http://localhost/api/healthz"))).status).toBe(401);
    expect((await middleware(new NextRequest("http://localhost/api/health/x"))).status).toBe(401);
  });
});

describe("026-producao › security › Healthcheck sem sessão restrito", () => {
  it("Healthcheck sem sessão: GET /api/health passa pelo middleware e responde só {status:ok}", async () => {
    logout();
    const mw = await middleware(new NextRequest("http://localhost/api/health"));
    expect(mw.status).toBe(200);
    expect(mw.headers.get("x-middleware-next")).toBe("1");
    const res = await health.GET();
    expect(res.status, saidaLog()).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["status"]);
    expect(body).toEqual({ status: "ok" });
  });

  it("Outro método no healthcheck: POST /api/health sem sessão → 401", async () => {
    const res = await middleware(new NextRequest("http://localhost/api/health", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

describe("026-producao › security › Login obrigatório (MODIFIED, cenários mantidos)", () => {
  it("Página sem sessão: /contratos redireciona para /login", async () => {
    const res = await middleware(new NextRequest("http://localhost/contratos"));
    expect([307, 308]).toContain(res.status);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("API sem sessão: POST /api/tipo_contratos → 401 e nada é gravado (middleware e rota)", async () => {
    logout();
    const antes = await prisma.tipoContrato.count();
    const mw = await middleware(new NextRequest("http://localhost/api/tipo_contratos", { method: "POST" }));
    expect(mw.status).toBe(401);
    const res = await tipoContratos.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "X" }));
    expect(res.status).toBe(401);
    expect(await prisma.tipoContrato.count()).toBe(antes);
  });
});
