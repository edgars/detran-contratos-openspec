import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AttachmentRule } from "@/lib/rules/attachments";

/** Pasta dos anexos, fora de `public/`. */
export function uploadDir(): string {
  return resolve(process.env.UPLOAD_DIR ?? "data/uploads");
}

export function uploadMaxBytes(): number {
  const mb = Number(process.env.UPLOAD_MAX_MB ?? 10);
  return (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024;
}

export class UploadError extends Error {}

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
