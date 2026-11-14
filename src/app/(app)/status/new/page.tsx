import { EntityForm } from "@/components/crud/entity-form";
import { status } from "@/lib/entities/status";

export default function NovoStatusPage() {
  return <EntityForm title="Novo status" api={status.api} basePath={status.basePath} fields={status.fields} />;
}
