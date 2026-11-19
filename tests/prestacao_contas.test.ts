import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/prestacao_contas/route";
import * as item from "@/app/api/prestacao_contas/[id]/route";
import { prestacaoContas } from "@/lib/entities/prestacao_contas";
import { PRESTACAO_MSG } from "@/lib/entities/prestacao_contas.server";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

vi.setConfig({ testTimeout: 30_000 });

let faseId: number;
let contratoId: number;

// Spec 008-prestacao-contas: um teste por cenário + autoria + 401.
describe("008-prestacao-contas", () => {
  beforeAll(async () => {
    faseId = (await prisma.fase.create({ data: { nome: "Execução", periodo: "mensal" } })).id;
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato PC", numeroContrato: "PC-001" } })).id;
    const autor = await loginAs("autor.pc");
    await prisma.prestacaoConta.deleteMany();
    await prisma.prestacaoConta.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        descricao: `Prestação ${String(i + 1).padStart(2, "0")}`,
        atendido: i % 2 ? "S" : "N",
        faseId,
        contratoId,
        userId: autor.id,
      })),
    });
  });

  it("Abrir a lista: colunas descricao e atendido, paginada, com busca", async () => {
    expect(prestacaoContas.columns.map((c) => c.key)).toEqual(["descricao", "atendido"]);
    await loginAs();
    const page2 = await (await collection.GET(jsonRequest("/api/prestacao_contas?q=Presta&page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0]).toHaveProperty("descricao");
    expect(page2.items[0]).toHaveProperty("atendido");
    const busca = await (await collection.GET(jsonRequest("/api/prestacao_contas?q=Presta%C3%A7%C3%A3o%2007"))).json();
    expect(busca.total).toBe(1);
  });

  it("formulário: descricao, atendido (toggle S/N) e lookups obrigatórios de fase e contrato", () => {
    expect(prestacaoContas.fields.map((f) => f.name)).toEqual(["descricao", "atendido", "faseId", "contratoId"]);
    expect(prestacaoContas.fields.find((f) => f.name === "atendido")?.kind).toBe("toggle");
    expect(prestacaoContas.fields.find((f) => f.name === "faseId")?.lookup).toEqual({ api: "/api/fases", labelField: "nome" });
    expect(prestacaoContas.fields.find((f) => f.name === "contratoId")?.lookup).toEqual({
      api: "/api/contratos",
      labelField: "numeroContrato",
    });
    expect(prestacaoContas.fields.some((f) => f.name === "userId" || f.name === "dataInclusao")).toBe(false);
  });

  it("Salvar um registro válido: grava com userId da sessão e dataInclusao do servidor; a lista o exibe", async () => {
    const eu = await loginAs("operador.pc");
    const res = await collection.POST(
      jsonRequest("/api/prestacao_contas", "POST", { descricao: "Relatório mensal", atendido: "S", faseId: String(faseId), contratoId: String(contratoId) }),
    );
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row).toMatchObject({ descricao: "Relatório mensal", atendido: "S", faseId, contratoId, userId: eu.id });
    expect(row.dataInclusao).toBeTruthy();
    const busca = await (await collection.GET(jsonRequest("/api/prestacao_contas?q=Relat%C3%B3rio%20mensal"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Autoria forjada: userId e dataInclusao do corpo são ignorados", async () => {
    const outro = await loginAs("outro.pc");
    const eu = await loginAs("operador.pc");
    const res = await collection.POST(
      jsonRequest("/api/prestacao_contas", "POST", {
        descricao: "Forjada",
        faseId,
        contratoId,
        userId: outro.id,
        dataInclusao: "2000-01-01T00:00:00.000Z",
      }),
    );
    expect(res.status).toBe(201);
    const salvo = await prisma.prestacaoConta.findFirstOrThrow({ where: { descricao: "Forjada" } });
    expect(salvo.userId).toBe(eu.id);
    expect(salvo.dataInclusao!.getFullYear()).not.toBe(2000);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    const eu = await loginAs();
    const pc = await prisma.prestacaoConta.create({ data: { descricao: "Antes", atendido: "N", faseId, contratoId, userId: eu.id } });
    const res = await item.PUT(
      jsonRequest(`/api/prestacao_contas/${pc.id}`, "PUT", { descricao: "Depois", atendido: "S", faseId, contratoId }),
      idParams(pc.id),
    );
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/prestacao_contas/${pc.id}`), idParams(pc.id))).json();
    expect(lido).toMatchObject({ descricao: "Depois", atendido: "S" });
  });

  it("Excluir com confirmação: o registro some da lista", async () => {
    const eu = await loginAs();
    const pc = await prisma.prestacaoConta.create({ data: { descricao: "Temporária PC", faseId, contratoId, userId: eu.id } });
    expect((await item.DELETE(jsonRequest(`/api/prestacao_contas/${pc.id}`, "DELETE"), idParams(pc.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/prestacao_contas/${pc.id}`), idParams(pc.id))).status).toBe(404);
  });

  it("corpo inválido gera 400: sem fase/contrato, atendido fora de S/N, campo extra, ids inexistentes", async () => {
    await loginAs();
    const antes = await prisma.prestacaoConta.count();
    const semLookups = await collection.POST(jsonRequest("/api/prestacao_contas", "POST", { descricao: "X" }));
    expect(semLookups.status).toBe(400);
    expect((await semLookups.json()).errors).toMatchObject({ faseId: PRESTACAO_MSG.fase, contratoId: PRESTACAO_MSG.contrato });
    const atendido = await collection.POST(jsonRequest("/api/prestacao_contas", "POST", { atendido: "talvez", faseId, contratoId }));
    expect(atendido.status).toBe(400);
    const extra = await collection.POST(jsonRequest("/api/prestacao_contas", "POST", { faseId, contratoId, outro: 1 }));
    expect(extra.status).toBe(400);
    const inexistente = await collection.POST(jsonRequest("/api/prestacao_contas", "POST", { faseId: 99999, contratoId: 99999 }));
    expect(inexistente.status).toBe(400);
    expect((await inexistente.json()).errors).toMatchObject({
      faseId: PRESTACAO_MSG.faseInexistente,
      contratoId: PRESTACAO_MSG.contratoInexistente,
    });
    expect(await prisma.prestacaoConta.count()).toBe(antes);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/prestacao_contas"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/prestacao_contas", "POST", { faseId, contratoId }))).status).toBe(401);
  });
});
