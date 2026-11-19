import { EntityForm } from "@/components/crud/entity-form";
import { anexosPublicacaos } from "@/lib/entities/anexos_publicacaos";

export default async function EditarAnexoPublicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntityForm
      title="Editar anexo de publicação"
      api={anexosPublicacaos.api}
      basePath={anexosPublicacaos.basePath}
      fields={anexosPublicacaos.fields}
      id={id}
    />
  );
}
