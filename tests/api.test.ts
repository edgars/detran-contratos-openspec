import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parsePagination, validationError } from "@/lib/api/http";
import { corsHeaders } from "@/lib/api/cors";
import { REFERENCE_TABLES } from "@/lib/reference/tables";
import * as diretorias from "@/app/api/diretorias/route";
import * as pessoasFisicas from "@/app/api/pessoas_fisicas/route";
import * as pessoas from "@/app/api/pessoas/route";
import * as prestadores from "@/app/api/prestadores_servicos/route";
import * as groupsUsers from "@/app/api/groups_users/route";
import * as pagamentoArquivos from "@/app/api/pagamento_arquivos/route";
import * as groups from "@/app/api/groups/route";
import { tipoContratoFields } from "@/lib/rules";

const routes = {
  diretorias,
  pessoas_fisicas: pessoasFisicas,
  pessoas,
  prestadores_servicos: prestadores,
  groups_users: groupsUsers,
  pagamento_arquivos: pagamentoArquivos,
  groups,
} as const;

const get = (table: keyof typeof routes, query = "") =>
  routes[table].GET(new Request(`http://localhost/api/${table}${query}`));

beforeAll(async () => {
  await prisma.diretoria.createMany({
    data: Array.from({ length: 25 }, (_, i) => ({ deDiretoria: `Diretoria ${i + 1}`, codigo: `D${i + 1}` })),
  });
  await prisma.diretoria.create({ data: { deDiretoria: "Diretoria de Contratos", codigo: "DCT" } });
  await prisma.pessoaFisica.create({ data: { idPessoaFisica: 1, deNome: "Maria Souza", dtNascimento: new Date("1980-05-10") } });
  await prisma.pessoa.create({ data: { cpf: "123.456.789-01" } });
  await prisma.prestadorServico.create({ data: { deRazaoSocial: "ACME Serviços Ltda" } });
  await prisma.groupUser.create({ data: { groupId: 1, userId: 1 } });
  await prisma.pagamentoArquivo.create({ data: { arquivo: "nota-fiscal.pdf", pagamentoId: 1 } });
  await prisma.group.create({ data: { name: "Gestores" } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("dados de referência somente leitura", () => {
  it("expõe uma rota por tabela de referência", () => {
    expect(Object.keys(routes).sort()).toEqual([...REFERENCE_TABLES].sort());
  });

  it("nenhuma tabela de referência aceita criação, edição ou exclusão", () => {
    for (const route of Object.values(routes)) {
      expect(Object.keys(route).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k))).toEqual([]);
    }
  });

  it("toda tabela lista pela API", async () => {
    for (const table of REFERENCE_TABLES) {
      const res = await get(table);
      expect(res.status, table).toBe(200);
      const body = await res.json();
      expect(body.total, table).toBeGreaterThan(0);
    }
  });

  it("pagina com page e size", async () => {
    const body = await (await get("diretorias", "?page=2&size=10")).json();
    expect(body).toMatchObject({ page: 2, size: 10, total: 26 });
    expect(body.items).toHaveLength(10);
    expect(body.items[0].deDiretoria).toBe("Diretoria 11");
  });

  it("busca com q", async () => {
    const body = await (await get("diretorias", "?q=Contratos")).json();
    expect(body.total).toBe(1);
    expect(body.items[0].codigo).toBe("DCT");
  });

  it("busca com aspas não quebra a consulta", async () => {
    const res = await get("prestadores_servicos", `?q=${encodeURIComponent("' OR 1=1 --")}`);
    expect(res.status).toBe(200);
    expect((await res.json()).total).toBe(0);
  });
});

describe("convenções da API", () => {
  it("normaliza paginação inválida", () => {
    expect(parsePagination(new URLSearchParams("page=-3&size=5000&q=%20x%20"))).toEqual({ page: 1, size: 100, q: "x" });
  });

  // Spec app-shell › "Corpo inválido"
  it("corpo inválido responde 400 nomeando o campo e a mensagem", async () => {
    const schema = z.object(tipoContratoFields);
    const result = schema.safeParse({ nome: "Serviço", gerenciamento: "" });
    expect(result.success).toBe(false);
    const res = validationError(result.error!);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ errors: { gerenciamento: "Gerenciamento é obrigatório" } });
  });

  it("CORS só para a origem do frontend", () => {
    expect(corsHeaders("http://localhost:3000", "http://localhost:3000").get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(corsHeaders("https://evil.example", "http://localhost:3000").get("Access-Control-Allow-Origin")).toBeNull();
    expect(corsHeaders(null, "http://localhost:3000").get("Access-Control-Allow-Origin")).toBeNull();
  });
});
