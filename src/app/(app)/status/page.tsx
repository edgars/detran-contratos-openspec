import { EntityList } from "@/components/crud/entity-list";
import { status } from "@/lib/entities/status";

export default function StatusPage() {
  return <EntityList title={status.title} api={status.api} basePath={status.basePath} columns={status.columns} />;
}
