import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/contrato_status/route";
import * as item from "@/app/api/contrato_status/[id]/route";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 004-contrato-status: um teste por cenário + RK + 401.
describe("004-contrato-status", () => {
  let contratoId: number;
  let statusId: number;

  beforeAll(async () => {
    await prisma.contratoStatus.deleteMany();
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato teste", numeroContrato: "001/2026" } })).id;
    statusId = (await prisma.status.create({ data: { nome: "Pendente" } })).id;
    await prisma.contratoStatus.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        contratoId,
        statusId,
        descricao: `Registro ${String(i + 1).padStart(2, "0")}`,
        atendido: i % 2,
      })),
    });
  });

  it("Abrir a lista: paginada, com colunas descricao e atendido, e filtro pela busca", async () => {
    await loginAs();
    const page2 = await (await collection.GET(jsonRequest("/api/contrato_status?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items[0]).toHaveProperty("descricao");
    expect(page2.items[0]).toHaveProperty("atendido");
    const busca = await (await collection.GET(jsonRequest("/api/contrato_status?q=Registro%2007"))).json();
    expect(busca.total).toBe(1);
    const atendidos = await (await collection.GET(jsonRequest("/api/contrato_status?q=sim&size=100"))).json();
    expect(atendidos.total).toBe(12);
    expect(atendidos.items.every((r: { atendido: number }) => r.atendido === 1)).toBe(true);
  });

  it("Salvar um registro válido: grava em contrato_status e a lista o exibe (data do servidor e autor da sessão)", async () => {
    const user = await loginAs();
    const res = await collection.POST(
      jsonRequest("/api/contrato_status", "POST", { descricao: "Aguardando", atendido: "1", contratoId: String(contratoId), statusId: String(statusId) }),
    );
    expect(res.status).toBe(201);
    const criado = await res.json();
    expect(criado).toMatchObject({ descricao: "Aguardando", atendido: 1, contratoId, statusId, usuarioId: user.id });
    expect(Math.abs(new Date(criado.dataInclusao).getTime() - Date.now())).toBeLessThan(60_000);
    const busca = await (await collection.GET(jsonRequest("/api/contrato_status?q=Aguardando"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("RK-f0ce91a53de9: aspas duplas da descrição viram simples antes de gravar", async () => {
    await loginAs();
    const res = await collection.POST(
      jsonRequest("/api/contrato_status", "POST", { descricao: 'Ofício "urgente"', atendido: "0", contratoId, statusId }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect((await prisma.contratoStatus.findUnique({ where: { id } }))?.descricao).toBe("Ofício 'urgente'");
  });

  it("POST rejeita corpo inválido com 400 e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.contratoStatus.count();
    const semContrato = await collection.POST(jsonRequest("/api/contrato_status", "POST", { descricao: "X", statusId }));
    expect(semContrato.status).toBe(400);
    expect((await semContrato.json()).errors.contratoId).toBe("Contrato é obrigatório");
    const inexistente = await collection.POST(jsonRequest("/api/contrato_status", "POST", { contratoId: 999999, statusId }));
    expect(inexistente.status).toBe(400);
    expect((await inexistente.json()).errors.contratoId).toBe("Contrato não encontrado");
    const autor = await collection.POST(jsonRequest("/api/contrato_status", "POST", { contratoId, statusId, usuarioId: 1 }));
    expect(autor.status).toBe(400);
    const atendido = await collection.POST(jsonRequest("/api/contrato_status", "POST", { contratoId, statusId, atendido: "2" }));
    expect(atendido.status).toBe(400);
    expect(await prisma.contratoStatus.count()).toBe(antes);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const r = await prisma.contratoStatus.create({ data: { contratoId, statusId, descricao: "Antes", atendido: 0 } });
    const res = await item.PUT(
      jsonRequest(`/api/contrato_status/${r.id}`, "PUT", { descricao: "Depois", atendido: "1", contratoId: String(contratoId), statusId: String(statusId) }),
      idParams(r.id),
    );
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/contrato_status/${r.id}`), idParams(r.id))).json();
    expect(lido).toMatchObject({ descricao: "Depois", atendido: 1 });
  });

  it("Excluir com confirmação: o registro some da lista (cancelar não chama a API)", async () => {
    await loginAs();
    const r = await prisma.contratoStatus.create({ data: { contratoId, statusId, descricao: "Temporário" } });
    expect((await item.DELETE(jsonRequest(`/api/contrato_status/${r.id}`, "DELETE"), idParams(r.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/contrato_status/${r.id}`), idParams(r.id))).status).toBe(404);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/contrato_status"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/contrato_status", "POST", { contratoId, statusId }))).status).toBe(401);
  });
});
