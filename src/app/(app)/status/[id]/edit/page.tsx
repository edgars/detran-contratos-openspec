import { EntityForm } from "@/components/crud/entity-form";
import { status } from "@/lib/entities/status";

export default async function EditarStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar status" api={status.api} basePath={status.basePath} fields={status.fields} id={id} />;
}
