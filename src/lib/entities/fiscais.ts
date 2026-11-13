import type { ColumnDef, FieldDef, ListFilter } from "@/components/crud/types";
import { MASKS } from "@/lib/mask";

/** Tela de Fiscais (010-fiscais). Configuração usada pela lista e pelo formulário. */
export const fiscais = {
  title: "Fiscais",
  api: "/api/fiscais",
  basePath: "/fiscais",
  columns: [
    // `contrato` é montado pela API (Fiscal não tem relação Prisma com Contrato).
    { key: "contrato", label: "Contrato", path: "contrato.numeroContrato" },
    { key: "pessoaFisicaCpf", label: "Pessoa Física CPF" },
    { key: "suplente", label: "Suplente", format: "boolean" },
    { key: "presidente", label: "Presidente", format: "boolean" },
  ] satisfies ColumnDef[],
  /**
   * `busca` do legado é FILTRO da lista por CPF (diretiva do autor), nunca coluna nem campo.
   * O kit não tem filtro mascarado: o filtro aceita só dígitos e a API aplica `MASKS.cpf`.
   */
  filters: [{ name: "busca", label: "Busca por CPF", kind: "number" }] satisfies ListFilter[],
  fields: [
    // contratoId é NOT NULL no modelo e não está no formulário da spec (design.md §Decisions).
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" } },
    { name: "pessoaFisicaCpf", label: "Pessoa Física CPF", kind: "masked", mask: MASKS.cpf, required: true },
    { name: "suplente", label: "Suplente", kind: "toggle", required: true },
    { name: "presidente", label: "Presidente", kind: "toggle", required: true },
  ] satisfies FieldDef[],
};
