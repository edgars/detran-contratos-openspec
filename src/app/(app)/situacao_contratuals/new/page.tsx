import { EntityForm } from "@/components/crud/entity-form";
import { situacaoContratuals } from "@/lib/entities/situacao_contratuals";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoSituacaoContratualsPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("cadastros", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "cadastros", "anexar")}
      title="Nova situação contratual"
      api={situacaoContratuals.api}
      basePath={situacaoContratuals.basePath}
      fields={situacaoContratuals.fields}
    />
  );
}
