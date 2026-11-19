import { EntityForm } from "@/components/crud/entity-form";
import { tipoContratos } from "@/lib/entities/tipo_contratos";

export default async function EditarTipoContratosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar tipo de contrato" api={tipoContratos.api} basePath={tipoContratos.basePath} fields={tipoContratos.fields} id={id} />;
}
