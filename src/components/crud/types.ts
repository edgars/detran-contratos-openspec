/** Definições de tela usadas pelo kit de CRUD (lista e formulário de cada entidade). */

export type ColumnFormat = "text" | "date" | "currency" | "boolean" | "file";

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
};

export type Option = { value: string; label: string };

export type FieldKind =
  | "text"
  | "textarea"
  | "select" // opções fixas
  | "lookup" // opções carregadas de uma API
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
  lookup?: { api: string; labelField: string; valueField?: string };
  mask?: string;
  toggleValues?: [string | number, string | number];
  description?: string;
  /** Só aparece ao criar (ex.: senha inicial). */
  createOnly?: boolean;
  /** Seção do formulário (campos com a mesma seção ficam agrupados, na ordem em que aparecem). */
  section?: string;
  /** Largura no grid do formulário: "full" (linha inteira) ou "half" (metade em telas largas). */
  span?: "full" | "half";
};

export type ListFilter = {
  name: string;
  label: string;
  kind: "select" | "lookup" | "number";
  options?: Option[];
  lookup?: { api: string; labelField: string; valueField?: string };
};
