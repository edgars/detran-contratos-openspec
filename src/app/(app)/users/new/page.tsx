import { EntityForm } from "@/components/crud/entity-form";
import { users } from "@/lib/entities/users";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoUsuarioPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("users", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "users", "anexar")}
      title="Novo usuário"
      api={users.api}
      basePath={users.basePath}
      fields={users.fields}
    />
  );
}
