/** Definições de tela usadas pelo kit de CRUD (lista e formulário de cada entidade). */

export type ColumnFormat = "text" | "date" | "currency" | "boolean" | "file";

export type ColumnDef = {
  key: string;
  label: string;
  format?: ColumnFormat;
  /** Caminho em objeto incluído, ex.: "diretoria.deDiretoria". */
  path?: string;
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
};

export type ListFilter = {
  name: string;
  label: string;
  kind: "select" | "lookup" | "number";
  options?: Option[];
  lookup?: { api: string; labelField: string; valueField?: string };
};
