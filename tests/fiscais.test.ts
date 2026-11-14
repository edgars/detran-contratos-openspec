import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyMask, MASKS } from "@/lib/mask";
import * as collection from "@/app/api/fiscais/route";
import * as item from "@/app/api/fiscais/[id]/route";
import * as pessoasFisicas from "@/app/api/pessoas_fisicas/route";
import { fiscais } from "@/lib/entities/fiscais";
import { MSG_CPF_INCOMPLETO } from "@/lib/entities/fiscais.server";
import { optionFromItem } from "@/components/crud/remote-search";
import { formatCell } from "@/components/crud/format-cell";
import { formatCpf } from "@/lib/format";
import { idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

let contratoId: number;
// 022-pessoas-fornecedores: o CPF do fiscal é gravado só com dígitos e precisa existir em pessoas_fisicas.
const cpf = (n: number) => String(n).padStart(11, "0");
const MARIA = "52998224725";
const valido = () => ({ contratoId: String(contratoId), pessoaFisicaCpf: "123.456.789-01", suplente: "N", presidente: "S" });

// Spec 010-fiscais: um teste por cenário, mais RK e 401.
describe("010-fiscais", () => {
  beforeAll(async () => {
    await prisma.fiscal.deleteMany();
    const pessoas = [
      { cpf: "12345678901", deNome: "Fiscal Um" },
      { cpf: "11122233344", deNome: "Fiscal Dois" },
      { cpf: MARIA, deNome: "Maria Gestora" },
    ];
    await prisma.pessoaFisica.deleteMany({ where: { cpf: { in: pessoas.map((p) => p.cpf) } } });
    await prisma.pessoaFisica.createMany({
      data: pessoas.map((p, i) => ({ ...p, idPessoaFisica: 7000 + i, dtNascimento: new Date("1980-01-01") })),
    });
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato de teste", numeroContrato: "077/2026" } })).id;
    await prisma.fiscal.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ contratoId, pessoaFisicaCpf: cpf(90000000000 + i), suplente: "N", presidente: "N" })),
    });
  });

  it("Abrir a lista: paginada, colunas contrato/CPF/suplente/presidente, filtro pela busca (CPF)", async () => {
    await loginAs();
    expect(fiscais.columns.map((c) => c.key)).toEqual(["contrato", "pessoa", "pessoaFisicaCpf", "suplente", "presidente"]);
    const page2 = await (await collection.GET(jsonRequest("/api/fiscais?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0].contrato).toEqual({ id: contratoId, numeroContrato: "077/2026" });
    // busca compara só os dígitos (CPF gravado sem máscara desde a 022).
    const busca = await (await collection.GET(jsonRequest("/api/fiscais?busca=90000000007"))).json();
    expect(busca.total).toBe(1);
    expect(busca.items[0].pessoaFisicaCpf).toBe("90000000007");
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
    expect(busca.items[0]).toMatchObject({ pessoaFisicaCpf: "12345678901", suplente: "N", presidente: "S" });
  });

  it("dataInclusao não é aceita do cliente (só data do servidor)", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), dataInclusao: "2000-01-01" }));
    expect(res.status).toBe(400);
  });

  it("Alterar um registro: atualiza e a lista reflete", async () => {
    await loginAs();
    const f = await prisma.fiscal.create({ data: { contratoId, pessoaFisicaCpf: "11122233344", suplente: "N", presidente: "N" } });
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
    const f = await prisma.fiscal.create({ data: { contratoId, pessoaFisicaCpf: "55566677788", suplente: "N", presidente: "N" } });
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

  // 022 › fiscais › "`busca` é digitado"
  it("`busca` é digitado: 529.982.247-25 ou 52998224725 mostram os fiscais com pessoaFisicaCpf 52998224725", async () => {
    await loginAs();
    await prisma.fiscal.create({ data: { contratoId, pessoaFisicaCpf: MARIA, suplente: "N", presidente: "N" } });
    const mascarado = await (await collection.GET(jsonRequest(`/api/fiscais?busca=${encodeURIComponent("529.982.247-25")}`))).json();
    const digitos = await (await collection.GET(jsonRequest("/api/fiscais?busca=52998224725"))).json();
    expect(mascarado.items.map((f: { pessoaFisicaCpf: string }) => f.pessoaFisicaCpf)).toEqual([MARIA]);
    expect(digitos.items.map((f: { id: number }) => f.id)).toEqual(mascarado.items.map((f: { id: number }) => f.id));
    expect(applyMask("12345678901", MASKS.cpf)).toBe("123.456.789-01");
  });

  // 022 › fiscais › "`pessoaFisicaCpf` é digitado"
  it("`pessoaFisicaCpf` é digitado: 529982 mostra 'Maria Gestora — 529.982.247-25' e, escolhida, grava 52998224725", async () => {
    const campo = fiscais.fields.find((f) => f.name === "pessoaFisicaCpf")!;
    expect(campo).toMatchObject({ kind: "search", required: true, lookup: { api: "/api/pessoas_fisicas?comCpf=1", valueField: "cpf", detailFormat: "cpf" } });
    await loginAs();
    const busca = await (await pessoasFisicas.GET(jsonRequest("/api/pessoas_fisicas?comCpf=1&q=529982&size=20"))).json();
    const opcoes = busca.items.map((i: Record<string, unknown>) => optionFromItem(campo.lookup!, i));
    const maria = opcoes.find((o: { label: string }) => o.label === "Maria Gestora — 529.982.247-25");
    expect(maria).toBeDefined();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), pessoaFisicaCpf: maria.value }));
    expect(res.status).toBe(201);
    expect((await prisma.fiscal.findUniqueOrThrow({ where: { id: (await res.json()).id } })).pessoaFisicaCpf).toBe("52998224725");
  });

  it("CPF fora do formato é recusado inline (MSG_CPF_INCOMPLETO)", async () => {
    await loginAs();
    const antes = await prisma.fiscal.count();
    for (const incompleto of ["123.456.789-0", "1234567890"]) {
      const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), pessoaFisicaCpf: incompleto }));
      expect(res.status).toBe(400);
      expect((await res.json()).errors.pessoaFisicaCpf).toBe(MSG_CPF_INCOMPLETO);
    }
    expect(await prisma.fiscal.count()).toBe(antes);
  });

  // 022 › fiscais › "CPF inexistente"
  it("CPF inexistente: 39053344705 → 400 'Pessoa física não encontrada para o CPF informado', nada gravado", async () => {
    await loginAs();
    const antes = await prisma.fiscal.count();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), pessoaFisicaCpf: "39053344705" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual({ pessoaFisicaCpf: "Pessoa física não encontrada para o CPF informado" });
    expect(await prisma.fiscal.count()).toBe(antes);
  });

  // 022 › fiscais › "CPF mascarado de pessoa existente"
  it("CPF mascarado de pessoa existente: 529.982.247-25 é gravado como 52998224725", async () => {
    await loginAs();
    const res = await collection.POST(jsonRequest("/api/fiscais", "POST", { ...valido(), pessoaFisicaCpf: "529.982.247-25" }));
    expect(res.status).toBe(201);
    expect((await res.json()).pessoaFisicaCpf).toBe("52998224725");
  });

  it("CPF inalterado na edição não é reconferido (fiscal com CPF órfão continua editável)", async () => {
    await loginAs();
    const f = await prisma.fiscal.create({ data: { contratoId, pessoaFisicaCpf: "39053344705", suplente: "N", presidente: "N" } });
    const res = await item.PUT(jsonRequest(`/api/fiscais/${f.id}`, "PUT", { ...valido(), pessoaFisicaCpf: "390.533.447-05", suplente: "S" }), idParams(f.id));
    expect(res.status).toBe(200);
  });

  // 022 › fiscais › "Abrir a lista" (Lista de Fiscais com nome do fiscal)
  it("Abrir a lista: a linha do fiscal 52998224725 mostra 'Maria Gestora' em Fiscal e 529.982.247-25 em CPF", async () => {
    await loginAs();
    const lista = await (await collection.GET(jsonRequest("/api/fiscais?busca=52998224725"))).json();
    const linha = lista.items[0];
    const coluna = (k: string) => fiscais.columns.find((c) => c.key === k)!;
    expect(coluna("pessoa")).toMatchObject({ label: "Fiscal", path: "pessoa.deNome" });
    expect(formatCell(linha, coluna("pessoa"))).toBe("Maria Gestora");
    // A coluna CPF usa o formato "cpf" do kit (format-cell.tsx → formatCpf).
    expect(coluna("pessoaFisicaCpf").format).toBe("cpf");
    expect(formatCpf(linha.pessoaFisicaCpf)).toBe("529.982.247-25");
    // CPF sem pessoa correspondente: nome vazio e CPF formatado.
    await prisma.fiscal.create({ data: { contratoId, pessoaFisicaCpf: "39053344705", suplente: "N", presidente: "N" } });
    const orfao = (await (await collection.GET(jsonRequest("/api/fiscais?busca=39053344705"))).json()).items[0];
    expect(orfao.pessoa).toBeNull();
    expect(formatCpf(orfao.pessoaFisicaCpf)).toBe("390.533.447-05");
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
