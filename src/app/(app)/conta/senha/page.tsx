import { EntityForm } from "@/components/crud/entity-form";
import { usersTrocaSenha } from "@/lib/entities/users";

/** Troca da própria senha (005-users). Ligada ao menu do usuário (Trocar senha). */
export default function TrocarSenhaPage() {
  return (
    <EntityForm
      title={usersTrocaSenha.title}
      api={usersTrocaSenha.api}
      basePath="/"
      afterSavePath="/"
      fields={usersTrocaSenha.fields}
      canDelete={false}
      submitLabel="Trocar senha"
    />
  );
}
