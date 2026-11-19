import { EntityForm } from "@/components/crud/entity-form";
import { pagamentos } from "@/lib/entities/pagamentos";

export default async function EditarPagamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar pagamento" api={pagamentos.api} basePath={pagamentos.basePath} fields={pagamentos.fields} id={id} />;
}
