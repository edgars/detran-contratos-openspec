import type { ColumnDef, FieldDef, ListFilter } from "@/components/crud/types";

/**
 * Tela de Contratos (017-contratos). Configuração usada pela lista, pelo formulário do contrato
 * e pelo formulário de aditivo. A ordem dos campos é a de design.md › Context.
 */

/** Lookup do gestor/suplente: grava `idPessoaFisica` (identificador legado) como texto; ver design.md › Open Questions. */
const pessoaFisicaLookup = { api: "/api/pessoas_fisicas", labelField: "deNome", valueField: "idPessoaFisica" };

export const contratos = {
  title: "Contratos",
  api: "/api/contratos",
  basePath: "/contratos",
  columns: [
    { key: "numeroContrato", label: "Nº do contrato" },
    { key: "numeroProcesso", label: "Nº do processo" },
    { key: "objeto", label: "Objeto" },
    { key: "departamento", label: "Unidade gestora", path: "departamento.deDepartamento" },
    { key: "prestadorServico", label: "Fornecedor", path: "prestadorServico.deRazaoSocial" },
    { key: "dataTermino", label: "Data de vencimento", format: "date" },
    { key: "valorTotal", label: "Valor total", format: "currency" },
    { key: "situacaoContratual", label: "Situação contratual", path: "situacaoContratual.descricao" },
  ] satisfies ColumnDef[],
  /** Filtros da lista (design.md › Filtros da lista): parâmetros de `GET /api/contratos`, nunca colunas. */
  filters: [
    { name: "departamentoId", label: "Unidade gestora", kind: "lookup", lookup: { api: "/api/departamentos", labelField: "deDepartamento" } },
    { name: "prestadorServicoId", label: "Fornecedor", kind: "lookup", lookup: { api: "/api/prestadores_servicos", labelField: "deRazaoSocial" } },
    { name: "gestor", label: "Gestor ou suplente", kind: "lookup", lookup: pessoaFisicaLookup },
    { name: "situacaoContratualId", label: "Situação contratual", kind: "lookup", lookup: { api: "/api/situacao_contratual", labelField: "descricao" } },
    { name: "vencendoEm", label: "Vencendo em (dias)", kind: "number" },
    {
      name: "sort",
      label: "Ordenar por",
      kind: "select",
      options: [
        { value: "dataTermino:asc", label: "Vencimento (mais próximo)" },
        { value: "dataTermino:desc", label: "Vencimento (mais distante)" },
        { value: "numeroContrato:asc", label: "Nº do contrato (A-Z)" },
        { value: "numeroContrato:desc", label: "Nº do contrato (Z-A)" },
        { value: "valorTotal:asc", label: "Valor total (menor)" },
        { value: "valorTotal:desc", label: "Valor total (maior)" },
      ],
    },
  ] satisfies ListFilter[],
  fields: [
    { name: "numeroProcesso", label: "Nº do processo", kind: "text", required: true },
    { name: "numeroContrato", label: "Nº do contrato", kind: "text", required: true },
    { name: "tipoContratoId", label: "Tipo de contrato", kind: "lookup", required: true, lookup: { api: "/api/tipo_contratos", labelField: "nome" } },
    { name: "modalidadeId", label: "Modalidade", kind: "lookup", lookup: { api: "/api/modalidades", labelField: "nome" } },
    { name: "numeroModalidade", label: "Nº da modalidade", kind: "text" },
    { name: "objeto", label: "Objeto", kind: "textarea", required: true },
    { name: "departamentoId", label: "Unidade gestora", kind: "lookup", required: true, lookup: { api: "/api/departamentos", labelField: "deDepartamento" } },
    { name: "prestadorServicoId", label: "Fornecedor", kind: "lookup", required: true, lookup: { api: "/api/prestadores_servicos", labelField: "deRazaoSocial" } },
    { name: "pessoaFisicaId", label: "Gestor", kind: "lookup", lookup: pessoaFisicaLookup },
    { name: "suplenteId", label: "Gestor suplente", kind: "lookup", lookup: pessoaFisicaLookup },
    { name: "dataInicio", label: "Data de início", kind: "date", required: true },
    { name: "dataTermino", label: "Data de vencimento", kind: "date", required: true },
    { name: "valorMensal", label: "Valor mensal", kind: "money" },
    { name: "valorTotal", label: "Valor total", kind: "money" },
    { name: "situacaoContratualId", label: "Situação contratual", kind: "lookup", lookup: { api: "/api/situacao_contratual", labelField: "descricao" } },
    { name: "projetoBasico", label: "Projeto básico", kind: "textarea" },
    { name: "anexo", label: "Contrato (PDF)", kind: "file" },
    { name: "anexoPublicacao", label: "Publicação (PDF)", kind: "file", description: "Gravado em anexos de publicação." },
    { name: "anexoFiscal", label: "Relatório fiscal (PDF)", kind: "file", description: "Gravado em anexos de fiscalização." },
  ] satisfies FieldDef[],
  /** Formulário de aditivo: o operador informa vigência e valores; o resto vem do contrato original. */
  aditivoFields: [
    { name: "dataInicio", label: "Data de início", kind: "date", required: true },
    { name: "dataTermino", label: "Data de vencimento", kind: "date", required: true },
    { name: "valorMensal", label: "Valor mensal", kind: "money" },
    { name: "valorTotal", label: "Valor total", kind: "money" },
  ] satisfies FieldDef[],
};
