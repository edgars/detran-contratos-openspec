import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrationNames, tempDb } from "./helpers/temp-db";

// 023-perfis-acesso › "Migração dos usuários atuais": a migração *_023_perfis_acesso num banco
// temporário com usuários e grupos do legado inseridos antes dela; depois o trecho de dados roda de novo.

const M023 = migrationNames().find((n) => n.endsWith("_023_perfis_acesso"))!;
const SQL = readFileSync(join("prisma/migrations", M023, "migration.sql"), "utf8");
/** Trecho de dados da migração (depois do marcador), um comando por item. */
const DADOS = SQL.slice(SQL.indexOf("-- MIGRACAO DE DADOS"))
  .replace(/^\s*--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

describe("023 › migração de perfis", () => {
  const db = tempDb("mig-023-");
  const ids: Record<string, number> = {};
  const perfis = async (nome: string) =>
    (
      await db.client().$queryRawUnsafe<{ perfil: string }[]>(`SELECT perfil FROM user_perfis WHERE userId = ${ids[nome]} ORDER BY perfil`)
    ).map((r) => r.perfil);

  beforeAll(async () => {
    expect(M023).toBeTruthy();
    db.deploy(migrationNames().filter((n) => n < M023));
    const sql = db.client();
    for (const [nome, superuser, inativo] of [
      ["inativo.primeiro", null, 1],
      ["super", 1, null],
      ["comum", null, null],
      ["gestor.pagto", null, null],
      ["cgcl", null, null],
      ["prestacao", null, null],
    ] as const) {
      await sql.$executeRawUnsafe(`INSERT INTO users (username, passwordHash, superuser, inativo) VALUES ('${nome}', 'h', ${superuser ?? "NULL"}, ${inativo ?? "NULL"})`);
      ids[nome] = Number((await sql.$queryRawUnsafe<{ id: bigint }[]>(`SELECT id FROM users WHERE username = '${nome}'`))[0].id);
    }
    const grupos: Record<string, number> = {};
    for (const g of ["ContratoCGCL", "Gestor", "PrestacaoConta", "Pagamentos", "Outro"]) {
      await sql.$executeRawUnsafe(`INSERT INTO groups (name) VALUES ('${g}')`);
      grupos[g] = Number((await sql.$queryRawUnsafe<{ id: bigint }[]>(`SELECT id FROM groups WHERE name = '${g}'`))[0].id);
    }
    for (const [u, g] of [
      ["gestor.pagto", "Gestor"],
      ["gestor.pagto", "Pagamentos"],
      ["cgcl", "ContratoCGCL"],
      ["prestacao", "PrestacaoConta"],
      ["comum", "Outro"],
    ]) {
      await sql.$executeRawUnsafe(`INSERT INTO groups_users (groupId, userId) VALUES (${grupos[g]}, ${ids[u]})`);
    }
    db.deploy([M023]);
  }, 120_000);
  afterAll(() => db.dispose());

  it("Usuário superuser: superuser = 1 → Administrador; superuser nulo, sem grupos → Consulta", async () => {
    expect(await perfis("super")).toEqual(["ADMINISTRADOR"]);
    expect(await perfis("comum")).toEqual(["CONSULTA"]); // grupo "Outro" não mapeia
  });

  it("Grupo do legado: Gestor + Pagamentos → Gestor de contrato e Financeiro; ContratoCGCL → Administrador; PrestacaoConta → Gestor de contrato", async () => {
    expect(await perfis("gestor.pagto")).toEqual(["FINANCEIRO", "GESTOR_CONTRATO"]);
    expect(await perfis("cgcl")).toEqual(["ADMINISTRADOR"]);
    expect(await perfis("prestacao")).toEqual(["GESTOR_CONTRATO"]);
    // Inativo sem grupo também recebe Consulta (todos os usuários têm perfil).
    expect(await perfis("inativo.primeiro")).toEqual(["CONSULTA"]);
  });

  it("Rodar duas vezes: o trecho de dados de novo não duplica nem remove perfis", async () => {
    const sql = db.client();
    const antes = await sql.$queryRawUnsafe<{ userId: number; perfil: string }[]>("SELECT userId, perfil FROM user_perfis ORDER BY userId, perfil");
    expect(DADOS.length).toBe(4);
    for (const cmd of DADOS) await sql.$executeRawUnsafe(cmd);
    const depois = await sql.$queryRawUnsafe<{ userId: number; perfil: string }[]>("SELECT userId, perfil FROM user_perfis ORDER BY userId, perfil");
    expect(depois).toEqual(antes);
  });

  it("CHECK do perfil: valor fora do catálogo é recusado pelo banco", async () => {
    await expect(db.client().$executeRawUnsafe(`INSERT INTO user_perfis (userId, perfil) VALUES (${ids.comum}, 'SUPERVISOR')`)).rejects.toThrow();
  });

  it("Sem Administrador: o usuário ativo de menor id recebe Administrador (o inativo de menor id não)", async () => {
    const sql = db.client();
    await sql.$executeRawUnsafe("DELETE FROM user_perfis WHERE perfil = 'ADMINISTRADOR'");
    for (const cmd of DADOS) await sql.$executeRawUnsafe(cmd);
    const admins = await sql.$queryRawUnsafe<{ userId: number }[]>("SELECT userId FROM user_perfis WHERE perfil = 'ADMINISTRADOR'");
    // Os grupos e o superuser voltam a dar Administrador (passos 1 e 2); o passo 4 não é necessário.
    expect(admins.map((a) => Number(a.userId)).sort()).toEqual([ids.super, ids.cgcl].sort((a, b) => a - b));
    // Sem nenhuma origem de Administrador, o passo 4 escolhe o ativo de menor id.
    await sql.$executeRawUnsafe(`UPDATE users SET superuser = NULL`);
    await sql.$executeRawUnsafe(`DELETE FROM groups_users`);
    await sql.$executeRawUnsafe("DELETE FROM user_perfis WHERE perfil = 'ADMINISTRADOR'");
    for (const cmd of DADOS) await sql.$executeRawUnsafe(cmd);
    const so = await sql.$queryRawUnsafe<{ userId: number }[]>("SELECT userId FROM user_perfis WHERE perfil = 'ADMINISTRADOR'");
    expect(so.map((a) => Number(a.userId))).toEqual([ids.super]); // "super" é o ativo de menor id
  });
});
