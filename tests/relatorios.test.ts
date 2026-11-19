import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { existsSync, readFileSync } from "node:fs";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";
import { diasAte, hojeUtc, somaDecimal } from "@/lib/relatorios/comum";
import { nomesDosGestores } from "@/lib/relatorios/chaves";
import { lerParams, vencendoParams, vencidosParams } from "@/lib/relatorios/params";
import { toCsv } from "@/lib/relatorios/csv";
import * as porGestor from "@/lib/relatorios/contratos-por-gestor";
import * as vencendo from "@/lib/relatorios/contratos-vencendo";
import * as vencidos from "@/lib/relatorios/contratos-vencidos";
import * as cadastro from "@/lib/relatorios/cadastro-incompleto";
import * as meta from "@/lib/relatorios/acompanhamento-meta";
import * as acerto from "@/lib/relatorios/acerto-valor";
import { RELATORIOS } from "@/lib/relatorios/indice";
import { imprimir } from "@/components/relatorios/report-actions";
import { ReportPage } from "@/components/relatorios/report-page";
import { ReportHeader } from "@/components/relatorios/report-header";
import * as rotaPorGestor from "@/app/api/relatorios/contratos-por-gestor/route";
import * as rotaGestores from "@/app/api/relatorios/contratos-por-gestor/gestores/route";
import * as rotaVencendo from "@/app/api/relatorios/contratos-vencendo/route";
import * as rotaVencidos from "@/app/api/relatorios/contratos-vencidos/route";
import * as rotaCadastro from "@/app/api/relatorios/cadastro-incompleto/route";
import * as rotaMeta from "@/app/api/relatorios/acompanhamento-meta/route";
import * as rotaAcerto from "@/app/api/relatorios/acerto-valor/route";
import * as rotaAcertoItem from "@/app/api/relatorios/acerto-valor/[id]/route";

// Os .tsx usam o JSX clássico no Vitest (tsconfig "jsx": "preserve"): `React` precisa existir no
// escopo global quando os componentes renderizam (renderToStaticMarkup, dentro dos testes).
(globalThis as { React?: unknown }).React = React;

/**
 * 019-relatorios › specs/relatorios/spec.md: um teste por cenário. "Hoje" fixo em 15/06/2090 nas
 * consultas (parâmetro `now`) para isolar os dados deste arquivo dos contratos de outros testes.
 */

const DAY = 86_400_000;
const NOW = new Date(2090, 5, 15, 12, 0, 0);
const HOJE = hojeUtc(NOW);
const d = (dias: number) => new Date(HOJE.getTime() + dias * DAY);
const nascimento = new Date(Date.UTC(1980, 0, 1));
let seq = 0;
const uid = () => `${Date.now().toString(36)}${++seq}`;

async function tipo(dados: { contratoPrincipal?: "S" | "N"; indicativoMetaRisco?: "S" | "N"; nome?: string } = {}) {
  return prisma.tipoContrato.create({ data: { nome: dados.nome ?? `Tipo ${uid()}`, gerenciamento: "N", ...dados } });
}
async function unidade(nome = `UN ${uid()}`) {
  const diretoria = await prisma.diretoria.create({ data: { deDiretoria: `Diretoria ${uid()}`, codigo: "D" } });
  return prisma.departamento.create({ data: { deDepartamento: nome, diretoriaId: diretoria.id } });
}
async function fornecedor(razao = `Fornecedor ${uid()}`) {
  return prisma.prestadorServico.create({ data: { deRazaoSocial: razao } });
}
async function pessoa(cpf: string, nome: string) {
  return prisma.pessoaFisica.upsert({
    where: { cpf },
    create: { idPessoaFisica: Number(cpf.slice(-6)), cpf, deNome: nome, dtNascimento: nascimento },
    update: { deNome: nome },
  });
}
function contrato(data: Partial<Prisma.ContratoUncheckedCreateInput> = {}) {
  return prisma.contrato.create({ data: { objeto: `Objeto ${uid()}`, ...data } });
}

beforeEach(async () => {
  // Cada cenário marca só os próprios tipos.
  await prisma.tipoContrato.updateMany({ data: { contratoPrincipal: "N", indicativoMetaRisco: "N" } });
});

describe("019 › comum", () => {
  it("diasAte: vence hoje = 0; somaDecimal sem Number (1000.10 + 2000.25 = 3000.35)", () => {
    expect(diasAte(HOJE, HOJE)).toBe(0);
    expect(diasAte(d(10), HOJE)).toBe(10);
    expect(diasAte(d(-3), HOJE)).toBe(-3);
    const s = somaDecimal([new Prisma.Decimal("1000.10"), null, new Prisma.Decimal("2000.25")]);
    expect(s).toBeInstanceOf(Prisma.Decimal);
    expect(s.toFixed(2)).toBe("3000.35");
  });

  it("chaves: nomesDosGestores resolve um CPF semeado para o nome", async () => {
    await pessoa("71000000001", "Pessoa Chave");
    const nomes = await nomesDosGestores(["71000000001", null, "71000000099"]);
    expect(nomes.get("71000000001")).toBe("Pessoa Chave");
    expect(nomes.has("71000000099")).toBe(false);
  });

  it("nenhum id de tipo de contrato fixo em src/lib/relatorios", async () => {
    const { readdirSync } = await import("node:fs");
    for (const f of readdirSync("src/lib/relatorios")) {
      expect(readFileSync(`src/lib/relatorios/${f}`, "utf8"), f).not.toMatch(/tipoContratoId:\s*\d/);
    }
  });
});

describe("019 › Índice de relatórios", () => {
  it("Abrir o índice: seis relatórios, cada link com a sua rota e página", () => {
    expect(RELATORIOS.map((r) => r.href).sort()).toEqual(
      [
        "/relatorios/acerto-valor",
        "/relatorios/acompanhamento-meta",
        "/relatorios/cadastro-incompleto",
        "/relatorios/contratos-por-gestor",
        "/relatorios/contratos-vencendo",
        "/relatorios/contratos-vencidos",
      ].sort(),
    );
    expect(existsSync("src/app/(app)/relatorios/page.tsx")).toBe(true);
    for (const r of RELATORIOS) {
      expect(r.titulo.length).toBeGreaterThan(0);
      expect(r.descricao.length).toBeGreaterThan(0);
      expect(existsSync(`src/app/(app)${r.href}/page.tsx`), r.href).toBe(true);
    }
  });
});

describe("019 › Só contratos originais e vencimento do próprio contrato", () => {
  it("Aditivo não aparece: vencendo 30 dias mostra o original (10 dias) e não o aditivo (15 dias)", async () => {
    const original = await contrato({ dataTermino: d(10) });
    const aditivo = await contrato({ parentId: original.id, dataTermino: d(15) });
    const r = await vencendo.consultar(vencendo.params.parse({ dias: "30" }), NOW);
    const ids = r.linhas.map((l) => l.id);
    expect(ids).toContain(original.id);
    expect(ids).not.toContain(aditivo.id);
    expect(r.linhas.find((l) => l.id === original.id)?.vencimento).toEqual(d(10));
  });

  it("Prorrogação por aditivo não muda o vencimento: original vencido há 5 dias aparece em vencidos", async () => {
    const original = await contrato({ dataTermino: d(-5) });
    await contrato({ parentId: original.id, dataTermino: d(300) });
    const r = await vencidos.consultar(vencidos.params.parse({ inicio: "01/06/2090", fim: "14/06/2090" }));
    expect(r.linhas.map((l) => l.id)).toContain(original.id);
  });
});

describe("019 › Tipo Contrato configurável e aviso", () => {
  it("Tipo marcado entra no relatório: só o contrato do tipo 'Contrato' aparece em Cadastro incompleto", async () => {
    const contratoT = await tipo({ contratoPrincipal: "S", nome: "Contrato" });
    const convenio = await tipo({ contratoPrincipal: "N", nome: "Convênio" });
    const a = await contrato({ tipoContratoId: contratoT.id, dataTermino: d(30) });
    const b = await contrato({ tipoContratoId: convenio.id, dataTermino: d(30) });
    const r = await cadastro.consultar(NOW);
    const ids = r.linhas.map((l) => l.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
    expect(r.avisos).toBeUndefined();
  });

  it("Nenhum tipo marcado: Meta (e Cadastro) devolvem o aviso SEM_TIPO_CONTRATO; a tela mostra o texto e o link", async () => {
    const r = await meta.consultar(NOW);
    expect(r.avisos).toEqual(["SEM_TIPO_CONTRATO"]);
    expect(r.listas.find((l) => l.lista === "total")?.termos).toBe(0);
    expect((await cadastro.consultar(NOW)).avisos).toEqual(["SEM_TIPO_CONTRATO"]);
    await loginAs();
    const api = await (await rotaMeta.GET(jsonRequest("/api/relatorios/acompanhamento-meta"))).json();
    expect(api.avisos).toEqual(["SEM_TIPO_CONTRATO"]);
    const { AvisoSemTipoContrato } = await import("@/components/relatorios/report-page");
    const html = renderToStaticMarkup(createElement(AvisoSemTipoContrato));
    expect(html).toContain("Nenhum tipo de contrato está marcado como Contrato.");
    expect(html).toContain('href="/tipo_contratos"');
  });
});

describe("019 › Contratos por gestor", () => {
  it("Agrupar e somar: Qtde 2, Valor acumulado R$ 3.000,35, gestor e UN Gestora", async () => {
    const un = await unidade("DIAFI");
    const t = await tipo({ nome: "Contrato" });
    await pessoa("12345678901", "Responsável Agrupado");
    await contrato({ pessoaFisicaId: "12345678901", tipoContratoId: t.id, departamentoId: un.id, valorTotal: new Prisma.Decimal("1000.10") });
    await contrato({ pessoaFisicaId: "12345678901", tipoContratoId: t.id, departamentoId: un.id, valorTotal: new Prisma.Decimal("2000.25") });
    const r = await porGestor.consultar(porGestor.params.parse({ departamentoId: String(un.id) }));
    expect(r.titulo).toBe("Contratos acumulados pelo gestor");
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({ qtde: 2, tipo: "Contrato", gestor: "Responsável Agrupado", unidade: "DIAFI" });
    expect(r.linhas[0].valorAcumulado.toFixed(2)).toBe("3000.35");
  });

  it("Contratos sem gestor: contados no grupo 'Sem gestor'", async () => {
    const un = await unidade();
    const c = await contrato({ departamentoId: un.id, valorTotal: null });
    expect(c.pessoaFisicaId).toBeNull();
    const r = await porGestor.consultar(porGestor.params.parse({ departamentoId: String(un.id) }));
    expect(r.linhas).toEqual([expect.objectContaining({ gestor: "Sem gestor", qtde: 1 })]);
    expect(r.linhas[0].valorAcumulado.toFixed(2)).toBe("0.00");
  });

  it("Filtrar por gestor e unidade: só os grupos daquele gestor naquela unidade", async () => {
    const [u1, u2] = [await unidade(), await unidade()];
    await pessoa("72000000001", "Responsável Um");
    await pessoa("72000000002", "Responsável Dois");
    for (const cpf of ["72000000001", "72000000002"]) for (const u of [u1, u2]) await contrato({ pessoaFisicaId: cpf, departamentoId: u.id });
    await loginAs();
    const res = await rotaPorGestor.GET(jsonRequest(`/api/relatorios/contratos-por-gestor?gestor=72000000001&departamentoId=${u1.id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linhas).toEqual([expect.objectContaining({ gestor: "Responsável Um", unidade: u1.deDepartamento, qtde: 1 })]);
  });

  it("Só quem é gestor: a lista do filtro tem A (gestora de contrato original) e não B (sem contrato)", async () => {
    await pessoa("73000000001", "Pessoa A");
    await pessoa("73000000002", "Pessoa B");
    const original = await contrato({ pessoaFisicaId: "73000000001" });
    await pessoa("73000000003", "Pessoa C só de aditivo");
    await contrato({ parentId: original.id, pessoaFisicaId: "73000000003" });
    await loginAs();
    const body = await (await rotaGestores.GET()).json();
    const values = body.items.map((o: { value: string }) => o.value);
    expect(body.items).toContainEqual({ value: "73000000001", label: "Pessoa A" });
    expect(values).not.toContain("73000000002");
    expect(values).not.toContain("73000000003");
  });
});

describe("019 › Contratos vencendo", () => {
  it("Vencendo em N dias: só o de 10 dias (não o de hoje nem o de 40); título 'Contratos vencendo em 30 dias'", async () => {
    const hoje = await contrato({ dataTermino: d(0) });
    const dez = await contrato({ dataTermino: d(10) });
    const quarenta = await contrato({ dataTermino: d(40) });
    const r = await vencendo.consultar(vencendo.params.parse({ dias: "30" }), NOW);
    const ids = r.linhas.map((l) => l.id);
    expect(ids).toContain(dez.id);
    expect(ids).not.toContain(hoje.id);
    expect(ids).not.toContain(quarenta.id);
    expect(r.titulo).toBe("Contratos vencendo em 30 dias");
  });

  it("Vencendo dentro de um período: 30 dias e período hoje+15 a hoje+25 → só o de 20 dias", async () => {
    const cinco = await contrato({ dataTermino: d(5) });
    const vinte = await contrato({ dataTermino: d(20) });
    const fmt = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
    const r = await vencendo.consultar(vencendo.params.parse({ dias: "30", inicio: fmt(d(15)), fim: fmt(d(25)) }), NOW);
    const ids = r.linhas.map((l) => l.id);
    expect(ids).toContain(vinte.id);
    expect(ids).not.toContain(cinco.id);
  });

  it("Ordenar por contratada: decrescente vem em ordem alfabética decrescente", async () => {
    const [fa, fb, fc] = [await fornecedor("Alfa Serviços"), await fornecedor("Beta Obras"), await fornecedor("Gama Limpeza")];
    for (const f of [fb, fa, fc]) await contrato({ prestadorServicoId: f.id, dataTermino: d(50) });
    const r = await vencendo.consultar(vencendo.params.parse({ dias: "90", sort: "contratada", dir: "desc" }), NOW);
    const nomes = r.linhas.map((l) => l.contratada).filter((n) => ["Alfa Serviços", "Beta Obras", "Gama Limpeza"].includes(n ?? ""));
    expect(nomes).toEqual(["Gama Limpeza", "Beta Obras", "Alfa Serviços"]);
  });

  it("Ordenar por gestor (em memória, pelo nome resolvido do CPF)", async () => {
    await pessoa("74000000001", "Zuleica");
    await pessoa("74000000002", "Abel");
    const z = await contrato({ pessoaFisicaId: "74000000001", dataTermino: d(60) });
    const a = await contrato({ pessoaFisicaId: "74000000002", dataTermino: d(61) });
    const r = await vencendo.consultar(vencendo.params.parse({ dias: "90", sort: "gestor" }), NOW);
    const ids = r.linhas.map((l) => l.id).filter((id) => id === z.id || id === a.id);
    expect(ids).toEqual([a.id, z.id]);
  });

  it("Sem número de dias: o filtro mostra 'Informe o número de dias', sem tabela; a API responde 400 no campo dias", async () => {
    const lido = lerParams(vencendoParams, { dias: "" });
    expect(lido.ok).toBe(false);
    if (!lido.ok) expect(lido.errors.dias).toBe("Informe o número de dias");
    const Page = (await import("@/app/(app)/relatorios/contratos-vencendo/page")).default;
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ dias: "", inicio: "01/07/2090" }) }));
    expect(html).toContain("Informe o número de dias");
    expect(html).not.toContain("<table");
    await loginAs();
    const res = await rotaVencendo.GET(jsonRequest("/api/relatorios/contratos-vencendo"));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.dias).toBe("Informe o número de dias");
    // Parâmetro desconhecido → 400 (schema estrito).
    expect((await rotaVencendo.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=30&foo=1"))).status).toBe(400);
    expect((await rotaVencendo.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=3651"))).status).toBe(400);
  });
});

describe("019 › Contratos vencidos", () => {
  it("Vencidos no período: 01/10 e 15/10 entram, 01/11 não; título do legado", async () => {
    const un = await unidade();
    const datas = [Date.UTC(2091, 9, 1), Date.UTC(2091, 9, 15), Date.UTC(2091, 10, 1)].map((t) => new Date(t));
    const [c1, c2, c3] = await Promise.all(datas.map((dt) => contrato({ dataTermino: dt, departamentoId: un.id })));
    const r = await vencidos.consultar(vencidos.params.parse({ inicio: "01/10/2091", fim: "15/10/2091" }));
    const ids = r.linhas.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining([c1.id, c2.id]));
    expect(ids).not.toContain(c3.id);
    expect(ids.indexOf(c1.id)).toBeLessThan(ids.indexOf(c2.id));
    expect(r.titulo).toBe("Contratos vencidos - Período de: 01/10/2091 até 15/10/2091");
  });

  it("Período incompleto ou invertido: 'Informe a data final' / 'Data inicial posterior à data final', 400 na API", async () => {
    const sem = lerParams(vencidosParams, { inicio: "01/10/2091" });
    expect(!sem.ok && sem.errors.fim).toBe("Informe a data final");
    const inv = lerParams(vencidosParams, { inicio: "15/10/2091", fim: "01/10/2091" });
    expect(!inv.ok && inv.errors.inicio).toBe("Data inicial posterior à data final");
    const Page = (await import("@/app/(app)/relatorios/contratos-vencidos/page")).default;
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ inicio: "01/10/2091", fim: "" }) }));
    expect(html).toContain("Informe a data final");
    expect(html).not.toContain("<table");
    await loginAs();
    const r1 = await rotaVencidos.GET(jsonRequest("/api/relatorios/contratos-vencidos?inicio=01/10/2091"));
    expect(r1.status).toBe(400);
    expect((await r1.json()).errors.fim).toBe("Informe a data final");
    const r2 = await rotaVencidos.GET(jsonRequest("/api/relatorios/contratos-vencidos?inicio=15/10/2091&fim=01/10/2091"));
    expect(r2.status).toBe(400);
    expect((await r2.json()).errors.inicio).toBe("Data inicial posterior à data final");
    // Vencendo: período com uma data só.
    const v = lerParams(vencendoParams, { dias: "30", inicio: "01/10/2091" });
    expect(!v.ok && v.errors.fim).toBe("Informe as duas datas do período");
  });
});

describe("019 › Cadastro incompleto", () => {
  it("Falta o projeto básico: só o segundo aparece, com Tem contrato 'Sim' e Tem projeto básico 'Não'", async () => {
    const t = await tipo({ contratoPrincipal: "S" });
    const completo = await contrato({ tipoContratoId: t.id, dataTermino: d(30), anexo: "a.pdf", projetoBasico: "pb.pdf" });
    const semPb = await contrato({ tipoContratoId: t.id, dataTermino: d(30), anexo: "b.pdf", projetoBasico: "" });
    const r = await cadastro.consultar(NOW);
    const ids = r.linhas.map((l) => l.id);
    expect(ids).toContain(semPb.id);
    expect(ids).not.toContain(completo.id);
    expect(r.linhas.find((l) => l.id === semPb.id)).toMatchObject({ temContrato: true, temProjetoBasico: false });
  });

  it("Contrato vencido não entra: sem anexo com dataTermino ontem", async () => {
    const t = await tipo({ contratoPrincipal: "S" });
    const ontem = await contrato({ tipoContratoId: t.id, dataTermino: d(-1) });
    const r = await cadastro.consultar(NOW);
    expect(r.linhas.map((l) => l.id)).not.toContain(ontem.id);
  });
});

describe("019 › Acompanhamento de meta", () => {
  it("Três listas: Total 1 termo e R$ 100,00, Vencidos 1 termo, risco 1 termo com 120 dias", async () => {
    const t = await tipo({ contratoPrincipal: "S" });
    const risco = await tipo({ indicativoMetaRisco: "S" });
    await contrato({ tipoContratoId: t.id, dataTermino: d(30), valorTotal: new Prisma.Decimal("100.00"), naPresidencia: 1 });
    await contrato({ tipoContratoId: t.id, dataTermino: d(-3) });
    const r120 = await contrato({ tipoContratoId: risco.id, dataTermino: d(120) });
    const r = await meta.consultar(NOW);
    const [total, venc, emRisco] = r.listas;
    expect(total).toMatchObject({ lista: "total", termos: 1 });
    expect(total.valorTotal.toFixed(2)).toBe("100.00");
    expect(total.linhas[0].naPresidencia).toBe(true);
    expect(venc).toMatchObject({ lista: "vencidos", termos: 1 });
    expect(emRisco).toMatchObject({ lista: "risco", rotulo: "Em prorrogação/risco", termos: 1 });
    expect(emRisco.linhas[0]).toMatchObject({ id: r120.id, diasParaVencer: 120 });
  });

  it("Fora da janela de risco: 200 dias não aparece (180 aparece)", async () => {
    const risco = await tipo({ indicativoMetaRisco: "S" });
    const fora = await contrato({ tipoContratoId: risco.id, dataTermino: d(200) });
    const limite = await contrato({ tipoContratoId: risco.id, dataTermino: d(180) });
    const r = await meta.consultar(NOW);
    const ids = r.listas[2].linhas.map((l) => l.id);
    expect(ids).not.toContain(fora.id);
    expect(ids).toContain(limite.id);
  });

  it("Somar sem perder centavos: R$ 0,10 + R$ 0,20 = R$ 0,30 em 2 termos", async () => {
    const t = await tipo({ contratoPrincipal: "S" });
    await contrato({ tipoContratoId: t.id, dataTermino: d(10), valorTotal: new Prisma.Decimal("0.10") });
    await contrato({ tipoContratoId: t.id, dataTermino: d(11), valorTotal: new Prisma.Decimal("0.20") });
    const r = await meta.consultar(NOW);
    expect(r.listas[0].termos).toBe(2);
    expect(r.listas[0].valorTotal.toFixed(2)).toBe("0.30");
  });
});

describe("019 › Acerto de valor", () => {
  const marca = `acerto-${Date.now().toString(36)}`;
  let ids: number[] = [];
  let preenchido: number;
  let aditivo: number;

  beforeAll(async () => {
    ids = [];
    for (let i = 0; i < 25; i++) {
      const c = await contrato({ objeto: `${marca} ${i}`, numeroContrato: `A${String(i).padStart(3, "0")}` });
      ids.push(c.id);
    }
    preenchido = (await contrato({ objeto: `${marca} preenchido`, valorInicial: new Prisma.Decimal("10") })).id;
    aditivo = (await contrato({ objeto: `${marca} aditivo`, parentId: ids[0] })).id;
  });

  it("Só contratos sem valor inicial: 20 na primeira página e 5 na segunda, sem o preenchido e sem o aditivo", async () => {
    const p1 = await acerto.consultar(acerto.params.parse({ q: marca }));
    const p2 = await acerto.consultar(acerto.params.parse({ q: marca, page: "2" }));
    expect(p1.linhas).toHaveLength(20);
    expect(p2.linhas).toHaveLength(5);
    expect(p1.total).toBe(25);
    const todos = [...p1.linhas, ...p2.linhas].map((l) => l.id);
    expect(todos).not.toContain(preenchido);
    expect(todos).not.toContain(aditivo);
    expect(p1.linhas[0].contrato).toBe("A000");
  });

  it("Buscar por objeto: só os sem valor inicial cujo objeto contém 'limpeza'", async () => {
    const l = await contrato({ objeto: `Serviço de limpeza ${marca}` });
    await contrato({ objeto: `Limpeza já acertada ${marca}`, valorInicial: new Prisma.Decimal("1") });
    await loginAs();
    const body = await (await rotaAcerto.GET(jsonRequest(`/api/relatorios/acerto-valor?q=${encodeURIComponent(`limpeza ${marca}`)}`))).json();
    expect(body.linhas.map((x: { id: number }) => x.id)).toEqual([l.id]);
    const geral = await acerto.consultar(acerto.params.parse({ q: "limpeza" }));
    for (const x of geral.linhas) expect(x.objeto.toLowerCase()).toContain("limpeza");
  });

  it("Gravar valor inicial: 1.234,56 vira Decimal 1234.56, os demais campos não mudam e a linha sai da lista", async () => {
    await loginAs();
    const id = ids[3];
    const antes = await prisma.contrato.findUniqueOrThrow({ where: { id } });
    const totalAntes = (await acerto.consultar(acerto.params.parse({ q: marca }))).total;
    const res = await rotaAcertoItem.PUT(jsonRequest(`/api/relatorios/acerto-valor/${id}`, "PUT", { valorInicial: "1.234,56" }), idParams(id));
    expect(res.status).toBe(200);
    const depois = await prisma.contrato.findUniqueOrThrow({ where: { id } });
    expect(depois.valorInicial).toBeInstanceOf(Prisma.Decimal);
    expect(depois.valorInicial?.toFixed(2)).toBe("1234.56");
    expect({ ...depois, valorInicial: null }).toEqual({ ...antes, valorInicial: null });
    const lista = await acerto.consultar(acerto.params.parse({ q: marca }));
    expect(lista.total).toBe(totalAntes - 1);
  });

  it("Valor inválido: 12,3,4 → 400 com 'Informe o valor no formato 1.234,56' e nada é gravado", async () => {
    await loginAs();
    const id = ids[4];
    const res = await rotaAcertoItem.PUT(jsonRequest(`/api/relatorios/acerto-valor/${id}`, "PUT", { valorInicial: "12,3,4" }), idParams(id));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.valorInicial).toBe("Informe o valor no formato 1.234,56");
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id } })).valorInicial).toBeNull();
    const { valorValido } = await import("@/components/relatorios/acerto-valor-linha");
    expect(valorValido("12,3,4")).toBe(false);
    expect(valorValido("1.234,56")).toBe(true);
  });

  it("Já informado ou aditivo: 409 'Valor inicial já informado'; aditivo e id inexistente → 404", async () => {
    await loginAs();
    const r409 = await rotaAcertoItem.PUT(jsonRequest(`/api/relatorios/acerto-valor/${preenchido}`, "PUT", { valorInicial: "5,00" }), idParams(preenchido));
    expect(r409.status).toBe(409);
    expect((await r409.json()).error).toBe("Valor inicial já informado");
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: preenchido } })).valorInicial?.toFixed(2)).toBe("10.00");
    const r404 = await rotaAcertoItem.PUT(jsonRequest(`/api/relatorios/acerto-valor/${aditivo}`, "PUT", { valorInicial: "5,00" }), idParams(aditivo));
    expect(r404.status).toBe(404);
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: aditivo } })).valorInicial).toBeNull();
    expect((await rotaAcertoItem.PUT(jsonRequest(`/api/relatorios/acerto-valor/999999`, "PUT", { valorInicial: "5,00" }), idParams(999999))).status).toBe(404);
  });

  it("Campo extra: { valorInicial, valorTotal } → 400 e nada é gravado", async () => {
    await loginAs();
    const id = ids[5];
    const antes = await prisma.contrato.findUniqueOrThrow({ where: { id } });
    const res = await rotaAcertoItem.PUT(
      jsonRequest(`/api/relatorios/acerto-valor/${id}`, "PUT", { valorInicial: "10,00", valorTotal: "99,00" }),
      idParams(id),
    );
    expect(res.status).toBe(400);
    expect(await prisma.contrato.findUniqueOrThrow({ where: { id } })).toEqual(antes);
  });
});

describe("019 › Exportação CSV", () => {
  it("Baixar CSV de vencidos: nome, BOM, cabeçalho, valor 1234,56 e objeto entre aspas", async () => {
    const f = await fornecedor("Contratada CSV");
    await contrato({
      dataTermino: new Date(Date.UTC(2092, 2, 10)),
      valorTotal: new Prisma.Decimal("1234.56"),
      objeto: "Serviço; manutenção",
      prestadorServicoId: f.id,
    });
    await loginAs();
    const res = await rotaVencidos.GET(jsonRequest("/api/relatorios/contratos-vencidos?inicio=01/03/2092&fim=31/03/2092&formato=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="contratos-vencidos-\d{4}-\d{2}-\d{2}\.csv"$/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder().decode(bytes.slice(3));
    const linhas = texto.split("\r\n");
    expect(linhas[0]).toBe("Contratada;Gestor;UN Gestora;Tipo;Contrato;Processo;Objeto;Valor total;Vencimento");
    expect(linhas[1]).toBe('Contratada CSV;;;;;;"Serviço; manutenção";1234,56;10/03/2092');
    expect(texto.endsWith("\r\n")).toBe(true);
  });

  it("Fórmula neutralizada: razão social que começa com = sai como '=", () => {
    const csv = toCsv([{ label: "Contratada", valor: (l: { c: string }) => l.c }], [{ c: "=HYPERLINK(\"x\")" }, { c: "@soma" }, { c: "+1" }, { c: "-1" }]);
    const linhas = csv.slice(1).split("\r\n");
    expect(linhas[1]).toBe(`"'=HYPERLINK(""x"")"`);
    expect(linhas[2]).toBe("'@soma");
    expect(linhas[3]).toBe("'+1");
    expect(linhas[4]).toBe("'-1");
  });

  it("CSV de vencendo e por gestor pela API", async () => {
    await loginAs();
    const v = await rotaVencendo.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=30&formato=csv"));
    expect(v.headers.get("content-disposition")).toContain("contratos-vencendo-");
    const g = await rotaPorGestor.GET(jsonRequest("/api/relatorios/contratos-por-gestor?formato=csv"));
    const texto = new TextDecoder().decode(new Uint8Array(await g.arrayBuffer()).slice(3));
    expect(texto.split("\r\n")[0]).toBe("Qtde;Tipo;Valor acumulado;Gestor;UN Gestora");
  });
});

describe("019 › Impressão e PDF", () => {
  it("Abrir a impressão: Imprimir / PDF chama window.print()", () => {
    const print = vi.fn();
    imprimir({ print });
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("Imprimir vencendo: A4 paisagem, título 'Contratos vencendo em 60 dias', sem menu, cabeçalho nem filtros", () => {
    const html = renderToStaticMarkup(
      createElement(
        ReportPage,
        { paisagem: true, titulo: "Contratos vencendo", descricao: "x" } as Parameters<typeof ReportPage>[0],
        createElement(ReportHeader, { titulo: vencendo.titulo(60), emitidoEm: new Date(2090, 5, 15) }),
      ),
    );
    expect(html).toContain("@page { size: A4 landscape; margin: 10mm }");
    expect(html).toContain('data-print="relatorio"');
    expect(html).toContain("Contratos vencendo em 60 dias");
    expect(html).toContain("Emitido em 15/06/2090");
    expect(html).toMatch(/hidden[^"]*print:block/);
    // Folha global: menu lateral escondido, cabeçalho repetido, linha inteira; cabeçalho do app e filtros com print:hidden.
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/@media print[\s\S]*\[data-slot="sidebar"\][\s\S]*display: none/);
    expect(css).toMatch(/thead \{\s*display: table-header-group;/);
    expect(css).toMatch(/break-inside: avoid/);
    expect(readFileSync("src/app/(app)/layout.tsx", "utf8")).toMatch(/<header className="[^"]*print:hidden/);
    expect(readFileSync("src/components/relatorios/report-filters.tsx", "utf8")).toMatch(/print:hidden/);
    expect(readFileSync("src/components/relatorios/report-actions.tsx", "utf8")).toMatch(/print:hidden/);
  });
});

describe("019 › Relatórios exigem sessão", () => {
  it("Sem sessão: GET /api/relatorios/contratos-vencendo?dias=30 → 401 sem dados; demais rotas também", async () => {
    logout();
    const res = await rotaVencendo.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=30"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sessão inválida" });
    expect((await rotaPorGestor.GET(jsonRequest("/api/relatorios/contratos-por-gestor"))).status).toBe(401);
    expect((await rotaGestores.GET()).status).toBe(401);
    expect((await rotaVencidos.GET(jsonRequest("/api/relatorios/contratos-vencidos?inicio=01/01/2090&fim=02/01/2090"))).status).toBe(401);
    expect((await rotaCadastro.GET(jsonRequest("/api/relatorios/cadastro-incompleto"))).status).toBe(401);
    expect((await rotaMeta.GET(jsonRequest("/api/relatorios/acompanhamento-meta"))).status).toBe(401);
    expect((await rotaAcerto.GET(jsonRequest("/api/relatorios/acerto-valor"))).status).toBe(401);
    expect((await rotaAcertoItem.PUT(jsonRequest("/api/relatorios/acerto-valor/1", "PUT", { valorInicial: "1,00" }), idParams(1))).status).toBe(401);
  });

  it("Com sessão: cada rota responde 200", async () => {
    await loginAs();
    expect((await rotaCadastro.GET(jsonRequest("/api/relatorios/cadastro-incompleto"))).status).toBe(200);
    expect((await rotaMeta.GET(jsonRequest("/api/relatorios/acompanhamento-meta"))).status).toBe(200);
    expect((await rotaAcerto.GET(jsonRequest("/api/relatorios/acerto-valor"))).status).toBe(200);
    expect((await rotaVencendo.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=30&sort=valor&dir=desc"))).status).toBe(200);
    expect((await rotaVencidos.GET(jsonRequest("/api/relatorios/contratos-vencidos?inicio=01/01/2090&fim=02/01/2090"))).status).toBe(200);
  });
});
