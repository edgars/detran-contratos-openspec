import { EntityList } from "@/components/crud/entity-list";
import { fases } from "@/lib/entities/fases";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function FasesPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("cadastros", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "cadastros", "criar")}
      title={fases.title}
      api={fases.api}
      basePath={fases.basePath}
      columns={fases.columns}
    />
  );
}
