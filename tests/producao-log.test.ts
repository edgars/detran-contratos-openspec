import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { middleware } from "@/middleware";
import { hashPassword } from "@/lib/auth/password";
import { crudHandlers } from "@/lib/crud/server";
import { log, semSegredos, setLogOutput } from "@/lib/log";
import { savePdf } from "@/lib/uploads";
import { ANEXO_FISCAL } from "@/lib/rules/attachments";
import * as loginRoute from "@/app/api/auth/login/route";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as departamentos from "@/app/api/departamentos/route";
import { PNG_BYTES, jsonRequest, loginAs } from "./helpers/auth";

// 026-producao › "Logs estruturados sem segredos" (tasks 3.2 e 3.3).

vi.setConfig({ testTimeout: 30_000 });

let saida: string[] = [];
const linhas = () => saida.map((l) => JSON.parse(l) as Record<string, unknown>);
const evento = (nome: string) => linhas().filter((l) => l.evento === nome);

beforeEach(() => {
  saida = [];
});
afterEach(() => {
  setLogOutput(null);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("026-producao › log.ts", () => {
  it("uma linha JSON por evento em stdout, com ts, level e evento", () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    log("info", "teste.evento", { rota: "/x", metodo: "GET", status: 200 });
    expect(writes).toHaveLength(1);
    expect(writes[0].endsWith("\n")).toBe(true);
    expect(writes[0].trim().split("\n")).toHaveLength(1);
    const l = JSON.parse(writes[0]);
    expect(l).toMatchObject({ level: "info", evento: "teste.evento", rota: "/x", metodo: "GET", status: 200 });
    expect(new Date(l.ts).toISOString()).toBe(l.ts);
  });

  it("chaves proibidas aninhadas (password, passwordHash, cookie, token, …) não aparecem na saída", () => {
    setLogOutput((l) => saida.push(l));
    log("error", "teste", {
      password: "p1-SEGREDO",
      dados: {
        passwordHash: "$2b$12$HASHSEGREDO",
        nivel: { cookie: "sessao=COOKIESEGREDO", token: "TOKENSEGREDO", Authorization: "Bearer AUTHSEGREDO" },
        lista: [{ senha: "SENHASEGREDO", passwordconfirm: "CONFSEGREDO", sessionId: "SIDSEGREDO", ok: 1 }],
      },
    });
    expect(saida).toHaveLength(1);
    expect(saida[0]).not.toMatch(/SEGREDO|password|cookie|token|senha|sessionId|authorization/i);
    expect(JSON.parse(saida[0]).dados.lista[0]).toEqual({ ok: 1 });
    expect(semSegredos({ AUTH_SECRET: "x", a: 1 })).toEqual({ a: 1 });
  });

  it("o valor de AUTH_SECRET nunca sai, nem dentro de uma mensagem de erro", () => {
    vi.stubEnv("AUTH_SECRET", "valor-do-segredo-de-teste-026");
    setLogOutput((l) => saida.push(l));
    log("error", "teste", { erro: new Error("falhou com valor-do-segredo-de-teste-026") });
    expect(saida[0]).not.toContain("valor-do-segredo-de-teste-026");
  });

  it("LOG_LEVEL=warn descarta info; a pilha do erro só sai com LOG_LEVEL=debug", () => {
    setLogOutput((l) => saida.push(l));
    vi.stubEnv("LOG_LEVEL", "warn");
    log("info", "descartado");
    log("warn", "mantido", { erro: new Error("x") });
    expect(linhas().map((l) => l.evento)).toEqual(["mantido"]);
    expect(linhas()[0].erro).not.toHaveProperty("stack");
    vi.stubEnv("LOG_LEVEL", "debug");
    log("error", "com.pilha", { erro: new Error("y") });
    expect(evento("com.pilha")[0].erro).toHaveProperty("stack");
  });
});

describe("026-producao › eventos (task 3.3)", () => {
  beforeEach(() => setLogOutput((l) => saida.push(l)));

  it("Falha de login: linha login.falha com username e nenhuma linha contém a senha", async () => {
    await prisma.user.upsert({
      where: { username: "maria" },
      update: { passwordHash: await hashPassword("Senha-Certa-1") },
      create: { username: "maria", passwordHash: await hashPassword("Senha-Certa-1") },
    });
    const writes: string[] = [];
    setLogOutput(null);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    const res = await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "maria", password: "Senha-Errada-XYZ" }));
    expect(res.status).toBe(401);
    const falhas = writes.map((w) => JSON.parse(w)).filter((l) => l.evento === "login.falha");
    expect(falhas).toHaveLength(1);
    expect(falhas[0]).toMatchObject({ level: "warn", evento: "login.falha", username: "maria" });
    expect(writes.join("")).not.toContain("Senha-Errada-XYZ");
  });

  it("login.ok e logout com userId e username", async () => {
    await prisma.user.upsert({
      where: { username: "jose.log" },
      update: {},
      create: { username: "jose.log", passwordHash: await hashPassword("Senha-Jose-1") },
    });
    const res = await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "jose.log", password: "Senha-Jose-1" }));
    expect(res.status).toBe(200);
    expect(evento("login.ok")[0]).toMatchObject({ username: "jose.log" });
    await logoutRoute.POST();
    expect(evento("logout")[0]).toMatchObject({ username: "jose.log" });
    expect(saida.join("")).not.toContain("Senha-Jose-1");
  });

  it("Erro interno: exceção não tratada → 500 sem detalhes e linha erro.interno com rota e método", async () => {
    await loginAs();
    const api = crudHandlers({
      resource: "cadastros",
      delegate: () => {
        throw new Error("detalhe interno: /app/data/app.db travado");
      },
      schema: z.object({}),
    });
    const res = await api.list(jsonRequest("/api/departamentos?page=1"));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain("detalhe interno");
    expect(body).not.toContain("app.db");
    const l = evento("erro.interno")[0];
    expect(l).toMatchObject({ level: "error", evento: "erro.interno", rota: "/api/departamentos", metodo: "GET", status: 500 });
    expect(JSON.stringify(l.erro)).toContain("detalhe interno");
  });

  it("sessao.invalida: 401 em /api registrado no log", async () => {
    await middleware(new NextRequest("http://localhost/api/contratos"));
    expect(evento("sessao.invalida")[0]).toMatchObject({ rota: "/api/contratos", metodo: "GET", status: 401 });
  });

  it("acesso.negado: 403 da 023 registrado no log", async () => {
    await loginAs("consulta.log", ["CONSULTA"]);
    const res = await departamentos.POST(jsonRequest("/api/departamentos", "POST", { nome: "X" }));
    expect(res.status).toBe(403);
    expect(evento("acesso.negado")[0]).toMatchObject({ rota: "/api/departamentos", metodo: "POST", status: 403 });
  });

  it("upload.recusado: motivo e campo, sem o conteúdo", async () => {
    await expect(savePdf(new Blob([PNG_BYTES]), ANEXO_FISCAL, "anexo")).rejects.toThrow();
    expect(evento("upload.recusado")[0]).toMatchObject({ level: "warn", motivo: "nao_pdf", campo: "anexo" });
  });
});
