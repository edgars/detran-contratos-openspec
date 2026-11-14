import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toDecimal } from "@/lib/money";
import * as collection from "@/app/api/pagamentos/route";
import * as item from "@/app/api/pagamentos/[id]/route";
import { pagamentos } from "@/lib/entities/pagamentos";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

let contratoId: number;
const valido = () => ({
  contratoId: String(contratoId),
  competencia: "01/11/2026",
  numeroProcesso: "E-12/001/2026",
  ano: "2026",
  notaFiscal: "NF-1",
  empenho: "2026NE0001",
  notaLiquidacao: "NL-1",
  ordemBancaria: "OB-1",
  valor: "1.234,56",
  valorGlosa: "",
  mes: "11",
  glosa: "N",
});

// Spec 006-pagamentos: um teste por cenário, mais RK, dinheiro Decimal e 401.
describe("006-pagamentos", () => {
  beforeAll(async () => {
    await prisma.pagamento.deleteMany();
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato de teste", numeroContrato: "001/2026" } })).id;
    await prisma.pagamento.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        competencia: new Date(Date.UTC(2026, 0, 1)),
        numeroProcesso: `PROC-${String(i + 1).padStart(2, "0")}`,
        contratoId,
        ano: "2025",
      })),
    });
  });

  it("Abrir a lista: paginada, com as colunas da spec, e filtro pela busca", async () => {
    await loginAs();
    expect(pagamentos.columns.map((c) => c.key)).toEqual(["numeroProcesso", "ano", "notaFiscal", "empenho", "notaLiquidacao"]);
    const page2 = await (await collection.GET(jsonRequest("/api/pagamentos?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items).toHaveLength(10);
    const busca = await (await collection.GET(jsonRequest("/api/pagamentos?q=PROC-07"))).json();
    expect(busca.total).toBe(1);
    expect(busca.items[0].numeroProcesso).toBe("PROC-07");
  });

  it("formulário: campos da spec na ordem, com contratoId e competencia obrigatórios", () => {
    const names = pagamentos.fields.map((f) => f.name);
    const spec = ["numeroProcesso", "ano", "notaFiscal", "empenho", "notaLiquidacao", "ordemBancaria", "valor", "valorGlosa", "mes", "glosa"];
    expect(names.filter((n) => spec.includes(n))).toEqual(spec);
    expect(pagamentos.fields.find((f) => f.name === "contratoId")).toMatchObject({ kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } });
    expect(pagamentos.fields.find((f) => f.name === "valor")?.kind).toBe("money");
    expect(pagamentos.fields.find((f) => f.name === "mes")?.options).toHaveLength(12);
  });

  it("Salvar um registro válido: grava em pagamentos e a lista o exibe", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", valido()));
    expect(res.status).toBe(201);
    const busca = await (await collection.GET(jsonRequest("/api/pagamentos?q=E-12%2F001%2F2026"))).json();
    expect(busca.items).toHaveLength(1);
    expect(busca.items[0]).toMatchObject({ numeroProcesso: "E-12/001/2026", mes: "11", glosa: "N", valorGlosa: null });
  });

  it("dinheiro: grava \"1.234,56\" e lê exatamente 1234.56 (Decimal)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), numeroProcesso: "DEC-1" }));
    const criado = await res.json();
    expect(criado.valor).toBe("1234.56");
    const row = await prisma.pagamento.findUniqueOrThrow({ where: { id: criado.id } });
    expect(row.valor).toBeInstanceOf(Prisma.Decimal);
    expect(row.valor?.toString()).toBe("1234.56");
    expect(row.valor?.equals(new Prisma.Decimal("1234.56"))).toBe(true);
  });

  it("dinheiro: 0,10 + 0,20 = 0,30 sem erro de ponto flutuante", async () => {
    await loginAs();
    expect(toDecimal("0,10")!.plus(toDecimal("0,20")!).toString()).toBe("0.3");
    expect(toDecimal("0,10")!.plus(toDecimal("0,20")!).equals(toDecimal("0,30")!)).toBe(true);
    await prisma.pagamento.deleteMany({ where: { numeroProcesso: "SOMA" } });
    for (const valor of ["0,10", "0,20"]) {
      expect((await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), numeroProcesso: "SOMA", valor }))).status).toBe(201);
    }
    const soma = await prisma.pagamento.aggregate({ where: { numeroProcesso: "SOMA" }, _sum: { valor: true } });
    expect(soma._sum.valor?.equals(new Prisma.Decimal("0.30"))).toBe(true);
  });

  it("dinheiro inválido gera 400 no campo", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), valor: "abc" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.valor).toBe("Valor inválido");
  });

  it("mes e glosa só aceitam as opções decididas (01..12, S/N)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), mes: "13", glosa: "X" }));
    expect(res.status).toBe(400);
    const { errors } = await res.json();
    expect(errors.mes).toBe("Mês inválido");
    expect(errors.glosa).toBe("Glosa inválido");
  });

  it("Alterar um registro: atualiza e a lista reflete (inclusive limpar campo opcional)", async () => {
    await loginAs();
    const p = await prisma.pagamento.create({
      data: { competencia: new Date(), numeroProcesso: "ALT-1", contratoId, notaFiscal: "NF-velha", valor: new Prisma.Decimal("10.00") },
    });
    const res = await item.PUT(
      jsonRequest(`/api/pagamentos/${p.id}`, "PUT", { ...valido(), numeroProcesso: "ALT-1 revisado", notaFiscal: "", valor: "20,50" }),
      idParams(p.id),
    );
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/pagamentos/${p.id}`), idParams(p.id))).json();
    expect(lido).toMatchObject({ numeroProcesso: "ALT-1 revisado", notaFiscal: null, valor: "20.5" });
    const busca = await (await collection.GET(jsonRequest("/api/pagamentos?q=ALT-1%20revisado"))).json();
    expect(busca.total).toBe(1);
  });

  it("Excluir com confirmação: o registro some da lista", async () => {
    await loginAs();
    const p = await prisma.pagamento.create({ data: { competencia: new Date(), numeroProcesso: "TEMP-1", contratoId } });
    expect((await item.DELETE(jsonRequest(`/api/pagamentos/${p.id}`, "DELETE"), idParams(p.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/pagamentos/${p.id}`), idParams(p.id))).status).toBe(404);
    const busca = await (await collection.GET(jsonRequest("/api/pagamentos?q=TEMP-1"))).json();
    expect(busca.total).toBe(0);
  });

  it("Salvar sem um campo obrigatório: 400 com a mensagem de numeroProcesso e nada gravado", async () => {
    await loginAs();
    const antes = await prisma.pagamento.count();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), numeroProcesso: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.numeroProcesso).toBe("Número Processo é obrigatório");
    expect(await prisma.pagamento.count()).toBe(antes);
  });

  it("RK-774f44ed6df9: competencia é obrigatória (400 no campo, nada gravado)", async () => {
    await loginAs();
    const antes = await prisma.pagamento.count();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), competencia: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.competencia).toBe("Competência é obrigatório");
    expect(await prisma.pagamento.count()).toBe(antes);
  });

  it("contratoId é obrigatório (coluna NOT NULL)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), contratoId: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.contratoId).toBe("Contrato é obrigatório");
  });

  it("campo fora do schema gera 400 (gravação só de campos permitidos)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/pagamentos", "POST", { ...valido(), id: 999 }));
    expect(res.status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/pagamentos"))).status).toBe(401);
    expect((await collection.POST(jsonRequest("/api/pagamentos", "POST", valido()))).status).toBe(401);
  });

  // 024-kit-robustez › crud-kit › "Campo opcional apagável na edição"
  it("Limpar um campo opcional: notaFiscal 123 apagada no formulário vira null", async () => {
    await loginAs();
    const p = await prisma.pagamento.create({
      data: { competencia: new Date(Date.UTC(2026, 0, 1)), numeroProcesso: "LIMPAR-1", contratoId, notaFiscal: "123" },
    });
    const res = await item.PUT(jsonRequest(`/api/pagamentos/${p.id}`, "PUT", { ...valido(), notaFiscal: "" }), idParams(p.id));
    expect(res.status).toBe(200);
    expect((await prisma.pagamento.findUniqueOrThrow({ where: { id: p.id } })).notaFiscal).toBeNull();
    const lido = await (await item.GET(jsonRequest(`/api/pagamentos/${p.id}`), idParams(p.id))).json();
    expect(lido.notaFiscal).toBeNull();
  });
});
