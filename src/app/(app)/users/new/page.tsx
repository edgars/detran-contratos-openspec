import { EntityForm } from "@/components/crud/entity-form";
import { users } from "@/lib/entities/users";

export default function NovoUsuarioPage() {
  return <EntityForm title="Novo usuário" api={users.api} basePath={users.basePath} fields={users.fields} />;
}
