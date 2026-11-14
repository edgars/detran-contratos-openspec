import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Tipos de contrato (003-tipo-contratos). Configuração usada pela lista e pelo formulário. */
export const tipoContratos = {
  title: "Tipos de contrato",
  api: "/api/tipo_contratos",
  basePath: "/tipo_contratos",
  columns: [
    { key: "nome", label: "Nome" },
    { key: "gerenciamento", label: "Gerenciamento", format: "boolean" },
    // 019-relatorios: marcações usadas pelos relatórios (Sim/Não).
    { key: "contratoPrincipal", label: "Contrato", format: "boolean" },
    { key: "indicativoMetaRisco", label: "Risco da meta", format: "boolean" },
  ] satisfies ColumnDef[],
  fields: [
    // Obrigatório por RK-82de63b47e64 (regra transversal; ver design.md › Decisions).
    { name: "nome", label: "Nome", kind: "text", required: true },
    { name: "gerenciamento", label: "Gerenciamento", kind: "toggle", required: true, toggleValues: ["S", "N"] },
    // 019-relatorios: no lugar do id fixo `Contrato::tipoContratoId` do legado.
    {
      name: "contratoPrincipal",
      label: "É o tipo Contrato (relatórios)",
      kind: "toggle",
      toggleValues: ["S", "N"],
      description: "Contratos deste tipo entram em Cadastro incompleto e em Acompanhamento de meta.",
    },
    // 019-relatorios: `indicativo_meta_risco` do legado.
    {
      name: "indicativoMetaRisco",
      label: "Entra no risco da meta",
      kind: "toggle",
      toggleValues: ["S", "N"],
      description: "Contratos deste tipo que vencem em até 180 dias entram em Em prorrogação/risco, no Acompanhamento de meta.",
    },
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
