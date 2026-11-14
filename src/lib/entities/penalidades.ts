import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Penalidades (016-penalidades). Configuração usada pela lista e pelo formulário. */
export const penalidades = {
  title: "Penalidades",
  api: "/api/penalidades",
  basePath: "/penalidades",
  columns: [{ key: "arquivo", label: "Arquivo", format: "file" }] satisfies ColumnDef[],
  fields: [
    { name: "arquivo", label: "Arquivo", kind: "file", description: "Arquivo PDF, exigido na inclusão. Na edição, envie só para substituir." },
    // contratoId é NOT NULL no modelo e não consta do formulário da spec (design.md §Decisions).
    // userId e dataRegistro vêm do servidor (sessão e relógio), não são campos.
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
  ] satisfies FieldDef[],
};
