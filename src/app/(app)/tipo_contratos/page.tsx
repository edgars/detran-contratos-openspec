import { EntityList } from "@/components/crud/entity-list";
import { tipoContratos } from "@/lib/entities/tipo_contratos";

export default function TipoContratosPage() {
  return <EntityList title={tipoContratos.title} api={tipoContratos.api} basePath={tipoContratos.basePath} columns={tipoContratos.columns} />;
}
