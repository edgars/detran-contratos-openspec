import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
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

  it("Abrir a lista: colunas nome, gerenciamento, Contrato e Risco da meta (019), paginada e com filtro pela busca", async () => {
    await loginAs();
    expect(tipoContratos.columns.map((c) => c.key)).toEqual(["nome", "gerenciamento", "contratoPrincipal", "indicativoMetaRisco"]);
    expect(tipoContratos.columns.slice(2)).toEqual([
      { key: "contratoPrincipal", label: "Contrato", format: "boolean" },
      { key: "indicativoMetaRisco", label: "Risco da meta", format: "boolean" },
    ]);
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
    // 019: toggles contratoPrincipal e indicativoMetaRisco depois de gerenciamento; 021: prestacaoContas por último.
    expect(tipoContratos.fields.map((f) => f.name)).toEqual(["nome", "gerenciamento", "contratoPrincipal", "indicativoMetaRisco", "prestacaoContas"]);
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

  it("indicativoMetaRisco entrou no formulário (019): 'S' grava (201), 'X' gera 400; campo fora do schema continua 400", async () => {
    await loginAs();
    const ok = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Risco", gerenciamento: "S", indicativoMetaRisco: "S" }));
    expect(ok.status).toBe(201);
    expect((await ok.json()).indicativoMetaRisco).toBe("S");
    const ruim = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "X", gerenciamento: "S", indicativoMetaRisco: "X" }));
    expect(ruim.status).toBe(400);
    expect((await ruim.json()).errors.indicativoMetaRisco).toBeDefined();
    const extra = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "X", gerenciamento: "S", campoInventado: "S" }));
    expect(extra.status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/tipo_contratos"))).status).toBe(401);
  });
});

// 021-prestacao-contas-fluxo › specs/tipo-contratos/spec.md: um teste por cenário.
describe("021 › Tipo de contrato sujeito à prestação de contas", () => {
  it("Marcar um tipo: PUT liga a flag e os contratos vencidos acima do limite entram na lista", async () => {
    await loginAs();
    const campo = tipoContratos.fields.find((f) => f.name === "prestacaoContas");
    expect(campo).toMatchObject({ label: "Sujeito à prestação de contas", kind: "toggle", toggleValues: ["S", "N"] });
    expect(campo).not.toHaveProperty("required");
    const t = await prisma.tipoContrato.create({ data: { nome: "Contrato", gerenciamento: "S" } });
    expect(t.prestacaoContas).toBe("N");
    const c = await prisma.contrato.create({
      data: { objeto: "Marcar tipo", tipoContratoId: t.id, dataTermino: new Date(Date.UTC(2020, 0, 1)), valorTotal: new Prisma.Decimal("700000.00") },
    });
    const { GET } = await import("@/app/api/prestacao_contas/contratos/route");
    const antes = await (await GET(jsonRequest(`/api/prestacao_contas/contratos?tipoContratoId=${t.id}`))).json();
    expect(antes.total).toBe(0);
    const res = await item.PUT(
      jsonRequest(`/api/tipo_contratos/${t.id}`, "PUT", { nome: "Contrato", gerenciamento: "S", prestacaoContas: "S" }),
      idParams(t.id),
    );
    expect(res.status).toBe(200);
    expect((await prisma.tipoContrato.findUniqueOrThrow({ where: { id: t.id } })).prestacaoContas).toBe("S");
    const depois = await (await GET(jsonRequest(`/api/prestacao_contas/contratos?tipoContratoId=${t.id}`))).json();
    expect(depois.items.map((i: { id: number }) => i.id)).toEqual([c.id]);
  });

  it("Tipo novo nasce desmarcado: sem o toggle (ausente ou vazio) grava prestacaoContas = N", async () => {
    await loginAs();
    const ausente = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Novo sem toggle", gerenciamento: "N" }));
    expect(ausente.status).toBe(201);
    expect((await ausente.json()).prestacaoContas).toBe("N");
    const vazio = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Novo vazio", gerenciamento: "N", prestacaoContas: "" }));
    expect(vazio.status).toBe(201);
    expect((await vazio.json()).prestacaoContas).toBe("N");
  });

  it("Valor inválido: prestacaoContas = X → 400 com erro em prestacaoContas e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.tipoContrato.count();
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Inválido", gerenciamento: "N", prestacaoContas: "X" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.prestacaoContas).toBeDefined();
    expect(await prisma.tipoContrato.count()).toBe(antes);
  });

  it("Filtrar tipos marcados: ?prestacaoContas=S devolve só o tipo marcado", async () => {
    await loginAs();
    await prisma.tipoContrato.updateMany({ data: { prestacaoContas: "N" } });
    const sim = await prisma.tipoContrato.create({ data: { nome: "Marcado", gerenciamento: "N", prestacaoContas: "S" } });
    await prisma.tipoContrato.create({ data: { nome: "Desmarcado", gerenciamento: "N", prestacaoContas: "N" } });
    const body = await (await collection.GET(jsonRequest("/api/tipo_contratos?prestacaoContas=S"))).json();
    expect(body.items.map((i: { id: number }) => i.id)).toEqual([sim.id]);
    const nao = await (await collection.GET(jsonRequest("/api/tipo_contratos?prestacaoContas=N&size=100"))).json();
    expect(nao.items.map((i: { id: number }) => i.id)).not.toContain(sim.id);
  });
});

// 019-relatorios › specs/tipo-contratos/spec.md: um teste por cenário novo.
describe("019 › Marcações do tipo de contrato", () => {
  it("Marcar o tipo Contrato: grava contratoPrincipal = 'S' e a lista mostra Sim na coluna Contrato", async () => {
    await loginAs();
    const campo = tipoContratos.fields.find((f) => f.name === "contratoPrincipal");
    expect(campo).toMatchObject({ label: "É o tipo Contrato (relatórios)", kind: "toggle", toggleValues: ["S", "N"] });
    expect(tipoContratos.fields.find((f) => f.name === "indicativoMetaRisco")).toMatchObject({
      label: "Entra no risco da meta",
      kind: "toggle",
      toggleValues: ["S", "N"],
    });
    const t = await prisma.tipoContrato.create({ data: { nome: "Contrato 019", gerenciamento: "S" } });
    const res = await item.PUT(
      jsonRequest(`/api/tipo_contratos/${t.id}`, "PUT", { nome: "Contrato 019", gerenciamento: "S", contratoPrincipal: "S" }),
      idParams(t.id),
    );
    expect(res.status).toBe(200);
    expect((await prisma.tipoContrato.findUniqueOrThrow({ where: { id: t.id } })).contratoPrincipal).toBe("S");
    const lista = await (await collection.GET(jsonRequest("/api/tipo_contratos?q=Contrato%20019"))).json();
    expect(lista.items[0].contratoPrincipal).toBe("S");
    // A coluna "Contrato" usa o formato boolean do kit: "S" aparece como "Sim".
    const { formatCell } = await import("@/components/crud/format-cell");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const React = await import("react");
    (globalThis as { React?: unknown }).React = React;
    const coluna = tipoContratos.columns.find((c) => c.key === "contratoPrincipal")!;
    expect(renderToStaticMarkup(React.createElement(React.Fragment, null, formatCell(lista.items[0], coluna)))).toContain("Sim");
  });

  it("Valor fora de S/N: contratoPrincipal = X → 400 no campo contratoPrincipal e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.tipoContrato.count();
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Inválido 019", gerenciamento: "N", contratoPrincipal: "X" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.contratoPrincipal).toBeDefined();
    expect(await prisma.tipoContrato.count()).toBe(antes);
  });

  it("Marcações ausentes: só nome e gerenciamento → contratoPrincipal e indicativoMetaRisco = N", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/tipo_contratos", "POST", { nome: "Sem marcações", gerenciamento: "N" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ contratoPrincipal: "N", indicativoMetaRisco: "N" });
  });
});
