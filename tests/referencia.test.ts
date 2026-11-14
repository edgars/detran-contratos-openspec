import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { prisma } from "@/lib/db";
import * as diretorias from "@/app/api/diretorias/route";
import * as pessoasFisicas from "@/app/api/pessoas_fisicas/route";
import * as prestadores from "@/app/api/prestadores_servicos/route";
import { contratos } from "@/lib/entities/contratos";
import { isCnpjValido, isCpfValido } from "@/lib/documento";
import { pessoasPorCpf } from "@/lib/reference/pessoas";
import { RemoteSearch, moreResultsMessage, type RemoteState } from "@/components/crud/remote-search";
import type { LookupConfig } from "@/components/crud/types";
import { jsonRequest, loginAs, logout } from "./helpers/auth";
import { migrationNames, tempDb } from "./helpers/temp-db";

// 022-pessoas-fornecedores › app-shell: um teste por cenário.

const MARIA = "52998224725";
const JOAO = "11144477735";

type Item = { id: number; idPessoaFisica?: number; cpf?: string | null; deNome?: string; deRazaoSocial?: string; cnpj?: string | null };
const getPessoas = async (qs: string) => (await (await pessoasFisicas.GET(jsonRequest(`/api/pessoas_fisicas${qs}`))).json()) as { items: Item[]; total: number };
const getFornecedores = async (qs: string) =>
  (await (await prestadores.GET(jsonRequest(`/api/prestadores_servicos${qs}`))).json()) as { items: Item[]; total: number };

/** CPF com DV válido a partir de 9 dígitos (para gerar massas de teste). */
function cpfDe(base9: number) {
  const b = String(base9).padStart(9, "0");
  const dv = (d: string, w: number[]) => {
    const r = w.reduce((a, x, i) => a + Number(d[i]) * x, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(b, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${b}${d1}${dv(`${b}${d1}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])}`;
}

const nascimento = new Date("1980-01-01");

describe("022 › referência: pessoas físicas e fornecedores", () => {
  let limpaTudoId: number;

  beforeAll(async () => {
    // Pessoas físicas não têm FK: cada arquivo cria as suas. Aqui a tabela começa vazia.
    await prisma.pessoaFisica.deleteMany();
    await prisma.pessoaFisica.createMany({
      data: [
        { idPessoaFisica: 1001, cpf: MARIA, deNome: "Maria Gestora", dtNascimento: nascimento, deEndereco: "Rua A, 1", deNomeMae: "Mãe da Maria" },
        { idPessoaFisica: 1002, cpf: JOAO, deNome: "João Suplente", dtNascimento: nascimento },
        { idPessoaFisica: 1003, cpf: null, deNome: "Ana Sem Documento", dtNascimento: nascimento },
      ],
    });
    // Fornecedores podem estar ligados a contratos de outro arquivo: upsert pela chave.
    limpaTudoId = (
      await prisma.prestadorServico.upsert({
        where: { cnpj: "11222333000181" },
        update: { deRazaoSocial: "Limpa Tudo Ltda" },
        create: { deRazaoSocial: "Limpa Tudo Ltda", cnpj: "11222333000181" },
      })
    ).id;
  });

  it("Carregar um dropdown: opções de GET /api/diretorias e nenhuma rota de edição para diretorias", async () => {
    await loginAs();
    await prisma.diretoria.create({ data: { deDiretoria: "Diretoria 022", codigo: "D22" } });
    const res = await diretorias.GET(jsonRequest("/api/diretorias?size=100&q=Diretoria%20022"));
    expect(res.status).toBe(200);
    expect((await res.json()).items.map((d: { codigo: string }) => d.codigo)).toEqual(["D22"]);
    expect(Object.keys(diretorias).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k))).toEqual([]);
  });

  it("Nenhuma escrita em pessoas físicas e fornecedores: as rotas só exportam GET (o Next.js responde 405) e nada é gravado", async () => {
    await loginAs();
    const antes = [await prisma.pessoaFisica.count(), await prisma.prestadorServico.count()];
    for (const route of [pessoasFisicas, prestadores]) {
      expect(Object.keys(route).filter((k) => /^[A-Z]+$/.test(k))).toEqual(["GET"]);
      for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(m in route).toBe(false);
    }
    expect([await prisma.pessoaFisica.count(), await prisma.prestadorServico.count()]).toEqual(antes);
  });

  it("Projeção enxuta de pessoas físicas / Ler pessoas físicas: cada item tem só id, idPessoaFisica, cpf e deNome", async () => {
    await loginAs();
    const body = await getPessoas("");
    expect(body.items.length).toBeGreaterThan(0);
    for (const p of body.items) expect(Object.keys(p).sort()).toEqual(["cpf", "deNome", "id", "idPessoaFisica"]);
    expect(JSON.stringify(body)).not.toMatch(/deEndereco|deNomeMae|dtNascimento|Rua A|Mãe da Maria/);
    const forn = await getFornecedores("");
    for (const f of forn.items) expect(Object.keys(f).sort()).toEqual(["cnpj", "deRazaoSocial", "id"]);
  });

  it("CPF repetido: o índice único recusa outra pessoa com cpf 52998224725 (P2002)", async () => {
    await expect(
      prisma.pessoaFisica.create({ data: { idPessoaFisica: 9999, cpf: MARIA, deNome: "Outra Maria", dtNascimento: nascimento } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.prestadorServico.create({ data: { deRazaoSocial: "Outra", cnpj: "11222333000181" } })).rejects.toMatchObject({ code: "P2002" });
    // Vários NULL são aceitos (pessoas do global sem documento).
    await prisma.pessoaFisica.create({ data: { idPessoaFisica: 9998, cpf: null, deNome: "Bruno Sem Documento", dtNascimento: nascimento } });
    await prisma.pessoaFisica.deleteMany({ where: { idPessoaFisica: 9998 } });
  });

  it("Buscar pessoa por nome: q=maria traz só Maria Gestora", async () => {
    await loginAs();
    const body = await getPessoas("?q=maria");
    expect(body.items.map((p) => p.deNome)).toEqual(["Maria Gestora"]);
  });

  it("Buscar pessoa por CPF mascarado: q=529.982 traz Maria Gestora (cpf começa com 529982)", async () => {
    await loginAs();
    const body = await getPessoas(`?q=${encodeURIComponent("529.982")}`);
    expect(body.items.map((p) => [p.deNome, p.cpf])).toEqual([["Maria Gestora", MARIA]]);
    // Menos de 3 dígitos não procura no documento; prefixo, não "contém".
    expect((await getPessoas("?q=52")).total).toBe(0);
    expect((await getPessoas("?q=982247")).total).toBe(0);
  });

  it("Buscar fornecedor por CNPJ: q=11.222.333 traz Limpa Tudo Ltda", async () => {
    await loginAs();
    const body = await getFornecedores(`?q=${encodeURIComponent("11.222.333")}`);
    expect(body.items.map((f) => f.deRazaoSocial)).toEqual(["Limpa Tudo Ltda"]);
    // Busca com aspas continua parametrizada.
    expect((await prestadores.GET(jsonRequest(`/api/prestadores_servicos?q=${encodeURIComponent("' OR 1=1 --")}`))).status).toBe(200);
  });

  it("Sem sessão: GET /api/pessoas_fisicas?q=maria responde 401 sem dados", async () => {
    logout();
    const res = await pessoasFisicas.GET(jsonRequest("/api/pessoas_fisicas?q=maria"));
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain("Maria");
  });

  it("Resolver o valor gravado: cpf=529.982.247-25 traz exatamente a pessoa 52998224725; fornecedor por id e cnpj", async () => {
    await loginAs();
    const body = await getPessoas(`?cpf=${encodeURIComponent("529.982.247-25")}`);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ cpf: MARIA, deNome: "Maria Gestora" });
    expect((await getPessoas("?cpf=5299822472")).total).toBe(0);
    expect((await getFornecedores(`?id=${limpaTudoId}`)).items.map((f) => f.cnpj)).toEqual(["11222333000181"]);
    expect((await getFornecedores("?cnpj=11.222.333/0001-81")).items.map((f) => f.id)).toEqual([limpaTudoId]);
  });

  it("Só pessoas com CPF, em ordem alfabética: comCpf=1&deEndereco=x traz João Suplente e Maria Gestora", async () => {
    await loginAs();
    const body = await getPessoas("?comCpf=1&deEndereco=x");
    expect(body.items.map((p) => p.deNome)).toEqual(["João Suplente", "Maria Gestora"]);
    // Sem comCpf, Ana (sem CPF) aparece, na ordem alfabética.
    expect((await getPessoas("")).items.map((p) => p.deNome)).toEqual(["Ana Sem Documento", "João Suplente", "Maria Gestora"]);
  });

  it("pessoasPorCpf: dois CPFs, um órfão, nulos e repetidos → mapa com um item (uma consulta)", async () => {
    const mapa = await pessoasPorCpf([MARIA, "39053344705", null, "529.982.247-25", undefined]);
    expect([...mapa.keys()]).toEqual([MARIA]);
    expect(mapa.get(MARIA)?.deNome).toBe("Maria Gestora");
    expect((await pessoasPorCpf([])).size).toBe(0);
  });
});

describe("022 › campo de busca remota (RemoteSearch)", () => {
  const lookup = contratos.fields.find((f) => f.name === "pessoaFisicaId")!.lookup as LookupConfig;
  /** `fetch` simulado que encaminha para a rota real, liberado só depois dos timers falsos. */
  function fakeFetch() {
    const calls: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fn = async (url: string) => {
      calls.push(url);
      await gate;
      return pessoasFisicas.GET(jsonRequest(url));
    };
    return { calls, release, fn };
  }
  const nextState = (states: RemoteState[]) =>
    vi.waitFor(() => {
      const last = states.at(-1);
      if (!last || last.status === "loading") throw new Error("aguardando");
      return last;
    });

  beforeAll(async () => {
    await prisma.pessoaFisica.createMany({
      data: Array.from({ length: 497 }, (_, i) => ({
        idPessoaFisica: 20000 + i,
        cpf: cpfDe(200000000 + i * 17),
        deNome: `Pessoa Teste ${String(i + 1).padStart(3, "0")}`,
        dtNascimento: nascimento,
      })),
    });
  });

  it("Digitar parte do nome: com 500 pessoas, 'Maria Ges' gera uma só consulta após a pausa e mostra 'Maria Gestora — 529.982.247-25'", async () => {
    await loginAs();
    expect(await prisma.pessoaFisica.count()).toBe(500);
    const states: RemoteState[] = [];
    const f = fakeFetch();
    vi.useFakeTimers();
    try {
      const search = new RemoteSearch(lookup, (s) => states.push(s), { fetch: f.fn });
      let typed = "";
      for (const ch of "Maria Ges") {
        typed += ch;
        search.search(typed);
        await vi.advanceTimersByTimeAsync(120); // digitação mais rápida que a pausa
      }
      expect(f.calls).toEqual([]);
      await vi.advanceTimersByTimeAsync(300);
      expect(f.calls).toEqual(["/api/pessoas_fisicas?comCpf=1&q=Maria%20Ges&size=20"]);
    } finally {
      vi.useRealTimers();
    }
    f.release();
    const final = await nextState(states);
    expect(final.status).toBe("ok");
    expect(final.options.map((o) => o.label)).toContain("Maria Gestora — 529.982.247-25");
    expect(f.calls).toHaveLength(1);
  });

  it("cancela a consulta anterior: só o resultado da última busca é entregue", async () => {
    await loginAs();
    const states: RemoteState[] = [];
    const f = fakeFetch();
    const search = new RemoteSearch(lookup, (s) => states.push(s), { fetch: f.fn });
    search.search("Pessoa", { immediate: true });
    search.search("João", { immediate: true });
    f.release();
    const final = await nextState(states);
    expect(f.calls).toHaveLength(2);
    expect(final.options.map((o) => o.label)).toEqual(["João Suplente — 111.444.777-35"]);
    expect(states.filter((s) => s.status === "ok")).toHaveLength(1);
  });

  it("Mais resultados do que cabem: 35 'Silva' → 20 opções e 'Mostrando 20 de 35 — continue digitando para refinar'", async () => {
    await loginAs();
    await prisma.pessoaFisica.createMany({
      data: Array.from({ length: 35 }, (_, i) => ({
        idPessoaFisica: 30000 + i,
        cpf: cpfDe(300000000 + i * 13),
        deNome: `Carlos Silva ${String(i + 1).padStart(2, "0")}`,
        dtNascimento: nascimento,
      })),
    });
    const states: RemoteState[] = [];
    const search = new RemoteSearch(lookup, (s) => states.push(s), { fetch: (url) => pessoasFisicas.GET(jsonRequest(url)) });
    search.search("Silva", { immediate: true });
    const final = await nextState(states);
    expect(final.options).toHaveLength(20);
    expect(final.total).toBe(35);
    expect(moreResultsMessage(final.options.length, final.total)).toBe("Mostrando 20 de 35 — continue digitando para refinar");
    expect(moreResultsMessage(3, 3)).toBeNull();
  });

  it("erro da API vira 'Erro ao buscar' (status error)", async () => {
    const states: RemoteState[] = [];
    const search = new RemoteSearch(lookup, (s) => states.push(s), { fetch: async () => new Response("x", { status: 500 }) });
    search.search("x", { immediate: true });
    expect((await nextState(states)).status).toBe("error");
  });
});

describe("022 › seed de referência", () => {
  const db = tempDb("seed-022-");
  beforeAll(() => db.deploy(migrationNames()), 60_000);
  afterAll(() => db.dispose());

  it("Seed recusado em produção / Seed em produção: NODE_ENV=production termina com erro e não grava nada", async () => {
    const r = db.run("seed-referencia.mjs", [], { NODE_ENV: "production" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/NODE_ENV=production/);
    expect(await db.client().pessoaFisica.count()).toBe(0);
    expect(await db.client().prestadorServico.count()).toBe(0);
  });

  it("fora de produção: 30 pessoas e 10 fornecedores com DV válido; rodar de novo não duplica; --preencher-existentes dá CPF a quem não tem", async () => {
    expect(db.run("seed-referencia.mjs").status).toBe(0);
    expect(db.run("seed-referencia.mjs").status).toBe(0);
    const pessoas = await db.client().pessoaFisica.findMany();
    const fornecedores = await db.client().prestadorServico.findMany();
    expect(pessoas).toHaveLength(30);
    expect(fornecedores).toHaveLength(10);
    expect(pessoas.every((p) => isCpfValido(p.cpf))).toBe(true);
    expect(fornecedores.every((f) => isCnpjValido(f.cnpj))).toBe(true);
    await db.client().pessoaFisica.create({ data: { idPessoaFisica: 1, deNome: "Sem CPF", dtNascimento: nascimento } });
    const r = db.run("seed-referencia.mjs", ["--preencher-existentes"]);
    expect(r.stdout).toContain("1 pessoas existentes receberam CPF fictício");
    const preenchida = await db.client().pessoaFisica.findFirstOrThrow({ where: { idPessoaFisica: 1 } });
    expect(isCpfValido(preenchida.cpf)).toBe(true);
    expect(await db.client().pessoaFisica.count()).toBe(31);
  }, 60_000);
});
