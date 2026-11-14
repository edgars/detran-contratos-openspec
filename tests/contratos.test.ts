import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/contratos/route";
import * as item from "@/app/api/contratos/[id]/route";
import * as aditivos from "@/app/api/contratos/[id]/aditivos/route";
import * as pessoasFisicas from "@/app/api/pessoas_fisicas/route";
import { contratos } from "@/lib/entities/contratos";
import { formatCurrency } from "@/lib/format";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadDir } from "@/lib/uploads";
import { PDF_BYTES, PNG_BYTES, idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 017-contratos: um teste por cenário, um por RK e 401 sem sessão.

let tipoId: number;
let tipo2Id: number;
let modalidadeId: number;
let deptoId: number;
let depto2Id: number;
let fornecedorId: number;
let fornecedor2Id: number;
let situacaoId: number;

const pad = (n: number) => String(n).padStart(2, "0");
/** Mesmo dia, como a API grava (meia-noite UTC). */
function diaUtc(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function valido(extra: Record<string, unknown> = {}) {
  return {
    numeroProcesso: "E-12/001/2026",
    numeroContrato: "001/2026",
    tipoContratoId: String(tipoId),
    objeto: "Prestação de serviços de limpeza",
    departamentoId: String(deptoId),
    prestadorServicoId: String(fornecedorId),
    dataInicio: "01/01/2026",
    dataTermino: "31/12/2026",
    ...extra,
  };
}

function multipart(url: string, fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request(`http://localhost${url}`, { method: "POST", body: form });
}

async function criar(extra: Record<string, unknown> = {}) {
  const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido(extra)));
  expect(res.status).toBe(201);
  return res.json();
}

async function semCampo(campo: string, mensagem: string) {
  await loginAs();
  const antes = await prisma.contrato.count();
  const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ [campo]: "" })));
  expect(res.status).toBe(400);
  expect((await res.json()).errors[campo]).toBe(mensagem);
  expect(await prisma.contrato.count()).toBe(antes);
  // O formulário mostra a mensagem no campo: o campo existe e é obrigatório na tela.
  expect(contratos.fields.find((f) => f.name === campo)?.required).toBe(true);
}

describe("017-contratos", () => {
  beforeAll(async () => {
    await prisma.anexoPublicacao.deleteMany();
    await prisma.anexoFiscal.deleteMany();
    await prisma.contrato.updateMany({ data: { parentId: null } });
    await prisma.contrato.deleteMany();
    tipoId = (await prisma.tipoContrato.create({ data: { nome: "Serviço", gerenciamento: "S" } })).id;
    tipo2Id = (await prisma.tipoContrato.create({ data: { nome: "Obra", gerenciamento: "N" } })).id;
    modalidadeId = (await prisma.modalidade.create({ data: { nome: "Pregão" } })).id;
    const diretoria = await prisma.diretoria.create({ data: { deDiretoria: "Diretoria Geral", codigo: "DG" } });
    deptoId = (await prisma.departamento.create({ data: { deDepartamento: "Coordenadoria de TI", diretoriaId: diretoria.id } })).id;
    depto2Id = (await prisma.departamento.create({ data: { deDepartamento: "Almoxarifado", diretoriaId: diretoria.id } })).id;
    fornecedorId = (await prisma.prestadorServico.create({ data: { deRazaoSocial: "Limpa Tudo Ltda" } })).id;
    fornecedor2Id = (await prisma.prestadorServico.create({ data: { deRazaoSocial: "Constrói SA" } })).id;
    situacaoId = (await prisma.situacaoContratual.create({ data: { descricao: "Vigente" } })).id;
    await prisma.pessoaFisica.createMany({
      data: [
        { idPessoaFisica: 1001, deNome: "Maria Gestora", dtNascimento: new Date("1980-01-01") },
        { idPessoaFisica: 1002, deNome: "João Suplente", dtNascimento: new Date("1985-01-01") },
      ],
    });
  });

  // ------------------------------------------------------------------ Listar / filtrar

  it("Abrir a lista: colunas da spec, paginada, datas e valores formatados, com relações incluídas", async () => {
    await loginAs();
    for (let i = 1; i <= 12; i++) {
      await prisma.contrato.create({
        data: {
          numeroContrato: `LST-${pad(i)}`,
          numeroProcesso: `PROC-LST-${pad(i)}`,
          objeto: "Lista",
          departamentoId: deptoId,
          prestadorServicoId: fornecedorId,
          situacaoContratualId: situacaoId,
          dataTermino: new Date(Date.UTC(2026, 11, 31)),
          valorTotal: new Prisma.Decimal("1234.56"),
        },
      });
    }
    const page2 = await (await collection.GET(jsonRequest("/api/contratos?q=LST-&page=2&size=5&sort=numeroContrato:asc"))).json();
    expect(page2).toMatchObject({ page: 2, size: 5, total: 12 });
    expect(page2.items[0]).toMatchObject({
      numeroContrato: "LST-06",
      numeroProcesso: "PROC-LST-06",
      objeto: "Lista",
      departamento: { deDepartamento: "Coordenadoria de TI" },
      prestadorServico: { deRazaoSocial: "Limpa Tudo Ltda" },
      situacaoContratual: { descricao: "Vigente" },
    });
    expect(contratos.columns.map((c) => c.path ?? c.key)).toEqual([
      "numeroContrato",
      "numeroProcesso",
      "objeto",
      "departamento.deDepartamento",
      "prestadorServico.deRazaoSocial",
      "dataTermino",
      "valorTotal",
      "situacaoContratual.descricao",
    ]);
    expect(contratos.columns.find((c) => c.key === "dataTermino")?.format).toBe("date");
    expect(contratos.columns.find((c) => c.key === "valorTotal")?.format).toBe("currency");
    expect(formatCurrency(page2.items[0].valorTotal)).toBe("R$ 1.234,56");
    const desc = await (await collection.GET(jsonRequest("/api/contratos?q=LST-&size=1&sort=numeroContrato&dir=desc"))).json();
    expect(desc.items[0].numeroContrato).toBe("LST-12");
  });

  it("Contratos vencendo: vencendoEm=30 mostra o que vence em 10 dias e não o de 60", async () => {
    await loginAs();
    const base = { objeto: "Vencimento", departamentoId: deptoId, prestadorServicoId: fornecedorId };
    await prisma.contrato.create({ data: { ...base, numeroContrato: "VENC-10", dataTermino: diaUtc(10) } });
    await prisma.contrato.create({ data: { ...base, numeroContrato: "VENC-60", dataTermino: diaUtc(60) } });
    await prisma.contrato.create({ data: { ...base, numeroContrato: "VENC-PASSADO", dataTermino: diaUtc(-1) } });
    const res = await (await collection.GET(jsonRequest("/api/contratos?q=VENC-&vencendoEm=30"))).json();
    expect(res.items.map((c: { numeroContrato: string }) => c.numeroContrato)).toEqual(["VENC-10"]);
    expect(contratos.filters.find((f) => f.name === "vencendoEm")?.kind).toBe("number");
  });

  it("Filtros da lista: q, departamentoId, prestadorServicoId, gestor e situacaoContratualId (parâmetros, nunca colunas)", async () => {
    await loginAs();
    await prisma.contrato.create({
      data: { numeroContrato: "FLT-A", objeto: "Filtro A", departamentoId: depto2Id, prestadorServicoId: fornecedor2Id, pessoaFisicaId: "1001" },
    });
    await prisma.contrato.create({
      data: { numeroContrato: "FLT-B", objeto: "Filtro B", departamentoId: deptoId, prestadorServicoId: fornecedorId, suplenteId: "1001", situacaoContratualId: situacaoId },
    });
    const nums = async (qs: string) =>
      (await (await collection.GET(jsonRequest(`/api/contratos?q=FLT-&sort=numeroContrato&${qs}`))).json()).items.map(
        (c: { numeroContrato: string }) => c.numeroContrato,
      );
    expect(await nums("")).toEqual(["FLT-A", "FLT-B"]);
    expect(await nums(`departamentoId=${depto2Id}`)).toEqual(["FLT-A"]);
    expect(await nums(`prestadorServicoId=${fornecedorId}`)).toEqual(["FLT-B"]);
    expect(await nums("gestor=1001")).toEqual(["FLT-A", "FLT-B"]);
    expect(await nums(`situacaoContratualId=${situacaoId}`)).toEqual(["FLT-B"]);
    // Busca por objeto e por número do processo
    expect(await (await collection.GET(jsonRequest("/api/contratos?q=Filtro%20B"))).json()).toMatchObject({ total: 1 });
    // Parâmetro de pesquisa do legado não vira filtro de coluna (nem erro).
    expect((await collection.GET(jsonRequest("/api/contratos?buscaGestor=x&vencendo=1"))).status).toBe(200);
  });

  // ------------------------------------------------------------------ Criar / editar / excluir

  it("Salvar um contrato válido: grava em contratos e a lista o exibe", async () => {
    await loginAs();
    const criado = await criar({
      numeroContrato: "VAL-001",
      modalidadeId: String(modalidadeId),
      numeroModalidade: "PE 10/2026",
      pessoaFisicaId: "1001",
      suplenteId: "1002",
      valorMensal: "100,00",
      valorTotal: "1.200,00",
      situacaoContratualId: String(situacaoId),
      projetoBasico: "Projeto",
    });
    const gravado = await prisma.contrato.findUniqueOrThrow({ where: { id: criado.id } });
    expect(gravado).toMatchObject({ numeroContrato: "VAL-001", tipoContratoId: tipoId, parentId: null });
    expect(gravado.dataInicio?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(gravado.dataTermino?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    // dataInclusao = data do servidor
    expect(Math.abs((gravado.dataInclusao?.getTime() ?? 0) - Date.now())).toBeLessThan(60_000);
    const lista = await (await collection.GET(jsonRequest("/api/contratos?q=VAL-001"))).json();
    expect(lista.items).toHaveLength(1);
  });

  it("Criar Contratos: formulário com os campos na ordem da spec", () => {
    expect(contratos.fields.map((f) => f.name)).toEqual([
      "numeroProcesso",
      "numeroContrato",
      "tipoContratoId",
      "modalidadeId",
      "numeroModalidade",
      "objeto",
      "departamentoId",
      "prestadorServicoId",
      "pessoaFisicaId",
      "suplenteId",
      "dataInicio",
      "dataTermino",
      "valorMensal",
      "valorTotal",
      "situacaoContratualId",
      "projetoBasico",
      "anexo",
      "anexoPublicacao",
      "anexoFiscal",
    ]);
    const kind = (n: string) => contratos.fields.find((f) => f.name === n)?.kind;
    expect([kind("dataInicio"), kind("dataTermino"), kind("valorTotal"), kind("objeto"), kind("anexoFiscal")]).toEqual([
      "date",
      "date",
      "money",
      "textarea",
      "file",
    ]);
  });

  it("Alterar um contrato: atualiza e a lista reflete a alteração", async () => {
    await loginAs();
    const criado = await criar({ numeroContrato: "ALT-001" });
    const res = await item.PUT(
      jsonRequest(`/api/contratos/${criado.id}`, "PUT", valido({ numeroContrato: "ALT-001-REV", objeto: "Objeto revisado" })),
      idParams(criado.id),
    );
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/contratos/${criado.id}`), idParams(criado.id))).json();
    expect(lido).toMatchObject({ numeroContrato: "ALT-001-REV", objeto: "Objeto revisado" });
    const lista = await (await collection.GET(jsonRequest("/api/contratos?q=ALT-001-REV"))).json();
    expect(lista.total).toBe(1);
  });

  it("Excluir com confirmação: o contrato some de contratos e da lista", async () => {
    await loginAs();
    const criado = await criar({ numeroContrato: "EXC-001" });
    expect((await item.DELETE(jsonRequest(`/api/contratos/${criado.id}`, "DELETE"), idParams(criado.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/contratos/${criado.id}`), idParams(criado.id))).status).toBe(404);
    expect((await (await collection.GET(jsonRequest("/api/contratos?q=EXC-001"))).json()).total).toBe(0);
  });

  // ------------------------------------------------------------------ Obrigatórios (RK)

  it("Salvar sem tipo: RK-79134600b4be — Informe o tipo de contrato", () => semCampo("tipoContratoId", "Informe o tipo de contrato"));
  it("Salvar sem número do processo: RK-776d8b62d6df — Informe o número do processo", () =>
    semCampo("numeroProcesso", "Informe o número do processo"));
  it("Salvar sem número do contrato: RK-04fd1cbfc346 — Informe o número do contrato", () =>
    semCampo("numeroContrato", "Informe o número do contrato"));
  it("Salvar sem data de início: RK-6b2806cfff8d — Informe a data de início", () => semCampo("dataInicio", "Informe a data de início"));
  it("Salvar sem data de vencimento: RK-9d6599f5897d — Informe a data de vencimento", () =>
    semCampo("dataTermino", "Informe a data de vencimento"));
  it("Salvar sem unidade gestora: RK-a0660a4fb262 — Informe o departamento(unidade gestora)", () =>
    semCampo("departamentoId", "Informe o departamento(unidade gestora)"));
  it("Salvar sem fornecedor: RK-37f294a3dc8e — Informe o fornecedor", () => semCampo("prestadorServicoId", "Informe o fornecedor"));
  it("Objeto obrigatório: RK-879233539305 RK-ee6cd831c2d4 (contratoFields.objeto)", () => semCampo("objeto", "Objeto é obrigatório"));

  // ------------------------------------------------------------------ Valores

  it("Valor em formato brasileiro: RK-5c46553fce3d RK-260f6b933f77 — 1.234,56 grava 1234.56 e a lista exibe R$ 1.234,56", async () => {
    await loginAs();
    const criado = await criar({ numeroContrato: "BRL-001", valorTotal: "1.234,56", valorMensal: "102,88" });
    const gravado = await prisma.contrato.findUniqueOrThrow({ where: { id: criado.id } });
    expect(gravado.valorTotal?.equals(new Prisma.Decimal("1234.56"))).toBe(true);
    expect(gravado.valorMensal?.equals(new Prisma.Decimal("102.88"))).toBe(true);
    const lista = await (await collection.GET(jsonRequest("/api/contratos?q=BRL-001"))).json();
    expect(formatCurrency(lista.items[0].valorTotal)).toBe("R$ 1.234,56");
    // Milhar sem centavos (1.234) é lido como mil duzentos e trinta e quatro.
    const milhar = await criar({ numeroContrato: "BRL-002", valorTotal: "1.234" });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: milhar.id } })).valorTotal?.toFixed(2)).toBe("1234.00");
    // Valor ilegível é rejeitado
    const ruim = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ valorTotal: "abc" })));
    expect(ruim.status).toBe(400);
    expect((await ruim.json()).errors.valorTotal).toBe("Valor total inválido");
  });

  it("Contrato original: RK-c3fbde6dbf4a — sem parentId, valorInicial = valorTotal (120.000,00)", async () => {
    await loginAs();
    const criado = await criar({ numeroContrato: "ORIG-001", valorTotal: "120.000,00" });
    const gravado = await prisma.contrato.findUniqueOrThrow({ where: { id: criado.id } });
    expect(gravado.parentId).toBeNull();
    expect(gravado.valorInicial?.toFixed(2)).toBe("120000.00");
  });

  it("Aditivo: RK-c3fbde6dbf4a — criar aditivo de 30.000,00 não recalcula o valorInicial do original", async () => {
    await loginAs();
    const original = await criar({ numeroContrato: "ORIG-002", valorTotal: "120.000,00" });
    const res = await aditivos.POST(
      jsonRequest(`/api/contratos/${original.id}/aditivos`, "POST", { dataInicio: "01/01/2027", dataTermino: "31/12/2027", valorTotal: "30.000,00" }),
      idParams(original.id),
    );
    expect(res.status).toBe(201);
    const aditivo = await res.json();
    const lidoOriginal = await prisma.contrato.findUniqueOrThrow({ where: { id: original.id } });
    expect(lidoOriginal.valorInicial?.toFixed(2)).toBe("120000.00");
    expect(lidoOriginal.valorTotal?.toFixed(2)).toBe("120000.00");
    const lidoAditivo = await prisma.contrato.findUniqueOrThrow({ where: { id: aditivo.id } });
    expect(lidoAditivo.valorTotal?.toFixed(2)).toBe("30000.00");
    expect(lidoAditivo.valorInicial).toBeNull();
    // Editar o aditivo também não recalcula valorInicial
    await item.PUT(
      jsonRequest(`/api/contratos/${aditivo.id}`, "PUT", valido({ numeroContrato: "ORIG-002", valorTotal: "35.000,00" })),
      idParams(aditivo.id),
    );
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: aditivo.id } })).valorInicial).toBeNull();
  });

  // ------------------------------------------------------------------ Aditivo

  it("Criar aditivo: grava contrato com parentId do original, copia tipo/objeto/unidade/fornecedor e aparece na página do original", async () => {
    await loginAs();
    const original = await criar({ numeroContrato: "ADT-001", objeto: "Objeto do original", tipoContratoId: String(tipo2Id) });
    const res = await aditivos.POST(
      jsonRequest(`/api/contratos/${original.id}/aditivos`, "POST", {
        dataInicio: "01/01/2027",
        dataTermino: "31/12/2027",
        valorMensal: "1.000,00",
        valorTotal: "12.000,00",
      }),
      idParams(original.id),
    );
    expect(res.status).toBe(201);
    const aditivo = await prisma.contrato.findUniqueOrThrow({ where: { id: (await res.json()).id } });
    expect(aditivo).toMatchObject({
      parentId: original.id,
      tipoContratoId: tipo2Id,
      objeto: "Objeto do original",
      departamentoId: deptoId,
      prestadorServicoId: fornecedorId,
    });
    expect(aditivo.dataTermino?.toISOString()).toBe("2027-12-31T00:00:00.000Z");
    const lista = await (await aditivos.GET(jsonRequest(`/api/contratos/${original.id}/aditivos`), idParams(original.id))).json();
    expect(lista.items.map((a: { id: number }) => a.id)).toEqual([aditivo.id]);
    // Página do contrato (detalhe) lista o aditivo
    const { getContratoDetalhe } = await import("@/lib/entities/contratos.server");
    expect((await getContratoDetalhe(original.id))?.contrato.aditivos.map((a) => a.id)).toEqual([aditivo.id]);
    // Validação e corpo estrito no aditivo
    const semData = await aditivos.POST(jsonRequest(`/api/contratos/${original.id}/aditivos`, "POST", { dataTermino: "31/12/2027" }), idParams(original.id));
    expect((await semData.json()).errors.dataInicio).toBe("Informe a data de início");
    const extra = await aditivos.POST(
      jsonRequest(`/api/contratos/${original.id}/aditivos`, "POST", { dataInicio: "01/01/2027", dataTermino: "31/12/2027", parentId: 1 }),
      idParams(original.id),
    );
    expect(extra.status).toBe(400);
    expect((await aditivos.POST(jsonRequest("/api/contratos/999999/aditivos", "POST", {}), idParams(999999))).status).toBe(404);
    expect(contratos.aditivoFields.map((f) => f.name)).toEqual(["dataInicio", "dataTermino", "valorMensal", "valorTotal"]);
  });

  // ------------------------------------------------------------------ Anexos

  it("Anexo que não é PDF: RK-295d296eb4f7 — planilha como publicação mostra a mensagem e nada é gravado", async () => {
    await loginAs();
    const antes = { c: await prisma.contrato.count(), p: await prisma.anexoPublicacao.count(), f: await prisma.anexoFiscal.count() };
    const planilha = new File([new TextEncoder().encode("a;b;c\n1;2;3\n")], "planilha.csv", { type: "text/csv" });
    const res = await collection.POST(multipart("/api/contratos", { ...valido({ numeroContrato: "PDF-ERR" }), anexoPublicacao: planilha }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.anexoPublicacao).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect({ c: await prisma.contrato.count(), p: await prisma.anexoPublicacao.count(), f: await prisma.anexoFiscal.count() }).toEqual(antes);
  });

  it("Anexo fiscal não PDF: RK-b6f82ba63c1f — mesma mensagem, nada gravado", async () => {
    await loginAs();
    const antes = await prisma.contrato.count();
    const png = new File([PNG_BYTES], "foto.pdf", { type: "application/pdf" });
    const res = await collection.POST(multipart("/api/contratos", { ...valido({ numeroContrato: "PDF-ERR2" }), anexoFiscal: png }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.anexoFiscal).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect(await prisma.contrato.count()).toBe(antes);
  });

  it("Anexo do contrato não PDF: RK-ed7bc4aaba15 — Erro ao incluir O arquivo anexo deve ser do tipo PDF!", async () => {
    await loginAs();
    const png = new File([PNG_BYTES], "contrato.png", { type: "image/png" });
    const res = await collection.POST(multipart("/api/contratos", { ...valido({ numeroContrato: "PDF-ERR3" }), anexo: png }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.anexo).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
  });

  it("Anexos PDF no cadastro: RK-295d296eb4f7 RK-b6f82ba63c1f RK-ed7bc4aaba15 — gravados em anexos_publicacao/anexos_fiscais com data do servidor", async () => {
    await loginAs();
    const pdf = (n: string) => new File([PDF_BYTES], n, { type: "application/pdf" });
    const res = await collection.POST(
      multipart("/api/contratos", {
        ...valido({ numeroContrato: "PDF-OK" }),
        anexo: pdf("contrato.pdf"),
        anexoPublicacao: pdf("publicacao.pdf"),
        anexoFiscal: pdf("fiscal.pdf"),
      }),
    );
    expect(res.status).toBe(201);
    const criado = await res.json();
    expect(criado.anexo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(criado).not.toHaveProperty("anexoPublicacao");
    const pub = await prisma.anexoPublicacao.findMany({ where: { contratoId: criado.id } });
    const fis = await prisma.anexoFiscal.findMany({ where: { contratoId: criado.id } });
    expect(pub).toHaveLength(1);
    expect(fis).toHaveLength(1);
    expect(pub[0].anexo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(Math.abs(pub[0].dataPublicacao.getTime() - Date.now())).toBeLessThan(60_000);
    expect(Math.abs(fis[0].dataRegistro.getTime() - Date.now())).toBeLessThan(60_000);
    // Nome de arquivo informado direto no corpo não é aceito.
    const direto = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ anexo: criado.anexo })));
    expect(direto.status).toBe(400);
  });

  // ------------------------------------------------------------------ Lookups

  const lookup = (name: string) => contratos.fields.find((f) => f.name === name);

  it("Escolher um tipo: lookup /api/tipo_contratos (nome) grava o id em tipoContratoId", async () => {
    await loginAs();
    expect(lookup("tipoContratoId")).toMatchObject({ kind: "lookup", lookup: { api: "/api/tipo_contratos", labelField: "nome" } });
    const c = await criar({ numeroContrato: "LK-TIPO", tipoContratoId: String(tipo2Id) });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).tipoContratoId).toBe(tipo2Id);
  });

  it("Escolher uma modalidade: lookup /api/modalidades (nome) grava o id em modalidadeId", async () => {
    await loginAs();
    expect(lookup("modalidadeId")).toMatchObject({ kind: "lookup", lookup: { api: "/api/modalidades", labelField: "nome" } });
    const c = await criar({ numeroContrato: "LK-MOD", modalidadeId: String(modalidadeId) });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).modalidadeId).toBe(modalidadeId);
  });

  it("Escolher a unidade gestora: lookup /api/departamentos (deDepartamento) grava o id em departamentoId", async () => {
    await loginAs();
    expect(lookup("departamentoId")).toMatchObject({ kind: "lookup", lookup: { api: "/api/departamentos", labelField: "deDepartamento" } });
    const c = await criar({ numeroContrato: "LK-DEP", departamentoId: String(depto2Id) });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).departamentoId).toBe(depto2Id);
  });

  it("Escolher o fornecedor: lookup /api/prestadores_servicos (deRazaoSocial) grava o id em prestadorServicoId", async () => {
    await loginAs();
    expect(lookup("prestadorServicoId")).toMatchObject({
      kind: "lookup",
      lookup: { api: "/api/prestadores_servicos", labelField: "deRazaoSocial" },
    });
    const c = await criar({ numeroContrato: "LK-FORN", prestadorServicoId: String(fornecedor2Id) });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).prestadorServicoId).toBe(fornecedor2Id);
  });

  it("Escolher a situação: lookup /api/situacao_contratual (descricao) grava o id em situacaoContratualId", async () => {
    await loginAs();
    expect(lookup("situacaoContratualId")).toMatchObject({ kind: "lookup", lookup: { api: "/api/situacao_contratual", labelField: "descricao" } });
    const c = await criar({ numeroContrato: "LK-SIT", situacaoContratualId: String(situacaoId) });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).situacaoContratualId).toBe(situacaoId);
    // Limpar o campo opcional na edição grava null
    await item.PUT(jsonRequest(`/api/contratos/${c.id}`, "PUT", valido({ situacaoContratualId: "" })), idParams(c.id));
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).situacaoContratualId).toBeNull();
  });

  it("Buscar o gestor: busca em /api/pessoas_fisicas por nome e grava o identificador em pessoaFisicaId/suplenteId", async () => {
    await loginAs();
    expect(lookup("pessoaFisicaId")).toMatchObject({
      kind: "lookup",
      lookup: { api: "/api/pessoas_fisicas", labelField: "deNome", valueField: "idPessoaFisica" },
    });
    expect(lookup("suplenteId")?.lookup).toEqual(lookup("pessoaFisicaId")?.lookup);
    const busca = await (await pessoasFisicas.GET(jsonRequest("/api/pessoas_fisicas?q=Gestora"))).json();
    expect(busca.items).toHaveLength(1);
    const escolhida = String(busca.items[0].idPessoaFisica);
    const c = await criar({ numeroContrato: "LK-GEST", pessoaFisicaId: escolhida, suplenteId: "1002" });
    const gravado = await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } });
    expect(gravado).toMatchObject({ pessoaFisicaId: "1001", suplenteId: "1002" });
    const { getContratoDetalhe } = await import("@/lib/entities/contratos.server");
    expect(await getContratoDetalhe(c.id)).toMatchObject({ gestor: "Maria Gestora", suplente: "João Suplente" });
  });

  it("Integridade das FKs (tasks 1.2): id inexistente em cada lookup responde 409 e parentId inválido é recusado pelo banco", async () => {
    await loginAs();
    const antes = await prisma.contrato.count();
    for (const campo of ["tipoContratoId", "modalidadeId", "departamentoId", "prestadorServicoId", "situacaoContratualId"]) {
      const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ numeroContrato: `FK-${campo}`, [campo]: "999999" })));
      expect(res.status, campo).toBe(409);
    }
    await expect(prisma.contrato.create({ data: { objeto: "FK", parentId: 999999 } })).rejects.toMatchObject({ code: "P2003" });
    expect(await prisma.contrato.count()).toBe(antes);
  });

  // ------------------------------------------------------------------ Segurança

  it("campo fora do schema gera 400 (valorInicial, parentId e dataInclusao não vêm do corpo)", async () => {
    await loginAs();
    for (const extra of [{ valorInicial: "1,00" }, { parentId: 1 }, { dataInclusao: "01/01/2020" }, { periodo: "x" }]) {
      const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido(extra)));
      expect(res.status).toBe(400);
    }
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/contratos"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/contratos", "POST", valido()))).status).toBe(401);
    expect((await item.GET(jsonRequest("/api/contratos/1"), idParams(1))).status).toBe(401);
    expect((await item.PUT(jsonRequest("/api/contratos/1", "PUT", valido()), idParams(1))).status).toBe(401);
    expect((await item.DELETE(jsonRequest("/api/contratos/1", "DELETE"), idParams(1))).status).toBe(401);
    expect((await aditivos.GET(jsonRequest("/api/contratos/1/aditivos"), idParams(1))).status).toBe(401);
    expect((await aditivos.POST(jsonRequest("/api/contratos/1/aditivos", "POST", {}), idParams(1))).status).toBe(401);
  });

  // 024-kit-robustez › crud-kit › "Anexos desfeitos quando a gravação falha"
  it("Segundo anexo inválido na mesma requisição: 400 em anexoPublicacao, nada gravado e UPLOAD_DIR com N arquivos", async () => {
    await loginAs();
    const original = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "contratos-024-"));
    try {
      const antes = await prisma.contrato.count();
      const res = await collection.POST(
        multipart("/api/contratos", {
          ...valido({ numeroContrato: "ANX-024" }),
          anexo: new File([PDF_BYTES], "contrato.pdf", { type: "application/pdf" }),
          anexoPublicacao: new File([PNG_BYTES], "foto.png", { type: "image/png" }),
        }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).errors.anexoPublicacao).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
      expect(await prisma.contrato.count()).toBe(antes);
      expect(readdirSync(uploadDir())).toHaveLength(0);
    } finally {
      rmSync(uploadDir(), { recursive: true, force: true });
      process.env.UPLOAD_DIR = original;
    }
  });
});
