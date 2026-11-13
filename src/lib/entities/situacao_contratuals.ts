import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Situações contratuais (014-situacao-contratuals). Configuração usada pela lista e pelo formulário. */
export const situacaoContratuals = {
  title: "Situações contratuais",
  api: "/api/situacao_contratuals",
  basePath: "/situacao_contratuals",
  columns: [{ key: "descricao", label: "Descrição" }] satisfies ColumnDef[],
  fields: [{ name: "descricao", label: "Descrição", kind: "text" }] satisfies FieldDef[],
};
