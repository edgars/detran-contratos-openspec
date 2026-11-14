import type { ColumnDef, FieldDef, ListFilter, LookupConfig } from "@/components/crud/types";

/**
 * Tela de Contratos (017-contratos). Configuração usada pela lista, pelo formulário do contrato
 * e pelo formulário de aditivo. A ordem dos campos é a de design.md › Context.
 */

/**
 * Busca remota do gestor/suplente (022-pessoas-fornecedores, D6): só pessoas com CPF; grava o CPF
 * com 11 dígitos, como o legado (`PessoaFisica.CPF = Contrato.pessoa_fisica_id`).
 */
export const pessoaFisicaLookup = {
  api: "/api/pessoas_fisicas?comCpf=1",
  labelField: "deNome",
  valueField: "cpf",
  detailField: "cpf",
  detailFormat: "cpf",
} satisfies LookupConfig;

/** Busca remota do fornecedor (022, D3/D6): grava o `id`, mostra razão social e CNPJ. */
export const prestadorServicoLookup = {
  api: "/api/prestadores_servicos",
  labelField: "deRazaoSocial",
  valueField: "id",
  detailField: "cnpj",
  detailFormat: "cnpj",
} satisfies LookupConfig;

export const contratos = {
  title: "Contratos",
  api: "/api/contratos",
  basePath: "/contratos",
  columns: [
    { key: "numeroContrato", label: "Nº do contrato", sortable: true },
    { key: "numeroProcesso", label: "Nº do processo", secondary: true },
    { key: "objeto", label: "Objeto" },
    { key: "departamento", label: "Unidade gestora", path: "departamento.deDepartamento", secondary: true },
    { key: "prestadorServico", label: "Fornecedor", path: "prestadorServico.deRazaoSocial" },
    { key: "dataTermino", label: "Data de vencimento", format: "date", sortable: true },
    { key: "valorTotal", label: "Valor total", format: "currency", align: "right", sortable: true },
    { key: "situacaoContratual", label: "Situação contratual", path: "situacaoContratual.descricao" },
  ] satisfies ColumnDef[],
  /** Filtros da lista (design.md › Filtros da lista): parâmetros de `GET /api/contratos`, nunca colunas. */
  filters: [
    { name: "departamentoId", label: "Unidade gestora", kind: "lookup", lookup: { api: "/api/departamentos", labelField: "deDepartamento" } },
    { name: "prestadorServicoId", label: "Fornecedor", kind: "search", lookup: prestadorServicoLookup },
    { name: "gestor", label: "Gestor ou suplente", kind: "search", lookup: pessoaFisicaLookup },
    { name: "situacaoContratualId", label: "Situação contratual", kind: "lookup", lookup: { api: "/api/situacao_contratual", labelField: "descricao" } },
    { name: "vencendoEm", label: "Vencendo em (dias)", kind: "number" },
  ] satisfies ListFilter[],
  fields: [
    { name: "numeroProcesso", label: "Nº do processo", kind: "text", required: true, maxLength: 45, section: "Identificação" },
    { name: "numeroContrato", label: "Nº do contrato", kind: "text", required: true, maxLength: 45, section: "Identificação" },
    { name: "tipoContratoId", label: "Tipo de contrato", kind: "lookup", required: true, lookup: { api: "/api/tipo_contratos", labelField: "nome" }, section: "Identificação", span: "full" },
    { name: "modalidadeId", label: "Modalidade", kind: "lookup", lookup: { api: "/api/modalidades", labelField: "nome" }, section: "Identificação" },
    { name: "numeroModalidade", label: "Nº da modalidade", kind: "text", maxLength: 12, section: "Identificação" },
    { name: "objeto", label: "Objeto", kind: "textarea", required: true, maxLength: 200, section: "Identificação" },
    { name: "departamentoId", label: "Unidade gestora", kind: "lookup", required: true, lookup: { api: "/api/departamentos", labelField: "deDepartamento" }, section: "Partes e responsáveis" },
    { name: "prestadorServicoId", label: "Fornecedor", kind: "search", required: true, lookup: prestadorServicoLookup, section: "Partes e responsáveis" },
    { name: "pessoaFisicaId", label: "Gestor", kind: "search", lookup: pessoaFisicaLookup, section: "Partes e responsáveis" },
    { name: "suplenteId", label: "Gestor suplente", kind: "search", lookup: pessoaFisicaLookup, section: "Partes e responsáveis" },
    // 020 (docs/legado/contratos-complementos.md): inteiro de 0 a 999 e o BOOLEAN na_presidencia (1/0).
    { name: "numeroFiscais", label: "Número de fiscais", kind: "masked", mask: "###", section: "Partes e responsáveis" },
    { name: "naPresidencia", label: "Localizado na Presidência", kind: "toggle", toggleValues: [1, 0], section: "Partes e responsáveis" },
    { name: "dataInicio", label: "Data de início", kind: "date", required: true, section: "Vigência e valores" },
    { name: "dataTermino", label: "Data de vencimento", kind: "date", required: true, section: "Vigência e valores" },
    { name: "valorMensal", label: "Valor mensal", kind: "money", section: "Vigência e valores" },
    { name: "valorTotal", label: "Valor total", kind: "money", section: "Vigência e valores" },
    { name: "situacaoContratualId", label: "Situação contratual", kind: "lookup", lookup: { api: "/api/situacao_contratual", labelField: "descricao" }, section: "Vigência e valores" },
    // 020: "Projeto Básico (.pdf)" do legado, gravado por savePdf().
    { name: "projetoBasico", label: "Projeto básico (PDF)", kind: "file", section: "Documentos" },
    { name: "anexo", label: "Contrato (PDF)", kind: "file", section: "Documentos" },
    { name: "anexoPublicacao", label: "Publicação (PDF)", kind: "file", description: "Gravado em anexos de publicação.", section: "Documentos" },
    { name: "anexoFiscal", label: "Relatório fiscal (PDF)", kind: "file", description: "Gravado em anexos de fiscalização.", section: "Documentos" },
  ] satisfies FieldDef[],
  /** Formulário de aditivo: o operador informa vigência e valores; o resto vem do contrato original. */
  aditivoFields: [
    { name: "dataInicio", label: "Data de início", kind: "date", required: true, section: "Vigência" },
    { name: "dataTermino", label: "Data de vencimento", kind: "date", required: true, section: "Vigência" },
    { name: "valorMensal", label: "Valor mensal", kind: "money", section: "Valores" },
    { name: "valorTotal", label: "Valor total", kind: "money", section: "Valores" },
  ] satisfies FieldDef[],
};
