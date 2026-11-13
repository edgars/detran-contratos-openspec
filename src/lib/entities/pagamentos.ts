import type { ColumnDef, FieldDef, Option } from "@/components/crud/types";

/** Opções de `mes` (sem opções rastreadas no legado: decisão registrada em design.md §Decisions). */
export const MESES: Option[] = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
].map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

/** Opções de `glosa` (sem opções rastreadas no legado: decisão registrada em design.md §Decisions). */
export const GLOSA_OPCOES: Option[] = [
  { value: "S", label: "Sim" },
  { value: "N", label: "Não" },
];

/** Tela de Pagamentos (006-pagamentos). Configuração usada pela lista e pelo formulário. */
export const pagamentos = {
  title: "Pagamentos",
  api: "/api/pagamentos",
  basePath: "/pagamentos",
  columns: [
    { key: "numeroProcesso", label: "Número Processo" },
    { key: "ano", label: "Ano" },
    { key: "notaFiscal", label: "Nota Fiscal" },
    { key: "empenho", label: "Empenho" },
    { key: "notaLiquidacao", label: "Nota Liquidação" },
  ] satisfies ColumnDef[],
  fields: [
    // contratoId e competencia são NOT NULL no modelo e não estão no formulário da spec (design.md §Decisions).
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
    { name: "competencia", label: "Competência", kind: "date", required: true },
    { name: "numeroProcesso", label: "Número Processo", kind: "text", required: true },
    { name: "ano", label: "Ano", kind: "text" },
    { name: "notaFiscal", label: "Nota Fiscal", kind: "text" },
    { name: "empenho", label: "Empenho", kind: "text" },
    { name: "notaLiquidacao", label: "Nota Liquidação", kind: "text" },
    { name: "ordemBancaria", label: "Ordem Bancária", kind: "text" },
    { name: "valor", label: "Valor", kind: "money" },
    { name: "valorGlosa", label: "Valor Glosa", kind: "money" },
    { name: "mes", label: "Mês", kind: "select", options: MESES },
    { name: "glosa", label: "Glosa", kind: "select", options: GLOSA_OPCOES },
  ] satisfies FieldDef[],
};
