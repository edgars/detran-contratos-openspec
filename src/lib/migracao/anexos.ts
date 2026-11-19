import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, posix } from "node:path";
import type { Prisma } from "@prisma/client";
import { deleteStoredPdf, savePdf, uploadMaxBytes } from "@/lib/uploads";
import type { AttachmentRule } from "@/lib/rules/attachments";

/**
 * Anexos do legado (025-migracao-legado, design.md D6): índice recursivo da pasta `--anexos` por
 * nome de arquivo (sem diferenciar maiúsculas), ambiguidade por SHA-256, assinatura `%PDF-` e
 * gravação por `savePdf()`; `migracao_arquivos` dá a idempotência (mesmo SHA-256 → mesmo nome
 * gravado, sem copiar de novo). Em simulação só verifica.
 */

export type TipoAvisoAnexo = "anexo_ausente" | "anexo_ambiguo" | "anexo_invalido" | "anexo_nao_importado";

export type ResultadoAnexo = { ok: true; nome: string | null } | { ok: false; motivo: string; aviso: TipoAvisoAnexo };

export const MOTIVO_ANEXO = {
  naoEncontrado: "anexo não encontrado",
  ambiguo: "anexo ambíguo (mesmo nome, conteúdos diferentes)",
  naoPdf: "anexo não é PDF",
  acimaDoLimite: "anexo acima do limite de tamanho",
  semPasta: "anexo não importado (sem --anexos)",
} as const;

const REGRA: AttachmentRule = { missing: MOTIVO_ANEXO.naoEncontrado, notPdf: MOTIVO_ANEXO.naoPdf };

/** Basename normalizado do valor da coluna do legado (`uploads/contratos/CT_10.pdf` → `ct_10.pdf`). */
export function nomeLegado(valor: string): string {
  return posix.basename(valor.trim().replace(/\\/g, "/")).toLowerCase();
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

type Db = Prisma.TransactionClient;

export class ImportadorAnexos {
  private indice: Map<string, string[]> | null = null;
  private cache = new Map<string, ResultadoAnexo>();
  /** Arquivos gravados nesta execução (apagados se a transação falhar). */
  readonly gravados: string[] = [];

  constructor(
    private readonly pasta: string | undefined,
    private readonly simular: boolean,
  ) {}

  /** Indexa a pasta recursivamente por basename em minúsculas. */
  async indexar(): Promise<void> {
    if (!this.pasta) return;
    const st = await stat(this.pasta).catch(() => null);
    if (!st?.isDirectory()) throw new Error(`pasta de anexos não encontrada: ${this.pasta}`);
    this.indice = new Map();
    for (const d of await readdir(this.pasta, { recursive: true, withFileTypes: true })) {
      if (!d.isFile()) continue;
      const nome = d.name.toLowerCase();
      const caminho = join(d.parentPath, d.name);
      this.indice.set(nome, [...(this.indice.get(nome) ?? []), caminho]);
    }
  }

  /** Resolve o valor da coluna do legado para o nome gravado (ou o motivo da falha). */
  async resolver(tx: Db, valor: string | null): Promise<ResultadoAnexo> {
    if (valor === null || valor.trim() === "") return { ok: true, nome: null };
    const base = nomeLegado(valor);
    const memo = this.cache.get(base);
    if (memo) return memo;
    const r = await this.resolverSemCache(tx, base);
    this.cache.set(base, r);
    return r;
  }

  private async resolverSemCache(tx: Db, base: string): Promise<ResultadoAnexo> {
    const anterior = await tx.migracaoArquivo.findUnique({ where: { caminhoLegado: base } });
    if (!this.indice) {
      // Sem --anexos: reaproveita o que uma execução anterior já importou; senão, não importa.
      if (anterior) return { ok: true, nome: anterior.nomeGravado };
      return { ok: false, motivo: MOTIVO_ANEXO.semPasta, aviso: "anexo_nao_importado" };
    }
    const caminhos = this.indice.get(base) ?? [];
    if (!caminhos.length) {
      if (anterior) return { ok: true, nome: anterior.nomeGravado };
      return { ok: false, motivo: MOTIVO_ANEXO.naoEncontrado, aviso: "anexo_ausente" };
    }
    const conteudos = await Promise.all(caminhos.map((c) => readFile(c)));
    const hashes = new Set(conteudos.map(sha256));
    if (hashes.size > 1) return { ok: false, motivo: MOTIVO_ANEXO.ambiguo, aviso: "anexo_ambiguo" };
    const bytes = conteudos[0];
    const hash = [...hashes][0];
    if (bytes.length > uploadMaxBytes()) return { ok: false, motivo: MOTIVO_ANEXO.acimaDoLimite, aviso: "anexo_invalido" };
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, motivo: MOTIVO_ANEXO.naoPdf, aviso: "anexo_invalido" };
    if (anterior && anterior.sha256 === hash) return { ok: true, nome: anterior.nomeGravado };
    // Simulação: verificado, nada copiado; o nome é um marcador que a transação desfeita descarta.
    if (this.simular) return { ok: true, nome: `simulacao:${base}` };
    const nome = await savePdf(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), REGRA);
    this.gravados.push(nome);
    await tx.migracaoArquivo.upsert({
      where: { caminhoLegado: base },
      create: { caminhoLegado: base, sha256: hash, nomeGravado: nome, tamanho: bytes.length },
      update: { sha256: hash, nomeGravado: nome, tamanho: bytes.length },
    });
    return { ok: true, nome };
  }

  /** Apaga os arquivos gravados nesta execução (transação desfeita). */
  async desfazer(): Promise<void> {
    for (const nome of this.gravados.splice(0)) await deleteStoredPdf(nome).catch(() => undefined);
  }
}
