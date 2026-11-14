import { vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { crudHandlers, searchWhere, sortOrder } from "@/lib/crud/server";
import { ANEXO_FISCAL } from "@/lib/rules/attachments";
import { uploadDir } from "@/lib/uploads";
import * as fiscaisCol from "@/app/api/anexos_fiscais/route";
import * as fiscaisItem from "@/app/api/anexos_fiscais/[id]/route";
import * as publicacoesCol from "@/app/api/anexos_publicacaos/route";
import * as publicacoesItem from "@/app/api/anexos_publicacaos/[id]/route";
import * as penalidadesCol from "@/app/api/penalidades/route";
import * as statusItem from "@/app/api/status/[id]/route";
import * as contratosCol from "@/app/api/contratos/route";
import * as usersCol from "@/app/api/users/route";
import * as contratoStatusCol from "@/app/api/contrato_status/route";
import { contratos } from "@/lib/entities/contratos";
import { ariaSort, nextSort, parseSort, withSortParam } from "@/components/crud/sort";
import { PDF_BYTES, PNG_BYTES, idParams, jsonRequest, loginAs } from "./helpers/auth";

// Spec 024-kit-robustez › crud-kit: um teste por cenário (e as verificações de tasks.md).

const pdf = () => new File([PDF_BYTES], "a.pdf", { type: "application/pdf" });
const png = () => new File([PNG_BYTES], "imagem.pdf", { type: "application/pdf" });
const files = () => (existsSync(uploadDir()) ? readdirSync(uploadDir()) : []);
const has = (nome: string) => existsSync(join(uploadDir(), nome));

function multipart(url: string, method: string, fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request(`http://localhost${url}`, { method, body: form });
}

/** Delegate falso que conta chamadas; `fail` faz create/update lançarem o erro dado. */
function fakeDelegate(row: Record<string, unknown>, fail?: unknown) {
  const calls = { findUnique: 0, findMany: [] as object[], create: 0, update: 0 };
  const delegate = {
    findMany: async (args: object) => {
      calls.findMany.push(args);
      return [row];
    },
    count: async () => 1,
    findUnique: async () => {
      calls.findUnique++;
      return row;
    },
    create: async (args: { data: object }) => {
      calls.create++;
      if (fail) throw fail;
      return { ...row, ...args.data };
    },
    update: async (args: { data: object }) => {
      calls.update++;
      if (fail) throw fail;
      return { ...row, ...args.data };
    },
    delete: async () => row,
  };
  return { delegate, calls };
}

describe("024-kit-robustez › crud-kit", () => {
  const original = process.env.UPLOAD_DIR;
  let contratoId: number;

  beforeAll(async () => {
    contratoId = (await prisma.contrato.create({ data: { objeto: "Kit", numeroContrato: "KIT-1" } })).id;
  });
  beforeEach(() => {
    process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "crud-kit-"));
  });
  afterEach(() => {
    rmSync(uploadDir(), { recursive: true, force: true });
    process.env.UPLOAD_DIR = original;
  });

  async function anexoFiscal() {
    const res = await fiscaisCol.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(contratoId), anexo: pdf() }));
    expect(res.status).toBe(201);
    return (await res.json()) as { id: number; anexo: string };
  }

  describe("Anexos desfeitos quando a gravação falha", () => {
    it("Validação falha depois do upload: 400 em contratoId e UPLOAD_DIR com N arquivos", async () => {
      await loginAs();
      const n = files().length;
      const res = await fiscaisCol.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: "", anexo: pdf() }));
      expect(res.status).toBe(400);
      expect((await res.json()).errors.contratoId).toBeTruthy();
      expect(files()).toHaveLength(n);
    });

    it("Erro do banco depois do upload: P2003 → 409 e o PDF não fica no disco", async () => {
      await loginAs();
      const { delegate } = fakeDelegate({ id: 1 }, { code: "P2003" });
      const api = crudHandlers({ resource: "anexos_fiscais", delegate: () => delegate, schema: z.object({}), fileFields: { arquivo: { rule: ANEXO_FISCAL } } });
      const res = await api.create(multipart("/api/x", "POST", { arquivo: pdf() }));
      expect(res.status).toBe(409);
      expect(files()).toHaveLength(0);
    });
  });

  describe("Troca de anexo remove o arquivo anterior", () => {
    it("Trocar o PDF de um anexo fiscal: coluna aponta para o novo e a.pdf sai do disco", async () => {
      await loginAs();
      const a = await anexoFiscal();
      const res = await fiscaisItem.PUT(
        multipart(`/api/anexos_fiscais/${a.id}`, "PUT", { contratoId: String(contratoId), anexo: pdf() }),
        idParams(a.id),
      );
      expect(res.status).toBe(200);
      const novo = (await prisma.anexoFiscal.findUnique({ where: { id: a.id } }))!.anexo;
      expect(novo).not.toBe(a.anexo);
      expect(has(novo)).toBe(true);
      expect(has(a.anexo)).toBe(false);
    });

    it("Edição sem arquivo novo: a coluna continua a.pdf e o arquivo continua no disco", async () => {
      await loginAs();
      const a = await anexoFiscal();
      const res = await fiscaisItem.PUT(jsonRequest(`/api/anexos_fiscais/${a.id}`, "PUT", { contratoId: String(contratoId) }), idParams(a.id));
      expect(res.status).toBe(200);
      expect((await prisma.anexoFiscal.findUnique({ where: { id: a.id } }))!.anexo).toBe(a.anexo);
      expect(has(a.anexo)).toBe(true);
    });

    it("Edição que falha não perde o anexo: contrato inexistente → 400, a.pdf fica e o novo sai", async () => {
      await loginAs();
      const a = await anexoFiscal();
      const res = await fiscaisItem.PUT(
        multipart(`/api/anexos_fiscais/${a.id}`, "PUT", { contratoId: "999999", anexo: pdf() }),
        idParams(a.id),
      );
      expect(res.status).toBe(400);
      expect(files()).toEqual([a.anexo]);
      expect((await prisma.anexoFiscal.findUnique({ where: { id: a.id } }))!.anexo).toBe(a.anexo);
    });
  });

  describe("Exclusão com gancho e sem anexos órfãos", () => {
    it("Excluir um anexo de publicação: a linha sai e p.pdf sai do disco", async () => {
      await loginAs();
      const res = await publicacoesCol.POST(
        multipart("/api/anexos_publicacaos", "POST", { contratoId: String(contratoId), dataPublicacao: "01/02/2026", anexo: pdf() }),
      );
      expect(res.status).toBe(201);
      const p = await res.json();
      expect(has(p.anexo)).toBe(true);
      expect((await publicacoesItem.DELETE(jsonRequest(`/api/anexos_publicacaos/${p.id}`, "DELETE"), idParams(p.id))).status).toBe(204);
      expect(await prisma.anexoPublicacao.findUnique({ where: { id: p.id } })).toBeNull();
      expect(has(p.anexo)).toBe(false);
    });

    it("Gancho recusa a exclusão: Status usado por contrato_status → 409 e o Status continua", async () => {
      await loginAs();
      const status = await prisma.status.create({ data: { nome: "Em uso (kit)" } });
      await prisma.contratoStatus.create({ data: { contratoId, statusId: status.id } });
      const res = await statusItem.DELETE(jsonRequest(`/api/status/${status.id}`, "DELETE"), idParams(status.id));
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe("Registro em uso por outro cadastro");
      expect(await prisma.status.findUnique({ where: { id: status.id } })).not.toBeNull();
    });

    it("beforeDelete lançando: o arquivo do registro continua no disco", async () => {
      await loginAs();
      const a = await anexoFiscal();
      const api = crudHandlers({
        resource: "anexos_fiscais",
        delegate: (db = prisma) => db.anexoFiscal,
        schema: z.object({}),
        fileFields: { anexo: { rule: ANEXO_FISCAL } },
        beforeDelete: () => {
          throw new (class extends Error {})("falhou");
        },
      });
      await expect(api.remove(jsonRequest(`/api/x/${a.id}`, "DELETE"), idParams(a.id))).rejects.toThrow("falhou");
      expect(has(a.anexo)).toBe(true);
      expect(await prisma.anexoFiscal.findUnique({ where: { id: a.id } })).not.toBeNull();
    });
  });

  describe("Erro de upload no campo", () => {
    it("PDF inválido em penalidade: errors.arquivo com a mensagem e sem errors._ (RK-174d58601890)", async () => {
      await loginAs();
      const res = await penalidadesCol.POST(multipart("/api/penalidades", "POST", { contratoId: String(contratoId), arquivo: png() }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.errors.arquivo).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
      expect(body.errors._).toBeUndefined();
    });

    it("Arquivo ausente na inclusão: errors.anexo = Não existe arquivo para anexar! (RK-e2b53b79c3c2)", async () => {
      await loginAs();
      const res = await publicacoesCol.POST(
        multipart("/api/anexos_publicacaos", "POST", { contratoId: String(contratoId), dataPublicacao: "01/02/2026" }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).errors.anexo).toBe("Erro ao incluir Não existe arquivo para anexar!");
    });
  });

  describe("Registro atual disponível no prepare", () => {
    it("Prepare na edição: recebe current e o delegate tem uma única chamada de findUnique", async () => {
      await loginAs();
      const row = { id: 5, nome: "antes" };
      const { delegate, calls } = fakeDelegate(row);
      let visto: unknown;
      const api = crudHandlers({
        resource: "anexos_fiscais",
        delegate: () => delegate,
        schema: z.object({ nome: z.string() }),
        prepare: (raw, ctx) => {
          visto = ctx.current;
          return raw;
        },
      });
      const res = await api.update(jsonRequest("/api/x/5", "PUT", { nome: "depois" }), idParams(5));
      expect(res.status).toBe(200);
      expect(visto).toEqual(row);
      expect(calls.findUnique).toBe(1);
    });
  });

  describe("Filtro de lista assíncrono", () => {
    it("listWhere assíncrono recebe user e q, e o kit aguarda o filtro", async () => {
      const eu = await loginAs();
      const { delegate, calls } = fakeDelegate({ id: 1 });
      let ctxVisto: { user: { id: number }; q: string } | undefined;
      const api = crudHandlers({
        resource: "anexos_fiscais",
        delegate: () => delegate,
        schema: z.object({}),
        listWhere: async (params, ctx) => {
          ctxVisto = ctx;
          await new Promise((r) => setTimeout(r, 5));
          return { marca: params.get("marca") };
        },
      });
      expect((await api.list(jsonRequest("/api/x?q=abc&marca=7"))).status).toBe(200);
      expect(ctxVisto?.user.id).toBe(eu.id);
      expect(ctxVisto?.q).toBe("abc");
      expect(calls.findMany[0]).toMatchObject({ where: { AND: [{ marca: "7" }] } });
    });
  });

  describe("Busca em colunas numéricas", () => {
    it("searchWhere: texto com contains; int só quando q é inteiro; nenhum campo → OR vazio", () => {
      const fields = ["nome", { field: "periodo", type: "int" as const }];
      expect(searchWhere("30", fields)).toEqual({ OR: [{ nome: { contains: "30" } }, { periodo: 30 }] });
      expect(searchWhere("abc", fields)).toEqual({ OR: [{ nome: { contains: "abc" } }] });
      expect(searchWhere("abc", [{ field: "periodo", type: "int" }])).toEqual({ OR: [] });
      expect(searchWhere("", fields)).toBeNull();
    });

    it("contrato_status com q=abc responde 200 (atendido é Int)", async () => {
      await loginAs();
      expect((await contratoStatusCol.GET(jsonRequest("/api/contrato_status?q=abc"))).status).toBe(200);
      expect((await contratoStatusCol.GET(jsonRequest("/api/contrato_status?q=sim"))).status).toBe(200);
    });
  });

  describe("Ordenação escolhida pelo operador", () => {
    it("Ordenar contratos pelo vencimento: sort=dataTermino:asc", async () => {
      await loginAs();
      for (const d of ["2027-01-10", "2027-01-05", "2027-01-20"]) {
        await prisma.contrato.create({ data: { objeto: "Ord", numeroContrato: `SRT-${d}`, dataTermino: new Date(`${d}T00:00:00Z`) } });
      }
      const body = await (await contratosCol.GET(jsonRequest("/api/contratos?q=SRT-&sort=dataTermino:asc"))).json();
      expect(body.items.map((c: { dataTermino: string }) => c.dataTermino.slice(0, 10))).toEqual(["2027-01-05", "2027-01-10", "2027-01-20"]);
      const desc = await (await contratosCol.GET(jsonRequest("/api/contratos?q=SRT-&sort=dataTermino:desc"))).json();
      expect(desc.items[0].dataTermino.slice(0, 10)).toBe("2027-01-20");
    });

    it("Campo não permitido: GET /api/users?sort=passwordHash:asc → 200 na ordem padrão", async () => {
      await loginAs("zz-ordem");
      await loginAs("aa-ordem");
      const padrao = await (await usersCol.GET(jsonRequest("/api/users?size=100"))).json();
      const res = await usersCol.GET(jsonRequest("/api/users?size=100&sort=passwordHash:asc"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items.map((u: { id: number }) => u.id)).toEqual(padrao.items.map((u: { id: number }) => u.id));
      expect(JSON.stringify(body)).not.toContain("passwordHash");
    });

    it("sortOrder: campo permitido + desempate id desc; não permitido → orderBy padrão", () => {
      const p = (qs: string) => new URLSearchParams(qs);
      expect(sortOrder(p("sort=dataTermino:asc"), ["dataTermino"], undefined)).toEqual([{ dataTermino: "asc" }, { id: "desc" }]);
      expect(sortOrder(p("sort=dataTermino&dir=desc"), ["dataTermino"], undefined)).toEqual([{ dataTermino: "desc" }, { id: "desc" }]);
      expect(sortOrder(p("sort=passwordHash:asc"), [], { username: "asc" })).toEqual([{ username: "asc" }, { id: "desc" }]);
      expect(sortOrder(p(""), undefined, undefined)).toEqual([{ id: "desc" }]);
    });

    it("Clicar no cabeçalho: Vencimento ordenável; 1º clique crescente, 2º decrescente; sort na URL", () => {
      const coluna = contratos.columns.find((c) => c.key === "dataTermino") as { sortable?: boolean; label: string };
      expect(coluna.sortable).toBe(true);
      expect(coluna.label).toContain("vencimento");
      const primeiro = nextSort(null, "dataTermino");
      expect(primeiro).toEqual({ field: "dataTermino", dir: "asc" });
      expect(ariaSort(primeiro, "dataTermino")).toBe("ascending");
      expect(withSortParam("?vencendoEm=30", primeiro)).toBe("?vencendoEm=30&sort=dataTermino%3Aasc");
      const segundo = nextSort(primeiro, "dataTermino");
      expect(segundo).toEqual({ field: "dataTermino", dir: "desc" });
      expect(ariaSort(segundo, "dataTermino")).toBe("descending");
      expect(ariaSort(segundo, "valorTotal")).toBe("none");
      expect(parseSort(new URLSearchParams(withSortParam("", segundo)).get("sort"))).toEqual(segundo);
    });
  });

  describe("Valor único duplicado responde 409", () => {
    it("Gravação com valor único repetido: P2002 → 409 e nenhum PDF da requisição no disco", async () => {
      await loginAs();
      const { delegate } = fakeDelegate({ id: 1 }, { code: "P2002" });
      const api = crudHandlers({ resource: "anexos_fiscais", delegate: () => delegate, schema: z.object({}), fileFields: { arquivo: { rule: ANEXO_FISCAL } } });
      const res = await api.create(multipart("/api/x", "POST", { arquivo: pdf() }));
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe("Já existe um registro com esse valor");
      expect(files()).toHaveLength(0);
    });
  });
});
