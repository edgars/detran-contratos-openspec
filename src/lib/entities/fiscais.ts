import type { ColumnDef, FieldDef, ListFilter } from "@/components/crud/types";
import { pessoaFisicaLookup } from "./contratos";

/** Tela de Fiscais (010-fiscais). Configuração usada pela lista e pelo formulário. */
export const fiscais = {
  title: "Fiscais",
  api: "/api/fiscais",
  basePath: "/fiscais",
  columns: [
    // `contrato` é montado pela API (Fiscal não tem relação Prisma com Contrato).
    { key: "contrato", label: "Contrato", path: "contrato.numeroContrato" },
    // Nome do fiscal vem de pessoas_fisicas pelo CPF, montado pela API (022-pessoas-fornecedores, D10).
    { key: "pessoa", label: "Fiscal", path: "pessoa.deNome" },
    { key: "pessoaFisicaCpf", label: "CPF", format: "cpf" },
    { key: "suplente", label: "Suplente", format: "boolean" },
    { key: "presidente", label: "Presidente", format: "boolean" },
  ] satisfies ColumnDef[],
  /**
   * `busca` do legado é FILTRO da lista por CPF (diretiva do autor), nunca coluna nem campo.
   * O filtro aceita só dígitos; a API compara só os dígitos (CPF gravado sem máscara, 022).
   */
  filters: [{ name: "busca", label: "Busca por CPF", kind: "number" }] satisfies ListFilter[],
  fields: [
    // contratoId é NOT NULL no modelo e não está no formulário da spec (design.md §Decisions).
    { name: "contratoId", label: "Contrato", kind: "lookup", required: true, lookup: { api: "/api/contratos", labelField: "numeroContrato" }, span: "full" },
    // Escolhido entre as pessoas físicas por nome ou CPF; grava o CPF com 11 dígitos (022, D6).
    { name: "pessoaFisicaCpf", label: "Fiscal", kind: "search", lookup: pessoaFisicaLookup, required: true, span: "full" },
    { name: "suplente", label: "Suplente", kind: "toggle", required: true, span: "half" },
    { name: "presidente", label: "Presidente", kind: "toggle", required: true, span: "half" },
  ] satisfies FieldDef[],
};
