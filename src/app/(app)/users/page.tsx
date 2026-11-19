import { EntityList } from "@/components/crud/entity-list";
import { users } from "@/lib/entities/users";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function UsersPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("users", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "users", "criar")}
      title={users.title}
      api={users.api}
      basePath={users.basePath}
      columns={users.columns}
      searchPlaceholder="Buscar usuário"
    />
  );
}
