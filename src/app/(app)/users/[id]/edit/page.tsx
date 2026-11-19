import { EntityForm } from "@/components/crud/entity-form";
import { users } from "@/lib/entities/users";

/** Edição só de `username` (os campos de senha são createOnly). */
export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityForm title="Editar usuário" api={users.api} basePath={users.basePath} fields={users.fields} id={id} />;
}
