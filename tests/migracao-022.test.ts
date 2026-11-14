import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrationNames, tempDb } from "./helpers/temp-db";

// 022-pessoas-fornecedores › contratos/fiscais: migração 022 e scripts/resolver-cpf-gestores.mjs,
// num banco temporário com as migrações anteriores aplicadas (os dados são inseridos antes da 022).

const M022 = "20261114024443_022_pessoas_fornecedores";

describe("022 › migração e resolvedor", () => {
  const db = tempDb("mig-022-");
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    const todas = migrationNames();
    expect(todas).toContain(M022);
    db.deploy(todas.filter((n) => n < M022));
    const sql = db.client();
    // Estado anterior à 022: gestor gravado como idPessoaFisica e fiscal com máscara.
    await sql.$executeRaw`INSERT INTO pessoas_fisicas (idPessoaFisica, deNome, dtNascimento) VALUES (1001, 'Maria Gestora', 0), (1002, 'João Sem CPF', 0)`;
    for (const [nome, gestor, suplente] of [
      ["X", "1001", null],
      ["Y", "1002", null],
      ["Z", null, "1001"],
    ] as const) {
      await sql.$executeRaw`INSERT INTO contratos (numeroContrato, objeto, pessoaFisicaId, suplenteId) VALUES (${nome}, 'Pré-022', ${gestor}, ${suplente})`;
      ids[nome] = Number((await sql.$queryRaw<{ id: bigint }[]>`SELECT id FROM contratos WHERE numeroContrato = ${nome}`)[0].id);
    }
    await sql.$executeRaw`INSERT INTO fiscais (contratoId, pessoaFisicaCpf, suplente, presidente) VALUES (${ids.X}, '529.982.247-25', 'N', 'N'), (${ids.X}, '390.533.447-05', 'N', 'N')`;
    db.deploy([M022]);
  }, 120_000);
  afterAll(() => db.dispose());

  it("Migrar gestor gravado como idPessoaFisica: pessoaFisicaId fica nulo e migracao_pendencias guarda (contratos, id, pessoaFisicaId, 1001)", async () => {
    const sql = db.client();
    expect((await sql.contrato.findUniqueOrThrow({ where: { id: ids.X } })).pessoaFisicaId).toBeNull();
    expect((await sql.contrato.findUniqueOrThrow({ where: { id: ids.Z } })).suplenteId).toBeNull();
    const pend = await sql.migracaoPendencia.findMany({ orderBy: { id: "asc" } });
    expect(pend.map((p) => [p.origem, p.tabela, p.registroId, p.campo, p.valorAntigo, p.resolvidoEm])).toEqual([
      ["022", "contratos", ids.X, "pessoaFisicaId", "1001", null],
      ["022", "contratos", ids.Y, "pessoaFisicaId", "1002", null],
      ["022", "contratos", ids.Z, "suplenteId", "1001", null],
    ]);
  });

  it("Migrar fiscal mascarado: 529.982.247-25 vira 52998224725", async () => {
    const cpfs = (await db.client().fiscal.findMany({ orderBy: { id: "asc" } })).map((f) => f.pessoaFisicaCpf);
    expect(cpfs).toEqual(["52998224725", "39053344705"]);
  });

  it("Simulação: --dry-run lista a troca de 1001 por 52998224725 e nada muda", async () => {
    const sql = db.client();
    // A carga (025) ou o seed preenche o CPF de Maria.
    await sql.pessoaFisica.updateMany({ where: { idPessoaFisica: 1001 }, data: { cpf: "52998224725" } });
    const r = db.run("resolver-cpf-gestores.mjs", ["--dry-run"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`trocaria contrato ${ids.X} pessoaFisicaId: 1001 -> 52998224725`);
    expect((await sql.contrato.findUniqueOrThrow({ where: { id: ids.X } })).pessoaFisicaId).toBeNull();
    expect(await sql.migracaoPendencia.count({ where: { resolvidoEm: { not: null } } })).toBe(0);
  });

  it("Resolver depois da carga: contrato X fica com 52998224725 e a pendência tem resolvidoEm", async () => {
    const sql = db.client();
    const r = db.run("resolver-cpf-gestores.mjs");
    expect(r.status).toBe(0);
    expect((await sql.contrato.findUniqueOrThrow({ where: { id: ids.X } })).pessoaFisicaId).toBe("52998224725");
    expect((await sql.contrato.findUniqueOrThrow({ where: { id: ids.Z } })).suplenteId).toBe("52998224725");
    const px = await sql.migracaoPendencia.findFirstOrThrow({ where: { registroId: ids.X } });
    expect(px.resolvidoEm).toBeInstanceOf(Date);
  });

  it("Pessoa ainda sem CPF: rodando duas vezes, a pendência 1002 continua aberta, o contrato não muda e a saída informa 1 aberta", async () => {
    const sql = db.client();
    for (let i = 0; i < 2; i++) {
      const r = db.run("resolver-cpf-gestores.mjs");
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("pendências abertas: 1;");
      expect((await sql.contrato.findUniqueOrThrow({ where: { id: ids.Y } })).pessoaFisicaId).toBeNull();
      expect((await sql.migracaoPendencia.findFirstOrThrow({ where: { registroId: ids.Y } })).resolvidoEm).toBeNull();
    }
    // Idempotente: o que já foi resolvido não é tocado de novo.
    expect(await sql.migracaoPendencia.count({ where: { resolvidoEm: { not: null } } })).toBe(2);
  });

  it("Fiscal órfão listado: 39053344705 aparece como 'CPF sem pessoa física' e o registro não muda", async () => {
    const sql = db.client();
    const r = db.run("resolver-cpf-gestores.mjs");
    expect(r.stdout).toMatch(/CPF sem pessoa física: fiscal \d+ \(contrato \d+\) 390\.533\.447-05/);
    expect(r.stdout).not.toContain("529.982.247-25");
    expect(r.stdout).toContain("fiscais com CPF sem pessoa física: 1");
    expect((await sql.fiscal.findMany({ orderBy: { id: "asc" } })).map((f) => f.pessoaFisicaCpf)).toEqual(["52998224725", "39053344705"]);
  });
});
