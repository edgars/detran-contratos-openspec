import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
// Páginas com client components (`useRouter`): no teste não há App Router montado.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
  usePathname: () => "/",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensureAdminUser } from "@/lib/auth/seed";
import { MSG_PAGINA_SEM_PERMISSAO, MSG_SEM_PERMISSAO, PERFIS, can, type Perfil } from "@/lib/auth/permissions";
import { uploadDir } from "@/lib/uploads";
import { SemPermissao } from "@/components/sem-permissao";
import * as contratosRoute from "@/app/api/contratos/route";
import * as contratoItem from "@/app/api/contratos/[id]/route";
import * as aditivosRoute from "@/app/api/contratos/[id]/aditivos/route";
import * as historicosRoute from "@/app/api/historicos/route";
import * as fiscaisRoute from "@/app/api/fiscais/route";
import * as anexosFiscaisRoute from "@/app/api/anexos_fiscais/route";
import * as anexosPublicacaosRoute from "@/app/api/anexos_publicacaos/route";
import * as pagamentosRoute from "@/app/api/pagamentos/route";
import * as pagamentoItem from "@/app/api/pagamentos/[id]/route";
import * as prestacaoRoute from "@/app/api/prestacao_contas/route";
import * as vencendoRoute from "@/app/api/relatorios/contratos-vencendo/route";
import * as acertoItem from "@/app/api/relatorios/acerto-valor/[id]/route";
import * as departamentosRoute from "@/app/api/departamentos/route";
import * as prestadoresRoute from "@/app/api/prestadores_servicos/route";
import * as usersRoute from "@/app/api/users/route";
import * as senhaRoute from "@/app/api/conta/senha/route";
import * as meRoute from "@/app/api/auth/me/route";
import * as arquivosRoute from "@/app/api/arquivos/[nome]/route";
import ContratoPage from "@/app/(app)/contratos/[id]/page";
import NovoContratoPage from "@/app/(app)/contratos/new/page";
import PagamentosPage from "@/app/(app)/pagamentos/page";
import EditarPagamentoPage from "@/app/(app)/pagamentos/[id]/edit/page";
import VencendoPage from "@/app/(app)/relatorios/contratos-vencendo/page";
import { PDF_BYTES, idParams, jsonRequest, loginAs, logout, setPerfis } from "./helpers/auth";

// bcrypt custo 12: cada usuário novo leva ~0,3 s.
vi.setConfig({ testTimeout: 30_000 });
// O Vitest compila JSX no modo clássico (React.createElement).
(globalThis as { React?: typeof React }).React = React;

/**
 * 023-perfis-acesso › specs/perfis-acesso/spec.md e specs/security/spec.md: um teste por cenário.
 * Cada perfil isolado tem o seu usuário (`p.<perfil>`), criado por `loginAs(username, [perfil])`.
 */

const como = (perfis: Perfil[], nome?: string) => loginAs(nome ?? `p.${perfis.join("+").toLowerCase()}`, perfis);

let tipoId: number;
let deptoId: number;
let outroDeptoId: number;
let fornecedorId: number;
let faseId: number;
let seq = 0;

const pdf = () => new File([PDF_BYTES], "doc.pdf", { type: "application/pdf" });
function multipart(url: string, method: string, fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request(`http://localhost${url}`, { method, body: form });
}
const uploads = () => (existsSync(uploadDir()) ? readdirSync(uploadDir()) : []);
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

/** Corpo válido de contrato (formulário). */
function contratoValido(extra: Record<string, string> = {}) {
  seq += 1;
  return {
    numeroProcesso: `E-23/${seq}/2026`,
    numeroContrato: `C023-${seq}`,
    tipoContratoId: String(tipoId),
    objeto: "Serviços de vigilância 023",
    departamentoId: String(deptoId),
    prestadorServicoId: String(fornecedorId),
    dataInicio: "01/01/2026",
    dataTermino: "31/12/2026",
    valorMensal: "1.000,00",
    valorTotal: "12.000,00",
    ...extra,
  };
}

async function contratoDireto(data: Record<string, unknown> = {}) {
  seq += 1;
  return prisma.contrato.create({
    data: {
      numeroContrato: `D023-${seq}`,
      numeroProcesso: `P-D023-${seq}`,
      objeto: "Contrato direto 023",
      departamentoId: deptoId,
      prestadorServicoId: fornecedorId,
      tipoContratoId: tipoId,
      dataInicio: new Date(Date.UTC(2026, 0, 1)),
      dataTermino: new Date(Date.UTC(2026, 11, 31)),
      valorTotal: "12000.00",
      valorMensal: "1000.00",
      ...data,
    },
  });
}

const pagamentoValido = (contratoId: number) => ({
  contratoId: String(contratoId),
  competencia: "01/11/2026",
  numeroProcesso: "E-23/PAG/2026",
  ano: "2026",
  valor: "1.234,56",
  mes: "11",
  glosa: "N",
});

describe("023-perfis-acesso", () => {
  const originalUpload = process.env.UPLOAD_DIR;

  beforeAll(async () => {
    process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "perfis-023-"));
    tipoId = (await prisma.tipoContrato.create({ data: { nome: "Serviço 023", gerenciamento: "S" } })).id;
    const diretoria = await prisma.diretoria.create({ data: { deDiretoria: "Diretoria 023", codigo: "D23" } });
    deptoId = (await prisma.departamento.create({ data: { deDepartamento: "Unidade 023 A", diretoriaId: diretoria.id } })).id;
    outroDeptoId = (await prisma.departamento.create({ data: { deDepartamento: "Unidade 023 B", diretoriaId: diretoria.id } })).id;
    fornecedorId = (
      await prisma.prestadorServico.upsert({
        where: { cnpj: "11222333000181" },
        update: {},
        create: { deRazaoSocial: "Fornecedor 023 Ltda", cnpj: "11222333000181" },
      })
    ).id;
    faseId = (await prisma.fase.create({ data: { nome: "Fase 023", periodo: "P" } })).id;
  });

  afterAll(() => {
    rmSync(uploadDir(), { recursive: true, force: true });
    process.env.UPLOAD_DIR = originalUpload;
  });

  // ============================================================ Catálogo de perfis

  describe("Catálogo de perfis", () => {
    it("tem exatamente os cinco perfis decididos pelo autor", () => {
      expect([...PERFIS]).toEqual(["ADMINISTRADOR", "GESTOR_CONTRATO", "FISCAL", "FINANCEIRO", "CONSULTA"]);
    });

    it("Usuário com dois perfis: Fiscal + Financeiro cria um pagamento e depois um anexo fiscal", async () => {
      const c = await contratoDireto();
      await como(["FISCAL", "FINANCEIRO"]);
      const pag = await pagamentosRoute.POST(jsonRequest("/api/pagamentos", "POST", pagamentoValido(c.id)));
      expect(pag.status).toBe(201);
      const anexo = await anexosFiscaisRoute.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(c.id), anexo: pdf() }));
      expect(anexo.status).toBe(201);
    });

    it("Perfil fora do catálogo: SUPERVISOR → 400 no campo perfis e nada é gravado", async () => {
      await como(["ADMINISTRADOR"]);
      const antes = await prisma.user.count();
      const res = await usersRoute.POST(
        jsonRequest("/api/users", "POST", { username: "supervisor.x", password: "Segredo#1", passwordconfirm: "Segredo#1", perfis: ["SUPERVISOR"] }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).errors.perfis).toBeTruthy();
      expect(await prisma.user.count()).toBe(antes);
    });
  });

  // ============================================================ Contratos

  describe("Permissões de contratos", () => {
    it("Gestor não exclui contrato: DELETE → 403 e o contrato continua gravado", async () => {
      const c = await contratoDireto();
      await como(["GESTOR_CONTRATO"]);
      const res = await contratoItem.DELETE(jsonRequest(`/api/contratos/${c.id}`, "DELETE"), idParams(c.id));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe(MSG_SEM_PERMISSAO);
      expect(await prisma.contrato.findUnique({ where: { id: c.id } })).not.toBeNull();
    });

    it("Financeiro não cria aditivo: POST /api/contratos/:id/aditivos → 403 e nenhum aditivo", async () => {
      const c = await contratoDireto();
      await como(["FINANCEIRO"]);
      const res = await aditivosRoute.POST(
        jsonRequest(`/api/contratos/${c.id}/aditivos`, "POST", { dataInicio: "01/01/2027", dataTermino: "31/12/2027" }),
        idParams(c.id),
      );
      expect(res.status).toBe(403);
      expect(await prisma.contrato.count({ where: { parentId: c.id } })).toBe(0);
    });

    it("Gestor anexa projeto básico: edição com PDF válido grava o contrato com o anexo", async () => {
      await como(["ADMINISTRADOR"]);
      const criado = await (await contratosRoute.POST(jsonRequest("/api/contratos", "POST", contratoValido()))).json();
      await como(["GESTOR_CONTRATO"]);
      const res = await contratoItem.PUT(
        multipart(`/api/contratos/${criado.id}`, "PUT", { ...contratoValido({ numeroContrato: criado.numeroContrato }), projetoBasico: pdf() }),
        idParams(criado.id),
      );
      expect(res.status).toBe(200);
      const salvo = await prisma.contrato.findUniqueOrThrow({ where: { id: criado.id } });
      expect(salvo.projetoBasico).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    });
  });

  // ============================================================ Registros do contrato

  describe("Permissões dos registros do contrato", () => {
    it("Fiscal registra andamento: o histórico é gravado", async () => {
      const c = await contratoDireto();
      await como(["FISCAL"]);
      const res = await historicosRoute.POST(jsonRequest("/api/historicos", "POST", { contratoId: String(c.id), descricao: "Vistoria feita" }));
      expect(res.status).toBe(201);
      expect(await prisma.historico.count({ where: { contratoId: c.id } })).toBe(1);
    });

    it("Fiscal não designa fiscal: POST /api/fiscais → 403", async () => {
      await como(["FISCAL"]);
      const antes = await prisma.fiscal.count();
      const res = await fiscaisRoute.POST(jsonRequest("/api/fiscais", "POST", { contratoId: "1", pessoaFisicaCpf: "52998224725", suplente: "N", presidente: "N" }));
      expect(res.status).toBe(403);
      expect(await prisma.fiscal.count()).toBe(antes);
    });

    it("Consulta não vê históricos: GET /api/historicos → 403", async () => {
      await como(["CONSULTA"]);
      expect((await historicosRoute.GET(jsonRequest("/api/historicos"))).status).toBe(403);
    });
  });

  // ============================================================ Anexos

  describe("Permissões de anexos", () => {
    it("Fiscal envia relatório de fiscalização: o anexo fiscal com PDF é gravado", async () => {
      const c = await contratoDireto();
      await como(["FISCAL"]);
      const res = await anexosFiscaisRoute.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(c.id), anexo: pdf() }));
      expect(res.status).toBe(201);
      expect(await prisma.anexoFiscal.count({ where: { contratoId: c.id } })).toBe(1);
    });

    it("Financeiro tenta anexar publicação: 403 e UPLOAD_DIR continua com N arquivos", async () => {
      const c = await contratoDireto();
      await como(["FINANCEIRO"]);
      const n = uploads().length;
      const res = await anexosPublicacaosRoute.POST(
        multipart("/api/anexos_publicacaos", "POST", { contratoId: String(c.id), dataPublicacao: "01/02/2026", anexo: pdf() }),
      );
      expect(res.status).toBe(403);
      expect(uploads()).toHaveLength(n);
      expect(await prisma.anexoPublicacao.count({ where: { contratoId: c.id } })).toBe(0);
    });

    it("Arquivo no corpo exige anexar além de criar: Fiscal (cria históricos, sem anexar) envia PDF → 403 sem gravar arquivo", async () => {
      // Fiscal tem criar em históricos, mas não `anexar`: qualquer arquivo no corpo é recusado antes de gravar.
      const c = await contratoDireto();
      await como(["FISCAL"]);
      const n = uploads().length;
      const res = await historicosRoute.POST(multipart("/api/historicos", "POST", { contratoId: String(c.id), descricao: "x", anexo: pdf() }));
      expect(res.status).toBe(403);
      expect(uploads()).toHaveLength(n);
    });
  });

  // ============================================================ Pagamentos

  describe("Permissões de pagamentos", () => {
    it("Financeiro registra pagamento: o pagamento é gravado", async () => {
      const c = await contratoDireto();
      await como(["FINANCEIRO"]);
      const res = await pagamentosRoute.POST(jsonRequest("/api/pagamentos", "POST", pagamentoValido(c.id)));
      expect(res.status).toBe(201);
      expect(await prisma.pagamento.count({ where: { contratoId: c.id } })).toBe(1);
    });

    it("Gestor não altera pagamento: PUT /api/pagamentos/:id → 403 e o pagamento não muda", async () => {
      const c = await contratoDireto();
      const p = await prisma.pagamento.create({ data: { contratoId: c.id, competencia: new Date(Date.UTC(2026, 0, 1)), numeroProcesso: "ORIGINAL" } });
      await como(["GESTOR_CONTRATO"]);
      const res = await pagamentoItem.PUT(
        jsonRequest(`/api/pagamentos/${p.id}`, "PUT", { ...pagamentoValido(c.id), numeroProcesso: "ALTERADO" }),
        idParams(p.id),
      );
      expect(res.status).toBe(403);
      expect((await prisma.pagamento.findUniqueOrThrow({ where: { id: p.id } })).numeroProcesso).toBe("ORIGINAL");
    });
  });

  // ============================================================ Prestação de contas

  describe("Permissões de prestação de contas", () => {
    it("Gestor grava fase da prestação: a fase é gravada", async () => {
      const c = await contratoDireto();
      await como(["GESTOR_CONTRATO"]);
      const res = await prestacaoRoute.POST(
        jsonRequest("/api/prestacao_contas", "POST", { contratoId: String(c.id), faseId: String(faseId), descricao: "Entregue", atendido: "S" }),
      );
      expect(res.status).toBe(201);
      expect(await prisma.prestacaoConta.count({ where: { contratoId: c.id } })).toBe(1);
    });

    it("Fiscal só consulta a prestação: gravar fase → 403", async () => {
      const c = await contratoDireto();
      await como(["FISCAL"]);
      const res = await prestacaoRoute.POST(
        jsonRequest("/api/prestacao_contas", "POST", { contratoId: String(c.id), faseId: String(faseId), descricao: "x", atendido: "N" }),
      );
      expect(res.status).toBe(403);
      expect(await prisma.prestacaoConta.count({ where: { contratoId: c.id } })).toBe(0);
      expect((await prestacaoRoute.GET(jsonRequest(`/api/prestacao_contas?contratoId=${c.id}`))).status).toBe(200);
    });
  });

  // ============================================================ Relatórios

  describe("Permissões de relatórios", () => {
    it("Consulta não exporta: a tela abre sem Exportar/Imprimir, a API da tela responde 200 e o CSV 403", async () => {
      await como(["CONSULTA"]);
      const html = renderToStaticMarkup(await VencendoPage({ searchParams: Promise.resolve({ dias: "30" }) }));
      expect(texto(html)).toContain("Contratos vencendo");
      expect(html).not.toContain(MSG_PAGINA_SEM_PERMISSAO);
      expect(html).not.toContain("Exportar CSV");
      expect(html).not.toContain("Imprimir / PDF");
      expect((await vencendoRoute.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=30"))).status).toBe(200);
      const csv = await vencendoRoute.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=30&formato=csv"));
      expect(csv.status).toBe(403);
      // Contraprova: Fiscal exporta e vê os botões.
      await como(["FISCAL"]);
      expect((await vencendoRoute.GET(jsonRequest("/api/relatorios/contratos-vencendo?dias=30&formato=csv"))).status).toBe(200);
      expect(renderToStaticMarkup(await VencendoPage({ searchParams: Promise.resolve({ dias: "30" }) }))).toContain("Exportar CSV");
    });

    it("Gestor não acerta valor: PUT do Acerto de valor → 403 e valorInicial não muda", async () => {
      const c = await contratoDireto({ valorInicial: null });
      await como(["GESTOR_CONTRATO"]);
      const res = await acertoItem.PUT(jsonRequest(`/api/relatorios/acerto-valor/${c.id}`, "PUT", { valorInicial: "10.000,00" }), idParams(c.id));
      expect(res.status).toBe(403);
      expect((await prisma.contrato.findUniqueOrThrow({ where: { id: c.id } })).valorInicial).toBeNull();
    });
  });

  // ============================================================ Cadastros, referências, usuários

  describe("Permissões de cadastros e referências", () => {
    it("Gestor não cria departamento: POST /api/departamentos → 403", async () => {
      await como(["GESTOR_CONTRATO"]);
      const res = await departamentosRoute.POST(jsonRequest("/api/departamentos", "POST", { deDepartamento: "Nova", diretoriaId: "1" }));
      expect(res.status).toBe(403);
    });

    it("Dropdown para todos: Consulta em GET /api/prestadores_servicos → 200 com a lista", async () => {
      await como(["CONSULTA"]);
      const res = await prestadoresRoute.GET(jsonRequest("/api/prestadores_servicos"));
      expect(res.status).toBe(200);
      expect(Array.isArray((await res.json()).items)).toBe(true);
    });
  });

  describe("Usuários e perfis só para Administrador", () => {
    it("Gestor tenta abrir usuários: GET /api/users → 403", async () => {
      await como(["GESTOR_CONTRATO"]);
      expect((await usersRoute.GET(jsonRequest("/api/users"))).status).toBe(403);
    });

    it("Consulta troca a própria senha com a senha atual correta", async () => {
      const u = await como(["CONSULTA"], "consulta.senha");
      await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword("Atual#123") } });
      const res = await senhaRoute.POST(
        jsonRequest("/api/conta/senha", "POST", { passwordold: "Atual#123", passwordnew: "Nova#1234", passwordconfirm: "Nova#1234" }),
      );
      expect(res.status).toBe(200);
    });
  });

  // ============================================================ Escopo e visão restrita

  describe("Escopo dos perfis sobre os contratos", () => {
    it("Gestor edita contrato de outra unidade: a gravação é aceita", async () => {
      await como(["ADMINISTRADOR"]);
      const criado = await (await contratosRoute.POST(jsonRequest("/api/contratos", "POST", contratoValido({ departamentoId: String(outroDeptoId) })))).json();
      await como(["GESTOR_CONTRATO"]);
      const res = await contratoItem.PUT(
        jsonRequest(`/api/contratos/${criado.id}`, "PUT", contratoValido({ numeroContrato: criado.numeroContrato, departamentoId: String(outroDeptoId), objeto: "Editado pelo gestor" })),
        idParams(criado.id),
      );
      expect(res.status).toBe(200);
      expect((await prisma.contrato.findUniqueOrThrow({ where: { id: criado.id } })).objeto).toBe("Editado pelo gestor");
    });
  });

  describe("Visão restrita do contrato", () => {
    async function contratoComAnexos() {
      const c = await contratoDireto({ anexo: "11111111-1111-1111-1111-111111111111.pdf", projetoBasico: "22222222-2222-2222-2222-222222222222.pdf", anexoTipo: "PDF" });
      await prisma.anexoPublicacao.create({ data: { contratoId: c.id, anexo: "33333333-3333-3333-3333-333333333333.pdf", dataPublicacao: new Date() } });
      return c;
    }

    it("Consulta abre um contrato: vê número, objeto, vigência e valores, sem anexos, Editar nem Novo aditivo", async () => {
      const c = await contratoComAnexos();
      await como(["CONSULTA"]);
      const html = renderToStaticMarkup(await ContratoPage({ params: Promise.resolve({ id: String(c.id) }) }));
      const t = texto(html);
      expect(t).toContain(`Contrato ${c.numeroContrato}`);
      expect(t).toContain("Contrato direto 023");
      expect(t).toContain("01/01/2026");
      expect(t).toContain("31/12/2026");
      expect(t).toContain("R$ 12.000,00");
      expect(t).not.toContain("Anexos");
      expect(t).not.toContain("Andamento");
      expect(t).not.toContain("Editar");
      expect(t).not.toContain("Novo aditivo");
      expect(html).not.toContain("/api/arquivos/");
      // Contraprova: Fiscal (contratos:ver) vê os anexos, mas não Editar nem Novo aditivo.
      await como(["FISCAL"]);
      const fiscal = texto(renderToStaticMarkup(await ContratoPage({ params: Promise.resolve({ id: String(c.id) }) })));
      expect(fiscal).toContain("Anexos");
      expect(fiscal).not.toContain("Editar");
      expect(fiscal).not.toContain("Novo aditivo");
    });

    it("API do contrato para Consulta: GET /api/contratos/:id e GET /api/contratos sem anexo, anexoTipo nem projetoBasico", async () => {
      const c = await contratoComAnexos();
      await como(["CONSULTA"]);
      const um = await (await contratoItem.GET(jsonRequest(`/api/contratos/${c.id}`), idParams(c.id))).json();
      expect(um).toMatchObject({ id: c.id, numeroContrato: c.numeroContrato, objeto: "Contrato direto 023" });
      const lista = await (await contratosRoute.GET(jsonRequest(`/api/contratos?q=${c.numeroContrato}`))).json();
      expect(lista.items.map((i: { id: number }) => i.id)).toContain(c.id);
      for (const corpo of [um, ...lista.items]) {
        expect(corpo).not.toHaveProperty("anexo");
        expect(corpo).not.toHaveProperty("anexoTipo");
        expect(corpo).not.toHaveProperty("projetoBasico");
      }
    });
  });

  describe("Usuário sem perfil", () => {
    it("Usuário sem perfil abre contratos: GET /api/contratos → 403", async () => {
      await loginAs("sem.perfil", []);
      expect((await contratosRoute.GET(jsonRequest("/api/contratos"))).status).toBe(403);
    });
  });

  // ============================================================ Interface

  describe("Menu e ações conforme as permissões", () => {
    it("Lista sem permissão de criar: Fiscal em /pagamentos sem Novo; o pagamento abre em leitura, sem Salvar nem Excluir", async () => {
      const c = await contratoDireto();
      const p = await prisma.pagamento.create({ data: { contratoId: c.id, competencia: new Date(Date.UTC(2026, 0, 1)), numeroProcesso: "LEITURA" } });
      await como(["FISCAL"]);
      const lista = (await PagamentosPage()) as React.ReactElement<{ canCreate: boolean }>;
      expect(lista.props.canCreate).toBe(false);
      const form = (await EditarPagamentoPage({ params: Promise.resolve({ id: String(p.id) }) })) as React.ReactElement<{
        readOnly: boolean;
        canDelete: boolean;
      }>;
      expect(form.props.readOnly).toBe(true);
      expect(form.props.canDelete).toBe(false);
      const html = renderToStaticMarkup(form);
      expect(html).not.toContain("Salvar pagamento");
      expect(html).not.toContain("Excluir");
      expect(html).toContain("Somente leitura");
      // Contraprova: Financeiro tem o botão Novo e o formulário editável.
      await como(["FINANCEIRO"]);
      expect(((await PagamentosPage()) as React.ReactElement<{ canCreate: boolean }>).props.canCreate).toBe(true);
    });
  });

  describe("Página sem permissão", () => {
    it("Abrir URL de criação sem permissão: Financeiro em /contratos/new vê o aviso e nenhum formulário", async () => {
      await como(["FINANCEIRO"]);
      const el = (await NovoContratoPage()) as React.ReactElement;
      expect(el.type).toBe(SemPermissao);
      const html = renderToStaticMarkup(el);
      expect(html).toContain(MSG_PAGINA_SEM_PERMISSAO);
      expect(html).not.toContain("<form");
    });
  });

  describe("Usuário inicial Administrador", () => {
    it("Primeiro login: com users vazia, o usuário inicial recebe Administrador e abre /users", async () => {
      const env = { u: process.env.ADMIN_USERNAME, p: process.env.ADMIN_PASSWORD };
      process.env.ADMIN_USERNAME = "admin.inicial.023";
      process.env.ADMIN_PASSWORD = "Senha-Inicial-1";
      try {
        // Simula a tabela vazia só nesta chamada; as seguintes usam o count real (o spy não é desfeito:
        // `mockRestore` no delegate do Prisma apaga o método do proxy).
        vi.spyOn(prisma.user, "count").mockResolvedValueOnce(0);
        expect(await ensureAdminUser()).toBe(true);
        const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin.inicial.023" }, include: { perfis: true } });
        expect(admin.perfis.map((p) => p.perfil)).toEqual(["ADMINISTRADOR"]);
        logout();
        await createSession(admin.id);
        expect((await usersRoute.GET(jsonRequest("/api/users"))).status).toBe(200);
      } finally {
        process.env.ADMIN_USERNAME = env.u;
        process.env.ADMIN_PASSWORD = env.p;
        if (env.u === undefined) delete process.env.ADMIN_USERNAME;
        if (env.p === undefined) delete process.env.ADMIN_PASSWORD;
      }
    });
  });

  describe("Permissões do usuário logado", () => {
    it("Consultar as próprias permissões: Financeiro recebe perfis e permissoes, sem campos de senha", async () => {
      await como(["FINANCEIRO"]);
      const res = await meRoute.GET();
      expect(res.status).toBe(200);
      const { user } = await res.json();
      expect(user.perfis).toEqual(["FINANCEIRO"]);
      expect(user.permissoes).toContain("pagamentos:criar");
      expect(user.permissoes).not.toContain("contratos:editar");
      expect(JSON.stringify(user)).not.toMatch(/password/i);
    });
  });
});

// ================================================================ security (023)

describe("023 › security", () => {
  let contratoId: number;
  beforeAll(async () => {
    contratoId = (await prisma.contrato.create({ data: { objeto: "Security 023", numeroContrato: "SEC-023" } })).id;
  });

  describe("Acesso negado responde 403", () => {
    it("Consulta tenta criar contrato: POST com corpo válido → 403 e nenhum contrato gravado", async () => {
      await como(["CONSULTA"]);
      const antes = await prisma.contrato.count();
      const res = await contratosRoute.POST(jsonRequest("/api/contratos", "POST", contratoValido()));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Sem permissão para esta ação" });
      expect(await prisma.contrato.count()).toBe(antes);
    });

    it("Sem sessão continua 401: DELETE /api/contratos/1 sem sessão → 401, não 403", async () => {
      logout();
      expect((await contratoItem.DELETE(jsonRequest("/api/contratos/1", "DELETE"), idParams(1))).status).toBe(401);
    });

    it("Perfil forjado no corpo: Consulta com perfis ['ADMINISTRADOR'] em POST /api/departamentos → 403 e nada gravado", async () => {
      await como(["CONSULTA"]);
      const antes = await prisma.departamento.count();
      const res = await departamentosRoute.POST(
        jsonRequest("/api/departamentos", "POST", { deDepartamento: "Forjado", diretoriaId: "1", perfis: ["ADMINISTRADOR"] }),
      );
      expect(res.status).toBe(403);
      expect(await prisma.departamento.count()).toBe(antes);
    });

    it("Perfil retirado vale na próxima requisição: Financeiro sem o perfil → 403 em POST /api/pagamentos, sem novo login", async () => {
      const u = await como(["FINANCEIRO"], "financeiro.retirado");
      const ok = await pagamentosRoute.POST(jsonRequest("/api/pagamentos", "POST", pagamentoValido(contratoId)));
      expect(ok.status).toBe(201);
      await setPerfis(u.id, ["CONSULTA"]); // o Administrador retira o perfil (efeito no banco)
      const res = await pagamentosRoute.POST(jsonRequest("/api/pagamentos", "POST", pagamentoValido(contratoId)));
      expect(res.status).toBe(403);
    });
  });

  describe("Download de anexo conforme permissão", () => {
    const nomeParams = (nome: string) => ({ params: Promise.resolve({ nome }) });

    it("Consulta tenta baixar o anexo do contrato → 403", async () => {
      const nome = "44444444-4444-4444-4444-444444444444.pdf";
      await prisma.contrato.create({ data: { objeto: "Com anexo 023", anexo: nome } });
      await como(["CONSULTA"]);
      expect((await arquivosRoute.GET(jsonRequest(`/api/arquivos/${nome}`), nomeParams(nome))).status).toBe(403);
      expect(can({ perfis: ["CONSULTA"] }, "contratos_resumo", "ver")).toBe(true); // a visão restrita não basta
    });

    it("Fiscal baixa relatório de fiscalização → 200 application/pdf", async () => {
      await como(["FISCAL"]);
      const res = await anexosFiscaisRoute.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(contratoId), anexo: pdf() }));
      expect(res.status).toBe(201);
      const { anexo } = await res.json();
      const download = await arquivosRoute.GET(jsonRequest(`/api/arquivos/${anexo}`), nomeParams(anexo));
      expect(download.status).toBe(200);
      expect(download.headers.get("content-type")).toBe("application/pdf");
    });

    it("nome que nenhum registro referencia → 404", async () => {
      await como(["ADMINISTRADOR"]);
      const nome = "55555555-5555-5555-5555-555555555555.pdf";
      expect((await arquivosRoute.GET(jsonRequest(`/api/arquivos/${nome}`), nomeParams(nome))).status).toBe(404);
    });
  });
});
