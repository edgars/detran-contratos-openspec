import { EntityList } from "@/components/crud/entity-list";
import { users } from "@/lib/entities/users";

export default function UsersPage() {
  return <EntityList title={users.title} api={users.api} basePath={users.basePath} columns={users.columns} searchPlaceholder="Buscar usuário" />;
}
