import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
// A página do contrato usa um client component com `useRouter`; no teste não há App Router montado.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
  usePathname: () => "/",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/contratos/route";
import * as item from "@/app/api/contratos/[id]/route";
import * as andamentoApi from "@/app/api/contrato_status/route";
import ContratoPage from "@/app/(app)/contratos/[id]/page";
import { contratos } from "@/lib/entities/contratos";
import { contratosVencendoAte, getContratoDetalhe } from "@/lib/entities/contratos.server";
import { diasAte, vigencia } from "@/lib/contratos/vigencia";
import { formatDate } from "@/lib/format";
import { uploadDir } from "@/lib/uploads";
import { migrationNames } from "./helpers/temp-db";
import { PDF_BYTES, PNG_BYTES, idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 020-contratos-complementos › contratos: um teste por cenário (impressão: marcação da página
// conferida aqui; a pré-visualização do navegador é checagem manual).

let tipoId: number;
let deptoId: number;
let fornecedorId: number;
let statusAnalise: number;
let statusConcluido: number;
let seq = 0;

const PDF_NAME = /^[0-9a-f-]{36}\.pdf$/;
const DAY = 86_400_000;
/** Meia-noite UTC do dia do servidor + `dias` (como a API grava as datas). */
function diaUtc(dias: number) {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) + dias * DAY);
}
const hojeUtc = () => diaUtc(0).getTime();

function valido(extra: Record<string, unknown> = {}) {
  seq += 1;
  return {
    numeroProcesso: `E-20/${seq}/2026`,
    numeroContrato: `C020-${seq}`,
    tipoContratoId: String(tipoId),
    objeto: "Serviços de manutenção predial",
    departamentoId: String(deptoId),
    prestadorServicoId: String(fornecedorId),
    dataInicio: "01/01/2026",
    dataTermino: "31/12/2026",
    ...extra,
  };
}

const pdf = (n = "doc.pdf") => new File([PDF_BYTES], n, { type: "application/pdf" });

function multipart(url: string, method: string, fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request(`http://localhost${url}`, { method, body: form });
}

async function criar(extra: Record<string, unknown> = {}) {
  const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido(extra)));
  expect(res.status).toBe(201);
  return (await res.json()) as { id: number; numeroContrato: string };
}

async function contratoDireto(data: Partial<{ numeroContrato: string; parentId: number; dataInicio: Date; dataTermino: Date; projetoBasico: string; naPresidencia: number; numeroFiscais: string }> = {}) {
  seq += 1;
  return prisma.contrato.create({
    data: { numeroContrato: `D020-${seq}`, numeroProcesso: `P-D020-${seq}`, objeto: "Direto 020", departamentoId: deptoId, prestadorServicoId: fornecedorId, tipoContratoId: tipoId, ...data },
  });
}

// O Vitest compila JSX no modo clássico (React.createElement); o Next usa o automático.
(globalThis as { React?: typeof React }).React = React;

/** Renderiza a página `/contratos/[id]` (server component) em HTML. */
async function renderPagina(id: number) {
  return renderToStaticMarkup(await ContratoPage({ params: Promise.resolve({ id: String(id) }) }));
}
/** Texto visível do HTML (sem tags), com espaços normalizados. */
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

async function del(id: number) {
  return item.DELETE(jsonRequest(`/api/contratos/${id}`, "DELETE"), idParams(id));
}

describe("020-contratos-complementos", () => {
  const originalUpload = process.env.UPLOAD_DIR;

  beforeAll(async () => {
    process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "contratos-020-"));
    tipoId = (await prisma.tipoContrato.create({ data: { nome: "Serviço 020", gerenciamento: "S" } })).id;
    const diretoria = await prisma.diretoria.create({ data: { deDiretoria: "Diretoria 020", codigo: "D20" } });
    deptoId = (await prisma.departamento.create({ data: { deDepartamento: "Unidade 020", diretoriaId: diretoria.id } })).id;
    fornecedorId = (
      await prisma.prestadorServico.upsert({
        where: { cnpj: "11444777000161" },
        update: {},
        create: { deRazaoSocial: "Fornecedor 020 Ltda", cnpj: "11444777000161" },
      })
    ).id;
    statusAnalise = (await prisma.status.create({ data: { nome: "Em análise" } })).id;
    statusConcluido = (await prisma.status.create({ data: { nome: "Concluído" } })).id;
  });

  afterAll(() => {
    rmSync(uploadDir(), { recursive: true, force: true });
    process.env.UPLOAD_DIR = originalUpload;
  });

  // ================================================================ Criar / editar

  it("Salvar um contrato válido: gravado em contratos e a lista o exibe", async () => {
    await loginAs();
    const c = await criar({ numeroFiscais: "2", naPresidencia: "0" });
    expect(await prisma.contrato.findUnique({ where: { id: c.id } })).toMatchObject({ numeroContrato: c.numeroContrato });
    const lista = await (await collection.GET(jsonRequest(`/api/contratos?q=${c.numeroContrato}`))).json();
    expect(lista.items.map((i: { id: number }) => i.id)).toContain(c.id);
  });

  it("Ordem dos campos: numeroFiscais e naPresidencia depois do suplente; projetoBasico é arquivo PDF", () => {
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
      "numeroFiscais",
      "naPresidencia",
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
    const f = (n: string) => contratos.fields.find((x) => x.name === n);
    expect(f("numeroFiscais")).toMatchObject({ label: "Número de fiscais", kind: "masked", mask: "###", section: "Partes e responsáveis" });
    expect(f("naPresidencia")).toMatchObject({ label: "Localizado na Presidência", kind: "toggle", toggleValues: [1, 0], section: "Partes e responsáveis" });
    expect(f("projetoBasico")).toMatchObject({ label: "Projeto básico (PDF)", kind: "file", section: "Documentos" });
  });

  it("Alterar um contrato: atualiza e a lista reflete a alteração", async () => {
    await loginAs();
    const c = await criar();
    const novo = `${c.numeroContrato}-REV`;
    const res = await item.PUT(jsonRequest(`/api/contratos/${c.id}`, "PUT", valido({ numeroContrato: novo, numeroFiscais: "4", naPresidencia: "1" })), idParams(c.id));
    expect(res.status).toBe(200);
    expect(await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ numeroContrato: novo, numeroFiscais: "4", naPresidencia: 1 });
    expect((await (await collection.GET(jsonRequest(`/api/contratos?q=${novo}`))).json()).total).toBe(1);
  });

  // ================================================================ Projeto básico

  it("Enviar o projeto básico: projetoBasico guarda o nome gerado por savePdf()", async () => {
    await loginAs();
    const res = await collection.POST(multipart("/api/contratos", "POST", { ...valido(), projetoBasico: pdf("projeto.pdf") }));
    expect(res.status).toBe(201);
    const c = await res.json();
    expect(c.projetoBasico).toMatch(PDF_NAME);
    expect(existsSync(join(uploadDir(), c.projetoBasico))).toBe(true);
  });

  it("Projeto básico que não é PDF: PNG → 400 'Erro ao incluir O arquivo anexo deve ser do tipo PDF!' e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.contrato.count();
    const png = new File([PNG_BYTES], "planta.png", { type: "image/png" });
    const res = await collection.POST(multipart("/api/contratos", "POST", { ...valido(), projetoBasico: png }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.projetoBasico).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect(await prisma.contrato.count()).toBe(antes);
  });

  it("Projeto básico como texto no corpo: 400 'Envie o arquivo em PDF'", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ projetoBasico: "Projeto em texto livre" })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.projetoBasico).toBe("Envie o arquivo em PDF");
  });

  it("Editar sem trocar o projeto básico: alterar o objeto mantém o mesmo arquivo", async () => {
    await loginAs();
    const body = valido();
    const criado = await (await collection.POST(multipart("/api/contratos", "POST", { ...body, projetoBasico: pdf() }))).json();
    // O formulário não envia o campo de arquivo sem arquivo escolhido; multipart com arquivo vazio também mantém.
    const r1 = await item.PUT(jsonRequest(`/api/contratos/${criado.id}`, "PUT", { ...body, objeto: "Objeto alterado" }), idParams(criado.id));
    expect(r1.status).toBe(200);
    const vazio = new File([], "", { type: "application/octet-stream" });
    const r2 = await item.PUT(multipart(`/api/contratos/${criado.id}`, "PUT", { ...body, objeto: "Objeto alterado 2", projetoBasico: vazio }), idParams(criado.id));
    expect(r2.status).toBe(200);
    const lido = await prisma.contrato.findUniqueOrThrow({ where: { id: criado.id } });
    expect(lido).toMatchObject({ objeto: "Objeto alterado 2", projetoBasico: criado.projetoBasico });
    expect(existsSync(join(uploadDir(), criado.projetoBasico))).toBe(true);
  });

  it("Contrato com projeto básico: página mostra 'Ver PDF' para /api/arquivos/<projetoBasico> em nova aba", async () => {
    await loginAs();
    const nome = "0b5c9e1a-1111-4222-8333-944455556666.pdf";
    const c = await contratoDireto({ projetoBasico: nome });
    const html = await renderPagina(c.id);
    const bloco = html.slice(html.indexOf("Projeto básico</h3>"));
    expect(bloco).toContain(`href="/api/arquivos/${nome}"`);
    expect(bloco.slice(0, bloco.indexOf("</a>"))).toContain('target="_blank"');
    expect(texto(bloco.slice(0, bloco.indexOf("</a>")))).toContain("Ver PDF");
    // "Projeto básico" saiu de Identificação.
    const identificacao = html.slice(html.indexOf('id="sec-identificacao"'), html.indexOf('id="sec-partes"'));
    expect(identificacao).not.toContain("Projeto básico");
  });

  it("Contrato sem projeto básico: o item Projeto básico mostra '—'", async () => {
    await loginAs();
    const c = await contratoDireto();
    const html = await renderPagina(c.id);
    const bloco = html.slice(html.indexOf("Projeto básico</h3>"), html.indexOf("Publicação</h3>"));
    expect(texto(bloco)).toMatch(/Projeto básico —/);
    expect(bloco).not.toContain("/api/arquivos/");
  });

  // ================================================================ Presidência / número de fiscais

  it("Marcar contrato na Presidência: naPresidencia = 1 e a página mostra 'Localizado na Presidência: Sim'", async () => {
    await loginAs();
    const c = await criar({ naPresidencia: "1" });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).naPresidencia).toBe(1);
    expect(texto(await renderPagina(c.id))).toContain("Localizado na Presidência Sim");
  });

  it("Padrão desligado: criar sem mexer no interruptor grava naPresidencia = 0 (página: Não)", async () => {
    await loginAs();
    const c = await criar();
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).naPresidencia).toBe(0);
    expect(texto(await renderPagina(c.id))).toContain("Localizado na Presidência Não");
  });

  it("naPresidencia diferente de 0/1 (2) → 400, nada gravado", async () => {
    await loginAs();
    const antes = await prisma.contrato.count();
    const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ naPresidencia: 2 })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.naPresidencia).toBeTruthy();
    expect(await prisma.contrato.count()).toBe(antes);
  });

  it("Informar o número de fiscais: 3 é gravado e a página mostra 'Número de fiscais: 3'", async () => {
    await loginAs();
    const c = await criar({ numeroFiscais: "3" });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).numeroFiscais).toBe("3");
    expect(texto(await renderPagina(c.id))).toContain("Número de fiscais 3");
    // Vazio vira null; zeros à esquerda saem.
    const outro = await criar({ numeroFiscais: "007" });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: outro.id } })).numeroFiscais).toBe("7");
    const semValor = await criar({ numeroFiscais: "" });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: semValor.id } })).numeroFiscais).toBeNull();
  });

  it("Valor inválido: numeroFiscais 'abc' (e 1000, -1) → 400 'Número de fiscais inválido'", async () => {
    await loginAs();
    for (const v of ["abc", "1000", "-1", "2.5"]) {
      const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ numeroFiscais: v })));
      expect(res.status).toBe(400);
      expect((await res.json()).errors.numeroFiscais).toBe("Número de fiscais inválido");
    }
  });

  // ================================================================ Tamanhos máximos

  it("Número do processo com 46 caracteres: 400 'Nº do processo deve ter no máximo 45 caracteres', nada gravado", async () => {
    await loginAs();
    const antes = await prisma.contrato.count();
    const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ numeroProcesso: "P".repeat(46) })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.numeroProcesso).toBe("Nº do processo deve ter no máximo 45 caracteres");
    expect(await prisma.contrato.count()).toBe(antes);
  });

  it("Limites dos demais campos: contrato 46, modalidade 13 e objeto 201 → 400 com a mensagem do campo (criação e edição)", async () => {
    await loginAs();
    const casos: [string, string, string][] = [
      ["numeroContrato", "C".repeat(46), "Nº do contrato deve ter no máximo 45 caracteres"],
      ["numeroModalidade", "M".repeat(13), "Nº da modalidade deve ter no máximo 12 caracteres"],
      ["objeto", "O".repeat(201), "Objeto deve ter no máximo 200 caracteres"],
    ];
    const existente = await criar();
    for (const [campo, valor, msg] of casos) {
      const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ [campo]: valor })));
      expect(res.status).toBe(400);
      expect((await res.json()).errors[campo]).toBe(msg);
      const upd = await item.PUT(jsonRequest(`/api/contratos/${existente.id}`, "PUT", valido({ [campo]: valor })), idParams(existente.id));
      expect(upd.status).toBe(400);
      expect((await upd.json()).errors[campo]).toBe(msg);
    }
    // Contado depois do trim: 45 caracteres com espaços nas pontas é aceito.
    const res = await collection.POST(jsonRequest("/api/contratos", "POST", valido({ numeroProcesso: `  ${"P".repeat(45)}  ` })));
    expect(res.status).toBe(201);
  });

  it("Objeto no limite: 200 caracteres é gravado", async () => {
    await loginAs();
    const objeto = "O".repeat(200);
    const c = await criar({ objeto });
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).objeto).toBe(objeto);
  });

  it("Limite no formulário: maxlength 45 em processo e contrato, 200 em objeto e 12 em nº da modalidade", () => {
    const max = (n: string) => contratos.fields.find((f) => f.name === n)?.maxLength;
    expect([max("numeroProcesso"), max("numeroContrato"), max("objeto"), max("numeroModalidade")]).toEqual([45, 45, 200, 12]);
  });

  // ================================================================ Impressão

  it("Imprimir um contrato: botão Imprimir; botões, formulário de andamento ocultos na impressão; seções impressas", async () => {
    await loginAs("maria");
    const c = await contratoDireto();
    const html = await renderPagina(c.id);
    // Botões da página (Editar, Imprimir, Novo aditivo) num bloco print:hidden; formulário de andamento também.
    const acoes = html.match(/<div class="[^"]*print:hidden[^"]*">(<a[^>]*href="\/contratos\/\d+\/edit".*?)<\/div>/)?.[1] ?? "";
    expect(texto(acoes)).toMatch(/Editar Imprimir Novo aditivo/);
    expect(html).toMatch(/<form[^>]*class="[^"]*print:hidden/);
    // Seções do contrato não são ocultadas na impressão.
    for (const sec of ["sec-identificacao", "sec-partes", "sec-vigencia", "sec-aditivos", "sec-anexos", "sec-andamento"]) {
      const tag = html.match(new RegExp(`<section aria-labelledby="${sec}"[^>]*>`))?.[0];
      expect(tag).toBeTruthy();
      expect(tag).not.toContain("print:hidden");
    }
  });

  it("Cabeçalho na folha impressa: 'DETRAN-RJ — Contrato nº 001/2026' e 'Impresso em <data e hora> por maria', oculto na tela", async () => {
    await loginAs("maria");
    await prisma.contrato.deleteMany({ where: { numeroContrato: "001/2026", objeto: "Direto 020" } });
    const c = await contratoDireto({ numeroContrato: "001/2026" });
    const html = await renderPagina(c.id);
    const m = html.match(/<div class="hidden [^"]*print:block[^"]*">(.*?)<\/div>/);
    expect(m).not.toBeNull();
    const cab = texto(m![1]);
    expect(cab).toContain("DETRAN-RJ — Contrato nº 001/2026");
    expect(cab).toMatch(/Impresso em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por maria/);
    expect(cab).toContain(`Impresso em ${formatDate(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())))}`);
    // É o primeiro bloco da página.
    expect(html.indexOf("DETRAN-RJ — Contrato nº")).toBeLessThan(html.indexOf("<h1"));
  });

  // ================================================================ Andamento

  it("Registrar um andamento: grava contratoId, statusId 'Em análise', atendido 1, data do servidor e usuário da sessão; aparece no topo", async () => {
    const user = await loginAs("maria");
    const c = await contratoDireto();
    await prisma.contratoStatus.create({ data: { contratoId: c.id, statusId: statusConcluido, dataInclusao: new Date(Date.now() - DAY), atendido: 0 } });
    const res = await andamentoApi.POST(
      jsonRequest("/api/contrato_status", "POST", { contratoId: c.id, statusId: String(statusAnalise), descricao: "Enviado ao jurídico", atendido: 1 }),
    );
    expect(res.status).toBe(201);
    const row = await prisma.contratoStatus.findFirstOrThrow({ where: { contratoId: c.id, statusId: statusAnalise } });
    expect(row).toMatchObject({ contratoId: c.id, statusId: statusAnalise, atendido: 1, usuarioId: user.id, descricao: "Enviado ao jurídico" });
    expect(Math.abs((row.dataInclusao?.getTime() ?? 0) - Date.now())).toBeLessThan(60_000);
    const detalhe = await getContratoDetalhe(c.id);
    expect(detalhe!.andamentos[0]).toMatchObject({ id: row.id, status: "Em análise", atendido: true, usuario: "maria" });
    // A página traz o formulário e a linha do tempo (o formulário chama router.refresh() após gravar).
    const html = await renderPagina(c.id);
    expect(texto(html)).toContain("Registrar andamento");
    expect(texto(html).indexOf("Enviado ao jurídico")).toBeLessThan(texto(html).indexOf("Concluído"));
  });

  it("Andamento sem status: 400, 'Status é obrigatório' no campo e nada gravado", async () => {
    await loginAs();
    const c = await contratoDireto();
    const res = await andamentoApi.POST(jsonRequest("/api/contrato_status", "POST", { contratoId: c.id, statusId: "", descricao: "x", atendido: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.statusId).toBe("Status é obrigatório");
    expect(await prisma.contratoStatus.count({ where: { contratoId: c.id } })).toBe(0);
  });

  it("Ver a linha do tempo: 05/10/2026 antes de 01/10/2026, com status, situação, descrição e usuário; outros contratos não aparecem", async () => {
    const user = await loginAs("maria");
    const c = await contratoDireto();
    const outro = await contratoDireto();
    await prisma.contratoStatus.createMany({
      data: [
        { contratoId: c.id, statusId: statusAnalise, dataInclusao: new Date(2026, 9, 1, 9, 30), descricao: "Primeiro", atendido: 0, usuarioId: user.id },
        { contratoId: c.id, statusId: statusConcluido, dataInclusao: new Date(2026, 9, 5, 14, 5), descricao: "Segundo", atendido: 1, usuarioId: user.id },
        { contratoId: outro.id, statusId: statusAnalise, dataInclusao: new Date(2026, 9, 3), descricao: "De outro contrato", atendido: 0 },
      ],
    });
    const { andamentos } = (await getContratoDetalhe(c.id))!;
    expect(andamentos.map((a) => [a.descricao, a.status, a.atendido, a.usuario])).toEqual([
      ["Segundo", "Concluído", true, "maria"],
      ["Primeiro", "Em análise", false, "maria"],
    ]);
    const t = texto(await renderPagina(c.id));
    expect(t).toContain("Concluído Atendido Segundo 05/10/2026 14:05 · maria");
    expect(t).toContain("Em análise Pendente Primeiro 01/10/2026 09:30 · maria");
    expect(t.indexOf("05/10/2026 14:05")).toBeLessThan(t.indexOf("01/10/2026 09:30"));
    expect(t).not.toContain("De outro contrato");
  });

  it("Contrato sem andamento: 'Nenhum andamento registrado.'", async () => {
    await loginAs();
    const c = await contratoDireto();
    expect((await getContratoDetalhe(c.id))!.andamentos).toEqual([]);
    expect(texto(await renderPagina(c.id))).toContain("Nenhum andamento registrado.");
  });

  // ================================================================ Vigência

  it("vigencia/diasAte: vencido, vence hoje, vence em N ≤ 60, vigente e a iniciar (datas do próprio registro)", () => {
    const now = new Date(2026, 10, 14, 15, 0);
    const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
    expect(diasAte(d(2026, 11, 24), now)).toBe(10);
    expect(vigencia(d(2026, 1, 1), d(2026, 11, 4), now)).toMatchObject({ estado: "vencido", texto: "Vencido em 04/11/2026" });
    expect(vigencia(d(2026, 1, 1), d(2026, 11, 14), now)).toMatchObject({ estado: "vence-hoje", texto: "Vence hoje" });
    expect(vigencia(d(2026, 1, 1), d(2026, 11, 15), now)).toMatchObject({ estado: "vencendo", texto: "Vence em 1 dia" });
    expect(vigencia(d(2026, 1, 1), d(2027, 1, 13), now)).toMatchObject({ estado: "vencendo", texto: "Vence em 60 dias" });
    expect(vigencia(d(2026, 1, 1), d(2027, 1, 14), now)).toMatchObject({ estado: "vigente", texto: "Vigente" });
    expect(vigencia(d(2026, 12, 1), d(2027, 12, 1), now)).toMatchObject({ estado: "a-iniciar", texto: "Inicia em 01/12/2026" });
    expect(vigencia(null, null, now)).toBeNull();
  });

  it("Contrato vencido com aditivo posterior: selo 'Vencido em <dataTermino do contrato>', vigência até ela e sem 'Vencimento com aditivos'", async () => {
    await loginAs();
    const c = await contratoDireto({ dataInicio: diaUtc(-400), dataTermino: diaUtc(-10) });
    await contratoDireto({ parentId: c.id, dataInicio: diaUtc(-9), dataTermino: diaUtc(200) });
    const { contrato } = (await getContratoDetalhe(c.id))!;
    expect(vigencia(contrato.dataInicio, contrato.dataTermino)).toMatchObject({ estado: "vencido", texto: `Vencido em ${formatDate(diaUtc(-10))}` });
    const t = texto(await renderPagina(c.id));
    expect(t).toContain(`Vencido em ${formatDate(diaUtc(-10))}`);
    expect(t).toContain(`Vigência ${formatDate(diaUtc(-400))} a ${formatDate(diaUtc(-10))}`);
    expect(t).not.toContain("Vencimento com aditivos");
    // O aditivo mantém as próprias datas na tabela de aditivos.
    expect(t).toContain(formatDate(diaUtc(200)));
  });

  // ================================================================ Painel Início

  it("Painel Início ignora o aditivo: vencido há 10 dias com aditivo em +200 aparece em Vencidos ('Há 10 dias')", async () => {
    const c = await contratoDireto({ dataTermino: diaUtc(-10) });
    const aditivo = await contratoDireto({ parentId: c.id, dataTermino: diaUtc(200) });
    const linhas = await contratosVencendoAte(diaUtc(30), hojeUtc());
    const linha = linhas.find((l) => l.id === c.id);
    expect(linha).toMatchObject({ dias: -10 });
    expect(linha!.vencimento.getTime()).toBe(diaUtc(-10).getTime());
    expect(linhas.some((l) => l.id === aditivo.id)).toBe(false);
    // A página classifica dias < 0 como "Vencidos" e dias ≥ 0 como "Vencendo".
    const home = readFileSync("src/app/(app)/page.tsx", "utf8");
    expect(home).toContain("l.dias < 0");
    expect(home).toContain('return `Há ${-dias} dias`');
  });

  it("Contrato vencendo com aditivo: vence em 20 dias com aditivo em +400 aparece em 'Vencendo' com 'Em 20 dias'", async () => {
    const c = await contratoDireto({ dataTermino: diaUtc(20) });
    await contratoDireto({ parentId: c.id, dataTermino: diaUtc(400) });
    const linha = (await contratosVencendoAte(diaUtc(30), hojeUtc())).find((l) => l.id === c.id);
    expect(linha).toMatchObject({ dias: 20 });
  });

  // ================================================================ Exclusão

  it("Excluir com confirmação: sem vínculos, o contrato some de contratos e da lista", async () => {
    await loginAs();
    const c = await criar();
    expect((await del(c.id)).status).toBe(204);
    expect(await prisma.contrato.findUnique({ where: { id: c.id } })).toBeNull();
    expect((await (await collection.GET(jsonRequest(`/api/contratos?q=${c.numeroContrato}`))).json()).total).toBe(0);
  });

  it("Contrato com aditivo e pagamento: 409 'Não é possível excluir o contrato: há 2 aditivos, 1 pagamento vinculados. Exclua-os antes.' e nada é apagado", async () => {
    await loginAs();
    const c = await contratoDireto();
    await contratoDireto({ parentId: c.id });
    await contratoDireto({ parentId: c.id });
    await prisma.pagamento.create({ data: { contratoId: c.id, competencia: new Date(), numeroProcesso: "PG-020" } });
    await prisma.contratoStatus.create({ data: { contratoId: c.id, statusId: statusAnalise } });
    const res = await del(c.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Não é possível excluir o contrato: há 2 aditivos, 1 pagamento vinculados. Exclua-os antes.");
    expect(await prisma.contrato.count({ where: { OR: [{ id: c.id }, { parentId: c.id }] } })).toBe(3);
    expect(await prisma.pagamento.count({ where: { contratoId: c.id } })).toBe(1);
    expect(await prisma.contratoStatus.count({ where: { contratoId: c.id } })).toBe(1);
  });

  it("Contrato com prestação de contas: 409 'há 1 prestação de contas vinculados' e nada é apagado", async () => {
    const user = await loginAs();
    const c = await contratoDireto();
    await prisma.prestacaoConta.create({ data: { contratoId: c.id, faseId: 1, userId: user.id } });
    const res = await del(c.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Não é possível excluir o contrato: há 1 prestação de contas vinculados. Exclua-os antes.");
    expect(await prisma.contrato.findUnique({ where: { id: c.id } })).not.toBeNull();
  });

  it("Penalidades bloqueiam: 2 penalidades e 3 prestações → 'há 2 penalidades, 3 prestações de contas vinculados'", async () => {
    const user = await loginAs();
    const c = await contratoDireto();
    await prisma.penalidade.createMany({ data: [1, 2].map(() => ({ contratoId: c.id, userId: user.id, dataRegistro: new Date() })) });
    await prisma.prestacaoConta.createMany({ data: [1, 2, 3].map(() => ({ contratoId: c.id, faseId: 1, userId: user.id })) });
    const res = await del(c.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Não é possível excluir o contrato: há 2 penalidades, 3 prestações de contas vinculados. Exclua-os antes.");
    expect(await prisma.penalidade.count({ where: { contratoId: c.id } })).toBe(2);
  });

  it("Anexos excluídos junto: sem linhas em anexos_publicacao, anexos_fiscais, contrato_status, historicos e fiscais e os quatro PDFs fora do disco", async () => {
    const user = await loginAs();
    const res = await collection.POST(
      multipart("/api/contratos", "POST", {
        ...valido(),
        anexo: pdf("contrato.pdf"),
        projetoBasico: pdf("projeto.pdf"),
        anexoPublicacao: pdf("publicacao.pdf"),
        anexoFiscal: pdf("fiscal.pdf"),
      }),
    );
    expect(res.status).toBe(201);
    const c = await res.json();
    const pub = await prisma.anexoPublicacao.findFirstOrThrow({ where: { contratoId: c.id } });
    const fis = await prisma.anexoFiscal.findFirstOrThrow({ where: { contratoId: c.id } });
    await prisma.contratoStatus.create({ data: { contratoId: c.id, statusId: statusAnalise, usuarioId: user.id } });
    await prisma.historico.create({ data: { contratoId: c.id, descricao: "Histórico 020" } });
    await prisma.fiscal.create({ data: { contratoId: c.id, pessoaFisicaCpf: "52998224725", suplente: "N", presidente: "N" } });
    const arquivos = [c.anexo, c.projetoBasico, pub.anexo, fis.anexo];
    for (const a of arquivos) expect(existsSync(join(uploadDir(), a))).toBe(true);

    expect((await del(c.id)).status).toBe(204);
    const where = { where: { contratoId: c.id } };
    expect([
      await prisma.anexoPublicacao.count(where),
      await prisma.anexoFiscal.count(where),
      await prisma.contratoStatus.count(where),
      await prisma.historico.count(where),
      await prisma.fiscal.count(where),
      await prisma.contrato.count({ where: { id: c.id } }),
    ]).toEqual([0, 0, 0, 0, 0, 0]);
    for (const a of arquivos) expect(existsSync(join(uploadDir(), a))).toBe(false);
  });

  it("Exclusão: 404 para id inexistente e 401 sem sessão", async () => {
    await loginAs();
    expect((await del(99999999)).status).toBe(404);
    logout();
    const c = await contratoDireto();
    expect((await del(c.id)).status).toBe(401);
    expect(await prisma.contrato.findUnique({ where: { id: c.id } })).not.toBeNull();
  });

  // ================================================================ Migração de dados

  it("Migração 020: zera projetoBasico em texto livre e mantém nome gerado por savePdf", async () => {
    const pasta = migrationNames().find((n) => n.endsWith("_020_contratos_complementos"));
    expect(pasta).toBeTruthy();
    const sql = readFileSync(join("prisma/migrations", pasta!, "migration.sql"), "utf8")
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n");
    const valido = "0b5c9e1a-1111-4222-8333-944455556666.pdf";
    const livre = await contratoDireto();
    const pdfNome = await contratoDireto();
    await prisma.$executeRaw`UPDATE contratos SET projetoBasico = 'texto livre' WHERE id = ${livre.id}`;
    await prisma.$executeRaw`UPDATE contratos SET projetoBasico = ${valido} WHERE id = ${pdfNome.id}`;
    await prisma.$executeRawUnsafe(sql);
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: livre.id } })).projetoBasico).toBeNull();
    expect((await prisma.contrato.findUniqueOrThrow({ where: { id: pdfNome.id } })).projetoBasico).toBe(valido);
  });
});
