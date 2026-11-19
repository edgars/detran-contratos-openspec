import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Tabelas de referência: só lista (`GET /api/<tabela>`) e opções de dropdown.
 * Nenhuma tela de criação, edição ou exclusão (001-project-foundation › app-shell).
 */
export const REFERENCE_TABLES = [
  "diretorias",
  "pessoas_fisicas",
  "pessoas",
  "prestadores_servicos",
  "groups_users",
  "pagamento_arquivos",
  "groups",
] as const;

export type ReferenceTable = (typeof REFERENCE_TABLES)[number];

type Finder = {
  findMany: (args: { where?: object; skip: number; take: number; orderBy: object }) => Promise<unknown[]>;
  count: (args: { where?: object }) => Promise<number>;
};

type ReferenceConfig = { delegate: () => Finder; searchFields: string[] };

const config: Record<ReferenceTable, ReferenceConfig> = {
  diretorias: { delegate: () => prisma.diretoria as unknown as Finder, searchFields: ["deDiretoria", "codigo"] },
  pessoas_fisicas: { delegate: () => prisma.pessoaFisica as unknown as Finder, searchFields: ["deNome"] },
  pessoas: { delegate: () => prisma.pessoa as unknown as Finder, searchFields: ["cpf", "cnpj"] },
  prestadores_servicos: {
    delegate: () => prisma.prestadorServico as unknown as Finder,
    searchFields: ["deRazaoSocial"],
  },
  groups_users: { delegate: () => prisma.groupUser as unknown as Finder, searchFields: [] },
  pagamento_arquivos: { delegate: () => prisma.pagamentoArquivo as unknown as Finder, searchFields: ["arquivo"] },
  groups: { delegate: () => prisma.group as unknown as Finder, searchFields: ["name", "descricao"] },
};

export function searchWhere(table: ReferenceTable, q: string): object | undefined {
  const fields = config[table].searchFields;
  if (!q || fields.length === 0) return undefined;
  // Prisma parametriza o valor: a busca nunca é concatenada em SQL.
  return { OR: fields.map((f) => ({ [f]: { contains: q } satisfies Prisma.StringFilter })) };
}

export async function listReference(table: ReferenceTable, p: { page: number; size: number; q: string }) {
  const finder = config[table].delegate();
  const where = searchWhere(table, p.q);
  const [items, total] = await Promise.all([
    finder.findMany({ where, skip: (p.page - 1) * p.size, take: p.size, orderBy: { id: "asc" } }),
    finder.count({ where }),
  ]);
  return { items, total };
}
