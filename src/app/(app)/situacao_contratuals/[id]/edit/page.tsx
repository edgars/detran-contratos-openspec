import { EntityForm } from "@/components/crud/entity-form";
import { situacaoContratuals } from "@/lib/entities/situacao_contratuals";

export default async function EditarSituacaoContratualsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar situação contratual" api={situacaoContratuals.api} basePath={situacaoContratuals.basePath} fields={situacaoContratuals.fields} id={id} />;
}
