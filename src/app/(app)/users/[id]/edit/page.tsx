import { EntityForm } from "@/components/crud/entity-form";
import { users } from "@/lib/entities/users";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

/** Edição só de `username` (os campos de senha são createOnly). */
export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("users", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "users", "editar")}
      canDelete={can(user, "users", "excluir")}
      canAttach={can(user, "users", "anexar")}
      title="Editar usuário"
      api={users.api}
      basePath={users.basePath}
      fields={users.fields}
      id={id}
    />
  );
}
