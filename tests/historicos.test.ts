import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/historicos/route";
import * as item from "@/app/api/historicos/[id]/route";
import { historicos } from "@/lib/entities/historicos";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 012-historicos: um teste por cenário + 401.
describe("012-historicos", () => {
  let contratoA: number;
  let contratoB: number;

  beforeAll(async () => {
    await prisma.historico.deleteMany();
    contratoA = (await prisma.contrato.create({ data: { objeto: "A", numeroContrato: "CT-100/2026" } })).id;
    contratoB = (await prisma.contrato.create({ data: { objeto: "B", numeroContrato: "CT-200/2026" } })).id;
    const user = await loginAs("historico-seed");
    await prisma.historico.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        contratoId: i < 20 ? contratoA : contratoB,
        descricao: `Evento ${String(i + 1).padStart(2, "0")}`,
        dataInclusao: new Date(),
        usuarioId: user.id,
      })),
    });
  });

  it("Abrir a lista: paginada, com contrato (número), data e usuário, e filtro pela busca", async () => {
    await loginAs();
    const page2 = await (await collection.GET(jsonRequest("/api/historicos?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    const row = page2.items[0];
    expect(row).toHaveProperty("contratoId");
    expect(row.contrato).toMatchObject({ numeroContrato: expect.stringMatching(/^CT-/) });
    expect(row.usuario).toEqual({ id: expect.any(Number), username: "historico-seed" });
    expect(JSON.stringify(page2)).not.toMatch(/password/i);
    const busca = await (await collection.GET(jsonRequest("/api/historicos?q=CT-200"))).json();
    expect(busca.total).toBe(5);
    expect(busca.items.every((h: { contratoId: number }) => h.contratoId === contratoB)).toBe(true);
    const porDescricao = await (await collection.GET(jsonRequest("/api/historicos?q=Evento%2003"))).json();
    expect(porDescricao.total).toBe(1);
    const filtro = await (await collection.GET(jsonRequest(`/api/historicos?contratoId=${contratoA}`))).json();
    expect(filtro.total).toBe(20);
  });

  it("Salvar um registro válido: grava em historicos (data do servidor, usuário da sessão) e a lista o exibe", async () => {
    const user = await loginAs();
    const res = await collection.POST(jsonRequest("/api/historicos", "POST", { descricao: "Aditivo assinado", contratoId: String(contratoA) }));
    expect(res.status).toBe(201);
    const criado = await res.json();
    expect(criado).toMatchObject({ descricao: "Aditivo assinado", contratoId: contratoA, usuarioId: user.id, usuarioNome: user.username });
    expect(criado.id).toEqual(expect.any(Number));
    expect(Math.abs(new Date(criado.dataInclusao).getTime() - Date.now())).toBeLessThan(60_000);
    expect(criado).not.toHaveProperty("usuario.passwordHash");
    const busca = await (await collection.GET(jsonRequest("/api/historicos?q=Aditivo%20assinado"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Alterar um registro: atualiza e a lista reflete (autor e data não mudam)", async () => {
    await loginAs();
    const autor = await loginAs("historico-seed");
    const h = await prisma.historico.create({ data: { contratoId: contratoA, descricao: "Antes", dataInclusao: new Date("2026-01-02T00:00:00Z"), usuarioId: autor.id } });
    await loginAs("outro-usuario");
    const res = await item.PUT(jsonRequest(`/api/historicos/${h.id}`, "PUT", { descricao: "Depois", contratoId: String(contratoB) }), idParams(h.id));
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/historicos/${h.id}`), idParams(h.id))).json();
    expect(lido).toMatchObject({ descricao: "Depois", contratoId: contratoB, usuarioId: autor.id, dataInclusaoTexto: "02/01/2026" });
    expect(lido.contrato.numeroContrato).toBe("CT-200/2026");
  });

  it("Excluir com confirmação: o registro some da lista (cancelar não chama a API)", async () => {
    await loginAs();
    const h = await prisma.historico.create({ data: { contratoId: contratoA, descricao: "Temporário" } });
    expect((await item.DELETE(jsonRequest(`/api/historicos/${h.id}`, "DELETE"), idParams(h.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/historicos/${h.id}`), idParams(h.id))).status).toBe(404);
  });

  it("Salvar sem um campo obrigatório: 400 com a mensagem do campo e nada gravado", async () => {
    await loginAs();
    const antes = await prisma.historico.count();
    const res = await collection.POST(jsonRequest("/api/historicos", "POST", { descricao: "X", contratoId: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.contratoId).toBe("Contrato é obrigatório");
    // `id` é obrigatório e gerado pelo banco: o cliente não pode enviá-lo.
    expect((await collection.POST(jsonRequest("/api/historicos", "POST", { contratoId: contratoA, id: 5 }))).status).toBe(400);
    expect(await prisma.historico.count()).toBe(antes);
  });

  it("contratoId referencia Contratos: lookup de /api/contratos e id gravado; contrato inexistente → 400", async () => {
    await loginAs();
    const campo = historicos.fields.find((f) => f.name === "contratoId");
    expect(campo).toMatchObject({ kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } });
    const ok = await collection.POST(jsonRequest("/api/historicos", "POST", { contratoId: String(contratoB) }));
    expect((await ok.json()).contratoId).toBe(contratoB);
    const ruim = await collection.POST(jsonRequest("/api/historicos", "POST", { contratoId: "999999" }));
    expect(ruim.status).toBe(400);
    expect((await ruim.json()).errors.contratoId).toBe("Contrato não encontrado");
  });

  it("usuarioId referencia Users: gravado com o usuário da sessão; o cliente não escolhe", async () => {
    const user = await loginAs("historico-autor");
    const outro = await prisma.user.findUniqueOrThrow({ where: { username: "historico-seed" } });
    const forjado = await collection.POST(jsonRequest("/api/historicos", "POST", { contratoId: contratoA, usuarioId: outro.id }));
    expect(forjado.status).toBe(400);
    const res = await collection.POST(jsonRequest("/api/historicos", "POST", { contratoId: contratoA, descricao: "Pela sessão" }));
    const { id } = await res.json();
    const gravado = await prisma.historico.findUniqueOrThrow({ where: { id }, include: { usuario: true } });
    expect(gravado.usuarioId).toBe(user.id);
    expect(gravado.usuario?.username).toBe("historico-autor");
    expect(historicos.fields.find((f) => f.name === "usuarioNome")?.kind).toBe("readonly");
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/historicos"))).status).toBe(401);
    expect((await item.GET(jsonRequest("/api/historicos/1"), idParams(1))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/historicos", "POST", { contratoId: contratoA }))).status).toBe(401);
  });

  // 024-kit-robustez › crud-kit › "Filtro de lista assíncrono"
  it("Buscar históricos pelo número do contrato: só o histórico do contrato 123/2026", async () => {
    const user = await loginAs();
    const alvo = await prisma.contrato.create({ data: { objeto: "Alvo", numeroContrato: "123/2026" } });
    const outro = await prisma.contrato.create({ data: { objeto: "Outro", numeroContrato: "999/2025" } });
    await prisma.historico.create({ data: { contratoId: alvo.id, descricao: "do alvo", dataInclusao: new Date(), usuarioId: user.id } });
    await prisma.historico.create({ data: { contratoId: outro.id, descricao: "de outro", dataInclusao: new Date(), usuarioId: user.id } });
    const body = await (await collection.GET(jsonRequest(`/api/historicos?q=${encodeURIComponent("123/2026")}`))).json();
    expect(body.items.map((h: { contratoId: number }) => h.contratoId)).toEqual([alvo.id]);
    expect(body.items[0].contrato.numeroContrato).toBe("123/2026");
  });

  it("Parâmetro interno forjado: _q e _contratos são ignorados", async () => {
    await loginAs();
    const normal = await (await collection.GET(jsonRequest("/api/historicos?size=100"))).json();
    const forjado = await (await collection.GET(jsonRequest("/api/historicos?size=100&_q=x&_contratos=1,2,3"))).json();
    expect(forjado.total).toBe(normal.total);
    expect(forjado.items.map((h: { id: number }) => h.id)).toEqual(normal.items.map((h: { id: number }) => h.id));
  });
});
