"use client";

import { BrandLogo, BrandMark } from "@/components/brand/logo";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Banknote,
  Building2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  FileText,
  Gavel,
  History,
  Layers,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  Paperclip,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { navByGroup, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Um ícone por entidade (chave: `NavItem.name`). */
const ICONS: Record<string, LucideIcon> = {
  Contratos: FileText,
  Pagamentos: Banknote,
  Fiscais: ShieldCheck,
  Penalidades: Gavel,
  PrestacaoContas: ClipboardCheck,
  ContratoStatus: Activity,
  Historicos: History,
  AnexosFiscais: Paperclip,
  AnexosPublicacaos: Newspaper,
  Departamentos: Building2,
  TipoContratos: Tags,
  Modalidades: ListChecks,
  SituacaoContratuals: CircleDot,
  Fases: Layers,
  Status: Workflow,
  Users: Users,
};

/** Grupos que o usuário pode recolher (os de uso eventual). */
const COLLAPSIBLE: readonly NavGroup[] = ["cadastros", "administracao"];

/** Estado ativo com o acento de marca, igual para todos os itens. */
const itemClass =
  "text-sidebar-foreground/85 data-active:bg-sidebar-primary/10 data-active:text-sidebar-primary data-active:font-medium dark:data-active:bg-sidebar-primary/15 [&_svg]:text-sidebar-foreground/60 data-active:[&_svg]:text-sidebar-primary";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegação principal, agrupada por área de trabalho. */
export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const groups = navByGroup();
  const [closed, setClosed] = useState<Partial<Record<NavGroup, boolean>>>({});

  // No celular o menu é uma gaveta: fecha ao escolher um destino.
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border py-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="DETRAN-RJ · Gestão de contratos"
              className="h-10 hover:bg-sidebar-accent/70 group-data-[collapsible=icon]:size-8!"
              render={<Link href="/" onClick={onNavigate} aria-label="DETRAN-RJ, Gestão de contratos: início" />}
            >
              {/* Menu recolhido: só o símbolo "D"; aberto: logo completa + nome do sistema. */}
              <BrandMark className="hidden size-5! shrink-0 group-data-[collapsible=icon]:block" title="" />
              <span className="flex min-w-0 flex-1 items-center gap-2.5 group-data-[collapsible=icon]:hidden">
                <BrandLogo className="h-6! w-[125px]! shrink-0" title="" />
                <span className="truncate border-l border-sidebar-border pl-2.5 text-xs leading-tight text-sidebar-foreground/70">
                  Gestão de
                  <br />
                  contratos
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Início"
                  isActive={isActive(pathname, "/")}
                  className={itemClass}
                  render={<Link href="/" onClick={onNavigate} aria-current={pathname === "/" ? "page" : undefined} />}
                >
                  <LayoutDashboard aria-hidden />
                  <span>Início</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {groups.map((group) => {
          const collapsible = COLLAPSIBLE.includes(group.id);
          const hasActive = group.items.some((item) => isActive(pathname, item.href));
          // O grupo com a página atual nunca fica recolhido.
          const open = !collapsible || hasActive || !closed[group.id];
          const contentId = `nav-group-${group.id}`;
          return (
            <SidebarGroup key={group.id}>
              {collapsible ? (
                <SidebarGroupLabel
                  render={
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={contentId}
                      disabled={hasActive}
                      onClick={() => setClosed((prev) => ({ ...prev, [group.id]: open }))}
                    />
                  }
                  className="w-full gap-1 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground disabled:hover:bg-transparent disabled:hover:text-sidebar-foreground/70"
                >
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronRight
                    aria-hidden
                    className={cn("size-3.5! transition-transform duration-150", open && "rotate-90", hasActive && "opacity-0")}
                  />
                </SidebarGroupLabel>
              ) : (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent
                id={contentId}
                className={cn(!open && "hidden group-data-[collapsible=icon]:block")}
              >
                <SidebarMenu className="gap-px">
                  {group.items.map((item) => {
                    const Icon = ICONS[item.name] ?? FileText;
                    const active = isActive(pathname, item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          tooltip={item.label}
                          isActive={active}
                          className={itemClass}
                          render={
                            <Link
                              href={item.href}
                              data-entity={item.name}
                              onClick={onNavigate}
                              aria-current={active ? "page" : undefined}
                            />
                          }
                        >
                          <Icon aria-hidden />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarRail aria-label="Recolher ou expandir o menu" title="Recolher ou expandir o menu" />
    </Sidebar>
  );
}
