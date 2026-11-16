import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, KeyRound } from "lucide-react";
import { EntityForm } from "@/components/crud/entity-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { usersDefinirSenha } from "@/lib/entities/users";

export const dynamic = "force-dynamic";

/**
 * Definir senha e ativar (025-migracao-legado › users): o Administrador informa a senha de outro
 * usuário, em geral um usuário carregado do legado (inativo, sem senha conhecida). Ao salvar, o
 * servidor grava só o hash e ativa o usuário.
 */
export default async function DefinirSenhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await guardPage("users", "editar");
  if (!user) return <SemPermissao />;
  const alvo = /^\d+$/.test(id)
    ? await prisma.user.findUnique({ where: { id: Number(id) }, select: { id: true, username: true, inativo: true, senhaRedefinir: true } })
    : null;
  if (!alvo) notFound();
  const voltar = `/users/${alvo.id}/edit`;
  const semSenha = alvo.senhaRedefinir;
  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        href={voltar}
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Voltar ao usuário {alvo.username}
      </Link>
      <Alert className="max-w-3xl">
        <KeyRound aria-hidden />
        <AlertTitle>{semSenha ? "Usuário sem senha: veio do sistema antigo" : alvo.inativo ? "Usuário inativo" : "A senha atual deixará de valer"}</AlertTitle>
        <AlertDescription>
          {semSenha
            ? "A senha do sistema antigo não foi migrada. Este usuário só consegue entrar depois que você definir uma senha aqui; ao salvar, ele fica ativo."
            : alvo.inativo
              ? "Ao salvar, a senha passa a ser a informada aqui e o usuário volta a ficar ativo."
              : "Ao salvar, o usuário passa a entrar com a senha informada aqui. Combine a entrega da senha com ele."}
        </AlertDescription>
      </Alert>
      <EntityForm
        title={`Definir senha de ${alvo.username}`}
        api={`/api/users/${alvo.id}/senha`}
        basePath={voltar}
        afterSavePath="/users"
        fields={usersDefinirSenha.fields}
        canDelete={false}
        submitLabel="Definir senha e ativar"
      />
    </div>
  );
}
