import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Fases (009-fases). Configuração usada pela lista e pelo formulário. */
export const fases = {
  title: "Fases",
  api: "/api/fases",
  basePath: "/fases",
  columns: [
    { key: "nome", label: "Nome" },
    { key: "periodo", label: "Período" },
  ] satisfies ColumnDef[],
  fields: [
    { name: "nome", label: "Nome", kind: "text", required: true },
    { name: "periodo", label: "Período", kind: "text", required: true },
  ] satisfies FieldDef[],
};
