import { describe, expect, it, beforeAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PRESTACAO_VALOR_MINIMO,
  diasDesdeVencimento,
  hojeUtc,
  mesesDesdeInicio,
  ordenarPorGestor,
  ordenarPrazos,
  parsePrestacaoParams,
  prestacaoWhere,
} from "@/lib/prestacao/criterios";

// 021-prestacao-contas-fluxo › specs/prestacao-contas: critérios da lista e cálculos do painel (unitários).
const DAY = 86_400_000;
const diasAtras = (n: number) => new Date(hojeUtc().getTime() - n * DAY);
const pendentes = () => parsePrestacaoParams(new URLSearchParams());
const idsDaLista = async () => (await prisma.contrato.findMany({ where: await prestacaoWhere(pendentes()), select: { id: true } })).map((c) => c.id);

let marcado: number;
let desmarcado: number;

async function contrato(data: Partial<Prisma.ContratoUncheckedCreateInput> = {}) {
  return prisma.contrato.create({
    data: { objeto: "Critério", tipoContratoId: marcado, dataTermino: diasAtras(1), valorTotal: new Prisma.Decimal("700000.00"), ...data },
  });
}

describe("021 › Contratos sujeitos à prestação de contas (critérios)", () => {
  beforeAll(async () => {
    marcado = (await prisma.tipoContrato.create({ data: { nome: "Crit marcado", gerenciamento: "N", prestacaoContas: "S" } })).id;
    desmarcado = (await prisma.tipoContrato.create({ data: { nome: "Crit desmarcado", gerenciamento: "N", prestacaoContas: "N" } })).id;
  });

  it("Contrato que atende a todos os critérios: original, tipo marcado, vencido ontem, R$ 700.000,00 → Pendentes", async () => {
    const c = await contrato();
    expect(await idsDaLista()).toContain(c.id);
  });

  it("Limite de valor é estrito: R$ 650.000,00 fica de fora, R$ 650.000,01 entra", async () => {
    expect(PRESTACAO_VALOR_MINIMO.toFixed(2)).toBe("650000.00");
    const igual = await contrato({ valorTotal: new Prisma.Decimal("650000.00") });
    const acima = await contrato({ valorTotal: new Prisma.Decimal("650000.01") });
    const semValor = await contrato({ valorTotal: null });
    const ids = await idsDaLista();
    expect(ids).toContain(acima.id);
    expect(ids).not.toContain(igual.id);
    expect(ids).not.toContain(semValor.id);
  });

  it("Tipo não marcado, aditivo ou contrato vigente ficam de fora", async () => {
    const tipoN = await contrato({ tipoContratoId: desmarcado });
    const original = await contrato();
    const aditivo = await contrato({ parentId: original.id });
    const venceHoje = await contrato({ dataTermino: hojeUtc() });
    const ids = await idsDaLista();
    expect(ids).not.toContain(tipoN.id);
    expect(ids).not.toContain(aditivo.id);
    expect(ids).not.toContain(venceHoje.id);
  });

  it("Aditivo não prorroga o vencimento: o original vencido no mês passado aparece mesmo com aditivo até o ano que vem", async () => {
    const original = await contrato({ dataTermino: diasAtras(31) });
    const proximoAno = new Date(Date.UTC(hojeUtc().getUTCFullYear() + 1, 5, 30));
    await contrato({ parentId: original.id, dataTermino: proximoAno });
    expect(await idsDaLista()).toContain(original.id);
  });

  it("nenhum tipo marcado → lista vazia", async () => {
    const marcados = await prisma.tipoContrato.findMany({ where: { prestacaoContas: "S" }, select: { id: true } });
    await prisma.tipoContrato.updateMany({ data: { prestacaoContas: "N" } });
    try {
      expect(await idsDaLista()).toEqual([]);
    } finally {
      await prisma.tipoContrato.updateMany({ where: { id: { in: marcados.map((t) => t.id) } }, data: { prestacaoContas: "S" } });
    }
  });
});

describe("021 › Painel do contrato (cálculos)", () => {
  it("Dias e meses do painel: hoje 13/11/2026, início 28/02/2025, vencimento 03/11/2026 → 10 dias e 21 meses", () => {
    const now = new Date(2026, 10, 13, 15, 30);
    expect(diasDesdeVencimento(new Date(Date.UTC(2026, 10, 3)), now)).toBe(10);
    expect(mesesDesdeInicio(new Date(Date.UTC(2025, 1, 28)), now)).toBe(21);
  });

  it("virada de ano: PERIOD_DIFF ignora o dia; dias negativos antes do vencimento; null sem data", () => {
    const now = new Date(2027, 0, 2);
    expect(mesesDesdeInicio(new Date(Date.UTC(2026, 11, 31)), now)).toBe(1);
    expect(diasDesdeVencimento(new Date(Date.UTC(2026, 11, 31)), now)).toBe(2);
    expect(diasDesdeVencimento(new Date(Date.UTC(2027, 0, 5)), now)).toBe(-3);
    expect(mesesDesdeInicio(null, now)).toBeNull();
    expect(diasDesdeVencimento(null, now)).toBeNull();
  });

  it("prazos: numéricos em ordem numérica, depois texto; aparados e sem repetição", () => {
    expect(ordenarPrazos(["30", "mensal", " 10", "30 ", "5", "anual"])).toEqual(["5", "10", "30", "anual", "mensal"]);
  });

  it("ordenarPorGestor: crescente por nome, sem gestor por último, desempate id desc", () => {
    const nomes = new Map([
      ["11111111111", "Carlos"],
      ["22222222222", "Ana"],
    ]);
    const rows = [
      { id: 1, pessoaFisicaId: "11111111111" },
      { id: 2, pessoaFisicaId: null },
      { id: 3, pessoaFisicaId: "22222222222" },
    ];
    expect(ordenarPorGestor(rows, nomes, "asc")).toEqual([3, 1, 2]);
    expect(ordenarPorGestor(rows, nomes, "desc")).toEqual([1, 3, 2]);
  });

  it("parâmetros: ordenar inválido cai em vencimento asc; aceita valor:desc", () => {
    expect(parsePrestacaoParams(new URLSearchParams("ordenar=xpto&dir=desc"))).toMatchObject({ ordenar: "vencimento", dir: "asc" });
    expect(parsePrestacaoParams(new URLSearchParams("ordenar=valor:desc"))).toMatchObject({ ordenar: "valor", dir: "desc" });
    expect(parsePrestacaoParams(new URLSearchParams("ordenar=valor&dir=desc"))).toMatchObject({ ordenar: "valor", dir: "desc" });
  });
});
