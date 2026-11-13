import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyMask, MASKS } from "@/lib/mask";
import * as collection from "@/app/api/fiscais/route";
import * as item from "@/app/api/fiscais/[id]/route";
import { fiscais } from "@/lib/entities/fiscais";
import { MSG_CPF_INCOMPLETO } from "@/lib/entities/fiscais.server";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

let contratoId: number;
const cpf = (n: number) => applyMask(String(n).padStart(11, "0"), MASKS.cpf);
const valido = () => ({ contratoId: String(contratoId), pessoaFisicaCpf: "123.456.789-01", suplente: "N", presidente: "S" });

// Spec 010-fiscais: um teste por cenário, mais RK e 401.
describe("010-fiscais", () => {
  beforeAll(async () => {
    await prisma.fiscal.deleteMany();
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato de teste", numeroContrato: "077/2026" } })).id;
    await prisma.fiscal.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ contratoId, pessoaFisicaCpf: cpf(90000000000 + i), suplente: "N", presidente: "N" })),
    });
  });

  it("Abrir a lista: paginada, colunas contrato/CPF/suplente/presidente, filtro pela busca (CPF)", async () => {
    await loginAs();
    expect(fiscais.columns.map((c) => c.key)).toEqual(["contrato", "pessoaFisicaCpf", "suplente", "presidente"]);
    const page2 = await (await collection.GET(jsonRequest("/api/fiscais?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0].contrato).toEqual({ id: contratoId, numeroContrato: "077/2026" });
    // busca chega só com dígitos (filtro numérico) e a API aplica a máscara de CPF.
    const busca = await (await collection.GET(jsonRequest("/api/fiscais?busca=90000000007"))).json();
    expect(busca.total).toBe(1);
    expect(busca.items[0].pessoaFisicaCpf).toBe("900.000.000-07");
    const mascarada = await (await collection.GET(jsonRequest("/api/fiscais?busca=900.000.000-1"))).json();
    expect(mascarada.total).toBe(10); // 900.000.000-10 .. -19
  });

  it("busca é filtro da lista, nunca coluna nem campo do formulário (diretiva do autor)", async () => {
    expect(fiscais.columns.some((c) => c.key === "busca")).toBe(false);
    expect(fiscais.fields.some((f) => f.name === "busca")).toBe(false);
    expect(fiscais.filters.map((f) => f.name)).toEqual(["busca"]);
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), busca: "123" }));
    expect(res.status).toBe(400);
  });

  it("Salvar um registro válido: grava em fiscais (dataInclusao do servidor) e a lista o exibe", async () => {
    await loginAs();
    const antes = Date.now();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", valido()));
    expect(res.status).toBe(201);
    const criado = await res.json();
    expect(new Date(criado.dataInclusao).getTime()).toBeGreaterThanOrEqual(antes - 1000);
    const busca = await (await collection.GET(jsonRequest("/api/fiscais?busca=12345678901"))).json();
    expect(busca.items).toHaveLength(1);
    expect(busca.items[0]).toMatchObject({ pessoaFisicaCpf: "123.456.789-01", suplente: "N", presidente: "S" });
  });

  it("dataInclusao não é aceita do cliente (só data do servidor)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), dataInclusao: "2000-01-01" }));
    expect(res.status).toBe(400);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const f = await prisma.fiscal.create({ data: { contratoId, pessoaFisicaCpf: "111.222.333-44", suplente: "N", presidente: "N" } });
    const res = await item.PUT(
      jsonRequest(`/api/fiscais/${f.id}`, "PUT", { ...valido(), pessoaFisicaCpf: "111.222.333-44", suplente: "S" }),
      idParams(f.id),
    );
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/fiscais/${f.id}`), idParams(f.id))).json();
    expect(lido).toMatchObject({ suplente: "S", presidente: "S" });
    const busca = await (await collection.GET(jsonRequest("/api/fiscais?busca=11122233344"))).json();
    expect(busca.items[0].suplente).toBe("S");
  });

  it("Excluir com confirmação: o registro some da lista", async () => {
    await loginAs();
    const f = await prisma.fiscal.create({ data: { contratoId, pessoaFisicaCpf: "555.666.777-88", suplente: "N", presidente: "N" } });
    expect((await item.DELETE(jsonRequest(`/api/fiscais/${f.id}`, "DELETE"), idParams(f.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/fiscais/${f.id}`), idParams(f.id))).status).toBe(404);
    const busca = await (await collection.GET(jsonRequest("/api/fiscais?busca=55566677788"))).json();
    expect(busca.total).toBe(0);
  });

  it("Salvar sem um campo obrigatório: pessoaFisicaCpf vazio → 400 com a mensagem e nada gravado", async () => {
    await loginAs();
    const antes = await prisma.fiscal.count();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), pessoaFisicaCpf: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.pessoaFisicaCpf).toBe("Pessoa Física CPF é obrigatório");
    expect(await prisma.fiscal.count()).toBe(antes);
  });

  it("RK-0f7caf172fab: suplente é obrigatório", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), suplente: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.suplente).toBe("Suplente é obrigatório");
  });

  it("RK-6b60cd49b7ed: presidente é obrigatório", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), presidente: undefined }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.presidente).toBe("Presidente é obrigatório");
  });

  it("toggles só aceitam S/N", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), suplente: "X" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.suplente).toBe("Suplente deve ser S ou N");
  });

  it("contratoId é obrigatório (coluna NOT NULL)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), contratoId: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.contratoId).toBe("Contrato é obrigatório");
  });

  it("`busca` é digitado: o valor é formatado como ###.###.###-##", () => {
    expect(applyMask("12345678901", MASKS.cpf)).toBe("123.456.789-01");
    expect(applyMask("123a456", MASKS.cpf)).toBe("123.456");
  });

  it("`pessoaFisicaCpf` é digitado: formatado como ###.###.###-## e CPF fora da máscara é recusado inline", async () => {
    expect(fiscais.fields.find((f) => f.name === "pessoaFisicaCpf")).toMatchObject({ kind: "masked", mask: MASKS.cpf, required: true });
    expect(applyMask("98765432100", MASKS.cpf)).toBe("987.654.321-00");
    await loginAs();
    const antes = await prisma.fiscal.count();
    for (const incompleto of ["123.456.789-0", "12345678901"]) {
      const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), pessoaFisicaCpf: incompleto }));
      expect(res.status).toBe(400);
      expect((await res.json()).errors.pessoaFisicaCpf).toBe(MSG_CPF_INCOMPLETO);
    }
    expect(await prisma.fiscal.count()).toBe(antes);
  });

  it("campo fora do schema gera 400 (gravação só de campos permitidos)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), id: 999 }));
    expect(res.status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/fiscais"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/fiscais", "POST", valido()))).status).toBe(401);
  });
});
