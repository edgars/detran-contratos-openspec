import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import * as collection from "@/app/api/anexos_publicacaos/route";
import * as item from "@/app/api/anexos_publicacaos/[id]/route";
import { anexosPublicacaos } from "@/lib/entities/anexos_publicacaos";
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

// Spec 015-anexos-publicacaos: um teste por cenário, mais as regras RK de anexo.
describe("015-anexos-publicacaos", () => {
  let contratoId: number;
  const base = () => ({ contratoId: String(contratoId), dataPublicacao: "15/03/2026" });

  beforeAll(async () => {
    await prisma.anexoPublicacao.deleteMany();
    contratoId = (await prisma.contrato.create({ data: { objeto: "Contrato de teste", numeroContrato: "002/2026" } })).id;
    await prisma.anexoPublicacao.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        anexo: `publicacao-${String(i + 1).padStart(2, "0")}.pdf`,
        dataPublicacao: new Date("2026-01-10T12:00:00Z"),
        contratoId,
      })),
    });
  });

  it("Abrir a lista: paginada, com a coluna anexo, e filtro pela busca", async () => {
    await loginAs();
    expect(anexosPublicacaos.columns.map((c) => c.key)).toEqual(["anexo"]);
    const page2 = await (await collection.GET(jsonRequest("/api/anexos_publicacaos?page=2&size=10"))).json();
    expect(page2).toMatchObject({ page: 2, size: 10, total: 25 });
    expect(page2.items).toHaveLength(10);
    const busca = await (await collection.GET(jsonRequest("/api/anexos_publicacaos?q=publicacao-07"))).json();
    expect(busca.total).toBe(1);
  });

  it("Salvar um registro válido: grava o PDF em anexos_publicacao e a lista o exibe", async () => {
    await loginAs();
    const res = await collection.POST(multipart("/api/anexos_publicacaos", "POST", base(), pdf()));
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.anexo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(row.contratoId).toBe(contratoId);
    expect(new Date(row.dataPublicacao).getFullYear()).toBe(2026);
    expect(existsSync(join(uploadDir(), row.anexo))).toBe(true);
    const busca = await (await collection.GET(jsonRequest(`/api/anexos_publicacaos?q=${row.anexo}`))).json();
    expect(busca.items).toHaveLength(1);
  });

  it("Alterar um registro: atualiza e a lista reflete; sem arquivo novo mantém o anexo atual", async () => {
    await loginAs();
    const reg = await prisma.anexoPublicacao.create({ data: { anexo: "atual.pdf", dataPublicacao: new Date(), contratoId } });
    const res = await item.PUT(
      jsonRequest(`/api/anexos_publicacaos/${reg.id}`, "PUT", { contratoId: String(contratoId), dataPublicacao: "01/02/2026" }),
      idParams(reg.id),
    );
    expect(res.status).toBe(200);
    // 024-kit-robustez: nome de arquivo enviado como texto é recusado no campo (antes era ignorado).
    const forjado = await item.PUT(
      jsonRequest(`/api/anexos_publicacaos/${reg.id}`, "PUT", { contratoId: String(contratoId), dataPublicacao: "01/02/2026", anexo: "forjado.pdf" }),
      idParams(reg.id),
    );
    expect(forjado.status).toBe(400);
    expect((await forjado.json()).errors.anexo).toBe("Envie o arquivo em PDF");
    const lido = await (await item.GET(jsonRequest(`/api/anexos_publicacaos/${reg.id}`), idParams(reg.id))).json();
    expect(lido.anexo).toBe("atual.pdf");
    expect(lido.dataPublicacao).toBe("2026-02-01T00:00:00.000Z");

    const novo = await item.PUT(multipart(`/api/anexos_publicacaos/${reg.id}`, "PUT", base(), pdf()), idParams(reg.id));
    expect(novo.status).toBe(200);
    expect((await novo.json()).anexo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("Excluir com confirmação: o registro some da lista", async () => {
    await loginAs();
    const reg = await prisma.anexoPublicacao.create({ data: { anexo: "temp.pdf", dataPublicacao: new Date(), contratoId } });
    expect((await item.DELETE(jsonRequest(`/api/anexos_publicacaos/${reg.id}`, "DELETE"), idParams(reg.id))).status).toBe(204);
    expect((await item.GET(jsonRequest(`/api/anexos_publicacaos/${reg.id}`), idParams(reg.id))).status).toBe(404);
  });

  it("RK-e2b53b79c3c2: inclusão sem arquivo é recusada e nada é gravado", async () => {
    await loginAs();
    const antes = await prisma.anexoPublicacao.count();
    const res = await collection.POST(multipart("/api/anexos_publicacaos", "POST", base()));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.anexo).toBe("Erro ao incluir Não existe arquivo para anexar!");
    expect(await prisma.anexoPublicacao.count()).toBe(antes);
  });

  it("RK-9aa2ad64672e: imagem renomeada para .pdf é recusada", async () => {
    await loginAs();
    const antes = await prisma.anexoPublicacao.count();
    const res = await collection.POST(multipart("/api/anexos_publicacaos", "POST", base(), fakePdf()));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.anexo).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect(await prisma.anexoPublicacao.count()).toBe(antes);
  });

  it("corpo inválido gera 400: sem contrato, data inválida ou campo fora do schema", async () => {
    await loginAs();
    const semContrato = await collection.POST(multipart("/api/anexos_publicacaos", "POST", { dataPublicacao: "15/03/2026" }, pdf()));
    expect(semContrato.status).toBe(400);
    expect((await semContrato.json()).errors.contratoId).toBe("Contrato é obrigatório");
    const semData = await collection.POST(multipart("/api/anexos_publicacaos", "POST", { contratoId: String(contratoId) }, pdf()));
    expect(semData.status).toBe(400);
    expect((await semData.json()).errors.dataPublicacao).toBe("Data de publicação é obrigatório");
    const extra = await collection.POST(multipart("/api/anexos_publicacaos", "POST", { ...base(), id: "9" }, pdf()));
    expect(extra.status).toBe(400);
    const inexistente = await collection.POST(multipart("/api/anexos_publicacaos", "POST", { ...base(), contratoId: "999999" }, pdf()));
    expect(inexistente.status).toBe(400);
  });

  it("sem sessão responde 401", async () => {
    logout();
    expect((await collection.GET(jsonRequest("/api/anexos_publicacaos"))).status).toBe(401);
  });
});
