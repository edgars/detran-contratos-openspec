import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/modalidades/route";
import * as item from "@/app/api/modalidades/[id]/route";
import { modalidades } from "@/lib/entities/modalidades";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 007-modalidades: um teste por cenário + 401. Nenhuma RK nesta change.
describe("007-modalidades", () => {
  beforeAll(async () => {
    await prisma.modalidade.deleteMany();
    await prisma.modalidade.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ nome: `Modalidade ${String(i + 1).padStart(2, "0")}` })),
    });
  });

  it("Abrir a lista: coluna nome, paginada e com filtro pela busca", async () => {
    await loginAs();
    expect(modalidades.columns.map((c) => c.key)).toEqual(["nome"]);
    const page2 = await (await collection.GET(jsonRequest("/api/modalidades?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0]).toMatchObject({ nome: "Modalidade 11" });
    const busca = await (await collection.GET(jsonRequest("/api/modalidades?q=Modalidade%2007"))).json();
    expect(busca.total).toBe(1);
  });

  it("Salvar um registro válido: grava e a lista o exibe", async () => {
    await loginAs();
    expect(modalidades.fields.map((f) => f.name)).toEqual(["nome"]);
    const res = await collection.POST(jsonRequest("/api/modalidades", "POST", { nome: "Registro novo" }));
    expect(res.status).toBe(201);
    const busca = await (await collection.GET(jsonRequest("/api/modalidades?q=Registro%20novo"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("nenhum campo obrigatório: nome vazio é gravado como nulo", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/modalidades", "POST", { nome: "" }));
    expect(res.status).toBe(201);
    expect((await res.json()).nome).toBeNull();
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const r = await prisma.modalidade.create({ data: { nome: "Antigo" } });
    const lido = await (await item.GET(jsonRequest(`/api/modalidades/${r.id}`), idParams(r.id))).json();
    expect(lido.nome).toBe("Antigo");
    const res = await item.PUT(jsonRequest(`/api/modalidades/${r.id}`, "PUT", { nome: "Revisado" }), idParams(r.id));
    expect(res.status).toBe(200);
    const busca = await (await collection.GET(jsonRequest("/api/modalidades?q=Revisado"))).json();
    expect(busca.items[0].nome).toBe("Revisado");
  });

  it("Excluir com confirmação: o registro some; sem confirmar (sem DELETE) nada muda", async () => {
    await loginAs();
    const r = await prisma.modalidade.create({ data: { nome: "Temporário" } });
    expect(await prisma.modalidade.findUnique({ where: { id: r.id } })).not.toBeNull();
    expect((await item.DELETE(jsonRequest(`/api/modalidades/${r.id}`, "DELETE"), idParams(r.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/modalidades/${r.id}`), idParams(r.id))).status).toBe(404);
  });

  it("corpo inválido (campo fora do schema) gera 400", async () => {
    await loginAs();
    expect((await collection.POST(jsonRequest("/api/modalidades", "POST", { nome: "X", id: 77 }))).status).toBe(400);
    expect((await collection.POST(jsonRequest("/api/modalidades", "POST", { nome: 123 }))).status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/modalidades"))).status).toBe(401);
  });
});
