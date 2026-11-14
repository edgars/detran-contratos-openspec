import { EntityForm } from "@/components/crud/entity-form";
import { tipoContratos } from "@/lib/entities/tipo_contratos";

export default function NovoTipoContratosPage() {
  return <EntityForm title="Novo tipo de contrato" api={tipoContratos.api} basePath={tipoContratos.basePath} fields={tipoContratos.fields} />;
}
