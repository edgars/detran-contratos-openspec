import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 025-migracao-legado › usuários, perfis e autoria (tasks 6.1–6.4).
const banco = await vi.hoisted(async () => (await import("./helpers/dump-sintetico")).prepararBancoMigracao());
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { LOGIN_FAILED, authenticate } from "@/lib/auth/login";
import { POST as login } from "@/app/api/auth/login/route";
import { executarCarga, type ResultadoCarga } from "@/lib/migracao/carga";
import { contagensFecham } from "@/lib/migracao/relatorio";
import { USUARIO_TECNICO } from "@/lib/migracao/usuarios";
import { HASH_LEGADO, SENHA_JOAO, gerarDumpSintetico, limparBanco } from "./helpers/dump-sintetico";
import { jsonRequest } from "./helpers/auth";

const tmp = mkdtempSync(join(tmpdir(), "usuarios-025-"));
const arquivoRelatorio = join(tmp, "real.json");
const d = gerarDumpSintetico();
let r: ResultadoCarga;
let adminAntes: { passwordHash: string; inativo: number | null };

const perfisDe = async (username: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { username }, include: { perfis: true } })).perfis.map((p) => p.perfil).sort();
const idDe = async (username: string) => (await prisma.user.findUniqueOrThrow({ where: { username } })).id;

beforeAll(async () => {
  await limparBanco(prisma, banco.uploads);
  // `admin` já existe no destino, ativo e com senha conhecida.
  const admin = await prisma.user.create({
    data: { username: "admin", passwordHash: await hashPassword("senha-do-admin"), inativo: 0, perfis: { create: { perfil: "ADMINISTRADOR" } } },
  });
  adminAntes = { passwordHash: admin.passwordHash, inativo: admin.inativo };
  r = await executarCarga({ origens: [d.contratos, d.global], anexos: d.anexos, confirmar: true, relatorio: arquivoRelatorio, dirBackups: join(tmp, "b") });
  expect(contagensFecham(r.relatorio)).toEqual([]);
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await banco.dispose();
});

describe("Requirement: Usuários migrados inativos e sem senha", () => {
  it("usuários novos entram com inativo = 1, senhaRedefinir = true e hash que não é a senha do legado", async () => {
    for (const username of ["joao", "maria", "pedro", "carla"]) {
      const u = await prisma.user.findUniqueOrThrow({ where: { username } });
      expect([u.inativo, u.senhaRedefinir]).toEqual([1, true]);
      expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    }
    expect(r.relatorio.usuarios.criados.sort()).toEqual(["carla", "joao", "maria", "pedro"]);
    expect(r.relatorio.usuarios.precisamDeSenha.sort()).toEqual(["carla", "joao", "maria", "pedro"]);
    expect(r.relatorio.usuarios.usuariosInativosNoLegado).toEqual(["pedro"]);
  });

  it("Scenario: Login de usuário migrado — joao com a senha do dump é recusado com a mensagem genérica", async () => {
    expect(await authenticate("joao", SENHA_JOAO)).toBeNull();
    const res = await login(jsonRequest("/api/auth/login", "POST", { username: "joao", password: SENHA_JOAO }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: LOGIN_FAILED });
  });

  it("Scenario: Senha fora do relatório — nem o relatório JSON, nem a saída do terminal, nem o banco contêm HASHLEGADO123", () => {
    const relatorio = readFileSync(arquivoRelatorio, "utf8");
    expect(relatorio).not.toContain(HASH_LEGADO);
    expect(relatorio).not.toContain(SENHA_JOAO);
    expect(relatorio).not.toMatch(/passwordHash/);
    // Saída do terminal do comando (simulação do mesmo dump no mesmo banco).
    const cli = spawnSync("npx", ["tsx", "scripts/migrar.ts", "--origem", d.contratos, "--origem", d.global, "--simular", "--relatorio", join(tmp, "cli.json")], {
      env: { ...process.env, DATABASE_URL: banco.url },
      encoding: "utf8",
    });
    expect(cli.status).toBe(2);
    expect(cli.stdout).toContain("SIMULAÇÃO");
    expect(`${cli.stdout}${cli.stderr}`).not.toContain(HASH_LEGADO);
    expect(`${cli.stdout}${cli.stderr}`).not.toContain(SENHA_JOAO);
    // Banco: dump SQL completo (sqlite3 .dump) e os bytes do arquivo.
    const arquivo = banco.url.replace(/^file:/, "");
    const dump = spawnSync("sqlite3", [arquivo, ".dump"], { encoding: "utf8" });
    expect(dump.status).toBe(0);
    expect(dump.stdout).toContain("INSERT INTO users");
    expect(dump.stdout).not.toContain(HASH_LEGADO);
    expect(dump.stdout).not.toContain(SENHA_JOAO);
    expect(readFileSync(arquivo).includes(HASH_LEGADO)).toBe(false);
    // migracao_execucoes guarda o relatório: também sem a senha.
    expect(dump.stdout).toContain("INSERT INTO migracao_execucoes");
  }, 60_000);

  it("Scenario: Usuário já existente — admin continua ativo, com a mesma senha", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
    expect(admin.passwordHash).toBe(adminAntes.passwordHash);
    expect([admin.inativo, admin.senhaRedefinir]).toEqual([adminAntes.inativo, false]);
    expect((await authenticate("admin", "senha-do-admin"))?.username).toBe("admin");
    expect(r.relatorio.usuarios.existentes).toEqual(["admin"]);
  });
});

describe("Requirement: Grupos do legado mapeados para perfis", () => {
  it("Scenario: Usuário em dois grupos — maria (Gestor, Pagamentos) com Gestor de contrato e Financeiro", async () => {
    expect(await perfisDe("maria")).toEqual(["FINANCEIRO", "GESTOR_CONTRATO"]);
  });

  it("Scenario: Grupo desconhecido — pedro (Auditoria) com Consulta e Auditoria em gruposSemMapeamento", async () => {
    expect(await perfisDe("pedro")).toEqual(["CONSULTA"]);
    expect(r.relatorio.usuarios.gruposSemMapeamento).toEqual(["Auditoria"]);
  });

  it("ContratoCGCL → Administrador; superuser = 1 acrescenta Administrador ao usuário existente", async () => {
    expect(await perfisDe("carla")).toEqual(["ADMINISTRADOR"]);
    expect(await perfisDe("admin")).toEqual(["ADMINISTRADOR"]);
    expect(await perfisDe("joao")).toEqual(["GESTOR_CONTRATO"]);
  });

  it("groups_users aponta para o id do usuário migrado (mesma ligação da migração 023)", async () => {
    const gu = await prisma.groupUser.findMany({ orderBy: { id: "asc" } });
    expect(gu.map((g) => g.userId)).toEqual([await idDe("maria"), await idDe("maria"), await idDe("pedro"), await idDe("carla"), await idDe("joao")]);
  });
});

describe("Requirement: Autoria preservada", () => {
  it("Scenario: Penalidade de autor removido — userId de legado.desconhecido e aviso autor_desconhecido", async () => {
    const tecnico = await prisma.user.findUniqueOrThrow({ where: { username: USUARIO_TECNICO }, include: { perfis: true } });
    expect([tecnico.inativo, tecnico.senhaRedefinir, tecnico.perfis.map((p) => p.perfil)]).toEqual([1, true, ["CONSULTA"]]);
    expect((await prisma.penalidade.findUniqueOrThrow({ where: { id: 1 } })).userId).toBe(tecnico.id);
    expect(r.relatorio.avisos).toContainEqual(expect.objectContaining({ tipo: "autor_desconhecido", tabela: "penalidades", idLegado: "1" }));
  });

  it("histórico com autor desconhecido fica com usuarioId nulo; autor conhecido é o usuário migrado", async () => {
    expect((await prisma.historico.findUniqueOrThrow({ where: { id: 2 } })).usuarioId).toBeNull();
    expect(r.relatorio.avisos).toContainEqual(expect.objectContaining({ tipo: "autor_desconhecido", tabela: "historicos", idLegado: "2" }));
    expect((await prisma.historico.findUniqueOrThrow({ where: { id: 1 } })).usuarioId).toBe(await idDe("joao"));
    expect((await prisma.prestacaoConta.findUniqueOrThrow({ where: { id: 1 } })).userId).toBe(await idDe("maria"));
    expect((await prisma.contratoStatus.findUniqueOrThrow({ where: { id: 1 } })).usuarioId).toBe(await idDe("maria"));
  });
});
