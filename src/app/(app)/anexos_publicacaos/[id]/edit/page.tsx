import { EntityForm } from "@/components/crud/entity-form";
import { anexosPublicacaos } from "@/lib/entities/anexos_publicacaos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarAnexoPublicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("anexos_publicacaos", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "anexos_publicacaos", "editar")}
      canDelete={can(user, "anexos_publicacaos", "excluir")}
      canAttach={can(user, "anexos_publicacaos", "anexar")}
      title="Editar anexo de publicação"
      api={anexosPublicacaos.api}
      basePath={anexosPublicacaos.basePath}
      fields={anexosPublicacaos.fields}
      id={id}
    />
  );
}
