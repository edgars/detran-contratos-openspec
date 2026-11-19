import type { ColumnDef, FieldDef, Option } from "@/components/crud/types";
import { PERFIS, PERFIL_LABEL } from "@/lib/auth/permissions";

/** Perfis de acesso (023-perfis-acesso), na ordem do catálogo. */
export const PERFIL_OPTIONS: Option[] = PERFIS.map((p) => ({ value: p, label: PERFIL_LABEL[p] }));

/** Tela de Usuários (005-users; perfis na 023). Nenhum campo de senha é coluna da lista. */
export const users = {
  title: "Usuários",
  api: "/api/users",
  basePath: "/users",
  columns: [
    { key: "username", label: "Usuário" },
    { key: "perfis", label: "Perfis", format: "options", options: PERFIL_OPTIONS },
  ] satisfies ColumnDef[],
  fields: [
    { name: "username", label: "Usuário", kind: "text", required: true },
    // Senha só na criação (/users/new); vira passwordHash no servidor.
    { name: "password", label: "Senha inicial", kind: "password", required: true, createOnly: true },
    { name: "passwordconfirm", label: "Confirmar senha", kind: "password", required: true, createOnly: true },
    {
      name: "perfis",
      label: "Perfis",
      kind: "checkboxes",
      required: true,
      options: PERFIL_OPTIONS,
      span: "full",
      description: "Marque um ou mais. As permissões do usuário são a soma dos perfis marcados.",
    },
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
