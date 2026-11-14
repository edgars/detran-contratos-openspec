import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { ANEXO_FISCAL } from "@/lib/rules/attachments";
import { UploadError, UploadSession, deleteStoredPdf, uploadDir } from "@/lib/uploads";
import { PDF_BYTES, PNG_BYTES } from "./helpers/auth";

// 024-kit-robustez › tasks 1.1: registro de arquivos da requisição.
const pdf = () => new File([PDF_BYTES], "a.pdf", { type: "application/pdf" });
const files = () => (existsSync(uploadDir()) ? readdirSync(uploadDir()) : []);

describe("024 › UploadSession e deleteStoredPdf", () => {
  const original = process.env.UPLOAD_DIR;
  beforeEach(() => {
    process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "uploads-024-"));
  });
  afterEach(() => {
    rmSync(uploadDir(), { recursive: true, force: true });
    process.env.UPLOAD_DIR = original;
  });

  it("save grava e devolve nome UUID", async () => {
    const s = new UploadSession();
    const nome = await s.save("anexo", pdf(), ANEXO_FISCAL);
    expect(nome).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(files()).toEqual([nome]);
    expect(s.saved).toEqual([nome]);
  });

  it("rollback apaga os arquivos gravados na requisição", async () => {
    const s = new UploadSession();
    await s.save("a", pdf(), ANEXO_FISCAL);
    await s.save("b", pdf(), ANEXO_FISCAL);
    expect(files()).toHaveLength(2);
    await s.rollback();
    expect(files()).toHaveLength(0);
  });

  it("commit apaga os descartados e mantém os gravados", async () => {
    const antigo = await new UploadSession().save("anexo", pdf(), ANEXO_FISCAL);
    const s = new UploadSession();
    const novo = await s.save("anexo", pdf(), ANEXO_FISCAL);
    s.discard(antigo);
    expect(files()).toHaveLength(2);
    await s.commit();
    expect(files()).toEqual([novo]);
  });

  it("discard de nome ainda referenciado por uma coluna de anexo não apaga", async () => {
    const nome = await new UploadSession().save("anexo", pdf(), ANEXO_FISCAL);
    const contrato = await prisma.contrato.create({ data: { objeto: "ref" } });
    await prisma.anexoFiscal.create({ data: { anexo: nome, contratoId: contrato.id, dataRegistro: new Date() } });
    const s = new UploadSession();
    s.discard(nome);
    await s.commit();
    expect(files()).toEqual([nome]);
  });

  it("UploadError.field preenchido com o campo do anexo", async () => {
    const s = new UploadSession();
    const erro = await s.save("anexoPublicacao", new File([PNG_BYTES], "x.pdf"), ANEXO_FISCAL).catch((e) => e);
    expect(erro).toBeInstanceOf(UploadError);
    expect(erro.field).toBe("anexoPublicacao");
    expect(erro.message).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect(files()).toHaveLength(0);
  });

  it("deleteStoredPdf ignora nome fora do padrão e arquivo inexistente", async () => {
    await expect(deleteStoredPdf("../../etc/passwd")).resolves.toBeUndefined();
    await expect(deleteStoredPdf("00000000-0000-0000-0000-000000000000.pdf")).resolves.toBeUndefined();
    const nome = await new UploadSession().save("anexo", pdf(), ANEXO_FISCAL);
    await deleteStoredPdf(nome);
    expect(files()).toHaveLength(0);
  });
});
