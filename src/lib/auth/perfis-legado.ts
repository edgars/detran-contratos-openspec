import type { Perfil } from "./permissions";

/**
 * Grupos do ACL do legado → perfis do app novo (023-perfis-acesso, design.md › Seed e migração;
 * docs/legado/perfis-acesso.md). Mesmo mapeamento do passo 1 da migração `*_023_perfis_acesso`;
 * usado pela carga dos usuários do legado (025). `PrestacaoConta` é capacidade do Gestor de contrato.
 */
export const GRUPO_PERFIL: Readonly<Record<string, Perfil>> = {
  ContratoCGCL: "ADMINISTRADOR",
  Gestor: "GESTOR_CONTRATO",
  PrestacaoConta: "GESTOR_CONTRATO",
  Pagamentos: "FINANCEIRO",
};

/** Perfis dos nomes de grupo dados, sem repetição; nome desconhecido é ignorado. */
export function perfisDoLegado(nomes: readonly string[]): Perfil[] {
  const out = new Set<Perfil>();
  for (const nome of nomes) {
    const perfil = Object.hasOwn(GRUPO_PERFIL, nome) ? GRUPO_PERFIL[nome] : undefined;
    if (perfil) out.add(perfil);
  }
  return [...out];
}
