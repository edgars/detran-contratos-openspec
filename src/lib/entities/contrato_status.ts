import type { ColumnDef, FieldDef, ListFilter } from "@/components/crud/types";

/**
 * Tela de Status do contrato (004-contrato-status). `contratoId` e `statusId` são NOT NULL no
 * modelo e não estão na tela da spec: entram como lookups obrigatórios (design.md §Decisions).
 * `dataInclusao` e `usuarioId` são preenchidos pelo servidor e não aparecem no formulário.
 */
export const contratoStatus = {
  title: "Status do contrato",
  api: "/api/contrato_status",
  basePath: "/contrato_status",
  columns: [
    { key: "descricao", label: "Descrição" },
    { key: "atendido", label: "Atendido", format: "boolean" },
  ] satisfies ColumnDef[],
  filters: [
    { name: "contratoId", label: "Contrato", kind: "lookup", lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
  ] satisfies ListFilter[],
  fields: [
    { name: "descricao", label: "Descrição", kind: "text" },
    { name: "atendido", label: "Atendido", kind: "toggle", toggleValues: [1, 0] },
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
    { name: "statusId", label: "Status", kind: "lookup", required: true, lookup: { api: "/api/status", labelField: "nome" } },
  ] satisfies FieldDef[],
};
