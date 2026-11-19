import { EntityList } from "@/components/crud/entity-list";
import { pagamentos } from "@/lib/entities/pagamentos";

export default function PagamentosPage() {
  return <EntityList title={pagamentos.title} api={pagamentos.api} basePath={pagamentos.basePath} columns={pagamentos.columns} />;
}
