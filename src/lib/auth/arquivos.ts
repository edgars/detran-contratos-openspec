import { prisma } from "@/lib/db";
import type { Recurso } from "./permissions";

/**
 * Registro que referencia o arquivo (023-perfis-acesso › security "Download de anexo conforme permissão"):
 * o recurso dono decide quem baixa. Anexo e projeto básico do contrato exigem `contratos:ver` (a visão
 * restrita, `contratos_resumo`, não dá acesso). `null` = nenhum registro referencia o nome.
 */
export async function findAttachmentOwner(nome: string): Promise<Recurso | null> {
  const where = { anexo: nome };
  if (await prisma.contrato.findFirst({ where: { OR: [where, { projetoBasico: nome }] }, select: { id: true } })) return "contratos";
  if (await prisma.anexoFiscal.findFirst({ where, select: { id: true } })) return "anexos_fiscais";
  if (await prisma.anexoPublicacao.findFirst({ where, select: { id: true } })) return "anexos_publicacaos";
  if (await prisma.penalidade.findFirst({ where: { arquivo: nome }, select: { id: true } })) return "penalidades";
  return null;
}
