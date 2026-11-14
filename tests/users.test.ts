import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";

// bcrypt custo 12: cada hash leva ~0,3 s.
vi.setConfig({ testTimeout: 30_000 });
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/users/route";
import * as item from "@/app/api/users/[id]/route";
import * as senha from "@/app/api/conta/senha/route";
import * as login from "@/app/api/auth/login/route";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { users, usersTrocaSenha } from "@/lib/entities/users";
import { USERS_MSG } from "@/lib/entities/users.server";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

const SECRET_KEYS = ["password", "passwordHash", "passwordold", "passwordnew", "passwordconfirm"];

function expectNoSecrets(body: unknown) {
  const text = JSON.stringify(body);
  for (const key of SECRET_KEYS) expect(text).not.toContain(`"${key}"`);
}

// Spec 005-users: um teste por cenário + RK + 401.
describe("005-users", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: await Promise.all(
        Array.from({ length: 25 }, async (_, i) => ({
          username: `lista${String(i + 1).padStart(2, "0")}`,
          passwordHash: "$2a$12$naoeumhashreal",
        })),
      ),
    });
  });

  it("Abrir a lista: coluna username, paginada, sem colunas de senha, com busca", async () => {
    expect(users.columns.map((c) => c.key)).toEqual(["username"]);
    await loginAs();
    const page2 = await (await collection.GET(jsonRequest("/api/users?q=lista&page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0].username).toBe("lista11");
    expectNoSecrets(page2);
    const busca = await (await collection.GET(jsonRequest("/api/users?q=lista07"))).json();
    expect(busca.total).toBe(1);
    expectNoSecrets(busca);
  });

  it("Salvar um usuário válido: grava passwordHash (bcrypt) e a lista o exibe", async () => {
    await loginAs();
    const res = await collection.POST(
      jsonRequest("/api/users", "POST", { username: "novo.usuario", password: "Segredo#1", passwordconfirm: "Segredo#1" }),
    );
    expect(res.status).toBe(201);
    expectNoSecrets(await res.json());
    const salvo = await prisma.user.findUniqueOrThrow({ where: { username: "novo.usuario" } });
    expect(salvo.passwordHash).not.toBe("Segredo#1");
    expect(await verifyPassword("Segredo#1", salvo.passwordHash)).toBe(true);
    const busca = await (await collection.GET(jsonRequest("/api/users?q=novo.usuario"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Confirmação diferente (criação): erro no campo passwordconfirm e nada gravado", async () => {
    await loginAs();
    const antes = await prisma.user.count();
    const res = await collection.POST(
      jsonRequest("/api/users", "POST", { username: "confere.nao", password: "abc12345", passwordconfirm: "outra" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).errors.passwordconfirm).toBe(USERS_MSG.confirmacao);
    expect(await prisma.user.count()).toBe(antes);
  });

  it("Alterar um usuário: só username, formulário sem senha, lista reflete", async () => {
    expect(users.fields.filter((f) => f.kind === "password").every((f) => f.createOnly)).toBe(true);
    await loginAs();
    const u = await prisma.user.create({ data: { username: "editar.me", passwordHash: await hashPassword("x") } });
    const res = await item.PUT(jsonRequest(`/api/users/${u.id}`, "PUT", { username: "editado" }), idParams(u.id));
    expect(res.status).toBe(200);
    expectNoSecrets(await res.json());
    const lido = await (await item.GET(jsonRequest(`/api/users/${u.id}`), idParams(u.id))).json();
    expect(lido.username).toBe("editado");
    expectNoSecrets(lido);
    // A edição não troca senha de outro usuário: campo de senha no PUT gera 400.
    const comSenha = await item.PUT(jsonRequest(`/api/users/${u.id}`, "PUT", { username: "editado", password: "y" }), idParams(u.id));
    expect(comSenha.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash).toBe(u.passwordHash);
  });

  it("username duplicado gera 400 no campo", async () => {
    await loginAs();
    await prisma.user.create({ data: { username: "dup", passwordHash: "h" } });
    const res = await collection.POST(jsonRequest("/api/users", "POST", { username: "dup", password: "a", passwordconfirm: "a" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.username).toBe(USERS_MSG.duplicado);
  });

  it("Excluir com confirmação: removido e a lista não o exibe", async () => {
    await loginAs();
    const u = await prisma.user.create({ data: { username: "temporario", passwordHash: "h" } });
    expect((await item.DELETE(jsonRequest(`/api/users/${u.id}`, "DELETE"), idParams(u.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/users/${u.id}`), idParams(u.id))).status).toBe(404);
    const busca = await (await collection.GET(jsonRequest("/api/users?q=temporario"))).json();
    expect(busca.total).toBe(0);
  });

  it("não exclui o próprio usuário logado (409)", async () => {
    const eu = await loginAs("eu.mesmo");
    const res = await item.DELETE(jsonRequest(`/api/users/${eu.id}`, "DELETE"), idParams(eu.id));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(USERS_MSG.proprioUsuario);
    expect(await prisma.user.findUnique({ where: { id: eu.id } })).not.toBeNull();
  });

  it("Salvar sem um campo obrigatório: RK-d76edbb42dbe username vazio gera 400 e nada gravado", async () => {
    await loginAs();
    const antes = await prisma.user.count();
    const res = await collection.POST(jsonRequest("/api/users", "POST", { username: "", password: "a", passwordconfirm: "a" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.username).toBe("Usuário é obrigatório");
    expect(await prisma.user.count()).toBe(antes);
  });

  it("RK-3e9d7e57ae65: senha obrigatória na criação", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/users", "POST", { username: "sem.senha", password: "", passwordconfirm: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.password).toBe("Senha é obrigatório");
  });

  describe("Trocar a própria senha (/conta/senha)", () => {
    async function usuarioComSenha(username: string, senhaAtual: string) {
      const u = await prisma.user.upsert({
        where: { username },
        update: { passwordHash: await hashPassword(senhaAtual) },
        create: { username, passwordHash: await hashPassword(senhaAtual) },
      });
      await loginAs(username);
      return u;
    }

    it("tela tem passwordold, passwordnew e passwordconfirm", () => {
      expect(usersTrocaSenha.fields.map((f) => f.name)).toEqual(["passwordold", "passwordnew", "passwordconfirm"]);
    });

    it("Senha atual errada: RK-9187b7b464f8 RK-304882e7bdc8 'Senha atual não confere!' e a senha não muda", async () => {
      const u = await usuarioComSenha("troca1", "antiga");
      const res = await senha.POST(
        jsonRequest("/api/conta/senha", "POST", { passwordold: "errada", passwordnew: "nova123", passwordconfirm: "nova123" }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.errors.passwordold).toBe("Senha atual não confere!");
      expect(JSON.stringify(body)).not.toContain("errada");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash).toBe(u.passwordHash);
    });

    it("Confirmação diferente: RK-dcfcd941a4d6 RK-96cbe7d6e198 'A nova senha não confere!' e a senha não muda", async () => {
      const u = await usuarioComSenha("troca2", "antiga");
      const res = await senha.POST(
        jsonRequest("/api/conta/senha", "POST", { passwordold: "antiga", passwordnew: "nova123", passwordconfirm: "outra" }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).errors.passwordconfirm).toBe("A nova senha não confere!");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash).toBe(u.passwordHash);
    });

    it("Troca válida: grava novo hash e o próximo login aceita só a nova senha", async () => {
      await usuarioComSenha("troca3", "antiga");
      const res = await senha.POST(
        jsonRequest("/api/conta/senha", "POST", { passwordold: "antiga", passwordnew: "nova123", passwordconfirm: "nova123" }),
      );
      expect(res.status).toBe(200);
      expectNoSecrets(await res.json());
      logout();
      const velha = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "troca3", password: "antiga" }));
      expect(velha.status).toBe(401);
      const nova = await login.POST(jsonRequest("/api/auth/login", "POST", { username: "troca3", password: "nova123" }));
      expect(nova.status).toBe(200);
    });

    it("troca de senha: campo extra gera 400; sem sessão 401", async () => {
      await usuarioComSenha("troca4", "antiga");
      const extra = await senha.POST(
        jsonRequest("/api/conta/senha", "POST", { passwordold: "antiga", passwordnew: "n", passwordconfirm: "n", userId: 1 }),
      );
      expect(extra.status).toBe(400);
      logout();
      const res = await senha.POST(
        jsonRequest("/api/conta/senha", "POST", { passwordold: "antiga", passwordnew: "n", passwordconfirm: "n" }),
      );
      expect(res.status).toBe(401);
    });
  });

  it("sem sessão responde 401 em todos os verbos", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/users"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/users", "POST", { username: "x", password: "a", passwordconfirm: "a" }))).status).toBe(401);
    expect((await item.GET(jsonRequest("/api/users/1"), idParams(1))).status).toBe(401);
    expect((await item.PUT(jsonRequest("/api/users/1", "PUT", { username: "x" }), idParams(1))).status).toBe(401);
    expect((await item.DELETE(jsonRequest("/api/users/1", "DELETE"), idParams(1))).status).toBe(401);
  });
});
