import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Modalidades (007-modalidades). Configuração usada pela lista e pelo formulário. */
export const modalidades = {
  title: "Modalidades",
  api: "/api/modalidades",
  basePath: "/modalidades",
  columns: [{ key: "nome", label: "Nome" }] satisfies ColumnDef[],
  fields: [{ name: "nome", label: "Nome", kind: "text" }] satisfies FieldDef[],
};
