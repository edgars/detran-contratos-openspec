import { EntityList } from "@/components/crud/entity-list";
import { contratoStatus } from "@/lib/entities/contrato_status";

export default function ContratoStatusPage() {
  return (
    <EntityList
      title={contratoStatus.title}
      api={contratoStatus.api}
      basePath={contratoStatus.basePath}
      columns={contratoStatus.columns}
      filters={contratoStatus.filters}
    />
  );
}
