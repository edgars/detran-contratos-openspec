import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AttachmentRule } from "@/lib/rules/attachments";

/** Pasta dos anexos, fora de `public/`. */
export function uploadDir(): string {
  return resolve(process.env.UPLOAD_DIR ?? "data/uploads");
}

export function uploadMaxBytes(): number {
  const mb = Number(process.env.UPLOAD_MAX_MB ?? 10);
  return (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024;
}

/** Upload recusado. `field` é o campo do anexo: o kit responde `400 { errors: { [field]: message } }`. */
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

const STORED_NAME = /^[0-9a-f-]{36}\.pdf$/;

/**
 * Grava um PDF enviado (001b-security-baseline › "Upload de PDF validado"):
 * exige arquivo, confere a assinatura `%PDF-` no conteúdo (o tipo informado pelo navegador não
 * basta), aplica `UPLOAD_MAX_MB` e grava fora de `public/` com nome gerado.
 * Devolve o nome gravado, que é o valor salvo na coluna do anexo.
 */
export async function savePdf(file: unknown, rule: AttachmentRule): Promise<string> {
  if (!(file instanceof Blob) || file.size === 0) throw new UploadError(rule.missing);
  if (file.size > uploadMaxBytes()) {
    throw new UploadError(`O arquivo passa do limite de ${uploadMaxBytes() / 1024 / 1024} MB`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new UploadError(rule.notPdf);
  const name = `${randomUUID()}.pdf`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(join(uploadDir(), name), bytes);
  return name;
}

/** Lê um anexo gravado; só aceita nomes gerados por `savePdf`. */
export async function readStoredPdf(name: string): Promise<Buffer | null> {
  if (!STORED_NAME.test(name)) return null;
  try {
    return await readFile(join(uploadDir(), name));
  } catch {
    return null;
  }
}

/** Apaga um anexo gravado. Nome fora do padrão de `savePdf` é ignorado; arquivo inexistente não é erro. */
export async function deleteStoredPdf(name: string): Promise<void> {
  if (!STORED_NAME.test(name)) return;
  try {
    await unlink(join(uploadDir(), name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/**
 * Nome ainda referenciado por alguma coluna de anexo (`contratos.anexo`, `anexos_fiscais.anexo`,
 * `anexos_publicacao.anexo`, `penalidades.arquivo`): `commit()` não o apaga.
 */
async function isReferenced(name: string): Promise<boolean> {
  const counts = await Promise.all([
    prisma.contrato.count({ where: { anexo: name } }),
    prisma.anexoFiscal.count({ where: { anexo: name } }),
    prisma.anexoPublicacao.count({ where: { anexo: name } }),
    prisma.penalidade.count({ where: { arquivo: name } }),
  ]);
  return counts.some((n) => n > 0);
}

/** Falha ao apagar não desfaz a gravação: só registra o nome (nunca o conteúdo). */
async function removeQuietly(name: string) {
  try {
    await deleteStoredPdf(name);
  } catch {
    console.warn(`Não foi possível apagar o anexo ${name}`);
  }
}

/**
 * Registro de arquivos de uma requisição (024-kit-robustez › design.md › "Registro de arquivos da
 * requisição"). `save` grava via `savePdf` e lembra o nome; `rollback` apaga os gravados quando a
 * gravação no banco não termina; `discard` agenda o arquivo substituído ou do registro excluído,
 * apagado só no `commit`, depois que o banco confirmou.
 */
export class UploadSession {
  readonly saved: string[] = [];
  readonly replaced: string[] = [];

  async save(field: string, file: unknown, rule: AttachmentRule): Promise<string> {
    try {
      const name = await savePdf(file, rule);
      this.saved.push(name);
      return name;
    } catch (error) {
      if (error instanceof UploadError) throw new UploadError(error.message, field);
      throw error;
    }
  }

  discard(name: string | null | undefined): void {
    if (typeof name === "string" && STORED_NAME.test(name) && !this.replaced.includes(name)) this.replaced.push(name);
  }

  async rollback(): Promise<void> {
    const names = this.saved.splice(0);
    this.replaced.splice(0);
    await Promise.all(names.map(removeQuietly));
  }

  async commit(): Promise<void> {
    const names = this.replaced.splice(0);
    this.saved.splice(0);
    for (const name of names) {
      if (await isReferenced(name)) continue;
      await removeQuietly(name);
    }
  }
}
