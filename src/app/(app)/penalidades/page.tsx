import { EntityList } from "@/components/crud/entity-list";
import { penalidades } from "@/lib/entities/penalidades";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function PenalidadesPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("penalidades", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "penalidades", "criar")}
      title={penalidades.title}
      api={penalidades.api}
      basePath={penalidades.basePath}
      columns={penalidades.columns}
    />
  );
}
