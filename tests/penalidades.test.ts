import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/penalidades/route";
import * as item from "@/app/api/penalidades/[id]/route";
import { penalidades } from "@/lib/entities/penalidades";
import { uploadDir } from "@/lib/uploads";
import { PDF_BYTES, PNG_BYTES, idParams, jsonRequest, loginAs, logout } from "./helpers/auth";

function multipart(url: string, method: string, fields: Record<string, string>, file?: File) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file) form.set("arquivo", file);
  return new Request(`http://localhost${url}`, { method, body: form });
}
const pdf = () => new File([PDF_BYTES], "a.pdf", { type: "application/pdf" });
const fakePdf = () => new File([PNG_BYTES], "imagem.pdf", { type: "application/pdf" });

// Spec 016-penalidades: um teste por cenário, mais as regras RK de anexo e a autoria pela sessão.
describe("016-penalidades", () => {
  let contratoId: number;
  let outroUserId: number;

  beforeAll(async () => {
    await prisma.penalidade.deleteMany();
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato de teste", numeroContrato: "003/2026" } })).id;
    outroUserId = (await loginAs("outro-usuario")).id;
    await prisma.penalidade.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        arquivo: `penalidade-${String(i + 1).padStart(2, "0")}.pdf`,
        dataRegistro: new Date(),
        contratoId,
        userId: outroUserId,
      })),
    });
  });

  it("Abrir a lista: paginada, com a coluna arquivo, e filtro pela busca", async () => {
    await loginAs();
    expect(penalidades.columns.map((c) => c.key)).toEqual(["arquivo"]);
    const page2 = await (await collection.GET(jsonRequest("/api/penalidades?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items).toHaveLength(10);
    const busca = await (await collection.GET(jsonRequest("/api/penalidades?q=penalidade-07"))).json();
    expect(busca.total).toBe(1);
  });

  it("Salvar um registro válido: grava o PDF em penalidades e a lista o exibe", async () => {
    await loginAs();
    const res = await collection.POST(multipart("/api/penalidades", "POST", { contratoId: String(contratoId) }, pdf()));
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.arquivo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(existsSync(join(uploadDir(), row.arquivo))).toBe(true);
    expect(new Date(row.dataRegistro).getTime()).toBeLessThanOrEqual(Date.now());
    const busca = await (await collection.GET(jsonRequest(`/api/penalidades?q=${row.arquivo}`))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("autoria pela sessão: userId forjado no corpo é descartado e a penalidade fica com o usuário logado", async () => {
    const eu = await loginAs();
    const res = await collection.POST(
      multipart("/api/penalidades", "POST", { contratoId: String(contratoId), userId: String(outroUserId) }, pdf()),
    );
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.userId).toBe(eu.id);
    expect((await prisma.penalidade.findUnique({ where: { id: row.id } }))?.userId).toBe(eu.id);
  });

  it("Alterar um registro: atualiza e a lista reflete; arquivo e autoria atuais são mantidos", async () => {
    await loginAs();
    const outro = await prisma.contrato.create({ data: { objeto: "Outro" } });
    const reg = await prisma.penalidade.create({ data: { arquivo: "atual.pdf", dataRegistro: new Date(), contratoId, userId: outroUserId } });
    const res = await item.PUT(
      jsonRequest(`/api/penalidades/${reg.id}`, "PUT", { contratoId: String(outro.id), arquivo: "forjado.pdf", userId: 12345 }),
      idParams(reg.id),
    );
    expect(res.status).toBe(200);
    const lido = await (await item.GET(jsonRequest(`/api/penalidades/${reg.id}`), idParams(reg.id))).json();
    expect(lido).toMatchObject({ contratoId: outro.id, arquivo: "atual.pdf", userId: outroUserId });

    const novo = await item.PUT(multipart(`/api/penalidades/${reg.id}`, "PUT", { contratoId: String(outro.id) }, pdf()), idParams(reg.id));
    expect(novo.status).toBe(200);
    expect((await novo.json()).arquivo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("Excluir com confirmação: o registro some da lista", async () => {
    await loginAs();
    const reg = await prisma.penalidade.create({ data: { arquivo: "temp.pdf", dataRegistro: new Date(), contratoId, userId: outroUserId } });
    expect((await item.DELETE(jsonRequest(`/api/penalidades/${reg.id}`, "DELETE"), idParams(reg.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/penalidades/${reg.id}`), idParams(reg.id))).status).toBe(404);
  });

  it("RK-abb6ac79fad7: inclusão sem arquivo é recusada e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.penalidade.count();
    const res = await collection.POST(multipart("/api/penalidades", "POST", { contratoId: String(contratoId) }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.arquivo).toBe("Erro ao incluir Não existe arquivo para anexar!");
    expect(await prisma.penalidade.count()).toBe(antes);
  });

  it("RK-174d58601890: imagem renomeada para .pdf é recusada", async () => {
    await loginAs();
    const antes = await prisma.penalidade.count();
    const res = await collection.POST(multipart("/api/penalidades", "POST", { contratoId: String(contratoId) }, fakePdf()));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.arquivo).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect(await prisma.penalidade.count()).toBe(antes);
  });

  it("corpo inválido gera 400: sem contrato, contrato inexistente ou campo fora do schema", async () => {
    await loginAs();
    const sem = await collection.POST(multipart("/api/penalidades", "POST", {}, pdf()));
    expect(sem.status).toBe(400);
    expect((await sem.json()).errors.contratoId).toBe("Contrato é obrigatório");
    expect((await collection.POST(multipart("/api/penalidades", "POST", { contratoId: "999999" }, pdf()))).status).toBe(400);
    expect((await collection.POST(multipart("/api/penalidades", "POST", { contratoId: String(contratoId), id: "7" }, pdf()))).status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/penalidades"))).status).toBe(401);
  });
});
