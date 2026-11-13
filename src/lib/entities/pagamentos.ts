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
    { key: "numeroProcesso", label: "Nº do processo" },
    { key: "ano", label: "Ano" },
    { key: "notaFiscal", label: "Nota fiscal" },
    { key: "empenho", label: "Empenho", secondary: true },
    { key: "notaLiquidacao", label: "Nota de liquidação", secondary: true },
  ] satisfies ColumnDef[],
  fields: [
    // contratoId e competencia são NOT NULL no modelo e não estão no formulário da spec (design.md §Decisions).
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" }, section: "Contrato e competência", span: "full" },
    { name: "competencia", label: "Competência", kind: "date", required: true, section: "Contrato e competência" },
    { name: "numeroProcesso", label: "Nº do processo", kind: "text", required: true, section: "Contrato e competência" },
    { name: "ano", label: "Ano", kind: "text", section: "Contrato e competência" },
    { name: "notaFiscal", label: "Nota fiscal", kind: "text", section: "Documentos fiscais" },
    { name: "empenho", label: "Empenho", kind: "text", section: "Documentos fiscais" },
    { name: "notaLiquidacao", label: "Nota de liquidação", kind: "text", section: "Documentos fiscais" },
    { name: "ordemBancaria", label: "Ordem bancária", kind: "text", section: "Documentos fiscais" },
    { name: "valor", label: "Valor", kind: "money", section: "Valores" },
    { name: "valorGlosa", label: "Valor da glosa", kind: "money", section: "Valores" },
    { name: "mes", label: "Mês", kind: "select", options: MESES, section: "Contrato e competência" },
    { name: "glosa", label: "Glosa", kind: "select", options: GLOSA_OPCOES, section: "Valores" },
  ] satisfies FieldDef[],
};
