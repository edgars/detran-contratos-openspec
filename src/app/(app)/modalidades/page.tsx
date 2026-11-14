import { EntityList } from "@/components/crud/entity-list";
import { modalidades } from "@/lib/entities/modalidades";

export default function ModalidadesPage() {
  return <EntityList title={modalidades.title} api={modalidades.api} basePath={modalidades.basePath} columns={modalidades.columns} />;
}
