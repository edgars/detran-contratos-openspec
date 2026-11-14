import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/shell/app-breadcrumb";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Área logada: sem sessão válida no banco, volta para o login. */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Lembra se o menu lateral estava recolhido (cookie gravado pelo SidebarProvider).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {/* Perfis lidos do banco nesta requisição (023-perfis-acesso): o menu mostra só o que o usuário pode listar. */}
      <AppSidebar perfis={user.perfis} />
      {/* min-w-0: conteúdo largo (tabelas) rola no próprio contêiner, nunca a página inteira. */}
      <SidebarInset className="min-w-0">
        {/* print:hidden: o cabeçalho do app não sai na impressão (019-relatorios › Conteúdo impresso). */}
        <header className="sticky top-0 z-20 flex h-14 print:hidden shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
          <SidebarTrigger className="-ml-1.5" aria-label="Mostrar ou ocultar o menu" title="Mostrar ou ocultar o menu" />
          <Separator orientation="vertical" className="mr-1 h-5 self-center!" />
          <div className="min-w-0 flex-1">
            <AppBreadcrumb />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <UserMenu username={user.username} />
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col px-4 py-6 md:px-6 md:py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
