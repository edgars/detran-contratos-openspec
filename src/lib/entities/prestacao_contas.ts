import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Prestação de contas (008-prestacao-contas). */
export const prestacaoContas = {
  title: "Prestação de contas",
  api: "/api/prestacao_contas",
  basePath: "/prestacao_contas",
  columns: [
    { key: "descricao", label: "Descrição" },
    { key: "atendido", label: "Atendido", format: "boolean" },
  ] satisfies ColumnDef[],
  fields: [
    { name: "descricao", label: "Descrição", kind: "text" },
    { name: "atendido", label: "Atendido", kind: "toggle" },
    // Colunas NOT NULL do modelo ausentes da spec: lookups obrigatórios (design.md §Decisions).
    { name: "faseId", label: "Fase", kind: "lookup", required: true, lookup: { api: "/api/fases", labelField: "nome" } },
    {
      name: "contratoId",
      label: "Contrato",
      kind: "lookup",
      required: true,
      lookup: { api: "/api/contratos", labelField: "numeroContrato" },
    },
  ] satisfies FieldDef[],
};
