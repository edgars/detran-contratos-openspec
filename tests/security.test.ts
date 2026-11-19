import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ESLint } from "eslint";
import { middleware } from "@/middleware";
import { prisma } from "@/lib/db";
import { crudHandlers } from "@/lib/crud/server";
import { contratoStatusFields } from "@/lib/rules";
import { ANEXO_FISCAL } from "@/lib/rules/attachments";
import { BCRYPT_COST, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/token";
import { withAuthor } from "@/lib/auth/author";
import { LOGIN_FAILED } from "@/lib/auth/login";
import { ensureAdminUser } from "@/lib/auth/seed";
import { UploadError, savePdf, uploadDir } from "@/lib/uploads";
import { toDecimal } from "@/lib/money";
import { formatCurrency } from "@/lib/format";
import * as loginRoute from "@/app/api/auth/login/route";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as arquivos from "@/app/api/arquivos/[nome]/route";
import * as users from "@/app/api/users/route";
import * as userItem from "@/app/api/users/[id]/route";
import * as prestacoes from "@/app/api/prestacao_contas/route";
import { PDF_BYTES, PNG_BYTES, idParams, jsonRequest, loginAs, logout } from "./helpers/auth";
import { getCookie } from "./helpers/next-headers-mock";

// bcrypt custo 12: cada hash leva ~0,3 s.
vi.setConfig({ testTimeout: 30_000 });

const SECRET_KEYS = ["password", "passwordHash", "passwordold", "passwordnew", "passwordconfirm"];
const nomeParams = (nome: string) => ({ params: Promise.resolve({ nome }) });
const uploadedFiles = () => (existsSync(uploadDir()) ? readdirSync(uploadDir()) : []);

async function criarUsuario(username: string, senha: string) {
  return prisma.user.upsert({
    where: { username },
    update: { passwordHash: await hashPassword(senha) },
    create: { username, passwordHash: await hashPassword(senha) },
  });
}

// Spec 001b-security-baseline: um teste por cenário (e pelas tarefas de tasks.md).
describe("001b-security-baseline", () => {
  describe("Login obrigatório", () => {
    it("Página sem sessão: /contratos redireciona para /login", async () => {
      const res = await middleware(new NextRequest("http://localhost/contratos"));
      expect([302, 307, 308]).toContain(res.status);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    });

    it("API sem sessão: POST /api/tipo_contratos responde 401 e nada é gravado", async () => {
      const antes = await prisma.tipoContrato.count();
      const res = await middleware(
        new NextRequest("http://localhost/api/tipo_contratos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nome: "X", gerenciamento: "Y" }),
        }),
      );
      expect(res.status).toBe(401);
      expect(await prisma.tipoContrato.count()).toBe(antes);
    });

    it("rotas públicas: /login e /api/auth/* passam sem sessão", async () => {
      expect((await middleware(new NextRequest("http://localhost/login"))).status).toBe(200);
      expect((await middleware(new NextRequest("http://localhost/api/auth/login", { method: "POST" }))).status).toBe(200);
    });

    it("com cookie de sessão válido a página passa pelo middleware", async () => {
      await loginAs();
      const cookie = getCookie(SESSION_COOKIE)!;
      const res = await middleware(new NextRequest("http://localhost/contratos", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
      expect(res.status).toBe(200);
    });
  });

  describe("Sessão emitida pelo servidor", () => {
    it("Identificador na URL: ?sessionId= de outro usuário é tratado como sem sessão", async () => {
      await loginAs("vitima");
      const signed = getCookie(SESSION_COOKIE)!;
      logout(); // sem cookie
      const mw = await middleware(new NextRequest(`http://localhost/api/users?sessionId=${encodeURIComponent(signed)}`));
      expect(mw.status).toBe(401);
      const page = await middleware(new NextRequest(`http://localhost/contratos?sessionId=${encodeURIComponent(signed)}`));
      expect(new URL(page.headers.get("location")!).pathname).toBe("/login");
      // header customizado e corpo também não valem
      const hdr = await middleware(new NextRequest("http://localhost/api/users", { headers: { "x-session-id": signed } }));
      expect(hdr.status).toBe(401);
      expect(await getSessionUser()).toBeNull();
      expect((await users.GET(jsonRequest(`/api/users?sessionId=${encodeURIComponent(signed)}`))).status).toBe(401);
    });

    it("Novo login: o identificador de sessão é novo a cada login (createSession e POST /api/auth/login)", async () => {
      const u = await criarUsuario("relogin", "senha-1");
      logout();
      const t1 = await createSession(u.id);
      const t2 = await createSession(u.id);
      expect(t1).not.toBe(t2);
      // a sessão anterior é apagada ao renovar
      expect(await prisma.session.count({ where: { userId: u.id } })).toBe(1);

      logout();
      expect((await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "relogin", password: "senha-1" }))).status).toBe(200);
      const c1 = getCookie(SESSION_COOKIE);
      expect((await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "relogin", password: "senha-1" }))).status).toBe(200);
      const c2 = getCookie(SESSION_COOKIE);
      expect(c1).toBeTruthy();
      expect(c2).not.toBe(c1);
      expect((await getSessionUser())?.username).toBe("relogin");
    });

    it("logout apaga a sessão no banco e o cookie", async () => {
      const u = await loginAs("sai");
      expect((await logoutRoute.POST()).status).toBe(200);
      expect(getCookie(SESSION_COOKIE)).toBeUndefined();
      expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0);
      await destroySession(); // idempotente
    });
  });

  describe("Senha guardada como hash", () => {
    it("hash bcrypt com custo mínimo 12 e verificação", async () => {
      expect(BCRYPT_COST).toBeGreaterThanOrEqual(12);
      const hash = await hashPassword("s3nh@");
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(bcrypt.getRounds(hash)).toBeGreaterThanOrEqual(12);
      expect(await verifyPassword("s3nh@", hash)).toBe(true);
      expect(await verifyPassword("outra", hash)).toBe(false);
    });

    it("Ler um usuário: GET /api/users/:id e GET /api/users sem password* nem passwordHash", async () => {
      const eu = await loginAs("leitor");
      const one = await (await userItem.GET(jsonRequest(`/api/users/${eu.id}`), idParams(eu.id))).json();
      const list = await (await users.GET(jsonRequest("/api/users"))).json();
      for (const body of [one, list]) {
        const text = JSON.stringify(body);
        for (const key of SECRET_KEYS) expect(text).not.toContain(`"${key}"`);
      }
      expect(one.username).toBe("leitor");
    });

    it("Senha incorreta: mensagem genérica, igual para usuário existente e inexistente", async () => {
      await criarUsuario("existe", "certa");
      logout();
      const errada = await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "existe", password: "errada" }));
      const naoExiste = await loginRoute.POST(jsonRequest("/api/auth/login", "POST", { username: "nao-existe", password: "errada" }));
      expect(errada.status).toBe(401);
      expect(naoExiste.status).toBe(401);
      const b1 = await errada.json();
      const b2 = await naoExiste.json();
      expect(b1).toEqual({ error: LOGIN_FAILED });
      expect(b2).toEqual(b1);
      expect(getCookie(SESSION_COOKIE)).toBeUndefined();
    });

    it("seed: cria o admin só com users vazia, com senha em hash", async () => {
      const env = { u: process.env.ADMIN_USERNAME, p: process.env.ADMIN_PASSWORD };
      process.env.ADMIN_USERNAME = "admin.seed";
      process.env.ADMIN_PASSWORD = "senha-admin";
      try {
        await loginAs(); // garante users não vazia
        expect(await ensureAdminUser()).toBe(false);
        const spy = vi.spyOn(prisma.user, "count").mockResolvedValueOnce(0); // simula tabela vazia
        expect(await ensureAdminUser()).toBe(true);
        spy.mockRestore();
        const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin.seed" } });
        expect(admin.passwordHash).not.toBe("senha-admin");
        expect(await verifyPassword("senha-admin", admin.passwordHash)).toBe(true);
      } finally {
        process.env.ADMIN_USERNAME = env.u;
        process.env.ADMIN_PASSWORD = env.p;
        if (env.u === undefined) delete process.env.ADMIN_USERNAME;
        if (env.p === undefined) delete process.env.ADMIN_PASSWORD;
      }
    });
  });

  describe("Gravação só de campos permitidos", () => {
    it("Campo extra no corpo: PUT de contrato_status com campo fora do schema responde 400 e nada muda", async () => {
      await loginAs();
      // Mesmo kit (crudHandlers + schema da entidade) que a rota /api/contrato_status usa.
      const api = crudHandlers({ delegate: () => prisma.contratoStatus, schema: z.object(contratoStatusFields) });
      const cs = await prisma.contratoStatus.create({ data: { contratoId: 1, statusId: 1, descricao: "original" } });
      const res = await api.update(
        jsonRequest(`/api/contrato_status/${cs.id}`, "PUT", { descricao: "alterada", statusId: 999 }),
        idParams(cs.id),
      );
      expect(res.status).toBe(400);
      expect(await prisma.contratoStatus.findUniqueOrThrow({ where: { id: cs.id } })).toEqual(cs);
    });

    it("campo extra também gera 400 em POST /api/users", async () => {
      await loginAs();
      const res = await users.POST(
        jsonRequest("/api/users", "POST", { username: "extra", password: "a", passwordconfirm: "a", superuser: 1 }),
      );
      expect(res.status).toBe(400);
      expect(await prisma.user.findUnique({ where: { username: "extra" } })).toBeNull();
    });

    it("lint proíbe $queryRawUnsafe e $executeRawUnsafe", async () => {
      const eslint = new ESLint({ cwd: process.cwd() });
      const [result] = await eslint.lintText(
        'import { prisma } from "@/lib/db";\nexport const a = prisma.$queryRawUnsafe("SELECT 1");\nexport const b = prisma.$executeRawUnsafe("SELECT 1");\n',
        { filePath: resolve("src/lint-probe.ts") },
      );
      const hits = result.messages.filter((m) => m.ruleId === "no-restricted-properties");
      expect(hits).toHaveLength(2);
      expect(result.errorCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Upload de PDF validado", () => {
    afterEach(() => {
      delete process.env.UPLOAD_MAX_MB;
    });

    it("PDF válido é aceito, gravado fora de public/ com nome gerado", async () => {
      const nome = await savePdf(new File([PDF_BYTES], "contrato.pdf", { type: "application/pdf" }), ANEXO_FISCAL);
      expect(nome).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      expect(existsSync(join(uploadDir(), nome))).toBe(true);
      expect(relative(resolve("public"), uploadDir()).startsWith("..")).toBe(true);
    });

    it("Arquivo renomeado para .pdf: recusado com 'O arquivo anexo deve ser do tipo PDF!' e nada gravado", async () => {
      const antes = uploadedFiles().length;
      const promise = savePdf(new File([PNG_BYTES], "anexo.pdf", { type: "application/pdf" }), ANEXO_FISCAL);
      await expect(promise).rejects.toBeInstanceOf(UploadError);
      await expect(promise).rejects.toThrow("O arquivo anexo deve ser do tipo PDF!");
      expect(uploadedFiles().length).toBe(antes);
    });

    it("arquivo acima de UPLOAD_MAX_MB é recusado e nada gravado", async () => {
      process.env.UPLOAD_MAX_MB = "0.001"; // ~1 KB
      const antes = uploadedFiles().length;
      const grande = new Uint8Array(4096);
      grande.set(PDF_BYTES);
      await expect(savePdf(new File([grande], "grande.pdf", { type: "application/pdf" }), ANEXO_FISCAL)).rejects.toBeInstanceOf(
        UploadError,
      );
      expect(uploadedFiles().length).toBe(antes);
    });

    it("Baixar anexo sem sessão: 401; com sessão: 200 application/pdf", async () => {
      const nome = await savePdf(new File([PDF_BYTES], "a.pdf", { type: "application/pdf" }), ANEXO_FISCAL);
      logout();
      expect((await arquivos.GET(jsonRequest(`/api/arquivos/${nome}`), nomeParams(nome))).status).toBe(401);
      expect((await middleware(new NextRequest(`http://localhost/api/arquivos/${nome}`))).status).toBe(401);
      await loginAs();
      const ok = await arquivos.GET(jsonRequest(`/api/arquivos/${nome}`), nomeParams(nome));
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-type")).toBe("application/pdf");
      expect((await arquivos.GET(jsonRequest("/api/arquivos/..%2F..%2Fetc%2Fpasswd"), nomeParams("../../etc/passwd"))).status).toBe(404);
    });
  });

  describe("Autoria pela sessão", () => {
    it("Autoria forjada: withAuthor sobrescreve o userId enviado pelo cliente", async () => {
      const eu = { id: 7, username: "eu", superuser: null };
      expect(withAuthor({ userId: 999, descricao: "x" }, eu)).toEqual({ userId: 7, descricao: "x" });
    });

    it("Autoria forjada pela API (prestacao_contas): grava o userId da sessão", async () => {
      const outro = await loginAs("forjado.outro");
      const eu = await loginAs("forjado.eu");
      const fase = await prisma.fase.create({ data: { nome: "F", periodo: "P" } });
      const contrato = await prisma.contrato.create({ data: { objeto: "X" } });
      const res = await prestacoes.POST(
        jsonRequest("/api/prestacao_contas", "POST", { descricao: "autoria", faseId: fase.id, contratoId: contrato.id, userId: outro.id }),
      );
      expect(res.status).toBe(201);
      expect((await res.json()).userId).toBe(eu.id);
    });
  });

  describe("Consultas parametrizadas", () => {
    it("Busca com aspas: ' OR 1=1 -- não quebra e só traz registros que contêm o texto", async () => {
      await loginAs();
      // Mesmo kit (busca `q` com `contains`) que a lista de contratos usa.
      const api = crudHandlers({ delegate: () => prisma.contrato, schema: z.object({}), searchFields: ["objeto"] });
      await prisma.contrato.create({ data: { objeto: "Normal sem aspas" } });
      await prisma.contrato.create({ data: { objeto: "Objeto com ' OR 1=1 -- dentro" } });
      const res = await api.list(jsonRequest(`/api/contratos?q=${encodeURIComponent("' OR 1=1 --")}`));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(1);
      expect(body.items[0].objeto).toContain("' OR 1=1 --");
    });
  });

  describe("Valores monetários em Decimal", () => {
    it("Soma sem erro de arredondamento: 0,10 + 0,20 = 0,30 exibido como R$ 0,30", async () => {
      const a = toDecimal("0,10")!;
      const b = toDecimal("0,20")!;
      expect(a).toBeInstanceOf(Prisma.Decimal);
      const soma = a.plus(b);
      expect(soma.equals(new Prisma.Decimal("0.30"))).toBe(true);
      expect(soma.toFixed(2)).toBe("0.30");
      expect(formatCurrency(soma).replace(/\s/g, " ")).toBe("R$ 0,30");
      expect(toDecimal("1.234,56")!.toString()).toBe("1234.56");
      // e no banco, sem passar por float
      const c = await prisma.contrato.create({ data: { objeto: "Decimal", valorInicial: a, valorMensal: b } });
      const lido = await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } });
      expect(lido.valorInicial!.plus(lido.valorMensal!).toString()).toBe("0.3");
    });
  });
});
