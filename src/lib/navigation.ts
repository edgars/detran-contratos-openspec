/**
 * Navegação principal: um item por entidade gerenciada (001-project-foundation › app-shell) e o
 * item Relatórios (019-relatorios).
 * `name` é o nome da entidade na spec; `label` é o texto exibido; `change` diz qual change
 * entrega a lista da entidade.
 */
export type NavGroup = "contratos" | "documentos" | "cadastros" | "administracao";

export type NavItem = { name: string; label: string; href: string; change: string; group: NavGroup };

/** Grupos do menu lateral, na ordem em que aparecem. */
export const NAV_GROUPS: readonly { id: NavGroup; label: string }[] = [
  { id: "contratos", label: "Gestão de contratos" },
  { id: "documentos", label: "Documentos" },
  { id: "cadastros", label: "Cadastros auxiliares" },
  { id: "administracao", label: "Administração" },
];

export const NAV_ITEMS: readonly NavItem[] = [
  { name: "Departamentos", label: "Departamentos", href: "/departamentos", change: "002-departamentos", group: "cadastros" },
  { name: "TipoContratos", label: "Tipos de contrato", href: "/tipo_contratos", change: "003-tipo-contratos", group: "cadastros" },
  { name: "ContratoStatus", label: "Status do contrato", href: "/contrato_status", change: "004-contrato-status", group: "contratos" },
  { name: "Users", label: "Usuários", href: "/users", change: "005-users", group: "administracao" },
  { name: "Pagamentos", label: "Pagamentos", href: "/pagamentos", change: "006-pagamentos", group: "contratos" },
  { name: "Modalidades", label: "Modalidades", href: "/modalidades", change: "007-modalidades", group: "cadastros" },
  { name: "PrestacaoContas", label: "Prestação de contas", href: "/prestacao_contas", change: "008-prestacao-contas", group: "contratos" },
  { name: "Fases", label: "Fases", href: "/fases", change: "009-fases", group: "cadastros" },
  { name: "Fiscais", label: "Fiscais", href: "/fiscais", change: "010-fiscais", group: "contratos" },
  { name: "Status", label: "Status", href: "/status", change: "011-status", group: "cadastros" },
  { name: "Historicos", label: "Históricos", href: "/historicos", change: "012-historicos", group: "contratos" },
  { name: "AnexosFiscais", label: "Anexos de fiscalização", href: "/anexos_fiscais", change: "013-anexos-fiscais", group: "documentos" },
  {
    name: "SituacaoContratuals",
    label: "Situação contratual",
    href: "/situacao_contratuals",
    change: "014-situacao-contratuals", group: "cadastros"
  },
  {
    name: "AnexosPublicacaos",
    label: "Anexos de publicação",
    href: "/anexos_publicacaos",
    change: "015-anexos-publicacaos", group: "documentos"
  },
  { name: "Penalidades", label: "Penalidades", href: "/penalidades", change: "016-penalidades", group: "contratos" },
  { name: "Contratos", label: "Contratos", href: "/contratos", change: "017-contratos", group: "contratos" },
  // 019-relatorios: um item só, que abre o índice dos seis relatórios.
  { name: "Relatorios", label: "Relatórios", href: "/relatorios", change: "019-relatorios", group: "contratos" },
];

export function findNavItem(slug: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === `/${slug}`);
}

/** Ordem dentro de cada grupo (o mais usado primeiro). A ordem de NAV_ITEMS segue a das changes. */
export const NAV_ORDER: readonly string[] = [
  "Contratos", "Relatorios", "Pagamentos", "Fiscais", "Penalidades", "PrestacaoContas", "ContratoStatus", "Historicos",
  "AnexosFiscais", "AnexosPublicacaos",
  "Departamentos", "TipoContratos", "Modalidades", "SituacaoContratuals", "Fases", "Status",
  "Users",
];

export function navByGroup() {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: NAV_ITEMS.filter((i) => i.group === g.id).sort((a, b) => NAV_ORDER.indexOf(a.name) - NAV_ORDER.indexOf(b.name)),
  }));
}
