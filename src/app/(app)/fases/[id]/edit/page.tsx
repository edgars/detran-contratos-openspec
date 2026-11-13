import { EntityForm } from "@/components/crud/entity-form";
import { fases } from "@/lib/entities/fases";

export default async function EditarFasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar fase" api={fases.api} basePath={fases.basePath} fields={fases.fields} id={id} />;
}
