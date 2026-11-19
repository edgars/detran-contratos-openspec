import { EntityForm } from "@/components/crud/entity-form";
import type { FieldDef } from "@/components/crud/types";
import { usersTrocaSenha } from "@/lib/entities/users";

/** Orientação curta por campo (a regra é validada pela API: senha atual confere e nova = confirmação). */
const AJUDA: Record<string, string> = {
  passwordold: "A senha que você usa hoje para entrar no sistema.",
  passwordnew: "A senha que passará a valer no próximo acesso.",
  passwordconfirm: "Digite a nova senha outra vez, exatamente igual.",
};

const fields: FieldDef[] = usersTrocaSenha.fields.map((f) => ({ ...f, description: AJUDA[f.name] }));

/** Troca da própria senha (005-users). Ligada ao menu do usuário (Trocar senha). */
export default function TrocarSenhaPage() {
  return (
    <EntityForm
      title={usersTrocaSenha.title}
      api={usersTrocaSenha.api}
      basePath="/"
      afterSavePath="/"
      fields={fields}
      canDelete={false}
      submitLabel="Trocar senha"
    />
  );
}
