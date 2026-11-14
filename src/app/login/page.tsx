import { Suspense } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme-toggle";

/** Tela de login: identidade do sistema, formulário centralizado e rodapé institucional. */
export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-end px-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-4">
            <BrandLogo className="h-9 w-auto shrink-0" title="DETRAN-RJ" />
            <p className="border-l pl-4 text-sm leading-tight text-muted-foreground">
              Gestão de
              <br />
              contratos
            </p>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-balance">Entrar no sistema</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use seu usuário e senha de acesso.</p>

          <div className="mt-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
        Departamento de Trânsito do Estado do Rio de Janeiro
      </footer>
    </div>
  );
}
