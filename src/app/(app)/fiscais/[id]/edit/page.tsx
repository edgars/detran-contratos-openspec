import { EntityForm } from "@/components/crud/entity-form";
import { fiscais } from "@/lib/entities/fiscais";

export default async function EditarFiscalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar fiscal" api={fiscais.api} basePath={fiscais.basePath} fields={fiscais.fields} id={id} />;
}
