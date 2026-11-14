import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Anexos Fiscais (013-anexos-fiscais). Configuração usada pela lista e pelo formulário. */
export const anexosFiscais = {
  title: "Anexos de fiscalização",
  api: "/api/anexos_fiscais",
  basePath: "/anexos_fiscais",
  columns: [{ key: "anexo", label: "Anexo", format: "file" }] satisfies ColumnDef[],
  fields: [
    { name: "anexo", label: "Anexo", kind: "file", required: true, description: "Arquivo PDF." },
    // contratoId é NOT NULL no modelo e não consta do formulário da spec (design.md §Decisions).
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
  ] satisfies FieldDef[],
};
