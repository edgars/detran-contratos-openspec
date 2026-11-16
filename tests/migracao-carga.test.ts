import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 025-migracao-legado › ordem de carga, pessoas e fornecedores, aditivos, andamentos, tipos e pendências
// (tasks 4.1–4.7). Uma carga real do dump sintético padrão, conferida por cenário.
const banco = await vi.hoisted(async () => (await import("./helpers/dump-sintetico")).prepararBancoMigracao());

import { prisma } from "@/lib/db";
import { executarCarga, type OpcoesCarga, type ResultadoCarga } from "@/lib/migracao/carga";
import { contagensFecham, pendenciasCadastro } from "@/lib/migracao/relatorio";
import { alterar, gerarDumpSintetico, inserir, limparBanco } from "./helpers/dump-sintetico";

const tmp = mkdtempSync(join(tmpdir(), "carga-025-"));
let n = 0;
async function carregar(op: OpcoesCarga) {
  const r = await executarCarga({ relatorio: join(tmp, `r-${++n}.json`), dirBackups: join(tmp, "backups"), ...op });
  expect(contagensFecham(r.relatorio)).toEqual([]);
  return r;
}
const avisos = (r: ResultadoCarga, tipo: string) => r.relatorio.avisos.filter((a) => a.tipo === tipo);

let r: ResultadoCarga;
const d = gerarDumpSintetico({
  ajustar: (x) => {
    // Andamento com status inexistente e outro tipo de contrato fora da lista da prestação de contas.
    inserir(x.contratos.contrato_status, { id: 3, contrato_id: 10, status_id: 9, descricao: "Status 9 não existe", atendido: 0 });
  },
});

beforeAll(async () => {
  await limparBanco(prisma, banco.uploads);
  r = await carregar({ origens: [d.contratos, d.global], anexos: d.anexos, confirmar: true });
  expect(r.codigo).toBe(2);
}, 60_000);
afterAll(async () => {
  await prisma.$disconnect();
  await banco.dispose();
});

describe("Requirement: Referências carregadas antes dos contratos", () => {
  it("ordem de D4 no relatório: referências, auxiliares, grupos e usuários, contratos e filhas", () => {
    expect(r.relatorio.tabelas.map((t) => t.destino)).toEqual([
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
  });

  it("Scenario: Pagamento de contrato inexistente — rejeitado com 'contrato inexistente' e os demais gravados", async () => {
    expect(r.relatorio.rejeitados).toContainEqual({ tabela: "pagamentos", idLegado: "2", motivo: "contrato inexistente" });
    expect(await prisma.pagamento.findUnique({ where: { id: 2 } })).toBeNull();
    expect((await prisma.pagamento.findMany({ orderBy: { id: "asc" } })).map((p) => p.id)).toEqual([1, 4]);
  });

  it("ids do legado preservados nas referências e departamento ligado à diretoria", async () => {
    expect((await prisma.diretoria.findMany({ orderBy: { id: "asc" } })).map((x) => x.id)).toEqual([1, 2]);
    expect((await prisma.departamento.findUniqueOrThrow({ where: { id: 12 } })).diretoriaId).toBe(2);
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).departamentoId).toBe(10);
  });
});

describe("Requirement: Pessoas e fornecedores pelas chaves do legado", () => {
  it("Scenario: CPF numérico sem zero à esquerda — pessoa com cpf 01234567890 e contrato com pessoaFisicaId 01234567890", async () => {
    const p = await prisma.pessoaFisica.findUniqueOrThrow({ where: { cpf: "01234567890" } });
    expect(p.deNome).toBe("José Zero");
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).pessoaFisicaId).toBe("01234567890");
  });

  it("Scenario: CNPJ com máscara — o contrato aponta para o id desse fornecedor", async () => {
    const f = await prisma.prestadorServico.findUniqueOrThrow({ where: { cnpj: "12345678000190" } });
    expect(f.deRazaoSocial).toBe("Fornecedor Um Ltda");
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).prestadorServicoId).toBe(f.id);
  });

  it("Scenario: CNPJ sem fornecedor — prestadorServicoId nulo, pendência em migracao_pendencias e erro cnpj_sem_fornecedor", async () => {
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 11 } })).prestadorServicoId).toBeNull();
    const pend = await prisma.migracaoPendencia.findMany({ where: { origem: "025" } });
    expect(pend.map((p) => [p.tabela, p.registroId, p.campo, p.valorAntigo, p.motivo])).toEqual([
      ["contratos", 11, "prestadorServicoId", "99888777000166", "CNPJ sem fornecedor"],
    ]);
    expect(avisos(r, "cnpj_sem_fornecedor")).toEqual([expect.objectContaining({ tabela: "contratos", idLegado: "11" })]);
  });

  it("Scenario: CPF duplicado no global — fica a linha com DtExcluido nulo; a outra vai para avisos como cpf_duplicado", async () => {
    const p = await prisma.pessoaFisica.findUniqueOrThrow({ where: { cpf: "39053344705" } });
    expect([p.idPessoaFisica, p.deNome, p.dtExcluido]).toEqual([1004, "Ana Atual", null]);
    expect(avisos(r, "cpf_duplicado")).toEqual([expect.objectContaining({ tabela: "pessoas_fisicas", idLegado: "1003" })]);
  });

  it("pessoa sem CPF não é carregada (contagem), DV inválido e CPF sem pessoa viram aviso", () => {
    const pf = r.relatorio.tabelas.find((t) => t.destino === "pessoas_fisicas")!;
    expect([pf.lidas, pf.inseridas, pf.naoCarregadas]).toEqual([5, 3, 2]);
    expect(avisos(r, "dv_invalido").map((a) => a.detalhe)).toContain("cnpj: 12345678000190");
    expect(avisos(r, "cpf_sem_pessoa").map((a) => a.detalhe)).toContain("pessoaFisicaCpf: 11144477735");
  });

  it("recarga: o id do fornecedor não muda e nada é apagado e recriado", async () => {
    const antes = await prisma.prestadorServico.findMany({ orderBy: { id: "asc" } });
    const r2 = await carregar({ origens: [d.contratos, d.global], anexos: d.anexos, confirmar: true });
    expect(r2.codigo).toBe(2);
    expect(await prisma.prestadorServico.findMany({ orderBy: { id: "asc" } })).toEqual(antes);
    const pf = r2.relatorio.tabelas.find((t) => t.destino === "prestadores_servicos")!;
    expect([pf.inseridas, pf.atualizadas, pf.inalteradas]).toEqual([0, 0, 2]);
    expect(await prisma.migracaoPendencia.count({ where: { origem: "025" } })).toBe(1);
  });
});

describe("Requirement: Aditivos ligados ao contrato original", () => {
  it("Scenario: Aditivo antes do original no dump — os dois gravados e o 20 tem parentId 10", async () => {
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 10 } })).parentId).toBeNull();
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 20 } })).parentId).toBe(10);
  });

  it("Scenario: Aditivo órfão — rejeitado com 'aditivo sem contrato original'", async () => {
    expect(r.relatorio.rejeitados).toContainEqual({ tabela: "contratos", idLegado: "12", motivo: "aditivo sem contrato original" });
    expect(await prisma.contrato.findUnique({ where: { id: 12 } })).toBeNull();
  });

  it("Scenario: Original sem valor inicial — gravado com valorInicial nulo e contado em contratosSemValorInicial (RK-c3fbde6dbf4a não se aplica)", async () => {
    const c = await prisma.contrato.findUniqueOrThrow({ where: { id: 11 } });
    expect(c.valorInicial).toBeNull();
    expect(c.valorTotal!.toFixed(2)).toBe("1000.00");
    expect(r.relatorio.contratosSemValorInicial).toBe(1);
  });
});

describe("andamentos, tipos e textos (tasks 4.4, 4.5, 4.7)", () => {
  it("andamento sem status_id ou com status inexistente é rejeitado (RK-a7017eb6c42d, RK-067d06861847)", async () => {
    const motivos = r.relatorio.rejeitados.filter((x) => x.tabela === "contrato_status");
    expect(motivos.map((m) => m.idLegado).sort()).toEqual(["2", "3"]);
    for (const m of motivos) {
      expect(m.motivo).toContain("RK-a7017eb6c42d");
      expect(m.motivo).toContain("RK-067d06861847");
    }
    expect((await prisma.contratoStatus.findMany()).map((s) => s.id)).toEqual([1]);
  });

  it("tipos 3 e 13 com prestacaoContas 'S', tipo 12 com 'N'; indicativoMetaRisco S/N", async () => {
    const tipos = await prisma.tipoContrato.findMany({ where: { id: { in: [3, 12, 13] } }, orderBy: { id: "asc" } });
    expect(tipos.map((t) => [t.id, t.prestacaoContas, t.indicativoMetaRisco, t.gerenciamento])).toEqual([
      [3, "S", "N", "S"],
      [12, "N", "N", "N"],
      [13, "S", "S", "N"],
    ]);
  });

  it("objeto de 250 caracteres gravado inteiro, com aviso texto_acima_do_limite", async () => {
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 13 } })).objeto).toHaveLength(250);
    expect(avisos(r, "texto_acima_do_limite")).toEqual([expect.objectContaining({ idLegado: "13", detalhe: expect.stringContaining("objeto: 250 caracteres (limite 200)") })]);
  });
});

describe("Requirement: Pendências de cadastro sinalizadas", () => {
  it("Scenario: Contrato sem número de processo — gravado, com aviso pendencia_cadastro citando RK-776d8b62d6df", async () => {
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: 11 } })).numeroProcesso).toBeNull();
    expect(avisos(r, "pendencia_cadastro")).toContainEqual(expect.objectContaining({ idLegado: "11", detalhe: expect.stringContaining("RK-776d8b62d6df") }));
  });

  const casos: [string, string, Record<string, unknown>][] = [
    ["RK-79134600b4be", "tipo", { tipoContratoId: null }],
    ["RK-776d8b62d6df", "processo", { numeroProcesso: null }],
    ["RK-04fd1cbfc346", "número", { numeroContrato: "" }],
    ["RK-6b2806cfff8d", "início", { dataInicio: null }],
    ["RK-9d6599f5897d", "vencimento", { dataTermino: null }],
    ["RK-a0660a4fb262", "unidade gestora", { departamentoId: null }],
    ["RK-37f294a3dc8e", "fornecedor", { prestadorServicoId: null }],
  ];
  const completo = { tipoContratoId: 10, numeroProcesso: "P", numeroContrato: "C", dataInicio: new Date(), dataTermino: new Date(), departamentoId: 1, prestadorServicoId: 1 };
  it("contrato completo não gera pendência", () => expect(pendenciasCadastro(completo)).toEqual([]));
  for (const [rk, nome, falta] of casos) {
    it(`${rk} — contrato sem ${nome} gera pendencia_cadastro com a chave`, () => {
      expect(pendenciasCadastro({ ...completo, ...falta }).map((p) => p.rk)).toEqual([rk]);
    });
  }

  it("RK-a0660a4fb262 na carga: departamento inexistente fica nulo, com aviso de referência e pendência", async () => {
    await limparBanco(prisma, banco.uploads);
    const d2 = gerarDumpSintetico({ ajustar: (x) => alterar(x.contratos.contratos, 13, { departamento_id: 999 }) });
    const r2 = await carregar({ origens: [d2.contratos, d2.global], simular: true });
    expect(avisos(r2, "referencia_inexistente")).toContainEqual(expect.objectContaining({ idLegado: "13" }));
    expect(avisos(r2, "pendencia_cadastro")).toContainEqual(expect.objectContaining({ idLegado: "13", detalhe: expect.stringContaining("RK-a0660a4fb262") }));
  });
});
