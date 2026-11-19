import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";

// 025-migracao-legado › simulação, proteções da carga real, relatório, idempotência e comando (tasks 7.1–7.5, 8.1).
const banco = await vi.hoisted(async () => (await import("./helpers/dump-sintetico")).prepararBancoMigracao());

import { prisma } from "@/lib/db";
import { MSG_APP_EM_USO, MSG_CONFIRMAR, MSG_DADOS_DO_APP, executarCarga, type OpcoesCarga } from "@/lib/migracao/carga";
import { contagensFecham } from "@/lib/migracao/relatorio";
import { alterar, arquivosEm, gerarDumpSintetico, inserir, limparBanco, remover, semRejeicoes } from "./helpers/dump-sintetico";

const tmp = mkdtempSync(join(tmpdir(), "exec-025-"));
const backups = join(tmp, "backups");
let n = 0;
/** Toda execução confere a invariante "Contagens fecham" em todas as tabelas. */
async function carregar(op: OpcoesCarga) {
  const r = await executarCarga({ relatorio: join(tmp, `r-${++n}.json`), dirBackups: backups, ...op });
  expect(contagensFecham(r.relatorio)).toEqual([]);
  for (const t of r.relatorio.tabelas) expect(t.lidas).toBe(t.inseridas + t.atualizadas + t.inalteradas + t.rejeitadas + t.naoCarregadas);
  return r;
}

const TABELAS_DE_DADOS = ["contrato", "pagamento", "fiscal", "pessoaFisica", "prestadorServico", "user", "historico", "anexoFiscal", "migracaoArquivo"] as const;
async function contagens() {
  const out: Record<string, number> = {};
  for (const t of TABELAS_DE_DADOS) out[t] = await (prisma[t] as unknown as { count: () => Promise<number> }).count();
  return out;
}

const d = gerarDumpSintetico();
const origens = [d.contratos, d.global];

beforeEach(() => limparBanco(prisma, banco.uploads));
afterAll(async () => {
  await prisma.$disconnect();
  await banco.dispose();
});

describe("Requirement: Modo de simulação", () => {
  it("Scenario: Simulação não grava — relatório com as linhas que seriam inseridas, tabelas vazias e pasta de anexos igual", async () => {
    const r = await carregar({ origens, anexos: d.anexos, simular: true });
    expect(r.codigo).toBe(2);
    expect(r.relatorio.tabelas.find((t) => t.destino === "contratos")!.inseridas).toBe(4);
    expect(r.relatorio.somatorios.length).toBe(5);
    expect(Object.values(await contagens()).every((x) => x === 0)).toBe(true);
    expect(arquivosEm(banco.uploads)).toEqual([]);
    expect(await prisma.migracaoPendencia.count()).toBe(0);
    const execs = await prisma.migracaoExecucao.findMany();
    expect(execs.map((e) => [e.simulacao, e.situacao])).toEqual([[true, "concluida_com_rejeicoes"]]);
    expect(JSON.parse(execs[0].relatorio!).execucao.simulacao).toBe(true);
    expect(r.relatorio.backup).toBeNull();
    expect(r.arquivoRelatorio).toMatch(/\.json$/);
  });

  it("Scenario: Carga real sem confirmação — recusa com a instrução de simular antes, nada gravado", async () => {
    const r = await carregar({ origens });
    expect(r.codigo).toBe(1);
    expect(r.relatorio.erros).toEqual([MSG_CONFIRMAR]);
    expect(r.resumo).toContain("--simular");
    expect(await prisma.migracaoExecucao.count()).toBe(0);
    expect(Object.values(await contagens()).every((x) => x === 0)).toBe(true);
  });
});

describe("Requirement: Proteções da carga real", () => {
  it("Scenario: Banco com dados criados no app — código 1 explicando que a carga deve rodar antes da virada", async () => {
    await prisma.contrato.create({ data: { objeto: "Criado pelo app" } });
    const r = await carregar({ origens, confirmar: true });
    expect(r.codigo).toBe(1);
    expect(r.relatorio.erros).toEqual([MSG_DADOS_DO_APP]);
    expect(r.resumo).toContain("antes da virada");
    expect(await prisma.contrato.count()).toBe(1);
    expect(await prisma.pessoaFisica.count()).toBe(0);
  });

  it("sessão criada nos últimos 5 minutos (app em uso) — recusa", async () => {
    const u = await prisma.user.create({ data: { username: "logado", passwordHash: "x" } });
    await prisma.session.create({ data: { id: "s1", userId: u.id, expiresAt: new Date(Date.now() + 3600_000) } });
    const r = await carregar({ origens, confirmar: true });
    expect(r.codigo).toBe(1);
    expect(r.relatorio.erros).toEqual([MSG_APP_EM_USO]);
    expect(await prisma.contrato.count()).toBe(0);
  });

  it("Scenario: Falha no meio da carga — nenhuma tabela com dados parciais, arquivos gravados apagados e backup pre-migracao-* presente", async () => {
    const antes = existsSync(backups) ? readdirSync(backups).length : 0;
    const r = await carregar({ origens, anexos: d.anexos, confirmar: true, falharEm: "pagamentos" });
    expect(r.codigo).toBe(1);
    expect(r.relatorio.erros.join(" ")).toContain("falha injetada ao gravar pagamentos");
    // Contratos (com anexos) já tinham sido gravados na transação: tudo desfeito.
    expect(Object.values(await contagens()).every((x) => x === 0)).toBe(true);
    expect(arquivosEm(banco.uploads)).toEqual([]);
    const lista = readdirSync(backups).filter((f) => /^pre-migracao-\d{8}-\d{6}(-\d+)?\.db$/.test(f));
    expect(lista.length).toBeGreaterThan(antes);
    expect(r.relatorio.backup).toMatch(/pre-migracao-\d{8}-\d{6}(-\d+)?\.db$/);
    expect((await prisma.migracaoExecucao.findFirstOrThrow()).situacao).toBe("abortada");
  });

  it("backup VACUUM INTO antes de toda carga real", async () => {
    const r = await carregar({ origens, confirmar: true });
    expect(r.relatorio.backup).not.toBeNull();
    expect(existsSync(r.relatorio.backup!)).toBe(true);
  });
});

describe("Requirement: Relatório de conferência", () => {
  it("Scenario: Somatórios batem — 100.005 + 200.10 + 0.333: origem 300.438, arredondada 300.44, destino 300.44, diferença 0.00", async () => {
    const d2 = gerarDumpSintetico({
      ajustar: (x) => {
        x.contratos.pagamentos.linhas = [];
        x.contratos.pagamento_arquivos.linhas = [];
        inserir(
          x.contratos.pagamentos,
          { id: 1, competencia: "2020-01-01", numero_processo: "P-1", contrato_id: 10, valor: { raw: "100.005" } },
          { id: 2, competencia: "2020-02-01", numero_processo: "P-2", contrato_id: 10, valor: { raw: "200.10" } },
          { id: 3, competencia: "2020-03-01", numero_processo: "P-3", contrato_id: 10, valor: { raw: "0.333" } },
        );
      },
    });
    const r = await carregar({ origens: [d2.contratos, d2.global], confirmar: true });
    expect(r.relatorio.somatorios.find((s) => s.campo === "pagamentos.valor")).toEqual({
      campo: "pagamentos.valor",
      origem: "300.438",
      origemArredondada: "300.44",
      destino: "300.44",
      diferenca: "0.00",
    });
    for (const s of r.relatorio.somatorios) expect(s.diferenca).toBe("0.00");
  });

  it("Scenario: Contagens fecham — em todas as tabelas, lidas = inseridas + atualizadas + inalteradas + rejeitadas + não carregadas", async () => {
    const r = await carregar({ origens, anexos: d.anexos, confirmar: true });
    expect(r.relatorio.tabelas).toHaveLength(23);
    expect(r.relatorio.tabelas.reduce((a, t) => a + t.lidas, 0)).toBeGreaterThan(50);
  });

  it("Scenario: Execução com rejeições — código 2 e o aditivo órfão em rejeitados com o motivo", async () => {
    const r = await carregar({ origens, anexos: d.anexos, confirmar: true });
    expect(r.codigo).toBe(2);
    expect(r.relatorio.rejeitados).toContainEqual({ tabela: "contratos", idLegado: "12", motivo: "aditivo sem contrato original" });
    expect((await prisma.migracaoExecucao.findFirstOrThrow({ where: { simulacao: false } })).situacao).toBe("concluida_com_rejeicoes");
  });

  it("código 0 sem rejeições; resolvedor de gestores da 022 roda ao fim da carga real e entra no relatório", async () => {
    const limpo = gerarDumpSintetico({ ajustar: semRejeicoes });
    const r = await carregar({ origens: [limpo.contratos, limpo.global], confirmar: true });
    expect(r.codigo).toBe(0);
    expect(r.relatorio.rejeitados).toEqual([]);
    expect(r.relatorio.resolvedorGestores?.codigo).toBe(0);
    expect(r.relatorio.resolvedorGestores?.saida).toContain("pendências resolvidas:");
    expect(r.relatorio.resolvedorGestores?.saida).toContain("CPF sem pessoa física: fiscal 2");
  });
});

describe("Requirement: Carga idempotente", () => {
  it("Scenario: Segunda execução igual — inseridas = 0 e atualizadas = 0 em todas as tabelas; banco e anexos iguais", async () => {
    await carregar({ origens, anexos: d.anexos, confirmar: true });
    const antes = { banco: await contagens(), arquivos: arquivosEm(banco.uploads), contrato: await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } }) };
    const r = await carregar({ origens, anexos: d.anexos, confirmar: true });
    for (const t of r.relatorio.tabelas) expect([t.destino, t.inseridas, t.atualizadas]).toEqual([t.destino, 0, 0]);
    expect(await contagens()).toEqual(antes.banco);
    expect(arquivosEm(banco.uploads)).toEqual(antes.arquivos);
    expect(await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).toEqual(antes.contrato);
    expect(r.relatorio.anexos.gravados).toBe(0);
  });

  it("Scenario: Dump mais novo — contrato 10 atualizado, contrato 11 continua e aparece em existentesForaDoDump", async () => {
    await carregar({ origens, confirmar: true });
    const novo = gerarDumpSintetico({
      ajustar: (x) => {
        alterar(x.contratos.contratos, 10, { objeto: "Objeto revisto no legado" });
        remover(x.contratos.contratos, 11);
      },
    });
    const r = await carregar({ origens: [novo.contratos, novo.global], confirmar: true });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).objeto).toBe("Objeto revisto no legado");
    expect(await prisma.contrato.findUnique({ where: { id: 11 } })).not.toBeNull();
    expect(r.relatorio.existentesForaDoDump).toContainEqual({ tabela: "contratos", chave: "11" });
    expect(r.relatorio.tabelas.find((t) => t.destino === "contratos")!.atualizadas).toBe(1);
  });

  it("Scenario: Novo registro depois da carga — contrato criado pelo app recebe id maior que o maior do legado (500)", async () => {
    const d2 = gerarDumpSintetico({ ajustar: (x) => alterar(x.contratos.contratos, 13, { id: 500 }) });
    await carregar({ origens: [d2.contratos, d2.global], confirmar: true });
    expect((await prisma.contrato.aggregate({ _max: { id: true } }))._max.id).toBe(500);
    const novo = await prisma.contrato.create({ data: { objeto: "Criado pelo app depois da carga" } });
    expect(novo.id).toBeGreaterThan(500);
  });
});

describe("comando npm run migrar (task 8.1)", () => {
  const cli = (args: string[]) =>
    spawnSync("npx", ["tsx", "scripts/migrar.ts", ...args], { env: { ...process.env, DATABASE_URL: banco.url }, encoding: "utf8" });

  it("--help imprime as opções", () => {
    const r = cli(["--help"]);
    expect(r.status).toBe(0);
    for (const op of ["--origem", "--anexos", "--encoding", "--simular", "--confirmar", "--relatorio"]) expect(r.stdout).toContain(op);
  }, 30_000);

  it("--simular com o dump sintético sem rejeições termina com 0 e imprime o resumo", () => {
    const limpo = gerarDumpSintetico({ ajustar: semRejeicoes });
    const r = cli(["--origem", limpo.contratos, "--origem", limpo.global, "--simular", "--relatorio", join(tmp, "cli.json")]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("SIMULAÇÃO");
    expect(r.stdout).toMatch(/contratos\s+4\s+4/);
  }, 60_000);

  it("sem --simular nem --confirmar termina com 1 e a instrução", () => {
    const r = cli(["--origem", d.contratos, "--origem", d.global, "--relatorio", join(tmp, "cli2.json")]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("rode antes com --simular");
  }, 30_000);
});
