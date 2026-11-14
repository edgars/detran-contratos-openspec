/** Ordenação da lista do kit (024-kit-robustez › "Ordenação escolhida pelo operador"). */

export type SortState = { field: string; dir: "asc" | "desc" } | null;

/** Lê `campo:asc|desc` (ou `campo.desc`); valor vazio ou malformado → sem ordenação escolhida. */
export function parseSort(value: string | null | undefined): SortState {
  const [field, dir] = (value ?? "").split(/[:.]/);
  if (!field || !/^[A-Za-z_][\w]*$/.test(field)) return null;
  return { field, dir: dir?.toLowerCase() === "desc" ? "desc" : "asc" };
}

export function formatSort(sort: SortState): string {
  return sort ? `${sort.field}:${sort.dir}` : "";
}

/** Clique no cabeçalho: coluna nova começa crescente; a mesma coluna alterna crescente ↔ decrescente. */
export function nextSort(current: SortState, field: string): SortState {
  if (!current || current.field !== field) return { field, dir: "asc" };
  return { field, dir: current.dir === "asc" ? "desc" : "asc" };
}

/** Valor de `aria-sort` do cabeçalho. */
export function ariaSort(current: SortState, field: string): "ascending" | "descending" | "none" {
  if (!current || current.field !== field) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

/** Query da página com `sort` atualizado (os outros parâmetros ficam). */
export function withSortParam(search: string, sort: SortState): string {
  const params = new URLSearchParams(search);
  if (sort) params.set("sort", formatSort(sort));
  else params.delete("sort");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
