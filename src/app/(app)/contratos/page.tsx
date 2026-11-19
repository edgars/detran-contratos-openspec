import { EntityList } from "@/components/crud/entity-list";
import { contratos } from "@/lib/entities/contratos";

export default function ContratosPage() {
  return (
    <EntityList
      title={contratos.title}
      api={contratos.api}
      basePath={contratos.basePath}
      columns={contratos.columns}
      filters={contratos.filters}
      searchPlaceholder="Processo, contrato ou objeto"
      rowHref="/contratos/{id}"
    />
  );
}
