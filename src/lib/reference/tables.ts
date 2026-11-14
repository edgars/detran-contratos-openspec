import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/documento";

/**
 * Tabelas de referência: só lista (`GET /api/<tabela>`) e opções de dropdown ou busca.
 * Nenhuma tela de criação, edição ou exclusão (001-project-foundation › app-shell).
 * 022-pessoas-fornecedores (design.md D4): `pessoas_fisicas` e `prestadores_servicos` buscam por
 * nome ou documento, aceitam filtros exatos de uma lista branca, ordenam por nome e devolvem só as
 * colunas do lookup.
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
  findMany: (args: { where?: object; skip: number; take: number; orderBy: object; select?: object }) => Promise<unknown[]>;
  count: (args: { where?: object }) => Promise<number>;
};

/** Filtro exato aceito na query string: devolve a condição, ou `null` se o valor não serve (nada casa). */
type ExactFilter = (value: string) => object | null;

type ReferenceConfig = {
  delegate: () => Finder;
  /** Colunas de texto da busca `q` (`contains`). */
  searchFields: string[];
  /** Coluna de documento (só dígitos): `q` com 3+ dígitos também procura por prefixo. */
  documentField?: string;
  /** Lista branca de filtros exatos; qualquer outro parâmetro é ignorado. */
  exactFields?: Record<string, ExactFilter>;
  /** Projeção devolvida pela API (padrão: todas as colunas). */
  select?: object;
  orderBy?: object;
};

/** Documento exato: com ou sem máscara, precisa ter `length` dígitos. */
const documentExact =
  (field: string, length: number): ExactFilter =>
  (value) => {
    const digits = onlyDigits(value);
    return digits.length === length ? { [field]: digits } : null;
  };

const intExact =
  (field: string): ExactFilter =>
  (value) =>
    /^\d+$/.test(value.trim()) ? { [field]: Number(value.trim()) } : null;

const config: Record<ReferenceTable, ReferenceConfig> = {
  diretorias: { delegate: () => prisma.diretoria as unknown as Finder, searchFields: ["deDiretoria", "codigo"] },
  pessoas_fisicas: {
    delegate: () => prisma.pessoaFisica as unknown as Finder,
    searchFields: ["deNome"],
    documentField: "cpf",
    exactFields: {
      cpf: documentExact("cpf", 11),
      comCpf: (value) => (value === "1" ? { cpf: { not: null } } : {}),
    },
    // Projeção enxuta: endereço, filiação e nascimento não saem pela busca por CPF.
    select: { id: true, idPessoaFisica: true, cpf: true, deNome: true },
    orderBy: [{ deNome: "asc" }, { id: "asc" }],
  },
  pessoas: { delegate: () => prisma.pessoa as unknown as Finder, searchFields: ["cpf", "cnpj"] },
  prestadores_servicos: {
    delegate: () => prisma.prestadorServico as unknown as Finder,
    searchFields: ["deRazaoSocial"],
    documentField: "cnpj",
    exactFields: { id: intExact("id"), cnpj: documentExact("cnpj", 14) },
    select: { id: true, cnpj: true, deRazaoSocial: true },
    orderBy: [{ deRazaoSocial: "asc" }, { id: "asc" }],
  },
  groups_users: { delegate: () => prisma.groupUser as unknown as Finder, searchFields: [] },
  pagamento_arquivos: { delegate: () => prisma.pagamentoArquivo as unknown as Finder, searchFields: ["arquivo"] },
  groups: { delegate: () => prisma.group as unknown as Finder, searchFields: ["name", "descricao"] },
};

/**
 * `OR` da busca `q`: nome `contains` e, quando a tabela tem documento e `q` tem 3 ou mais dígitos,
 * documento `startsWith` os dígitos de `q` (com ou sem máscara).
 */
export function searchWhere(table: ReferenceTable, q: string): object | undefined {
  const { searchFields, documentField } = config[table];
  if (!q || (searchFields.length === 0 && !documentField)) return undefined;
  // Prisma parametriza o valor: a busca nunca é concatenada em SQL.
  const or: object[] = searchFields.map((f) => ({ [f]: { contains: q } satisfies Prisma.StringFilter }));
  const digits = onlyDigits(q);
  if (documentField && digits.length >= 3) or.push({ [documentField]: { startsWith: digits } satisfies Prisma.StringNullableFilter });
  return { OR: or };
}

/** Filtros exatos da lista branca da tabela; parâmetros fora dela são ignorados. */
export function exactWhere(table: ReferenceTable, params: URLSearchParams): object[] {
  const out: object[] = [];
  for (const [name, filter] of Object.entries(config[table].exactFields ?? {})) {
    const value = params.get(name);
    if (value === null || value.trim() === "") continue;
    // Valor que não serve para o filtro (ex.: CPF com 10 dígitos) não casa com nenhuma linha.
    out.push(filter(value) ?? { id: -1 });
  }
  return out;
}

export async function listReference(
  table: ReferenceTable,
  p: { page: number; size: number; q: string },
  params: URLSearchParams = new URLSearchParams(),
) {
  const cfg = config[table];
  const finder = cfg.delegate();
  const filters = [searchWhere(table, p.q), ...exactWhere(table, params)].filter(
    (f): f is object => f !== undefined && Object.keys(f).length > 0,
  );
  const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : { AND: filters };
  const [items, total] = await Promise.all([
    finder.findMany({
      where,
      skip: (p.page - 1) * p.size,
      take: p.size,
      orderBy: cfg.orderBy ?? { id: "asc" },
      ...(cfg.select ? { select: cfg.select } : {}),
    }),
    finder.count({ where }),
  ]);
  return { items, total };
}
