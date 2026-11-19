import type { ColumnDef, FieldDef } from "@/components/crud/types";

/** Tela de Usuários (005-users). Nenhum campo de senha é coluna da lista. */
export const users = {
  title: "Usuários",
  api: "/api/users",
  basePath: "/users",
  columns: [{ key: "username", label: "Usuário" }] satisfies ColumnDef[],
  fields: [
    { name: "username", label: "Usuário", kind: "text", required: true },
    // Senha só na criação (/users/new); vira passwordHash no servidor.
    { name: "password", label: "Senha inicial", kind: "password", required: true, createOnly: true },
    { name: "passwordconfirm", label: "Confirmar senha", kind: "password", required: true, createOnly: true },
  ] satisfies FieldDef[],
};

/** Tela /conta/senha (troca da própria senha). Campos de formulário, nunca colunas. */
export const usersTrocaSenha = {
  title: "Trocar senha",
  api: "/api/conta/senha",
  fields: [
    { name: "passwordold", label: "Senha atual", kind: "password", required: true },
    { name: "passwordnew", label: "Nova senha", kind: "password", required: true },
    { name: "passwordconfirm", label: "Confirmar nova senha", kind: "password", required: true },
  ] satisfies FieldDef[],
};
