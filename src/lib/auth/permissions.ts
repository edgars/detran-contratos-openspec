/**
 * Perfis de acesso e matriz de permissões (023-perfis-acesso, design.md › Catálogo e matriz).
 * Módulo puro (sem banco nem cookies): usado pelo servidor e pelos componentes cliente.
 * A checagem que vale é a do servidor (`requirePermission` em `./guard`); a interface só esconde.
 * Matriz FINAL por decisão do autor (14/11/2026, openspec/config.yaml): só Administrador exclui
 * contrato; Fiscal e Financeiro só leem contratos; Gestor de contrato vê todos os contratos.
 */

export const PERFIS = ["ADMINISTRADOR", "GESTOR_CONTRATO", "FISCAL", "FINANCEIRO", "CONSULTA"] as const;
export type Perfil = (typeof PERFIS)[number];

export const PERFIL_LABEL: Record<Perfil, string> = {
  ADMINISTRADOR: "Administrador",
  GESTOR_CONTRATO: "Gestor de contrato",
  FISCAL: "Fiscal",
  FINANCEIRO: "Financeiro",
  CONSULTA: "Consulta",
};

export const ACOES = ["listar", "ver", "criar", "editar", "excluir", "anexar", "exportar"] as const;
export type Acao = (typeof ACOES)[number];

type Linha = Partial<Record<Perfil, readonly Acao[]>>;

const L = "listar", V = "ver", C = "criar", E = "editar", X = "excluir", A = "anexar", R = "exportar";

/** Uma linha por recurso; perfil ausente = nenhuma ação. Ver a tabela de design.md. */
export const MATRIZ = {
  // /contratos, aditivos, anexos do cadastro e complementos da 020 (projeto básico, Presidência, impressão).
  contratos: {
    ADMINISTRADOR: [L, V, C, E, X, A],
    GESTOR_CONTRATO: [L, V, C, E, A],
    FISCAL: [L, V],
    FINANCEIRO: [L, V],
    CONSULTA: [L],
  },
  // Visão restrita do contrato (`visualizar_restrito` do legado).
  contratos_resumo: { ADMINISTRADOR: [V], GESTOR_CONTRATO: [V], FISCAL: [V], FINANCEIRO: [V], CONSULTA: [V] },
  // Fluxo/andamento do contrato (004 e tela da 020).
  contrato_status: {
    ADMINISTRADOR: [L, V, C, E, X],
    GESTOR_CONTRATO: [L, V, C, E],
    FISCAL: [L, V, C, E],
    FINANCEIRO: [L, V],
  },
  historicos: {
    ADMINISTRADOR: [L, V, C, E, X],
    GESTOR_CONTRATO: [L, V, C, E],
    FISCAL: [L, V, C, E],
    FINANCEIRO: [L, V],
  },
  fiscais: {
    ADMINISTRADOR: [L, V, C, E, X],
    GESTOR_CONTRATO: [L, V, C, E, X],
    FISCAL: [L, V],
    FINANCEIRO: [L, V],
  },
  anexos_fiscais: {
    ADMINISTRADOR: [L, V, C, E, X, A],
    GESTOR_CONTRATO: [L, V, C, E, X, A],
    FISCAL: [L, V, C, E, A],
    FINANCEIRO: [L, V],
  },
  anexos_publicacaos: {
    ADMINISTRADOR: [L, V, C, E, X, A],
    GESTOR_CONTRATO: [L, V, C, E, X, A],
    FISCAL: [L, V],
    FINANCEIRO: [L, V],
  },
  penalidades: {
    ADMINISTRADOR: [L, V, C, E, X, A],
    GESTOR_CONTRATO: [L, V, C, E, A],
    FISCAL: [L, V],
    FINANCEIRO: [L, V],
  },
  pagamentos: {
    ADMINISTRADOR: [L, V, C, E, X],
    GESTOR_CONTRATO: [L, V],
    FISCAL: [L, V],
    FINANCEIRO: [L, V, C, E, X],
  },
  // Cadastro da 008, painel pendentes/realizadas e fluxo da 021 (`PrestacaoConta` → Gestor de contrato).
  prestacao_contas: {
    ADMINISTRADOR: [L, V, C, E, X],
    GESTOR_CONTRATO: [L, V, C, E],
    FISCAL: [L, V],
    FINANCEIRO: [L, V],
  },
  // Relatórios da 019 (tela = listar; CSV/impressão = exportar).
  relatorios: {
    ADMINISTRADOR: [L, R],
    GESTOR_CONTRATO: [L, R],
    FISCAL: [L, R],
    FINANCEIRO: [L, R],
    CONSULTA: [L],
  },
  // "Acerto de valor" da 019 (grava valorInicial).
  acerto_valor: { ADMINISTRADOR: [L, E] },
  // departamentos, tipo_contratos, modalidades, situacao_contratuals (e o alias situacao_contratual), fases, status.
  cadastros: {
    ADMINISTRADOR: [L, V, C, E, X],
    GESTOR_CONTRATO: [L, V],
    FISCAL: [L, V],
    FINANCEIRO: [L, V],
    CONSULTA: [L, V],
  },
  // Tabelas de referência dos dropdowns (diretorias, pessoas, pessoas_fisicas, prestadores_servicos, pagamento_arquivos).
  referencia: { ADMINISTRADOR: [L], GESTOR_CONTRATO: [L], FISCAL: [L], FINANCEIRO: [L], CONSULTA: [L] },
  // /users, perfis do usuário, GET /api/groups e /api/groups_users.
  users: { ADMINISTRADOR: [L, V, C, E, X] },
} satisfies Record<string, Linha>;

export type Recurso = keyof typeof MATRIZ;
export const RECURSOS = Object.keys(MATRIZ) as Recurso[];

const isPerfil = (v: unknown): v is Perfil => typeof v === "string" && (PERFIS as readonly string[]).includes(v);

/** Normaliza a lista lida do banco (ignora valor fora do catálogo). */
export function perfisValidos(lista: readonly unknown[]): Perfil[] {
  return PERFIS.filter((p) => lista.some((v) => v === p && isPerfil(v)));
}

/** Permissão pela união dos perfis do usuário; sem perfil, nega tudo. */
export function can(user: { perfis: readonly Perfil[] } | null | undefined, recurso: Recurso, acao: Acao): boolean {
  if (!user) return false;
  const linha = MATRIZ[recurso] as Linha;
  return user.perfis.some((p) => linha[p]?.includes(acao) ?? false);
}

/** Lista `recurso:ação` dos perfis dados (para `GET /api/auth/me`). */
export function permissoesDe(perfis: readonly Perfil[]): string[] {
  const out: string[] = [];
  for (const recurso of RECURSOS) for (const acao of ACOES) if (can({ perfis }, recurso, acao)) out.push(`${recurso}:${acao}`);
  return out;
}

export const MSG_SEM_PERMISSAO = "Sem permissão para esta ação";
export const MSG_PAGINA_SEM_PERMISSAO = "Você não tem permissão para acessar esta página.";

/** Falta de permissão: vira `403 { error: "Sem permissão para esta ação" }` em `handleError`. */
export class ForbiddenError extends Error {
  constructor(message: string = MSG_SEM_PERMISSAO) {
    super(message);
  }
}
