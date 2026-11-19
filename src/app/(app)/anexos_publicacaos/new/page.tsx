import { EntityForm } from "@/components/crud/entity-form";
import { anexosPublicacaos } from "@/lib/entities/anexos_publicacaos";

export default function NovoAnexoPublicacaoPage() {
  return (
    <EntityForm title="Novo anexo de publicação" api={anexosPublicacaos.api} basePath={anexosPublicacaos.basePath} fields={anexosPublicacaos.fields} />
  );
}
