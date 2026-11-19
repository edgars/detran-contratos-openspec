import { EntityForm } from "@/components/crud/entity-form";
import { modalidades } from "@/lib/entities/modalidades";

export default function NovoModalidadesPage() {
  return <EntityForm title="Nova modalidade" api={modalidades.api} basePath={modalidades.basePath} fields={modalidades.fields} />;
}
