import { EntityForm } from "@/components/crud/entity-form";
import { departamentos } from "@/lib/entities/departamentos";

export default function NovoDepartamentosPage() {
  return <EntityForm title="Novo departamento" api={departamentos.api} basePath={departamentos.basePath} fields={departamentos.fields} />;
}
