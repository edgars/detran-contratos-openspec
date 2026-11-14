import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Tipos de contrato (003-tipo-contratos). Configuração usada pela lista e pelo formulário. */
export const tipoContratos = {
  title: "Tipos de contrato",
  api: "/api/tipo_contratos",
  basePath: "/tipo_contratos",
  columns: [
    { key: "nome", label: "Nome" },
    { key: "gerenciamento", label: "Gerenciamento", format: "boolean" },
  ] satisfies ColumnDef[],
  fields: [
    // Obrigatório por RK-82de63b47e64 (regra transversal; ver design.md › Decisions).
    { name: "nome", label: "Nome", kind: "text", required: true },
    { name: "gerenciamento", label: "Gerenciamento", kind: "toggle", required: true, toggleValues: ["S", "N"] },
    // 021-prestacao-contas-fluxo: define quais tipos entram na lista de prestação de contas.
    {
      name: "prestacaoContas",
      label: "Sujeito à prestação de contas",
      kind: "toggle",
      toggleValues: ["S", "N"],
      description: "Contratos originais deste tipo, vencidos e acima de R$ 650.000,00, entram em Prestação de contas.",
    },
  ] satisfies FieldDef[],
};
