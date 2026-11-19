import { EntityForm } from "@/components/crud/entity-form";
import { status } from "@/lib/entities/status";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoStatusPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("cadastros", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "cadastros", "anexar")}
      title="Novo status"
      api={status.api}
      basePath={status.basePath}
      fields={status.fields}
    />
  );
}
