import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/departamentos/route";
import * as item from "@/app/api/departamentos/[id]/route";
import * as diretoriasRoute from "@/app/api/diretorias/route";
import { departamentos } from "@/lib/entities/departamentos";
import { MASKS, applyMask } from "@/lib/mask";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

// Spec 002-departamentos: um teste por cenário + RK + 401.
describe("002-departamentos", () => {
  let dirA: number;
  let dirB: number;

  beforeAll(async () => {
    await prisma.departamento.deleteMany();
    dirA = (await prisma.diretoria.create({ data: { deDiretoria: "Diretoria A", codigo: "DA" } })).id;
    dirB = (await prisma.diretoria.create({ data: { deDiretoria: "Diretoria B", codigo: "DB" } })).id;
    await prisma.departamento.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        deDepartamento: `Depto ${String(i + 1).padStart(2, "0")}`,
        diretoriaId: i < 5 ? dirB : dirA,
      })),
    });
  });

  it("Abrir a lista: colunas diretoriaId, paginada e com filtro pela busca", async () => {
    await loginAs();
    expect(departamentos.columns.map((c) => c.key)).toContain("diretoriaId");
    const page2 = await (await collection.GET(jsonRequest("/api/departamentos?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0]).toHaveProperty("diretoriaId");
    expect(page2.items[0].diretoria).toHaveProperty("deDiretoria");
    const busca = await (await collection.GET(jsonRequest("/api/departamentos?q=Depto%2007"))).json();
    expect(busca.total).toBe(1);
    const porDiretoria = await (await collection.GET(jsonRequest(`/api/departamentos?diretoriaId=${dirB}`))).json();
    expect(porDiretoria.total).toBe(5);
  });

  it("Salvar um registro válido: grava em departamentos e a lista o exibe", async () => {
    await loginAs();
    expect(departamentos.fields.map((f) => f.name)).toEqual([
      "codigo", "diretoriaId", "id", "deDepartamento", "deLogradouro", "deComplemento", "deBairro", "deCidade", "cep", "municipioId",
    ]);
    const res = await collection.POST(
      jsonRequest("/api/departamentos", "POST", {
        codigo: "TI",
        diretoriaId: String(dirA),
        deDepartamento: "Tecnologia",
        deLogradouro: "Av. Presidente Vargas",
        deComplemento: "5º andar",
        deBairro: "Centro",
        deCidade: "Rio de Janeiro",
        cep: "20071-003",
      }),
    );
    expect(res.status).toBe(201);
    const criado = await res.json();
    expect(criado).toMatchObject({ diretoriaId: dirA, cep: "20071-003", codigo: "TI" });
    const busca = await (await collection.GET(jsonRequest("/api/departamentos?q=Tecnologia"))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const d = await prisma.departamento.create({ data: { deDepartamento: "Compras", diretoriaId: dirA, codigo: "CP" } });
    const lido = await (await item.GET(jsonRequest(`/api/departamentos/${d.id}`), idParams(d.id))).json();
    expect(lido).toMatchObject({ deDepartamento: "Compras", codigo: "CP" });
    const res = await item.PUT(
      jsonRequest(`/api/departamentos/${d.id}`, "PUT", { codigo: "", diretoriaId: String(dirB), deDepartamento: "Compras e Licitações" }),
      idParams(d.id),
    );
    expect(res.status).toBe(200);
    const depois = await prisma.departamento.findUnique({ where: { id: d.id } });
    expect(depois).toMatchObject({ deDepartamento: "Compras e Licitações", diretoriaId: dirB, codigo: null });
    const busca = await (await collection.GET(jsonRequest("/api/departamentos?q=Licita"))).json();
    expect(busca.items[0].deDepartamento).toBe("Compras e Licitações");
  });

  it("Excluir com confirmação: o registro some; sem confirmar (sem DELETE) nada muda", async () => {
    await loginAs();
    const d = await prisma.departamento.create({ data: { deDepartamento: "Temporário", diretoriaId: dirA } });
    expect(await prisma.departamento.findUnique({ where: { id: d.id } })).not.toBeNull();
    expect((await item.DELETE(jsonRequest(`/api/departamentos/${d.id}`, "DELETE"), idParams(d.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/departamentos/${d.id}`), idParams(d.id))).status).toBe(404);
  });

  it("Salvar sem um campo obrigatório: diretoriaId vazio gera 400 com a mensagem do campo e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.departamento.count();
    const res = await collection.POST(jsonRequest("/api/departamentos", "POST", { diretoriaId: "", deDepartamento: "Sem diretoria" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.diretoriaId).toBe("Diretoria é obrigatório");
    expect(await prisma.departamento.count()).toBe(antes);
    expect(departamentos.fields.find((f) => f.name === "diretoriaId")?.required).toBe(true);
  });

  it("RK-4e6358dbafbf RK-52fdc2d97389 RK-ecfa90099032: DeDepartamento é obrigatório", async () => {
    await loginAs();
    const antes = await prisma.departamento.count();
    const res = await collection.POST(jsonRequest("/api/departamentos", "POST", { diretoriaId: dirA, deDepartamento: "  " }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.deDepartamento).toBe("Departamento é obrigatório");
    expect(await prisma.departamento.count()).toBe(antes);
  });

  it("Escolher um registro relacionado: lookup de /api/diretorias grava o id em diretoriaId", async () => {
    await loginAs();
    const campo = departamentos.fields.find((f) => f.name === "diretoriaId");
    expect(campo).toMatchObject({ kind: "lookup", lookup: { api: "/api/diretorias", labelField: "deDiretoria" } });
    const opcoes = await (await diretoriasRoute.GET(jsonRequest("/api/diretorias?size=100"))).json();
    const escolhida = opcoes.items.find((d: { deDiretoria: string }) => d.deDiretoria === "Diretoria B");
    expect(escolhida).toBeDefined();
    const res = await collection.POST(
      jsonRequest("/api/departamentos", "POST", { diretoriaId: String(escolhida.id), deDepartamento: "Jurídico" }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).diretoriaId).toBe(dirB);
  });

  it("FK diretoriaId: diretoria inexistente gera 400 no campo", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/departamentos", "POST", { diretoriaId: 999999, deDepartamento: "Órfão" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.diretoriaId).toBe("Diretoria não encontrada");
  });

  it("`cep` é digitado: formatado como #####-###; valor fora da máscara gera 400", async () => {
    await loginAs();
    expect(departamentos.fields.find((f) => f.name === "cep")).toMatchObject({ kind: "masked", mask: MASKS.cep });
    expect(applyMask("20071003", MASKS.cep)).toBe("20071-003");
    expect(applyMask("2007a1-00399", MASKS.cep)).toBe("20071-003");
    const res = await collection.POST(jsonRequest("/api/departamentos", "POST", { diretoriaId: dirA, deDepartamento: "X", cep: "2007-1003" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.cep).toBeDefined();
  });

  it("campo fora do schema (id, municipioId) gera 400", async () => {
    await loginAs();
    expect((await collection.POST(jsonRequest("/api/departamentos", "POST", { diretoriaId: dirA, deDepartamento: "X", id: 5 }))).status).toBe(400);
    expect((await collection.POST(jsonRequest("/api/departamentos", "POST", { diretoriaId: dirA, deDepartamento: "X", municipioId: 1 }))).status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/departamentos"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/departamentos", "POST", { diretoriaId: dirA, deDepartamento: "X" }))).status).toBe(401);
  });
});
