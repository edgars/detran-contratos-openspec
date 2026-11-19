import { EntityForm } from "@/components/crud/entity-form";
import { historicos } from "@/lib/entities/historicos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoHistoricoPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("historicos", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "historicos", "anexar")}
      title="Novo histórico"
      api={historicos.api}
      basePath={historicos.basePath}
      fields={historicos.fields}
    />
  );
}
