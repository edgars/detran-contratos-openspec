import { EntityForm } from "@/components/crud/entity-form";
import { contratoStatus } from "@/lib/entities/contrato_status";

export default function NovoContratoStatusPage() {
  return <EntityForm title="Novo status do contrato" api={contratoStatus.api} basePath={contratoStatus.basePath} fields={contratoStatus.fields} />;
}
