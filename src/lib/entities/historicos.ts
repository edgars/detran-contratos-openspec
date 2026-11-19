import type { ColumnDef, FieldDef, ListFilter } from "@/components/crud/types";

/**
 * Tela de Históricos (012-historicos). Ordem da spec: descricao, contratoId, id, dataInclusao,
 * usuarioId. `id`, data de inclusão e usuário são somente leitura (preenchidos pelo servidor);
 * os campos read-only exibem os valores derivados que a API devolve (`dataInclusaoTexto`,
 * `usuarioNome`). `descricao` é editável (design.md §Decisions).
 */
export const historicos = {
  title: "Históricos",
  api: "/api/historicos",
  basePath: "/historicos",
  columns: [
    { key: "contratoId", label: "Contrato", path: "contrato.numeroContrato" },
    { key: "dataInclusao", label: "Data de inclusão", format: "date" },
    { key: "usuarioId", label: "Usuário", path: "usuario.username", secondary: true },
  ] satisfies ColumnDef[],
  filters: [
    { name: "contratoId", label: "Contrato", kind: "lookup", lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
  ] satisfies ListFilter[],
  fields: [
    { name: "descricao", label: "Descrição", kind: "textarea", section: "Histórico" },
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" }, section: "Histórico", span: "full" },
    { name: "id", label: "Identificador", kind: "readonly", description: "Gerado ao salvar.", section: "Registro" },
    { name: "dataInclusaoTexto", label: "Data de inclusão", kind: "readonly", description: "Data do servidor na criação.", section: "Registro" },
    { name: "usuarioNome", label: "Usuário", kind: "readonly", description: "Usuário da sessão que incluiu o histórico.", section: "Registro" },
  ] satisfies FieldDef[],
};
