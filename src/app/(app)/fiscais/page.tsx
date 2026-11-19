import { EntityList } from "@/components/crud/entity-list";
import { fiscais } from "@/lib/entities/fiscais";

export default function FiscaisPage() {
  return (
    <EntityList
      title={fiscais.title}
      api={fiscais.api}
      basePath={fiscais.basePath}
      columns={fiscais.columns}
      filters={fiscais.filters}
      searchPlaceholder="Buscar por CPF"
    />
  );
}
