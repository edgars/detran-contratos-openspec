import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/tipo_contratos/route";
import * as item from "@/app/api/tipo_contratos/[id]/route";
import { tipoContratos } from "@/lib/entities/tipo_contratos";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 003-tipo-contratos: um teste por cenário + RK + 401.
describe("003-tipo-contratos", () => {
  beforeAll(async () => {
    await prisma.tipoContrato.deleteMany();
    await prisma.tipoContrato.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        nome: `Tipo ${String(i + 1).padStart(2, "0")}`,
        gerenciamento: i % 2 === 0 ? "S" : "N",
      })),
    });
  });

  it("Abrir a lista: colunas nome e gerenciamento, paginada e com filtro pela busca", async () => {
    await loginAs();
    expect(tipoContratos.columns.map((c) => c.key)).toEqual(["nome", "gerenciamento"]);
    const page2 = await (await collection.GET(jsonRequest("/api/tipo_contratos?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0]).toMatchObject({ nome: "Tipo 11", gerenciamento: "S" });
    const busca = await (await collection.GET(jsonRequest("/api/tipo_contratos?q=Tipo%2007"))).json();
    expect(busca.total).toBe(1);
    const gerenciados = await (await collection.GET(jsonRequest("/api/tipo_contratos?gerenciamento=S"))).json();
    expect(gerenciados.total).toBe(13);
  });

  it("Salvar um registro válido: grava em tipo_contrato (indicativoMetaRisco default N) e a lista o exibe", async () => {
    await loginAs();
    expect(tipoContratos.fields.map((f) => f.name)).toEqual(["nome", "gerenciamento"]);
    expect(tipoContratos.fields[1]).toMatchObject({ kind: "toggle", toggleValues: ["S", "N"] });
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Prestação de serviço", gerenciamento: "S" }));
    expect(res.status).toBe(201);
    const criado = await res.json();
    expect(criado).toMatchObject({ gerenciamento: "S", indicativoMetaRisco: "N" });
    const busca = await (await collection.GET(jsonRequest("/api/tipo_contratos?q=Presta%C3%A7%C3%A3o"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const t = await prisma.tipoContrato.create({ data: { nome: "Obra", gerenciamento: "N" } });
    const lido = await (await item.GET(jsonRequest(`/api/tipo_contratos/${t.id}`), idParams(t.id))).json();
    expect(lido).toMatchObject({ nome: "Obra", gerenciamento: "N" });
    const res = await item.PUT(jsonRequest(`/api/tipo_contratos/${t.id}`, "PUT", { nome: "Obra civil", gerenciamento: "S" }), idParams(t.id));
    expect(res.status).toBe(200);
    const busca = await (await collection.GET(jsonRequest("/api/tipo_contratos?q=Obra%20civil"))).json();
    expect(busca.items[0]).toMatchObject({ nome: "Obra civil", gerenciamento: "S" });
  });

  it("Excluir com confirmação: o registro some; sem confirmar (sem DELETE) nada muda", async () => {
    await loginAs();
    const t = await prisma.tipoContrato.create({ data: { nome: "Temporário", gerenciamento: "N" } });
    expect(await prisma.tipoContrato.findUnique({ where: { id: t.id } })).not.toBeNull();
    expect((await item.DELETE(jsonRequest(`/api/tipo_contratos/${t.id}`, "DELETE"), idParams(t.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/tipo_contratos/${t.id}`), idParams(t.id))).status).toBe(404);
  });

  it("Salvar sem um campo obrigatório (RK-2509b78bd0e0 RK-4564e4e322b6): gerenciamento vazio gera 400 e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.tipoContrato.count();
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Sem gerenciamento", gerenciamento: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.gerenciamento).toBe("Gerenciamento é obrigatório");
    expect(await prisma.tipoContrato.count()).toBe(antes);
    expect(tipoContratos.fields.find((f) => f.name === "gerenciamento")?.required).toBe(true);
  });

  it("gerenciamento só aceita S/N (toggle)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "X", gerenciamento: "talvez" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.gerenciamento).toBeDefined();
  });

  it("RK-82de63b47e64: nome vazio gera 400 com 'Por favor,Preencher o campo NOME !'", async () => {
    await loginAs();
    const antes = await prisma.tipoContrato.count();
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "", gerenciamento: "S" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.nome).toBe("Por favor,Preencher o campo NOME !");
    expect(await prisma.tipoContrato.count()).toBe(antes);
  });

  it("campo fora do schema (indicativoMetaRisco) gera 400", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "X", gerenciamento: "S", indicativoMetaRisco: "S" }));
    expect(res.status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/tipo_contratos"))).status).toBe(401);
  });
});
