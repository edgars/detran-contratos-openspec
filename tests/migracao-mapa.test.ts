import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// 025-migracao-legado › "Mapa de colunas conferido antes de gravar" (tasks 3.1 e 3.2).
const banco = await vi.hoisted(async () => (await import("./helpers/dump-sintetico")).prepararBancoMigracao());

import { prisma } from "@/lib/db";
import { MAPA } from "@/lib/migracao/mapa";
import { executarCarga, type OpcoesCarga } from "@/lib/migracao/carga";
import { contagensFecham } from "@/lib/migracao/relatorio";
import { acrescentarColuna, gerarDumpSintetico, limparBanco, renomearColuna } from "./helpers/dump-sintetico";

const tmp = mkdtempSync(join(tmpdir(), "mapa-025-"));
async function carregar(op: OpcoesCarga) {
  const r = await executarCarga({ relatorio: join(tmp, `r-${Date.now()}.json`), dirBackups: join(tmp, "backups"), ...op });
  expect(contagensFecham(r.relatorio)).toEqual([]);
  return r;
}

afterAll(async () => {
  await prisma.$disconnect();
  await banco.dispose();
});
beforeEach(() => limparBanco(prisma, banco.uploads));

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

describe("mapa.ts × modelo Prisma (task 3.1)", () => {
  it("as 23 tabelas de origem do D4 estão no mapa, em ordem de carga, com tabela de origem = @@map", () => {
    expect(MAPA.map((t) => t.destino)).toEqual([
      "diretorias",
      "departamentos",
      "pessoas_fisicas",
      "prestadores_servicos",
      "pessoas",
      "tipo_contrato",
      "modalidades",
      "situacao_contratual",
      "status",
      "fases",
      "groups",
      "users",
      "groups_users",
      "contratos",
      "contrato_status",
      "fiscais",
      "pagamentos",
      "pagamento_arquivos",
      "historicos",
      "prestacao_contas",
      "penalidades",
      "anexos_fiscais",
      "anexos_publicacao",
    ]);
    for (const t of MAPA) {
      const model = Prisma.dmmf.datamodel.models.find((m) => lowerFirst(m.name) === t.modelo)!;
      expect(model, t.modelo).toBeDefined();
      expect(model.dbName ?? model.name).toBe(t.destino);
      expect(t.origem).toBe(t.destino);
    }
  });

  it("toda coluna obrigatória de cada modelo de destino tem origem no mapa (Prisma.dmmf)", () => {
    // passwordHash é gerado (hash descartado, D7) — nunca vem do legado.
    const geradas = new Set(["User.passwordHash"]);
    for (const t of MAPA) {
      const model = Prisma.dmmf.datamodel.models.find((m) => lowerFirst(m.name) === t.modelo)!;
      const destinos = new Set(t.colunas.map((c) => c.destino));
      const obrigatorias = model.fields.filter((f) => f.kind === "scalar" && f.isRequired && !f.hasDefaultValue).map((f) => f.name);
      for (const f of obrigatorias) if (!geradas.has(`${model.name}.${f}`)) expect(destinos.has(f), `${t.destino}.${f}`).toBe(true);
      // E todo destino do mapa existe no modelo (exceto as colunas só lidas para o relatório).
      const campos = new Set(model.fields.map((f) => f.name));
      for (const c of t.colunas) if (c.conv !== "legado") expect(campos.has(c.destino), `${t.destino}.${c.destino}`).toBe(true);
    }
  });

  it("regra de nomes: snake_case no banco contratos, PascalCase no global, e as exceções de D3", () => {
    const col = (tabela: string, destino: string) => MAPA.find((t) => t.destino === tabela)!.colunas.find((c) => c.destino === destino)!.origem;
    expect(col("contratos", "numeroProcesso")).toBe("numero_processo");
    expect(col("contratos", "dataTermino")).toBe("data_termino");
    expect(col("pessoas_fisicas", "deNome")).toBe("DeNome");
    expect(col("pessoas_fisicas", "idPessoaFisica")).toBe("IdPessoaFisica");
    expect(col("fiscais", "pessoaFisicaCpf")).toBe("pessoa_fisica_CPF");
    expect(col("pessoas_fisicas", "cpf")).toBe("CPF");
    expect(col("prestadores_servicos", "cnpj")).toBe("CNPJ");
    // users.password não tem destino: a senha do legado não é lida.
    expect(MAPA.find((t) => t.destino === "users")!.colunas.some((c) => c.origem === "password")).toBe(false);
  });
});

describe("Requirement: Mapa de colunas conferido antes de gravar", () => {
  for (const modo of ["simular", "confirmar"] as const) {
    it(`Scenario: Coluna renomeada no dump real (--${modo}) — código 1, cita contratos.contratos.data_termino e mostra dt_termino; nada gravado`, async () => {
      const d = gerarDumpSintetico({ ajustar: (x) => renomearColuna(x.contratos.contratos, "data_termino", "dt_termino") });
      const r = await carregar({ origens: [d.contratos, d.global], [modo]: true });
      expect(r.codigo).toBe(1);
      const erro = r.relatorio.erros.join(" ");
      expect(erro).toContain("contratos.contratos.data_termino");
      expect(erro).toMatch(/colunas encontradas em contratos\.contratos: .*dt_termino/);
      expect(r.resumo).toContain("contratos.contratos.data_termino");
      expect(await prisma.contrato.count()).toBe(0);
      expect(await prisma.pessoaFisica.count()).toBe(0);
      expect(await prisma.migracaoExecucao.count()).toBe(0);
    });
  }

  it("tabela obrigatória ausente (contratos.contratos) aborta", async () => {
    const d = gerarDumpSintetico({ ajustar: (x) => delete (x.contratos as Record<string, unknown>).contratos });
    const r = await carregar({ origens: [d.contratos, d.global], simular: true });
    expect(r.codigo).toBe(1);
    expect(r.relatorio.erros.join(" ")).toContain("tabela obrigatória ausente: contratos.contratos");
  });

  it("Scenario: Coluna a mais no dump — a carga segue e colunasIgnoradas lista contratos.contratos.observacao_interna", async () => {
    const d = gerarDumpSintetico({ ajustar: (x) => acrescentarColuna(x.contratos.contratos, "observacao_interna", "não migrar") });
    const r = await carregar({ origens: [d.contratos, d.global], simular: true });
    expect(r.codigo).not.toBe(1);
    expect(r.relatorio.origem.colunasIgnoradas).toContain("contratos.contratos.observacao_interna");
    expect(r.relatorio.tabelas.find((t) => t.destino === "contratos")!.lidas).toBe(5);
  });
});
