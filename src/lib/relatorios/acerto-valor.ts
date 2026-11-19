import { z } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, FieldRuleError } from "@/lib/crud/server";
import { parseCurrency } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { SELECT_CONTRATADA } from "./chaves";
import { ORIGINAIS } from "./comum";
import { acertoValorParams, type AcertoValorParams } from "./params";

/**
 * Acerto de valor (019-relatorios). Legado: docs/legado/relatorios.md, tela `acertoValor` — contratos
 * originais com `valor_inicial IS NULL`, 20 por vez, ordem nº do contrato, e gravação do valor inicial.
 */

export const params = acertoValorParams;
export const slug = "acerto-valor";
export const TITULO = "Acerto de valor";
export const POR_PAGINA = 20;

export const MSG_VALOR = "Informe o valor no formato 1.234,56";
export const MSG_JA_INFORMADO = "Valor inicial já informado";

export type LinhaAcerto = {
  id: number;
  processo: string | null;
  contrato: string | null;
  objeto: string;
  unidade: string | null;
  contratada: string | null;
};

export async function consultar(p: AcertoValorParams) {
  const where = {
    ...ORIGINAIS,
    valorInicial: null,
    ...(p.q ? { objeto: { contains: p.q } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.contrato.findMany({
      where,
      select: {
        id: true,
        numeroProcesso: true,
        numeroContrato: true,
        objeto: true,
        departamento: { select: { deDepartamento: true } },
        ...SELECT_CONTRATADA,
      },
      orderBy: [{ numeroContrato: "asc" }, { id: "asc" }],
      skip: (p.page - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.contrato.count({ where }),
  ]);
  const linhas: LinhaAcerto[] = rows.map((r) => ({
    id: r.id,
    processo: r.numeroProcesso,
    contrato: r.numeroContrato,
    objeto: r.objeto,
    unidade: r.departamento?.deDepartamento ?? null,
    contratada: r.prestadorServico?.deRazaoSocial ?? null,
  }));
  return { titulo: TITULO, linhas, total, page: p.page, size: POR_PAGINA, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}

/** Corpo do `PUT /api/relatorios/acerto-valor/:id`: só `valorInicial` (schema estrito). */
export const corpoAcerto = z.object({ valorInicial: z.string({ error: MSG_VALOR }) }).strict();

/** Texto `1.234,56` → Decimal; inválido, vazio ou negativo → `null`. */
function lerValor(texto: string) {
  const t = texto.trim();
  if (!t || parseCurrency(t) === null) return null;
  const d = toDecimal(t);
  return d && !d.isNegative() ? d : null;
}

/**
 * Grava o valor inicial de um contrato original sem valor (`updateMany` com a condição no `where`:
 * nada mais muda e uma corrida não sobrescreve um valor já gravado). 404: id inexistente ou aditivo;
 * 409: já tem valor inicial.
 */
export async function gravarValorInicial(id: number, corpo: unknown): Promise<{ id: number; valorInicial: string } | null> {
  const { valorInicial } = corpoAcerto.parse(corpo);
  const valor = lerValor(valorInicial);
  if (!valor) throw new FieldRuleError({ valorInicial: MSG_VALOR });
  const { count } = await prisma.contrato.updateMany({ where: { id, ...ORIGINAIS, valorInicial: null }, data: { valorInicial: valor } });
  if (count === 1) return { id, valorInicial: valor.toFixed(2) };
  const atual = await prisma.contrato.findUnique({ where: { id }, select: { parentId: true } });
  if (!atual || atual.parentId !== null) return null;
  throw new ConflictError(MSG_JA_INFORMADO);
}
