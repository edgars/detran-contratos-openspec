import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { MSG_PAGINA_SEM_PERMISSAO } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

/**
 * Página sem permissão (023-perfis-acesso › "Página sem permissão"): a página não carrega os dados do
 * recurso e mostra só este aviso.
 */
export function SemPermissao() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <Alert>
        <LockKeyhole aria-hidden />
        <AlertTitle>{MSG_PAGINA_SEM_PERMISSAO}</AlertTitle>
        <AlertDescription>Se precisar deste acesso, peça a um Administrador para incluir o perfil adequado no seu usuário.</AlertDescription>
      </Alert>
      <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
        Voltar ao início
      </Link>
    </div>
  );
}
