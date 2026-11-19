import { EntityList } from "@/components/crud/entity-list";
import { historicos } from "@/lib/entities/historicos";

export default function HistoricosPage() {
  return (
    <EntityList
      title={historicos.title}
      api={historicos.api}
      basePath={historicos.basePath}
      columns={historicos.columns}
      filters={historicos.filters}
      searchPlaceholder="Buscar por contrato ou descrição"
    />
  );
}
