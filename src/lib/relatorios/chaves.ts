import type { Prisma } from "@prisma/client";
import { formatCpf } from "@/lib/format";
import { onlyDigits } from "@/lib/documento";
import { pessoasPorCpf } from "@/lib/reference/pessoas";

/**
 * Único ponto dos relatórios que conhece as chaves entregues pela 022-pessoas-fornecedores:
 * gestor por CPF em `contratos.pessoaFisicaId` (= `pessoas_fisicas.cpf`) e fornecedor como FK por
 * `id` (`prestadorServico`, com `cnpj`). Legado: `PessoaFisica.CPF = Contrato.pessoa_fisica_id`,
 * `PrestadorServico.CNPJ = Contrato.prestador_servico_id` (docs/legado/relatorios.md).
 */

/** Nome do gestor por CPF (`Map<cpf, deNome>`), pelo helper `pessoasPorCpf` da 022. */
export async function nomesDosGestores(cpfs: (string | null | undefined)[]): Promise<Map<string, string>> {
  const pessoas = await pessoasPorCpf(cpfs);
  return new Map([...pessoas].filter(([, p]) => p.deNome).map(([cpf, p]) => [cpf, p.deNome as string]));
}

/** Rótulo do gestor: nome; CPF sem pessoa → "CPF (não encontrado)"; sem CPF → `null`. */
export function rotuloGestor(cpf: string | null | undefined, nomes: Map<string, string>): string | null {
  const digits = onlyDigits(cpf);
  if (!digits) return null;
  return nomes.get(digits) ?? `${formatCpf(digits)} (não encontrado)`;
}

/** Contratada do contrato (relação `prestadorServico`, FK por `id` — decisão D3 da 022). */
export const SELECT_CONTRATADA = {
  prestadorServico: { select: { deRazaoSocial: true, cnpj: true } },
} satisfies Prisma.ContratoSelect;

/** Ordenação no banco pela razão social da contratada. */
export const ordemContratada = (dir: "asc" | "desc"): Prisma.ContratoOrderByWithRelationInput => ({
  prestadorServico: { deRazaoSocial: dir },
});
