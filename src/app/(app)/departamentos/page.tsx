import { EntityList } from "@/components/crud/entity-list";
import { departamentos } from "@/lib/entities/departamentos";

export default function DepartamentosPage() {
  return <EntityList title={departamentos.title} api={departamentos.api} basePath={departamentos.basePath} columns={departamentos.columns} filters={departamentos.filters} />;
}
