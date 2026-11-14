import { EntityList } from "@/components/crud/entity-list";
import { penalidades } from "@/lib/entities/penalidades";

export default function PenalidadesPage() {
  return <EntityList title={penalidades.title} api={penalidades.api} basePath={penalidades.basePath} columns={penalidades.columns} />;
}
