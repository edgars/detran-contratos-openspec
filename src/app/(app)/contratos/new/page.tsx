import { EntityForm } from "@/components/crud/entity-form";
import { contratos } from "@/lib/entities/contratos";

export default function NovoContratoPage() {
  return <EntityForm title="Novo contrato" api={contratos.api} basePath={contratos.basePath} fields={contratos.fields} />;
}
