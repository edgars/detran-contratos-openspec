import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/documento";

export type PessoaPorCpf = { cpf: string; deNome: string | null };

/**
 * Nomes das pessoas físicas pelos CPFs gravados em contratos e fiscais (022-pessoas-fornecedores,
 * D10): uma consulta `cpf in (...)`, ignorando nulos, vazios e repetidos. CPF sem pessoa (órfão)
 * simplesmente não aparece no mapa. Também usado pelos relatórios (019).
 */
export async function pessoasPorCpf(cpfs: (string | null | undefined)[]): Promise<Map<string, PessoaPorCpf>> {
  const unicos = [...new Set(cpfs.map((c) => onlyDigits(c)).filter((c) => c.length === 11))];
  if (unicos.length === 0) return new Map();
  const pessoas = await prisma.pessoaFisica.findMany({ where: { cpf: { in: unicos } }, select: { cpf: true, deNome: true } });
  return new Map(pessoas.filter((p): p is PessoaPorCpf => p.cpf !== null).map((p) => [p.cpf, p]));
}
