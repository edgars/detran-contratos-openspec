import { EntityForm } from "@/components/crud/entity-form";
import { penalidades } from "@/lib/entities/penalidades";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovaPenalidadePage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("penalidades", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "penalidades", "anexar")}
      title="Nova penalidade"
      api={penalidades.api}
      basePath={penalidades.basePath}
      fields={penalidades.fields}
    />
  );
}
