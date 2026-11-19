/** Valores derivados antes de gravar (001-project-foundation › cross-cutting-rules). */

/** RK-f0ce91a53de9 — o legado trocava aspas duplas por simples na descrição do status. */
export function normalizeDescricao(descricao: string): string {
  return descricao.replace(/"/g, "'");
}
