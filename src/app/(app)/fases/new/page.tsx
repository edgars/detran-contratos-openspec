import { EntityForm } from "@/components/crud/entity-form";
import { fases } from "@/lib/entities/fases";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovaFasePage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("cadastros", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "cadastros", "anexar")}
      title="Nova fase"
      api={fases.api}
      basePath={fases.basePath}
      fields={fases.fields}
    />
  );
}
