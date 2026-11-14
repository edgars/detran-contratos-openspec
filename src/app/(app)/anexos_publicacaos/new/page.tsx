import { EntityForm } from "@/components/crud/entity-form";
import { anexosPublicacaos } from "@/lib/entities/anexos_publicacaos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoAnexoPublicacaoPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("anexos_publicacaos", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "anexos_publicacaos", "anexar")}
      title="Novo anexo de publicação"
      api={anexosPublicacaos.api}
      basePath={anexosPublicacaos.basePath}
      fields={anexosPublicacaos.fields}
    />
  );
}
