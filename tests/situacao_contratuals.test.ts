import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/situacao_contratuals/route";
import * as item from "@/app/api/situacao_contratuals/[id]/route";
import { situacaoContratuals } from "@/lib/entities/situacao_contratuals";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 014-situacao-contratuals: um teste por cenário + 401. Nenhuma RK nesta change.
describe("014-situacao-contratuals", () => {
  beforeAll(async () => {
    await prisma.situacaoContratual.deleteMany();
    await prisma.situacaoContratual.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ descricao: `Situação ${String(i + 1).padStart(2, "0")}` })),
    });
  });

  it("Abrir a lista: coluna descricao, paginada e com filtro pela busca", async () => {
    await loginAs();
    expect(situacaoContratuals.columns.map((c) => c.key)).toEqual(["descricao"]);
    const page2 = await (await collection.GET(jsonRequest("/api/situacao_contratuals?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0]).toMatchObject({ descricao: "Situação 11" });
    const busca = await (await collection.GET(jsonRequest("/api/situacao_contratuals?q=Situação%2007"))).json();
    expect(busca.total).toBe(1);
  });

  it("Salvar um registro válido: grava e a lista o exibe", async () => {
    await loginAs();
    expect(situacaoContratuals.fields.map((f) => f.name)).toEqual(["descricao"]);
    const res = await collection.POST(jsonRequest("/api/situacao_contratuals", "POST", { descricao: "Registro novo" }));
    expect(res.status).toBe(201);
    const busca = await (await collection.GET(jsonRequest("/api/situacao_contratuals?q=Registro%20novo"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("nenhum campo obrigatório: descricao vazio é gravado como nulo", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/situacao_contratuals", "POST", { descricao: "" }));
    expect(res.status).toBe(201);
    expect((await res.json()).descricao).toBeNull();
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const r = await prisma.situacaoContratual.create({ data: { descricao: "Antigo" } });
    const lido = await (await item.GET(jsonRequest(`/api/situacao_contratuals/${r.id}`), idParams(r.id))).json();
    expect(lido.descricao).toBe("Antigo");
    const res = await item.PUT(jsonRequest(`/api/situacao_contratuals/${r.id}`, "PUT", { descricao: "Revisado" }), idParams(r.id));
    expect(res.status).toBe(200);
    const busca = await (await collection.GET(jsonRequest("/api/situacao_contratuals?q=Revisado"))).json();
    expect(busca.items[0].descricao).toBe("Revisado");
  });

  it("Excluir com confirmação: o registro some; sem confirmar (sem DELETE) nada muda", async () => {
    await loginAs();
    const r = await prisma.situacaoContratual.create({ data: { descricao: "Temporário" } });
    expect(await prisma.situacaoContratual.findUnique({ where: { id: r.id } })).not.toBeNull();
    expect((await item.DELETE(jsonRequest(`/api/situacao_contratuals/${r.id}`, "DELETE"), idParams(r.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/situacao_contratuals/${r.id}`), idParams(r.id))).status).toBe(404);
  });

  it("corpo inválido (campo fora do schema) gera 400", async () => {
    await loginAs();
    expect((await collection.POST(jsonRequest("/api/situacao_contratuals", "POST", { descricao: "X", id: 77 }))).status).toBe(400);
    expect((await collection.POST(jsonRequest("/api/situacao_contratuals", "POST", { descricao: 123 }))).status).toBe(400);
  });

  it("alias /api/situacao_contratual (usado por 017-contratos) usa os mesmos handlers", async () => {
    await loginAs();
    const alias = await import("@/app/api/situacao_contratual/route");
    const aliasItem = await import("@/app/api/situacao_contratual/[id]/route");
    expect(alias.GET).toBe(collection.GET);
    expect(alias.POST).toBe(collection.POST);
    expect(aliasItem.GET).toBe(item.GET);
    expect(aliasItem.PUT).toBe(item.PUT);
    expect(aliasItem.DELETE).toBe(item.DELETE);
    const lista = await (await alias.GET(jsonRequest("/api/situacao_contratual?q=Situa%C3%A7%C3%A3o%2003"))).json();
    expect(lista.items[0].descricao).toBe("Situação 03");
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/situacao_contratuals"))).status).toBe(401);
  });
});
