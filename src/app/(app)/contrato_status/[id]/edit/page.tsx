import { EntityForm } from "@/components/crud/entity-form";
import { contratoStatus } from "@/lib/entities/contrato_status";

export default async function EditarContratoStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntityForm title="Editar status do contrato" api={contratoStatus.api} basePath={contratoStatus.basePath} fields={contratoStatus.fields} id={id} />
  );
}
