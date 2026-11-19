import { MSG } from "./messages";

/**
 * Validação de anexos do legado: precisa existir arquivo enviado e ele precisa ser PDF.
 * Esta é a checagem do legado (tipo informado). `001b-security-baseline` acrescenta a
 * conferência pela assinatura `%PDF-`, o limite de tamanho e o armazenamento seguro.
 */
export type UploadLike = { type?: string; size?: number; name?: string } | null | undefined;

export type AttachmentRule = { missing: string; notPdf: string };

export function checkAttachment(file: UploadLike, rule: AttachmentRule): string | null {
  if (!file || !file.size) return rule.missing;
  if (file.type !== "application/pdf") return rule.notPdf;
  return null;
}

/** Anexos de fiscalização (`anexos_fiscais.anexo`). */
export const ANEXO_FISCAL: AttachmentRule = {
  missing: MSG.semArquivo, // RK-23cdd0c37c3c — Não existe arquivo para anexar!
  notPdf: MSG.pdfAnexo, // RK-01658245d11b — O arquivo anexo deve ser do tipo PDF!
};

/** Anexos de publicação (`anexos_publicacao.anexo`). */
export const ANEXO_PUBLICACAO: AttachmentRule = {
  missing: MSG.semArquivo, // RK-e2b53b79c3c2 — Não existe arquivo para anexar!
  notPdf: MSG.pdfAnexo, // RK-9aa2ad64672e — O arquivo anexo deve ser do tipo PDF!
};

/** Arquivo da penalidade (`penalidades.arquivo`). */
export const ARQUIVO_PENALIDADE: AttachmentRule = {
  missing: MSG.semArquivo, // RK-abb6ac79fad7 — Não existe arquivo para anexar!
  notPdf: MSG.pdfAnexo, // RK-174d58601890 — O arquivo anexo deve ser do tipo PDF!
};

/** Anexo do próprio contrato (`contratos.anexo`). */
export const ANEXO_CONTRATO: AttachmentRule = {
  missing: MSG.semArquivo,
  notPdf: MSG.pdfAnexo, // RK-ed7bc4aaba15 — O arquivo anexo deve ser do tipo PDF!
};

/** Anexos genéricos do cadastro de contratos (fiscal ou publicação enviados pelo contrato). */
export const ANEXO_CONTRATO_MODELO: AttachmentRule = {
  missing: MSG.semArquivo,
  notPdf: MSG.pdfAnexoCurto, // RK-d2c51245ec1e — O anexo deve ser do tipo PDF!
};
