import { EntityList } from "@/components/crud/entity-list";
import { departamentos } from "@/lib/entities/departamentos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function DepartamentosPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("cadastros", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "cadastros", "criar")}
      title={departamentos.title}
      api={departamentos.api}
      basePath={departamentos.basePath}
      columns={departamentos.columns}
      filters={departamentos.filters}
    />
  );
}
