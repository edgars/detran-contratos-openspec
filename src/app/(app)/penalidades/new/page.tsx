import { EntityForm } from "@/components/crud/entity-form";
import { penalidades } from "@/lib/entities/penalidades";

export default function NovaPenalidadePage() {
  return <EntityForm title="Nova penalidade" api={penalidades.api} basePath={penalidades.basePath} fields={penalidades.fields} />;
}
