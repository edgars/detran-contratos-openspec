import type { ColumnDef, ListFilter } from "@/components/crud/types";

/**
 * Tela de Prestação de contas (021-prestacao-contas-fluxo): contratos sujeitos à prestação de contas,
 * abas Pendentes/Realizadas, colunas e filtros do legado (`docs/legado/prestacao-contas.md`).
 * `situacao`, `campo`, `q`, `ordenar`, `tipoContratoId` e `modalidadeId` são parâmetros da lista, nunca colunas.
 */
export const prestacaoContas = {
  title: "Prestação de contas",
  api: "/api/prestacao_contas/contratos",
  basePath: "/prestacao_contas",
  rowHref: "/prestacao_contas/{id}",
  pageSize: 10,
  situacoes: [
    { value: "pendentes", label: "Pendentes" },
    { value: "realizadas", label: "Realizadas" },
  ] as const,
  columns: [
    // A primeira coluna é o link da linha; o Nº do contrato é o link para o fluxo (design.md › Lista).
    { key: "numeroContrato", label: "Nº contrato" },
    { key: "numeroProcesso", label: "Nº processo" },
    { key: "dataTermino", label: "Vencimento", format: "date" },
    { key: "objeto", label: "Objeto" },
    { key: "diasDesdeVencimento", label: "Dias", align: "right" },
    { key: "valorTotal", label: "Valor total", format: "currency" },
    { key: "contratada", label: "Contratada", path: "prestadorServico.deRazaoSocial" },
    { key: "unGestora", label: "UN gestora", path: "departamento.deDepartamento", secondary: true },
  ] satisfies ColumnDef[],
  filters: [
    {
      name: "campo",
      label: "Buscar em",
      kind: "select",
      options: [
        { value: "objeto", label: "Objeto" },
        { value: "numeroContrato", label: "Nº contrato" },
        { value: "numeroProcesso", label: "Nº processo" },
        { value: "contratada", label: "Contratada" },
        { value: "unGestora", label: "UN gestora" },
        { value: "gestor", label: "Gestor" },
      ],
    },
    {
      name: "ordenar",
      label: "Ordenar por",
      kind: "select",
      options: [
        { value: "vencimento:asc", label: "Vencimento (mais antigo)" },
        { value: "vencimento:desc", label: "Vencimento (mais recente)" },
        { value: "valor:desc", label: "Valor (maior)" },
        { value: "valor:asc", label: "Valor (menor)" },
        { value: "contratada:asc", label: "Contratada (A–Z)" },
        { value: "contratada:desc", label: "Contratada (Z–A)" },
        { value: "unGestora:asc", label: "UN gestora (A–Z)" },
        { value: "unGestora:desc", label: "UN gestora (Z–A)" },
        { value: "gestor:asc", label: "Gestor (A–Z)" },
        { value: "gestor:desc", label: "Gestor (Z–A)" },
      ],
    },
    // Só tipos marcados com prestacaoContas = "S".
    { name: "tipoContratoId", label: "Tipo de contrato", kind: "lookup", lookup: { api: "/api/tipo_contratos?prestacaoContas=S", labelField: "nome" } },
    { name: "modalidadeId", label: "Modalidade", kind: "lookup", lookup: { api: "/api/modalidades", labelField: "nome" } },
  ] satisfies ListFilter[],
};
