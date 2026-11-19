import { EntityList } from "@/components/crud/entity-list";
import { anexosPublicacaos } from "@/lib/entities/anexos_publicacaos";

export default function AnexosPublicacaosPage() {
  return (
    <EntityList title={anexosPublicacaos.title} api={anexosPublicacaos.api} basePath={anexosPublicacaos.basePath} columns={anexosPublicacaos.columns} />
  );
}
