import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/status/route";
import * as item from "@/app/api/status/[id]/route";
import * as csCollection from "@/app/api/contrato_status/route";
import { statusIdField, STATUS_OBRIGATORIO } from "@/lib/entities/status.rules";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 011-status: um teste por cenário + RK + 401.
describe("011-status", () => {
  beforeAll(async () => {
    await prisma.contratoStatus.deleteMany();
    await prisma.status.deleteMany();
    await prisma.status.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ nome: `Status ${String(i + 1).padStart(2, "0")}`, fluxo: "entrada", periodo: i + 1 })),
    });
  });

  it("Abrir a lista: paginada, com colunas nome, fluxo e periodo, e filtro pela busca", async () => {
    await loginAs();
    const page2 = await (await collection.GET(jsonRequest("/api/status?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0]).toMatchObject({ nome: "Status 11", fluxo: "entrada", periodo: 11 });
    const busca = await (await collection.GET(jsonRequest("/api/status?q=Status%2007"))).json();
    expect(busca.total).toBe(1);
    const porPeriodo = await (await collection.GET(jsonRequest("/api/status?q=23"))).json();
    expect(porPeriodo.items.map((s: { periodo: number }) => s.periodo)).toContain(23);
  });

  it("Salvar um registro válido: grava em status e a lista o exibe", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/status", "POST", { nome: "Em análise", fluxo: "saída", periodo: "30" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ nome: "Em análise", fluxo: "saída", periodo: 30 });
    const busca = await (await collection.GET(jsonRequest("/api/status?q=An%C3%A1lise"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("POST rejeita corpo inválido com 400 (período não inteiro, campo fora do schema)", async () => {
    await loginAs();
    const antes = await prisma.status.count();
    const res = await collection.POST(jsonRequest("/api/status", "POST", { nome: "X", periodo: "mensal" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.periodo).toBe("Período deve ser um número inteiro");
    expect((await collection.POST(jsonRequest("/api/status", "POST", { nome: "X", id: 9 }))).status).toBe(400);
    expect(await prisma.status.count()).toBe(antes);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const s = await prisma.status.create({ data: { nome: "Aberto", fluxo: "entrada", periodo: 5 } });
    const res = await item.PUT(jsonRequest(`/api/status/${s.id}`, "PUT", { nome: "Aberto revisado", fluxo: "", periodo: "" }), idParams(s.id));
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/status/${s.id}`), idParams(s.id))).json();
    expect(lido).toMatchObject({ nome: "Aberto revisado", fluxo: null, periodo: null });
  });

  it("Excluir com confirmação: o registro some da lista (cancelar não chama a API)", async () => {
    await loginAs();
    const s = await prisma.status.create({ data: { nome: "Temporário" } });
    expect((await item.DELETE(jsonRequest(`/api/status/${s.id}`, "DELETE"), idParams(s.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/status/${s.id}`), idParams(s.id))).status).toBe(404);
  });

  it("RK-a7017eb6c42d / RK-067d06861847: status_id is required (contrato_status sem status → 400)", async () => {
    await loginAs();
    expect(statusIdField.safeParse(undefined).success).toBe(false);
    expect(statusIdField.safeParse("").success).toBe(false);
    expect(statusIdField.safeParse("3").data).toBe(3);
    const contrato = await prisma.contrato.create({ data: { objeto: "X" } });
    const res = await csCollection.POST(jsonRequest("/api/contrato_status", "POST", { contratoId: String(contrato.id), statusId: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.statusId).toBe(STATUS_OBRIGATORIO);
  });

  it("RK-a7017eb6c42d / RK-067d06861847: Status em uso por contrato_status não pode ser excluído (409)", async () => {
    await loginAs();
    const s = await prisma.status.create({ data: { nome: "Em uso" } });
    const contrato = await prisma.contrato.create({ data: { objeto: "Y" } });
    await prisma.contratoStatus.create({ data: { contratoId: contrato.id, statusId: s.id } });
    expect((await item.DELETE(jsonRequest(`/api/status/${s.id}`, "DELETE"), idParams(s.id))).status).toBe(409);
    expect(await prisma.status.findUnique({ where: { id: s.id } })).not.toBeNull();
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/status"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/status", "POST", { nome: "X" }))).status).toBe(401);
    expect((await item.DELETE(jsonRequest("/api/status/1", "DELETE"), idParams(1))).status).toBe(401);
  });

  // 024-kit-robustez › crud-kit › "Busca em colunas numéricas"
  it("Texto em coluna numérica: q=abc → 200 com os status cujo nome ou fluxo contém abc", async () => {
    await loginAs();
    await prisma.status.create({ data: { nome: "Status abc", fluxo: "saida", periodo: 7 } });
    await prisma.status.create({ data: { nome: "Outro", fluxo: "fluxo abc", periodo: 8 } });
    const res = await collection.GET(jsonRequest("/api/status?q=abc&size=100"));
    expect(res.status).toBe(200);
    const nomes = (await res.json()).items.map((s: { nome: string }) => s.nome).sort();
    expect(nomes).toEqual(["Outro", "Status abc"]);
  });

  it("Número em coluna numérica: q=30 traz o status com periodo 30", async () => {
    await loginAs();
    const s = await prisma.status.create({ data: { nome: "Trinta dias", fluxo: "x", periodo: 30 } });
    const body = await (await collection.GET(jsonRequest("/api/status?q=30&size=100"))).json();
    expect(body.items.map((r: { id: number }) => r.id)).toContain(s.id);
  });
});
