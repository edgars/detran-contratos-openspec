import { EntityList } from "@/components/crud/entity-list";
import { fases } from "@/lib/entities/fases";

export default function FasesPage() {
  return <EntityList title={fases.title} api={fases.api} basePath={fases.basePath} columns={fases.columns} />;
}
