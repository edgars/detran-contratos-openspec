import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 025-migracao-legado › "Dinheiro de FLOAT para Decimal…" e "Datas e indicadores convertidos" (task 3.3).
const banco = await vi.hoisted(async () => (await import("./helpers/dump-sintetico")).prepararBancoMigracao());

import { prisma } from "@/lib/db";
import * as conv from "@/lib/migracao/conversoes";
import { executarCarga, type ResultadoCarga } from "@/lib/migracao/carga";
import { contagensFecham } from "@/lib/migracao/relatorio";
import { gerarDumpSintetico, limparBanco } from "./helpers/dump-sintetico";

const tmp = mkdtempSync(join(tmpdir(), "conv-025-"));

describe("conversores (D5)", () => {
  it("dinheiro: texto → Decimal com 2 casas, meio para cima, sem ponto flutuante", () => {
    const casos: [string, string, boolean][] = [
      ["1234.565", "1234.57", true],
      ["0.1000000015", "0.10", true],
      ["2500.5", "2500.50", false],
      ["100.005", "100.01", true],
      ["-0.105", "-0.11", true],
      ["1.5e6", "1500000.00", false],
      ["0", "0.00", false],
      ["  42.10 ", "42.10", false],
    ];
    for (const [entrada, gravado, arredondado] of casos) {
      const r = conv.dinheiro(entrada);
      expect(r.ok && r.valor && conv.dinheiroTexto(r.valor.decimal)).toBe(gravado);
      expect(r.ok && r.valor?.arredondado).toBe(arredondado);
    }
    expect(conv.dinheiro(null)).toEqual({ ok: true, valor: null });
    expect(conv.dinheiro("").ok).toBe(true);
    expect(conv.dinheiro("abc").ok).toBe(false);
    expect(conv.dinheiro("1,50").ok).toBe(false);
  });

  it("data: AAAA-MM-DD à meia-noite UTC; 0000-00-00 e data impossível são inválidas; hora descartada", () => {
    expect(conv.data("2020-02-29")).toEqual({ ok: true, valor: new Date(Date.UTC(2020, 1, 29)) });
    expect(conv.data("2020-02-29 13:45:00")).toEqual({ ok: true, valor: new Date(Date.UTC(2020, 1, 29)) });
    expect(conv.data("0000-00-00").ok).toBe(false);
    expect(conv.data("2021-02-30").ok).toBe(false);
    expect(conv.data("2021-13-01").ok).toBe(false);
    expect(conv.data(null)).toEqual({ ok: true, valor: null });
  });

  it("dataHora: interpretada em America/Sao_Paulo (inclusive horário de verão histórico)", () => {
    expect(conv.dataHora("2020-01-02 10:00:00")).toEqual({ ok: true, valor: new Date("2020-01-02T13:00:00Z") });
    expect(conv.dataHora("2015-01-15 10:00:00")).toEqual({ ok: true, valor: new Date("2015-01-15T12:00:00Z") }); // -02:00 no verão
    expect(conv.dataHora("0000-00-00 00:00:00").ok).toBe(false);
  });

  it("cpf/cnpj: só dígitos, zeros à esquerda, DV inválido é aviso, dígitos demais é erro", () => {
    expect(conv.cpf("1234567890")).toMatchObject({ ok: true, valor: "01234567890" });
    expect(conv.cpf("529.982.247-25")).toEqual({ ok: true, valor: "52998224725" });
    expect(conv.cpf("52998224700")).toEqual({ ok: true, valor: "52998224700", aviso: "dv_invalido" });
    expect(conv.cpf("123456789012").ok).toBe(false);
    expect(conv.cnpj("12.345.678/0001-90")).toMatchObject({ ok: true, valor: "12345678000190" });
    expect(conv.cnpj("11222333000181")).toEqual({ ok: true, valor: "11222333000181" });
    expect(conv.cnpj("123456789012345").ok).toBe(false);
    expect(conv.cpf(null)).toEqual({ ok: true, valor: null });
  });

  it("simNao / zeroUm / zeroUmTexto aceitam 1, 0, S, N, s, n, vazio e NULL", () => {
    expect(["1", "S", "s", "0", "N", "n", "", null].map((v) => (conv.simNao(v) as { valor: string }).valor)).toEqual(["S", "S", "S", "N", "N", "N", "N", "N"]);
    expect(["1", "S", "0", "n", "", null].map((v) => (conv.zeroUm(v) as { valor: number | null }).valor)).toEqual([1, 1, 0, 0, 0, null]);
    expect((conv.zeroUmTexto("1") as { valor: string }).valor).toBe("1");
    expect((conv.zeroUmTexto("0") as { valor: string }).valor).toBe("0");
    expect(conv.simNao("talvez").ok).toBe(false);
    expect(conv.zeroUm("2").ok).toBe(false);
  });

  it("texto passa sem alteração; inteiro só aceita dígitos", () => {
    expect(conv.texto("  com espaços  ")).toEqual({ ok: true, valor: "  com espaços  " });
    expect(conv.inteiro("007")).toEqual({ ok: true, valor: 7 });
    expect(conv.inteiro("1.5").ok).toBe(false);
  });
});

describe("conversões na carga real (dump sintético padrão)", () => {
  let r: ResultadoCarga;
  beforeAll(async () => {
    await limparBanco(prisma, banco.uploads);
    const d = gerarDumpSintetico();
    r = await executarCarga({
      origens: [d.contratos, d.global],
      anexos: d.anexos,
      confirmar: true,
      relatorio: join(tmp, "real.json"),
      dirBackups: join(tmp, "backups"),
    });
    expect(contagensFecham(r.relatorio)).toEqual([]);
  }, 60_000);
  afterAll(async () => {
    await prisma.$disconnect();
    await banco.dispose();
  });

  it("Scenario: Valor com três casas — 1234.565 gravado 1234.57 e registrado em arredondamentos", async () => {
    const p = await prisma.pagamento.findUniqueOrThrow({ where: { id: 1 } });
    expect(p.valor!.toFixed(2)).toBe("1234.57");
    expect(r.relatorio.arredondamentos).toContainEqual({ tabela: "pagamentos", id: "1", coluna: "valor", origem: "1234.565", gravado: "1234.57" });
  });

  it("Scenario: Resíduo de FLOAT — 0.1000000015 gravado 0.10 e registrado", async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } });
    expect(c.valorTotal!.toFixed(2)).toBe("0.10");
    expect(r.relatorio.arredondamentos).toContainEqual({ tabela: "contratos", id: "10", coluna: "valorTotal", origem: "0.1000000015", gravado: "0.10" });
  });

  it("Scenario: Valor exato — 2500.5 gravado 2500.50 sem arredondamento registrado", async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } });
    expect(c.valorMensal!.toFixed(2)).toBe("2500.50");
    expect(r.relatorio.arredondamentos.filter((a) => a.tabela === "contratos" && a.id === "10" && a.coluna === "valorMensal")).toEqual([]);
  });

  it("Scenario: Data zerada em coluna opcional — data_inclusao 0000-00-00 vira nulo", async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } });
    expect(c.dataInclusao).toBeNull();
    expect(c.dataInicio).toEqual(new Date(Date.UTC(2020, 0, 1)));
  });

  it("Scenario: Data zerada em coluna obrigatória — pagamento rejeitado com 'competencia inválida' (RK-774f44ed6df9)", async () => {
    expect(await prisma.pagamento.findUnique({ where: { id: 3 } })).toBeNull();
    expect(r.relatorio.rejeitados).toContainEqual({ tabela: "pagamentos", idLegado: "3", motivo: "competencia inválida" });
  });

  it("Scenario: Indicador de prestação de contas — atendido 1 → 'S' e prestacao_realizada 1 → '1'", async () => {
    expect((await prisma.prestacaoConta.findUniqueOrThrow({ where: { id: 1 } })).atendido).toBe("S");
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).prestacaoRealizada).toBe("1");
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 11 } })).prestacaoRealizada).toBe("0");
  });

  it("indicadores S/N e 1/0 nas demais colunas (D5)", async () => {
    const fiscais = await prisma.fiscal.findMany({ orderBy: { id: "asc" } });
    expect(fiscais.map((f) => [f.suplente, f.presidente])).toEqual([
      ["N", "N"],
      ["S", "S"],
    ]);
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).naPresidencia).toBe(1);
    expect((await prisma.contratoStatus.findUniqueOrThrow({ where: { id: 1 } })).atendido).toBe(1);
    const tipo10 = await prisma.tipoContrato.findUniqueOrThrow({ where: { id: 10 } });
    expect([tipo10.gerenciamento, tipo10.indicativoMetaRisco]).toEqual(["S", "S"]);
  });

  it("dataHora do andamento gravada no fuso de São Paulo", async () => {
    expect((await prisma.contratoStatus.findUniqueOrThrow({ where: { id: 1 } })).dataInclusao).toEqual(new Date("2020-01-02T13:00:00Z"));
  });
});
