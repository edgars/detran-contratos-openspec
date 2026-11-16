import Link from "next/link";
import { KeyRound } from "lucide-react";
import { EntityForm } from "@/components/crud/entity-form";
import { Button } from "@/components/ui/button";
import { users } from "@/lib/entities/users";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

/** Edição só de `username` (os campos de senha são createOnly). */
export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("users", "ver");
  if (!user) return <SemPermissao />;
  const podeEditar = can(user, "users", "editar");
  const form = (
    <EntityForm
      readOnly={!podeEditar}
      canDelete={can(user, "users", "excluir")}
      canAttach={can(user, "users", "anexar")}
      title="Editar usuário"
      api={users.api}
      basePath={users.basePath}
      fields={users.fields}
      id={id}
    />
  );
  if (!podeEditar) return form;
  // 025-migracao-legado: atalho para definir a senha e ativar (usuários vindos do legado entram sem senha).
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/users/${id}/senha`} />}>
        <KeyRound aria-hidden />
        Definir senha
      </Button>
      {form}
    </div>
  );
}
