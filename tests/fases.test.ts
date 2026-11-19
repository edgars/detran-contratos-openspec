import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/fases/route";
import * as item from "@/app/api/fases/[id]/route";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 009-fases: um teste por cenário.
describe("009-fases", () => {
  beforeAll(async () => {
    await prisma.fase.deleteMany();
    await prisma.fase.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ nome: `Fase ${String(i + 1).padStart(2, "0")}`, periodo: "mensal" })),
    });
  });

  it("Abrir a lista: paginada, com colunas nome e periodo, e filtro pela busca", async () => {
    await loginAs();
    const page2 = await (await collection.GET(jsonRequest("/api/fases?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0]).toMatchObject({ nome: "Fase 11", periodo: "mensal" });
    const busca = await (await collection.GET(jsonRequest("/api/fases?q=Fase%2007"))).json();
    expect(busca.total).toBe(1);
  });

  it("Salvar um registro válido: grava em fases e a lista o exibe", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fases", "POST", { nome: "Encerramento", periodo: "anual" }));
    expect(res.status).toBe(201);
    const busca = await (await collection.GET(jsonRequest("/api/fases?q=Encerramento"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const fase = await prisma.fase.create({ data: { nome: "Abertura", periodo: "mensal" } });
    const res = await item.PUT(jsonRequest(`/api/fases/${fase.id}`, "PUT", { nome: "Abertura revisada", periodo: "mensal" }), idParams(fase.id));
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/fases/${fase.id}`), idParams(fase.id))).json();
    expect(lido.nome).toBe("Abertura revisada");
  });

  it("Excluir com confirmação: o registro some da lista", async () => {
    await loginAs();
    const fase = await prisma.fase.create({ data: { nome: "Temporária", periodo: "mensal" } });
    expect((await item.DELETE(jsonRequest(`/api/fases/${fase.id}`, "DELETE"), idParams(fase.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/fases/${fase.id}`), idParams(fase.id))).status).toBe(404);
  });

  it("Salvar sem um campo obrigatório: 400 com a mensagem do campo e nada gravado", async () => {
    await loginAs();
    const antes = await prisma.fase.count();
    const res = await collection.POST(jsonRequest("/api/fases", "POST", { nome: "", periodo: "mensal" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.nome).toBe("Nome é obrigatório");
    expect(await prisma.fase.count()).toBe(antes);
  });

  it("campo fora do schema gera 400 (gravação só de campos permitidos)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fases", "POST", { nome: "X", periodo: "Y", id: 999 }));
    expect(res.status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/fases"))).status).toBe(401);
  });
});
