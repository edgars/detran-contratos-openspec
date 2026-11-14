import { EntityForm } from "@/components/crud/entity-form";
import { anexosFiscais } from "@/lib/entities/anexos_fiscais";

export default async function EditarAnexoFiscalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar anexo de fiscalização" api={anexosFiscais.api} basePath={anexosFiscais.basePath} fields={anexosFiscais.fields} id={id} />;
}
