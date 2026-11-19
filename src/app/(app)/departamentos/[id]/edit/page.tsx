import { EntityForm } from "@/components/crud/entity-form";
import { departamentos } from "@/lib/entities/departamentos";

export default async function EditarDepartamentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar departamento" api={departamentos.api} basePath={departamentos.basePath} fields={departamentos.fields} id={id} />;
}
