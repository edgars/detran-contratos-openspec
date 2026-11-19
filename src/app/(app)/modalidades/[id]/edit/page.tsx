import { EntityForm } from "@/components/crud/entity-form";
import { modalidades } from "@/lib/entities/modalidades";

export default async function EditarModalidadesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar modalidade" api={modalidades.api} basePath={modalidades.basePath} fields={modalidades.fields} id={id} />;
}
