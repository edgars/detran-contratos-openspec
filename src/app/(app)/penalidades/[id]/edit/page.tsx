import { EntityForm } from "@/components/crud/entity-form";
import { penalidades } from "@/lib/entities/penalidades";

export default async function EditarPenalidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar penalidade" api={penalidades.api} basePath={penalidades.basePath} fields={penalidades.fields} id={id} />;
}
