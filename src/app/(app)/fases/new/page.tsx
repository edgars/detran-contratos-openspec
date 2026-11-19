import { EntityForm } from "@/components/crud/entity-form";
import { fases } from "@/lib/entities/fases";

export default function NovaFasePage() {
  return <EntityForm title="Nova fase" api={fases.api} basePath={fases.basePath} fields={fases.fields} />;
}
