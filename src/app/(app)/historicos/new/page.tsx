import { EntityForm } from "@/components/crud/entity-form";
import { historicos } from "@/lib/entities/historicos";

export default function NovoHistoricoPage() {
  return <EntityForm title="Novo histórico" api={historicos.api} basePath={historicos.basePath} fields={historicos.fields} />;
}
