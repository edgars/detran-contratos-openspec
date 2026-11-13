import type { ColumnDef, FieldDef, ListFilter } from "@/components/crud/types";
import { MASKS } from "@/lib/mask";

/** Tela de Departamentos (002-departamentos). Configuração usada pela lista e pelo formulário. */
export const departamentos = {
  title: "Departamentos",
  api: "/api/departamentos",
  basePath: "/departamentos",
  columns: [
    // Coluna da lista do design: diretoriaId, exibida pelo rótulo legível da diretoria.
    { key: "diretoriaId", label: "Diretoria", path: "diretoria.deDiretoria" },
    { key: "deDepartamento", label: "Departamento" },
  ] satisfies ColumnDef[],
  filters: [
    { name: "diretoriaId", label: "Diretoria", kind: "lookup", lookup: { api: "/api/diretorias", labelField: "deDiretoria" } },
  ] satisfies ListFilter[],
  // Ordem dos campos de design.md › Context. `id` e `municipioId` ficam somente leitura (ver design.md › Decisions).
  fields: [
    { name: "codigo", label: "Código", kind: "text" },
    {
      name: "diretoriaId",
      label: "Diretoria",
      kind: "lookup",
      required: true,
      lookup: { api: "/api/diretorias", labelField: "deDiretoria" },
    },
    { name: "id", label: "ID", kind: "readonly" },
    { name: "deDepartamento", label: "Departamento", kind: "text", required: true },
    { name: "deLogradouro", label: "Logradouro", kind: "text" },
    { name: "deComplemento", label: "Complemento", kind: "text" },
    { name: "deBairro", label: "Bairro", kind: "text" },
    { name: "deCidade", label: "Cidade", kind: "text" },
    { name: "cep", label: "CEP", kind: "masked", mask: MASKS.cep },
    { name: "municipioId", label: "Município ID", kind: "readonly" },
  ] satisfies FieldDef[],
};
