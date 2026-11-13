import { EntityForm } from "@/components/crud/entity-form";
import { historicos } from "@/lib/entities/historicos";

export default async function EditarHistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar histórico" api={historicos.api} basePath={historicos.basePath} fields={historicos.fields} id={id} />;
}
