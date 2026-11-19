import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 025-migracao-legado › "Anexos importados da pasta do servidor antigo" (tasks 5.1 e 5.2).
const banco = await vi.hoisted(async () => (await import("./helpers/dump-sintetico")).prepararBancoMigracao());
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));

import { prisma } from "@/lib/db";
import { executarCarga, type OpcoesCarga, type ResultadoCarga } from "@/lib/migracao/carga";
import { contagensFecham } from "@/lib/migracao/relatorio";
import { GET as baixar } from "@/app/api/arquivos/[nome]/route";
import { arquivosAnexos, arquivosEm, gerarDumpSintetico, limparBanco } from "./helpers/dump-sintetico";
import { jsonRequest, loginAs } from "./helpers/auth";

const tmp = mkdtempSync(join(tmpdir(), "anexos-025-"));
let n = 0;
async function carregar(op: OpcoesCarga) {
  const r = await executarCarga({ relatorio: join(tmp, `r-${++n}.json`), dirBackups: join(tmp, "backups"), ...op });
  expect(contagensFecham(r.relatorio)).toEqual([]);
  return r;
}
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const GERADO = /^[0-9a-f-]{36}\.pdf$/;

const d = gerarDumpSintetico();
const originais = arquivosAnexos();
let r: ResultadoCarga;

beforeAll(async () => {
  await limparBanco(prisma, banco.uploads);
  r = await carregar({ origens: [d.contratos, d.global], anexos: d.anexos, confirmar: true });
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await banco.dispose();
});

describe("Requirement: Anexos importados da pasta do servidor antigo", () => {
  it("Scenario: PDF válido — anexo <uuid>.pdf e download por /api/arquivos/<nome> com o mesmo SHA-256 do original", async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } });
    expect(c.anexo).toMatch(GERADO);
    await loginAs("admin.anexos", ["ADMINISTRADOR"]);
    const res = await baixar(jsonRequest(`/api/arquivos/${c.anexo}`), { params: Promise.resolve({ nome: c.anexo! }) });
    expect(res.status).toBe(200);
    const baixado = new Uint8Array(await res.arrayBuffer());
    expect(sha(baixado)).toBe(sha(originais["uploads/contratos/ct_10.pdf"]));
  });

  it("Scenario: Imagem renomeada para .pdf — anexo de publicação gravado com anexo nulo e aviso anexo_invalido", async () => {
    expect((await prisma.anexoPublicacao.findUniqueOrThrow({ where: { id: 2 } })).anexo).toBeNull();
    expect(r.relatorio.avisos).toContainEqual(expect.objectContaining({ tipo: "anexo_invalido", tabela: "anexos_publicacao", idLegado: "2" }));
  });

  it("Scenario: Anexo fiscal sem arquivo — rejeitado com 'anexo não encontrado' (RK-0e70b6c81ee9, RK-9da08201400b)", async () => {
    expect(r.relatorio.rejeitados).toContainEqual({ tabela: "anexos_fiscais", idLegado: "2", motivo: "anexo não encontrado" });
    expect(await prisma.anexoFiscal.findUnique({ where: { id: 2 } })).toBeNull();
  });

  it("um arquivo por coluna: contratos.anexo, projetoBasico (nome sem diferenciar maiúsculas), anexos fiscais e de publicação, penalidades e pagamento_arquivos (RK-77287deac605)", async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } });
    const gravados: [string | null, string][] = [
      [c.anexo, "uploads/contratos/ct_10.pdf"],
      [c.projetoBasico, "projetos/pb_10.pdf"],
      [(await prisma.anexoFiscal.findUniqueOrThrow({ where: { id: 1 } })).anexo, "fiscais/2021/af_1.pdf"],
      [(await prisma.anexoPublicacao.findUniqueOrThrow({ where: { id: 1 } })).anexo, "pub_1.pdf"],
      [(await prisma.penalidade.findUniqueOrThrow({ where: { id: 1 } })).arquivo, "pen_1.pdf"],
      [(await prisma.pagamentoArquivo.findUniqueOrThrow({ where: { id: 1 } })).arquivo, "pagamentos/pg_1.pdf"],
    ];
    for (const [nome, origem] of gravados) {
      expect(nome).toMatch(GERADO);
      expect(sha(readFileSync(join(banco.uploads, nome!)))).toBe(sha(originais[origem]));
    }
    expect(arquivosEm(banco.uploads)).toHaveLength(6);
    expect(await prisma.migracaoArquivo.count()).toBe(6);
    expect(r.relatorio.anexos.gravados).toBe(6);
  });

  it("Scenario: Sem pasta de anexos — nenhum arquivo gravado, opcionais nulos e listados como 'anexo não importado (sem --anexos)'", async () => {
    await limparBanco(prisma, banco.uploads);
    const r2 = await carregar({ origens: [d.contratos, d.global], confirmar: true });
    expect(arquivosEm(banco.uploads)).toEqual([]);
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } });
    expect([c.anexo, c.projetoBasico]).toEqual([null, null]);
    expect((await prisma.penalidade.findUniqueOrThrow({ where: { id: 1 } })).arquivo).toBeNull();
    expect((await prisma.anexoPublicacao.findUniqueOrThrow({ where: { id: 1 } })).anexo).toBeNull();
    const sem = r2.relatorio.avisos.filter((a) => a.detalhe.includes("anexo não importado (sem --anexos)"));
    expect(sem.map((a) => `${a.tabela}.${a.detalhe.split(":")[0]}#${a.idLegado}`).sort()).toEqual([
      "anexos_publicacao.anexo#1",
      "anexos_publicacao.anexo#2",
      "contratos.anexo#10",
      "contratos.projetoBasico#10",
      "penalidades.arquivo#1",
    ]);
    // Obrigatórios (anexos_fiscais.anexo, pagamento_arquivos.arquivo): linha rejeitada com o mesmo motivo.
    expect(r2.relatorio.rejeitados.filter((x) => x.motivo === "anexo não importado (sem --anexos)").map((x) => x.tabela).sort()).toEqual([
      "anexos_fiscais",
      "anexos_fiscais",
      "pagamento_arquivos",
    ]);
  });

  it("nova execução com --anexos completa a anterior (idempotente)", async () => {
    const r3 = await carregar({ origens: [d.contratos, d.global], anexos: d.anexos, confirmar: true });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).anexo).toMatch(GERADO);
    expect(r3.relatorio.tabelas.find((t) => t.destino === "anexos_fiscais")!.inseridas).toBe(1);
    expect(arquivosEm(banco.uploads)).toHaveLength(6);
  });

  it("nome repetido com conteúdos diferentes → anexo_ambiguo; arquivo acima de UPLOAD_MAX_MB → anexo_invalido", async () => {
    await limparBanco(prisma, banco.uploads);
    const d2 = gerarDumpSintetico();
    mkdirSync(join(d2.anexos, "outra"), { recursive: true });
    writeFileSync(join(d2.anexos, "outra", "PUB_1.pdf"), "%PDF-1.4\n% outro conteúdo\n");
    const anterior = process.env.UPLOAD_MAX_MB;
    process.env.UPLOAD_MAX_MB = "0.00002"; // ~20 bytes: todos os PDFs sintéticos passam do limite
    try {
      const r4 = await carregar({ origens: [d2.contratos, d2.global], anexos: d2.anexos, simular: true });
      expect(r4.relatorio.avisos).toContainEqual(expect.objectContaining({ tipo: "anexo_ambiguo", tabela: "anexos_publicacao", idLegado: "1" }));
      expect(r4.relatorio.avisos).toContainEqual(
        expect.objectContaining({ tipo: "anexo_invalido", tabela: "contratos", idLegado: "10", detalhe: expect.stringContaining("acima do limite") }),
      );
    } finally {
      process.env.UPLOAD_MAX_MB = anterior;
    }
  });
});
