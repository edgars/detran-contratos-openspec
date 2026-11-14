import { EntityForm } from "@/components/crud/entity-form";
import { anexosFiscais } from "@/lib/entities/anexos_fiscais";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoAnexoFiscalPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("anexos_fiscais", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "anexos_fiscais", "anexar")}
      title="Novo anexo de fiscalização"
      api={anexosFiscais.api}
      basePath={anexosFiscais.basePath}
      fields={anexosFiscais.fields}
    />
  );
}
