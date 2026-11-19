import { EntityForm } from "@/components/crud/entity-form";
import { fiscais } from "@/lib/entities/fiscais";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoFiscalPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("fiscais", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "fiscais", "anexar")}
      title="Novo fiscal"
      api={fiscais.api}
      basePath={fiscais.basePath}
      fields={fiscais.fields}
    />
  );
}
