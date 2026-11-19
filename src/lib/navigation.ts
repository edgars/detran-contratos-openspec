/**
 * Navegação principal: um item por entidade gerenciada (001-project-foundation › app-shell).
 * `name` é o nome da entidade na spec; `label` é o texto exibido; `change` diz qual change
 * entrega a lista da entidade.
 */
export type NavItem = { name: string; label: string; href: string; change: string };

export const NAV_ITEMS: readonly NavItem[] = [
  { name: "Departamentos", label: "Departamentos", href: "/departamentos", change: "002-departamentos" },
  { name: "TipoContratos", label: "Tipos de contrato", href: "/tipo_contratos", change: "003-tipo-contratos" },
  { name: "ContratoStatus", label: "Status do contrato", href: "/contrato_status", change: "004-contrato-status" },
  { name: "Users", label: "Usuários", href: "/users", change: "005-users" },
  { name: "Pagamentos", label: "Pagamentos", href: "/pagamentos", change: "006-pagamentos" },
  { name: "Modalidades", label: "Modalidades", href: "/modalidades", change: "007-modalidades" },
  { name: "PrestacaoContas", label: "Prestação de contas", href: "/prestacao_contas", change: "008-prestacao-contas" },
  { name: "Fases", label: "Fases", href: "/fases", change: "009-fases" },
  { name: "Fiscais", label: "Fiscais", href: "/fiscais", change: "010-fiscais" },
  { name: "Status", label: "Status", href: "/status", change: "011-status" },
  { name: "Historicos", label: "Históricos", href: "/historicos", change: "012-historicos" },
  { name: "AnexosFiscais", label: "Anexos de fiscalização", href: "/anexos_fiscais", change: "013-anexos-fiscais" },
  {
    name: "SituacaoContratuals",
    label: "Situação contratual",
    href: "/situacao_contratuals",
    change: "014-situacao-contratuals",
  },
  {
    name: "AnexosPublicacaos",
    label: "Anexos de publicação",
    href: "/anexos_publicacaos",
    change: "015-anexos-publicacaos",
  },
  { name: "Penalidades", label: "Penalidades", href: "/penalidades", change: "016-penalidades" },
  { name: "Contratos", label: "Contratos", href: "/contratos", change: "017-contratos" },
];

export function findNavItem(slug: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === `/${slug}`);
}
