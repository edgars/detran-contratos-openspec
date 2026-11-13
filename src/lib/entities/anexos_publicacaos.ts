import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Anexos de Publicação (015-anexos-publicacaos). Configuração usada pela lista e pelo formulário. */
export const anexosPublicacaos = {
  title: "Anexos de publicação",
  api: "/api/anexos_publicacaos",
  basePath: "/anexos_publicacaos",
  columns: [{ key: "anexo", label: "Anexo", format: "file" }] satisfies ColumnDef[],
  fields: [
    { name: "anexo", label: "Anexo", kind: "file", description: "Arquivo PDF, exigido na inclusão. Na edição, envie só para substituir." },
    // contratoId e dataPublicacao são NOT NULL no modelo e não constam do formulário da spec (design.md §Decisions).
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
    { name: "dataPublicacao", label: "Data de publicação", kind: "date", required: true },
  ] satisfies FieldDef[],
};
