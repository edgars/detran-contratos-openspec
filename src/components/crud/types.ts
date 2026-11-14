/** Definições de tela usadas pelo kit de CRUD (lista e formulário de cada entidade). */

/** `cpf`/`cnpj`: documento gravado só com dígitos, exibido com máscara (022-pessoas-fornecedores). */
export type ColumnFormat = "text" | "date" | "currency" | "boolean" | "file" | "cpf" | "cnpj";

export type ColumnDef = {
  key: string;
  label: string;
  format?: ColumnFormat;
  /** Caminho em objeto incluído, ex.: "diretoria.deDiretoria". */
  path?: string;
  /** Alinhamento; números e valores à direita. */
  align?: "left" | "right";
  /** Coluna secundária: some em telas estreitas. */
  secondary?: boolean;
  /**
   * Cabeçalho clicável que ordena a lista por `key` (`sort=<key>:asc|desc`). Só para colunas
   * cujo campo está em `sortFields` da entidade no servidor (024-kit-robustez).
   */
  sortable?: boolean;
};

export type Option = { value: string; label: string };

/**
 * Lookup de uma API de referência. Configuração declarativa (sem função): as configs de
 * `src/lib/entities/*.ts` passam de server components para client components.
 */
export type LookupConfig = {
  /** Rota da lista, com parâmetros fixos (ex.: `/api/pessoas_fisicas?comCpf=1`). */
  api: string;
  labelField: string;
  /** Coluna gravada (padrão `id`); na busca remota, também o filtro exato que resolve o rótulo. */
  valueField?: string;
  /** Busca remota: coluna exibida depois do nome ("Nome — 529.982.247-25"). */
  detailField?: string;
  /** Busca remota: máscara do `detailField`. */
  detailFormat?: "cpf" | "cnpj";
};

export type FieldKind =
  | "text"
  | "textarea"
  | "select" // opções fixas
  | "lookup" // opções carregadas de uma API (tabelas pequenas)
  | "search" // busca remota na API enquanto digita (tabelas grandes; 022-pessoas-fornecedores)
  | "toggle" // grava "S"/"N" (ou 1/0 com toggleValues)
  | "date" // dd/MM/yyyy
  | "money" // R$ 1.234,56
  | "masked" // máscara # e A
  | "file" // PDF enviado em multipart
  | "password"
  | "readonly";

export type FieldDef = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: Option[];
  lookup?: LookupConfig;
  mask?: string;
  toggleValues?: [string | number, string | number];
  description?: string;
  /** Só aparece ao criar (ex.: senha inicial). */
  createOnly?: boolean;
  /** Seção do formulário (campos com a mesma seção ficam agrupados, na ordem em que aparecem). */
  section?: string;
  /** Largura no grid do formulário: "full" (linha inteira) ou "half" (metade em telas largas). */
  span?: "full" | "half";
  /** Limite de caracteres (text/textarea/password/masked): aplica `maxLength` e mostra contador perto do limite. */
  maxLength?: number;
};

export type ListFilter = {
  name: string;
  label: string;
  kind: "select" | "lookup" | "search" | "number";
  options?: Option[];
  lookup?: LookupConfig;
};
