/** Os seis relatórios gerenciais do legado (019-relatorios; docs/legado/relatorios.md). */
export const RELATORIOS = [
  {
    href: "/relatorios/contratos-vencendo",
    titulo: "Contratos vencendo",
    descricao: "Contratos que vencem nos próximos N dias, com período e ordenação opcionais.",
    saidas: "Tela · PDF · CSV",
  },
  {
    href: "/relatorios/contratos-vencidos",
    titulo: "Contratos vencidos",
    descricao: "Contratos com vencimento dentro de um período informado.",
    saidas: "Tela · PDF · CSV",
  },
  {
    href: "/relatorios/contratos-por-gestor",
    titulo: "Contratos por gestor",
    descricao: "Quantidade e valor acumulado por gestor, tipo de contrato e unidade gestora.",
    saidas: "Tela · PDF · CSV",
  },
  {
    href: "/relatorios/acompanhamento-meta",
    titulo: "Acompanhamento de meta",
    descricao: "Contratos vigentes, vencidos e em prorrogação/risco (até 180 dias).",
    saidas: "Tela · PDF",
  },
  {
    href: "/relatorios/cadastro-incompleto",
    titulo: "Cadastro incompleto",
    descricao: "Contratos vigentes sem o PDF do contrato ou do projeto básico.",
    saidas: "Tela",
  },
  {
    href: "/relatorios/acerto-valor",
    titulo: "Acerto de valor",
    descricao: "Contratos sem valor inicial, para informar e gravar o valor de cada um.",
    saidas: "Tela com gravação",
  },
] as const;
