import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { existsSync } from "node:fs";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/prestacao_contas/route";
import * as item from "@/app/api/prestacao_contas/[id]/route";
import * as contratos from "@/app/api/prestacao_contas/contratos/route";
import * as fluxo from "@/app/api/prestacao_contas/contratos/[id]/route";
import * as tipos from "@/app/api/tipo_contratos/route";
import { prestacaoContas } from "@/lib/entities/prestacao_contas";
import { PRESTACAO_MSG } from "@/lib/entities/prestacao_contas.server";
import { getFluxo } from "@/lib/prestacao/server";
import { hojeUtc } from "@/lib/prestacao/criterios";
import { formatCurrency, formatDate } from "@/lib/format";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

vi.setConfig({ testTimeout: 30_000 });

// 021-prestacao-contas-fluxo › specs/prestacao-contas/spec.md: um teste por cenário (+ 401).
const DAY = 86_400_000;
const diasAtras = (n: number) => new Date(hojeUtc().getTime() - n * DAY);
let seq = 0;

/** Tipo marcado novo por cenário: as listas filtram por ele e não enxergam dados de outros cenários. */
async function tipoMarcado() {
  return (await prisma.tipoContrato.create({ data: { nome: `PC tipo ${++seq}`, gerenciamento: "N", prestacaoContas: "S" } })).id;
}

async function contrato(tipoContratoId: number, data: Partial<Prisma.ContratoUncheckedCreateInput> = {}) {
  seq++;
  return prisma.contrato.create({
    data: {
      objeto: `Objeto ${seq}`,
      numeroContrato: `PC-${seq}`,
      tipoContratoId,
      dataTermino: diasAtras(1),
      valorTotal: new Prisma.Decimal("700000.00"),
      ...data,
    },
  });
}

type Item = { id: number; diasDesdeVencimento: number; dataTermino: string; valorTotal: string; [k: string]: unknown };
type PageBody = { items: Item[]; total: number; page: number; size: number };

async function lista(query: string): Promise<PageBody> {
  const res = await contratos.GET(jsonRequest(`/api/prestacao_contas/contratos?${query}`));
  expect(res.status).toBe(200);
  return res.json();
}

const fase = (nome: string, periodo: string) => prisma.fase.create({ data: { nome, periodo } });
const gravar = (body: Record<string, unknown>) => collection.POST(jsonRequest("/api/prestacao_contas", "POST", body));
const nascimento = new Date(Date.UTC(1980, 0, 1));

describe("021 › Lista de prestação de contas pendentes e realizadas", () => {
  beforeAll(async () => {
    await loginAs();
  });

  it("Contrato que atende a todos os critérios: aparece na aba Pendentes (API)", async () => {
    const t = await tipoMarcado();
    const c = await contrato(t);
    expect((await lista(`tipoContratoId=${t}`)).items.map((i) => i.id)).toEqual([c.id]);
  });

  it("Alternar entre pendentes e realizadas", async () => {
    const t = await tipoMarcado();
    const pendente = await contrato(t, { prestacaoRealizada: null });
    const realizada = await contrato(t, { prestacaoRealizada: "1" });
    expect((await lista(`tipoContratoId=${t}&situacao=pendentes`)).items.map((i) => i.id)).toEqual([pendente.id]);
    expect((await lista(`tipoContratoId=${t}&situacao=realizadas`)).items.map((i) => i.id)).toEqual([realizada.id]);
    // Sem `situacao`: Pendentes é o padrão.
    expect((await lista(`tipoContratoId=${t}`)).items.map((i) => i.id)).toEqual([pendente.id]);
  });

  it("Colunas, dias e paginação: 10 + 2, Dias = 15, data dd/MM/yyyy e valor em R$", async () => {
    const t = await tipoMarcado();
    for (let i = 0; i < 11; i++) await contrato(t, { dataTermino: diasAtras(30 + i) });
    const alvo = await contrato(t, { dataTermino: diasAtras(15), valorTotal: new Prisma.Decimal("812345.67") });

    // Configuração da tela: colunas do legado, 10 por página, sem Novo, linha abre o fluxo.
    expect(prestacaoContas.columns.map((c) => c.label)).toEqual([
      "Nº contrato",
      "Nº processo",
      "Vencimento",
      "Objeto",
      "Dias",
      "Valor total",
      "Contratada",
      "UN gestora",
    ]);
    expect(prestacaoContas.pageSize).toBe(10);
    expect(prestacaoContas.rowHref).toBe("/prestacao_contas/{id}");
    expect(prestacaoContas.api).toBe("/api/prestacao_contas/contratos");
    expect(prestacaoContas.columns.find((c) => c.key === "dataTermino")?.format).toBe("date");
    expect(prestacaoContas.columns.find((c) => c.key === "valorTotal")?.format).toBe("currency");

    const p1 = await lista(`tipoContratoId=${t}&size=10&page=1`);
    const p2 = await lista(`tipoContratoId=${t}&size=10&page=2`);
    expect(p1.items).toHaveLength(10);
    expect(p2.items).toHaveLength(2);
    expect(p1.total).toBe(12);
    const linha = [...p1.items, ...p2.items].find((i) => i.id === alvo.id)!;
    expect(linha.diasDesdeVencimento).toBe(15);
    expect(formatDate(linha.dataTermino)).toBe(formatDate(diasAtras(15)));
    expect(formatDate(linha.dataTermino)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(formatCurrency(linha.valorTotal)).toBe("R$ 812.345,67");
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await contratos.GET(jsonRequest("/api/prestacao_contas/contratos"))).status).toBe(401);
    expect((await fluxo.GET(jsonRequest("/api/prestacao_contas/contratos/1"), idParams(1))).status).toBe(401);
    expect((await collection.GET(jsonRequest("/api/prestacao_contas"))).status).toBe(401);
  });
});

describe("021 › Busca, ordenação e filtros", () => {
  beforeAll(async () => {
    await loginAs();
  });

  it("Buscar pela contratada", async () => {
    const t = await tipoMarcado();
    const alfa = await prisma.prestadorServico.create({ data: { deRazaoSocial: "Alfa Serviços" } });
    const beta = await prisma.prestadorServico.create({ data: { deRazaoSocial: "Beta Obras" } });
    const ca = await contrato(t, { prestadorServicoId: alfa.id });
    await contrato(t, { prestadorServicoId: beta.id });
    expect((await lista(`tipoContratoId=${t}&campo=contratada&q=alfa`)).items.map((i) => i.id)).toEqual([ca.id]);
  });

  it("Buscar pelo gestor", async () => {
    const t = await tipoMarcado();
    await prisma.pessoaFisica.create({ data: { idPessoaFisica: 921001, cpf: "92100100001", deNome: "Maria Souza", dtNascimento: nascimento } });
    await prisma.pessoaFisica.create({ data: { idPessoaFisica: 921002, cpf: "92100200002", deNome: "João Lima", dtNascimento: nascimento } });
    const maria = await contrato(t, { pessoaFisicaId: "92100100001" });
    await contrato(t, { pessoaFisicaId: "92100200002" });
    expect((await lista(`tipoContratoId=${t}&campo=gestor&q=souza`)).items.map((i) => i.id)).toEqual([maria.id]);
  });

  it("Coluna de busca inválida: campo=senha → 400 com erro em campo", async () => {
    const res = await contratos.GET(jsonRequest("/api/prestacao_contas/contratos?campo=senha&q=x"));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toHaveProperty("campo");
  });

  it("Ordenar por valor decrescente (ordenar=valor:desc e ordenar=valor&dir=desc)", async () => {
    const t = await tipoMarcado();
    for (const v of ["700000.00", "900000.00", "800000.00"]) await contrato(t, { valorTotal: new Prisma.Decimal(v) });
    for (const q of ["ordenar=valor:desc", "ordenar=valor&dir=desc"]) {
      const body = await lista(`tipoContratoId=${t}&${q}`);
      expect(body.items.map((i) => formatCurrency(i.valorTotal))).toEqual(["R$ 900.000,00", "R$ 800.000,00", "R$ 700.000,00"]);
    }
    // Ordenação desconhecida: padrão (vencimento crescente), sem erro.
    expect((await contratos.GET(jsonRequest(`/api/prestacao_contas/contratos?tipoContratoId=${t}&ordenar=xpto`))).status).toBe(200);
  });

  it("Ordenar por gestor: Ana, Carlos e por último o sem gestor", async () => {
    const t = await tipoMarcado();
    await prisma.pessoaFisica.create({ data: { idPessoaFisica: 922001, cpf: "92200100001", deNome: "Carlos", dtNascimento: nascimento } });
    await prisma.pessoaFisica.create({ data: { idPessoaFisica: 922002, cpf: "92200200002", deNome: "Ana", dtNascimento: nascimento } });
    const carlos = await contrato(t, { pessoaFisicaId: "92200100001" });
    const sem = await contrato(t, { pessoaFisicaId: null });
    const ana = await contrato(t, { pessoaFisicaId: "92200200002" });
    const body = await lista(`tipoContratoId=${t}&ordenar=gestor:asc`);
    expect(body.items.map((i) => i.id)).toEqual([ana.id, carlos.id, sem.id]);
    expect(body.total).toBe(3);
    // A paginação também vale na ordenação em memória.
    expect((await lista(`tipoContratoId=${t}&ordenar=gestor&size=1&page=3`)).items.map((i) => i.id)).toEqual([sem.id]);
  });

  it("Filtrar por modalidade", async () => {
    const t = await tipoMarcado();
    const pregao = await prisma.modalidade.create({ data: { nome: "Pregão" } });
    const concorrencia = await prisma.modalidade.create({ data: { nome: "Concorrência" } });
    const cp = await contrato(t, { modalidadeId: pregao.id });
    await contrato(t, { modalidadeId: concorrencia.id });
    expect((await lista(`tipoContratoId=${t}&modalidadeId=${pregao.id}`)).items.map((i) => i.id)).toEqual([cp.id]);
  });

  it("Filtro de tipo só oferece tipos marcados (lookup ?prestacaoContas=S); tipo não marcado → lista vazia", async () => {
    expect(prestacaoContas.filters.find((f) => f.name === "tipoContratoId")?.lookup?.api).toBe("/api/tipo_contratos?prestacaoContas=S");
    const marcado = await prisma.tipoContrato.create({ data: { nome: "Contrato PCF", gerenciamento: "N", prestacaoContas: "S" } });
    const convenio = await prisma.tipoContrato.create({ data: { nome: "Convênio PCF", gerenciamento: "N", prestacaoContas: "N" } });
    const body = await (await tipos.GET(jsonRequest("/api/tipo_contratos?prestacaoContas=S&size=100"))).json();
    const ids = body.items.map((i: { id: number }) => i.id);
    expect(ids).toContain(marcado.id);
    expect(ids).not.toContain(convenio.id);
    await contrato(convenio.id);
    expect((await lista(`tipoContratoId=${convenio.id}`)).total).toBe(0);
  });
});

describe("021 › Fluxo por contrato", () => {
  let t: number;
  beforeAll(async () => {
    await loginAs();
    t = await tipoMarcado();
  });

  it("Dias e meses do painel: hoje 13/11/2026, início 28/02/2025, vencimento 03/11/2026 → 10 dias e 21 meses", async () => {
    const c = await contrato(t, { dataInicio: new Date(Date.UTC(2025, 1, 28)), dataTermino: new Date(Date.UTC(2026, 10, 3)) });
    expect(await getFluxo(c.id, null, new Date(2026, 10, 13, 10))).toMatchObject({ diasDesdeVencimento: 10, mesesDesdeInicio: 21, realizada: false });
    const api = await (await fluxo.GET(jsonRequest(`/api/prestacao_contas/contratos/${c.id}`), idParams(c.id))).json();
    expect(api.contrato).toMatchObject({ id: c.id, numeroContrato: c.numeroContrato });
    expect(typeof api.diasDesdeVencimento).toBe("number");
  });

  it("Contrato inexistente: 404", async () => {
    expect((await fluxo.GET(jsonRequest("/api/prestacao_contas/contratos/999999"), idParams(999999))).status).toBe(404);
  });

  it("Escolher o prazo: prazo 30 lista as fases de período 30 e não a de período 10", async () => {
    const entrega = await fase("Entrega do relatório", "30");
    const analise = await fase("Análise", "30");
    const abertura = await fase("Abertura", "10");
    const c = await contrato(t);
    const body = await (await fluxo.GET(jsonRequest(`/api/prestacao_contas/contratos/${c.id}?periodo=30`), idParams(c.id))).json();
    expect(body.periodo).toBe("30");
    expect(body.prazos).toEqual(expect.arrayContaining(["10", "30"]));
    const ids = body.fases.map((f: { id: number }) => f.id);
    expect(ids).toEqual(expect.arrayContaining([entrega.id, analise.id]));
    expect(ids).not.toContain(abertura.id);
    // O prazo fica só na tela: nada é gravado no contrato.
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).periodo).toBeNull();
  });

  it("Última descrição por fase; usuário só com id e username (sem senha)", async () => {
    const analise = await fase("Análise (última)", "60");
    const c = await contrato(t);
    expect((await gravar({ contratoId: c.id, faseId: analise.id, descricao: "Pendências", atendido: "N" })).status).toBe(201);
    expect((await gravar({ contratoId: c.id, faseId: analise.id, descricao: "Documentos completos", atendido: "S" })).status).toBe(201);
    const raw = await (await fluxo.GET(jsonRequest(`/api/prestacao_contas/contratos/${c.id}?periodo=60`), idParams(c.id))).text();
    expect(raw).not.toMatch(/password/i);
    const body = JSON.parse(raw);
    const linha = body.fases.find((f: { id: number }) => f.id === analise.id);
    expect(linha.ultimo).toMatchObject({ descricao: "Documentos completos", atendido: "S" });
    expect(Object.keys(linha.ultimo.usuario).sort()).toEqual(["id", "username"]);
    expect(body.historico).toHaveLength(2);
  });
});

describe("021 › Gravar fase e conclusão", () => {
  let t: number;
  let encerramento: number;
  let abertura: number;
  beforeAll(async () => {
    await loginAs();
    t = await tipoMarcado();
    // Período com espaços: a comparação usa o texto aparado.
    encerramento = (await fase("Encerramento", " 30 ")).id;
    abertura = (await fase("Abertura (conclusão)", "10")).id;
  });

  const realizada = async (id: number) => (await prisma.contrato.findUniqueOrThrow({ where: { id } })).prestacaoRealizada;

  it("Gravar fase com autoria da sessão: userId da sessão, dataInclusao de hoje, registro novo no histórico", async () => {
    const outro = await loginAs("outro.pc");
    const eu = await loginAs("fiscal.a");
    const analise = await fase("Análise (autoria)", "60");
    const c = await contrato(t);
    const res = await gravar({ contratoId: c.id, faseId: analise.id, descricao: "Em análise", atendido: "N", userId: outro.id, dataInclusao: "2000-01-01" });
    expect(res.status).toBe(201);
    const row = await res.json();
    const salvo = await prisma.prestacaoConta.findUniqueOrThrow({ where: { id: row.id } });
    expect(salvo.userId).toBe(eu.id);
    expect(salvo.dataInclusao!.toDateString()).toBe(new Date().toDateString());
    const f = await getFluxo(c.id, "60");
    expect(f?.historico[0]).toMatchObject({ id: row.id, descricao: "Em análise", usuario: { id: eu.id, username: "fiscal.a" } });
  });

  it("Campo desconhecido: 400 e nada é gravado", async () => {
    const c = await contrato(t);
    const antes = await prisma.prestacaoConta.count();
    expect((await gravar({ contratoId: c.id, faseId: abertura, outro: 1 })).status).toBe(400);
    expect(await prisma.prestacaoConta.count()).toBe(antes);
  });

  it("Fase inexistente: 400 com erro em faseId e nada é gravado", async () => {
    const c = await contrato(t);
    const antes = await prisma.prestacaoConta.count();
    const res = await gravar({ contratoId: c.id, faseId: 999999 });
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toMatchObject({ faseId: PRESTACAO_MSG.faseInexistente });
    expect(await prisma.prestacaoConta.count()).toBe(antes);
  });

  it("Fase de período 30 atendida conclui: prestacaoRealizada = '1' e o contrato passa para Realizadas", async () => {
    const c = await contrato(t);
    expect((await lista(`tipoContratoId=${t}&situacao=pendentes&size=100`)).items.map((i) => i.id)).toContain(c.id);
    expect((await gravar({ contratoId: c.id, faseId: encerramento, atendido: "S" })).status).toBe(201);
    expect(await realizada(c.id)).toBe("1");
    expect((await lista(`tipoContratoId=${t}&situacao=pendentes&size=100`)).items.map((i) => i.id)).not.toContain(c.id);
    expect((await lista(`tipoContratoId=${t}&situacao=realizadas&size=100`)).items.map((i) => i.id)).toContain(c.id);
  });

  it("Fase de período 30 não atendida não conclui", async () => {
    const c = await contrato(t);
    expect((await gravar({ contratoId: c.id, faseId: encerramento, atendido: "N" })).status).toBe(201);
    expect(await realizada(c.id)).toBeNull();
  });

  it("Outro período atendido não conclui", async () => {
    const c = await contrato(t);
    expect((await gravar({ contratoId: c.id, faseId: abertura, atendido: "S" })).status).toBe(201);
    expect(await realizada(c.id)).toBeNull();
  });

  it("Conclusão não é desfeita: gravar período 30 com atendido N mantém '1'", async () => {
    const c = await contrato(t, { prestacaoRealizada: "1" });
    expect((await gravar({ contratoId: c.id, faseId: encerramento, atendido: "N" })).status).toBe(201);
    expect(await realizada(c.id)).toBe("1");
  });

  it("sem sessão: POST responde 401", async () => {
    logout();
    expect((await gravar({ contratoId: 1, faseId: encerramento })).status).toBe(401);
  });
});

describe("021 › Histórico somente leitura", () => {
  beforeAll(async () => {
    await loginAs();
  });

  it("Histórico do contrato: ?contratoId=<A> devolve só os três registros de A, do mais recente ao mais antigo", async () => {
    const t = await tipoMarcado();
    const f = await fase("Histórico", "60");
    const a = await contrato(t);
    const b = await contrato(t);
    for (const d of ["1", "2", "3"]) await gravar({ contratoId: a.id, faseId: f.id, descricao: `A${d}` });
    await gravar({ contratoId: b.id, faseId: f.id, descricao: "B1" });
    const body = await (await collection.GET(jsonRequest(`/api/prestacao_contas?contratoId=${a.id}`))).json();
    expect(body.total).toBe(3);
    expect(body.items.map((i: { descricao: string }) => i.descricao)).toEqual(["A3", "A2", "A1"]);
  });

  it("Registro gravado não é editado nem excluído: rota sem PUT/DELETE (405 do Next), registro inalterado, páginas new/edit removidas", async () => {
    const t = await tipoMarcado();
    const f = await fase("Somente leitura", "60");
    const c = await contrato(t);
    const row = await (await gravar({ contratoId: c.id, faseId: f.id, descricao: "Original" })).json();
    // O Next responde 405 a método que a rota não exporta.
    expect(Object.keys(item).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k))).toEqual(["GET"]);
    const lido = await (await item.GET(jsonRequest(`/api/prestacao_contas/${row.id}`), idParams(row.id))).json();
    expect(lido).toMatchObject({ descricao: "Original" });
    expect(await prisma.prestacaoConta.findUnique({ where: { id: row.id } })).toMatchObject({ descricao: "Original" });
    expect(existsSync("src/app/(app)/prestacao_contas/new")).toBe(false);
    expect(existsSync("src/app/(app)/prestacao_contas/[id]/edit")).toBe(false);
  });
});
