import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers-mock"));

import { prisma } from "@/lib/db";
import { authenticate } from "@/lib/auth/login";
import { hashPassword } from "@/lib/auth/password";
import { POST as definirSenha } from "@/app/api/users/[id]/senha/route";
import { GET as getUser, PUT as putUser } from "@/app/api/users/[id]/route";
import { idParams, jsonRequest, loginAs } from "./helpers/auth";

// 025-migracao-legado › users: "Definir senha e ativar usuário migrado" (task 6.5) e login recusado
// com senhaRedefinir (task 6.4).

let seq = 0;
async function usuarioMigrado() {
  const username = `migrado.${process.pid}.${++seq}`;
  const u = await prisma.user.create({
    data: { username, passwordHash: await hashPassword("ninguem-sabe"), inativo: 1, senhaRedefinir: true, perfis: { create: { perfil: "CONSULTA" } } },
  });
  return u;
}

describe("Requirement: Definir senha e ativar usuário migrado", () => {
  beforeEach(() => loginAs("admin.senha", ["ADMINISTRADOR"]));

  it("Scenario: Ativar usuário vindo do legado — entra com a nova senha e a resposta não traz password nem passwordHash", async () => {
    const joao = await usuarioMigrado();
    expect(await authenticate(joao.username, "nova-senha-123")).toBeNull();
    const res = await definirSenha(
      jsonRequest(`/api/users/${joao.id}/senha`, "POST", { password: "nova-senha-123", passwordconfirm: "nova-senha-123" }),
      idParams(joao.id),
    );
    expect(res.status).toBe(200);
    const texto = await res.text();
    expect(texto).not.toMatch(/password/i);
    expect(texto).not.toContain("nova-senha-123");
    expect(JSON.parse(texto)).toEqual({ ok: true, id: joao.id, username: joao.username });
    const depois = await prisma.user.findUniqueOrThrow({ where: { id: joao.id } });
    expect([depois.inativo, depois.senhaRedefinir]).toEqual([0, false]);
    expect(depois.passwordHash).not.toBe(joao.passwordHash);
    expect((await authenticate(joao.username, "nova-senha-123"))?.id).toBe(joao.id);
  });

  it("Scenario: Confirmação diferente — erro no campo de confirmação e nada alterado", async () => {
    const u = await usuarioMigrado();
    const res = await definirSenha(jsonRequest(`/api/users/${u.id}/senha`, "POST", { password: "abc12345", passwordconfirm: "outra" }), idParams(u.id));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual({ passwordconfirm: "A senha e a confirmação não conferem!" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).toEqual(u);
  });

  it("Scenario: Sem perfil Administrador — POST responde 403 e nada é alterado", async () => {
    const u = await usuarioMigrado();
    await loginAs("gestor.senha", ["GESTOR_CONTRATO", "FINANCEIRO", "FISCAL", "CONSULTA"]);
    const res = await definirSenha(jsonRequest(`/api/users/${u.id}/senha`, "POST", { password: "abc12345", passwordconfirm: "abc12345" }), idParams(u.id));
    expect(res.status).toBe(403);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).toEqual(u);
  });

  it("schema estrito: campo fora do schema (senhaRedefinir, inativo) → 400; usuário inexistente → 404", async () => {
    const u = await usuarioMigrado();
    const extra = await definirSenha(
      jsonRequest(`/api/users/${u.id}/senha`, "POST", { password: "abc12345", passwordconfirm: "abc12345", inativo: 0 }),
      idParams(u.id),
    );
    expect(extra.status).toBe(400);
    const nada = await definirSenha(jsonRequest(`/api/users/999999/senha`, "POST", { password: "a", passwordconfirm: "a" }), idParams(999999));
    expect(nada.status).toBe(404);
  });

  it("senhaRedefinir fica fora do schema de PUT /api/users/:id (400) e do retorno da API", async () => {
    const u = await usuarioMigrado();
    const res = await putUser(jsonRequest(`/api/users/${u.id}`, "PUT", { username: u.username, perfis: ["CONSULTA"], senhaRedefinir: false }), idParams(u.id));
    expect(res.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).senhaRedefinir).toBe(true);
    const get = await getUser(jsonRequest(`/api/users/${u.id}`), idParams(u.id));
    const body = await get.json();
    expect(body.username).toBe(u.username);
    expect(body).not.toHaveProperty("senhaRedefinir");
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("login recusado com senhaRedefinir = true mesmo com senha certa e inativo = 0 (task 6.4)", async () => {
    const username = `marcado.${process.pid}`;
    await prisma.user.create({ data: { username, passwordHash: await hashPassword("certa-123"), inativo: 0, senhaRedefinir: true } });
    expect(await authenticate(username, "certa-123")).toBeNull();
  });
});
