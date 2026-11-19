import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/anexos_fiscais/route";
import * as item from "@/app/api/anexos_fiscais/[id]/route";
import { anexosFiscaisSchema } from "@/lib/entities/anexos_fiscais.server";
import { anexosFiscais } from "@/lib/entities/anexos_fiscais";
import { uploadDir } from "@/lib/uploads";
import { PDF_BYTES, PNG_BYTES, idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

function multipart(url: string, method: string, fields: Record<string, string>, file?: File) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file) form.set("anexo", file);
  return new Request(`http://localhost${url}`, { method, body: form });
}
const pdf = () => new File([PDF_BYTES], "a.pdf", { type: "application/pdf" });
const fakePdf = () => new File([PNG_BYTES], "imagem.pdf", { type: "application/pdf" });

// Spec 013-anexos-fiscais: um teste por cenário, mais as regras RK de anexo.
describe("013-anexos-fiscais", () => {
  let contratoId: number;

  beforeAll(async () => {
    await prisma.anexoFiscal.deleteMany();
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato de teste", numeroContrato: "001/2026" } })).id;
    await prisma.anexoFiscal.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        anexo: `arquivo-${String(i + 1).padStart(2, "0")}.pdf`,
        dataRegistro: new Date(),
        contratoId,
      })),
    });
  });

  it("Abrir a lista: paginada, com a coluna anexo, e filtro pela busca", async () => {
    await loginAs();
    expect(anexosFiscais.columns.map((c) => c.key)).toEqual(["anexo"]);
    const page2 = await (await collection.GET(jsonRequest("/api/anexos_fiscais?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0]).toHaveProperty("anexo");
    const busca = await (await collection.GET(jsonRequest("/api/anexos_fiscais?q=arquivo-07"))).json();
    expect(busca.total).toBe(1);
  });

  it("Salvar um registro válido: grava o PDF em anexos_fiscais e a lista o exibe", async () => {
    await loginAs();
    const res = await collection.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(contratoId) }, pdf()));
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.anexo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(row.contratoId).toBe(contratoId);
    expect(new Date(row.dataRegistro).getTime()).toBeLessThanOrEqual(Date.now());
    expect(existsSync(join(uploadDir(), row.anexo))).toBe(true);
    const busca = await (await collection.GET(jsonRequest(`/api/anexos_fiscais?q=${row.anexo}`))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Alterar um registro: atualiza e a lista reflete; sem arquivo novo mantém o anexo atual", async () => {
    await loginAs();
    const outro = await prisma.contrato.create({ data: { objeto: "Outro" } });
    const reg = await prisma.anexoFiscal.create({ data: { anexo: "atual.pdf", dataRegistro: new Date(), contratoId } });
    const res = await item.PUT(jsonRequest(`/api/anexos_fiscais/${reg.id}`, "PUT", { contratoId: String(outro.id) }), idParams(reg.id));
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/anexos_fiscais/${reg.id}`), idParams(reg.id))).json();
    expect(lido).toMatchObject({ contratoId: outro.id, anexo: "atual.pdf" });

    const novo = await item.PUT(multipart(`/api/anexos_fiscais/${reg.id}`, "PUT", { contratoId: String(outro.id) }, pdf()), idParams(reg.id));
    expect(novo.status).toBe(200);
    expect((await novo.json()).anexo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("edição não aceita nome de arquivo enviado pelo cliente", async () => {
    await loginAs();
    const reg = await prisma.anexoFiscal.create({ data: { anexo: "mantido.pdf", dataRegistro: new Date(), contratoId } });
    const res = await item.PUT(
      jsonRequest(`/api/anexos_fiscais/${reg.id}`, "PUT", { anexo: "../../etc/passwd", contratoId: String(contratoId) }),
      idParams(reg.id),
    );
    expect(res.status).toBe(200);
    expect((await prisma.anexoFiscal.findUnique({ where: { id: reg.id } }))?.anexo).toBe("mantido.pdf");
  });

  it("Excluir com confirmação: o registro some da lista", async () => {
    await loginAs();
    const reg = await prisma.anexoFiscal.create({ data: { anexo: "temp.pdf", dataRegistro: new Date(), contratoId } });
    expect((await item.DELETE(jsonRequest(`/api/anexos_fiscais/${reg.id}`, "DELETE"), idParams(reg.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/anexos_fiscais/${reg.id}`), idParams(reg.id))).status).toBe(404);
  });

  it("Salvar sem um campo obrigatório: anexo vazio → 400 com a mensagem do campo e nada gravado (RK-23cdd0c37c3c)", async () => {
    await loginAs();
    const antes = await prisma.anexoFiscal.count();
    const res = await collection.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(contratoId) }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.anexo).toBe("Erro ao incluir Não existe arquivo para anexar!");
    expect(await prisma.anexoFiscal.count()).toBe(antes);
  });

  it("RK-9da08201400b RK-0e70b6c81ee9: anexo é obrigatório no schema", () => {
    const r = anexosFiscaisSchema.safeParse({ anexo: "", contratoId: 1 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Anexo é obrigatório");
  });

  it("RK-01658245d11b: imagem renomeada para .pdf é recusada", async () => {
    await loginAs();
    const antes = await prisma.anexoFiscal.count();
    const res = await collection.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(contratoId) }, fakePdf()));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.anexo).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect(await prisma.anexoFiscal.count()).toBe(antes);
  });

  it("contrato obrigatório e existente; campo fora do schema gera 400", async () => {
    await loginAs();
    const sem = await collection.POST(multipart("/api/anexos_fiscais", "POST", {}, pdf()));
    expect(sem.status).toBe(400);
    expect((await sem.json()).errors.contratoId).toBe("Contrato é obrigatório");
    const inexistente = await collection.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: "999999" }, pdf()));
    expect(inexistente.status).toBe(400);
    const extra = await collection.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: String(contratoId), id: "999" }, pdf()));
    expect(extra.status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/anexos_fiscais"))).status).toBe(401);
    expect((await collection.POST(multipart("/api/anexos_fiscais", "POST", { contratoId: "1" }, pdf()))).status).toBe(401);
  });
});
