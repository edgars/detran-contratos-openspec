import { EntityForm } from "@/components/crud/entity-form";
import { pagamentos } from "@/lib/entities/pagamentos";

export default function NovoPagamentoPage() {
  return <EntityForm title="Novo pagamento" api={pagamentos.api} basePath={pagamentos.basePath} fields={pagamentos.fields} />;
}
