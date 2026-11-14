import type { ColumnDef, FieldDef } from "@/components/crud/types";

/**
 * Tela de Status (011-status). `fluxo` e `periodo` são "select" no legado, mas as opções não
 * foram rastreadas: viram campos de texto (período só aceita número inteiro). Ver design.md §Decisions.
 */
export const status = {
  title: "Status",
  api: "/api/status",
  basePath: "/status",
  columns: [
    { key: "nome", label: "Nome" },
    { key: "fluxo", label: "Fluxo" },
    { key: "periodo", label: "Período" },
  ] satisfies ColumnDef[],
  fields: [
    { name: "nome", label: "Nome", kind: "text" },
    { name: "fluxo", label: "Fluxo", kind: "text" },
    { name: "periodo", label: "Período", kind: "text", description: "Número inteiro (opções do legado não rastreadas)." },
  ] satisfies FieldDef[],
};
