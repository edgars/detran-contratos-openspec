import { EntityList } from "@/components/crud/entity-list";
import { status } from "@/lib/entities/status";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function StatusPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("cadastros", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "cadastros", "criar")}
      title={status.title}
      api={status.api}
      basePath={status.basePath}
      columns={status.columns}
    />
  );
}
