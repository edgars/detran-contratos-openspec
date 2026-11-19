import { EntityList } from "@/components/crud/entity-list";
import { anexosFiscais } from "@/lib/entities/anexos_fiscais";

export default function AnexosFiscaisPage() {
  return <EntityList title={anexosFiscais.title} api={anexosFiscais.api} basePath={anexosFiscais.basePath} columns={anexosFiscais.columns} />;
}
