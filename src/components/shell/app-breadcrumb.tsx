"use client";

import Link from "next/link";
import { Fragment, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

const FIXED: Record<string, string> = {
  new: "Novo",
  edit: "Editar",
  aditivos: "Aditivos",
  // 019-relatorios: um rótulo fixo por relatório.
  "contratos-por-gestor": "Contratos por gestor",
  "contratos-vencendo": "Contratos vencendo",
  "contratos-vencidos": "Contratos vencidos",
  "cadastro-incompleto": "Cadastro incompleto",
  "acompanhamento-meta": "Acompanhamento de meta",
  "acerto-valor": "Acerto de valor",
};

/**
 * Rótulo definido pela página aberta (021): `last` troca o último nível (ex.: "#12" → "Contrato 001/2026");
 * `append` acrescenta um nível sem link (ex.: a aba "Pendentes"). Vale só para o `pathname` informado.
 */
export type CrumbOverride = { pathname: string; last?: string; append?: string };

let currentOverride: CrumbOverride | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const setOverride = (value: CrumbOverride | null) => {
  currentOverride = value;
  listeners.forEach((fn) => fn());
};

/** Componente sem saída visual: a página declara o rótulo da trilha enquanto está montada. */
export function BreadcrumbOverride({ pathname, last, append }: CrumbOverride) {
  useEffect(() => {
    const value = { pathname, last, append };
    setOverride(value);
    return () => {
      if (currentOverride === value) setOverride(null);
    };
  }, [pathname, last, append]);
  return null;
}

/** Trilha da rota atual. Segmentos sem página própria (ex.: "aditivos", "conta") não viram link. */
export function crumbsFor(pathname: string, override?: CrumbOverride | null): Crumb[] {
  const crumbs = baseCrumbs(pathname);
  if (!override || override.pathname !== pathname || crumbs.length === 0) return crumbs;
  if (override.last) crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], label: override.last };
  if (override.append) crumbs.push({ label: override.append });
  return crumbs;
}

function baseCrumbs(pathname: string): Crumb[] {
  if (pathname === "/conta/senha") return [{ label: "Trocar senha" }];
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";
  parts.forEach((part, index) => {
    href += `/${part}`;
    const nav = index === 0 ? NAV_ITEMS.find((item) => item.href === href) : undefined;
    let label: string;
    let linkable = true;
    if (nav) label = nav.label;
    else if (/^\d+$/.test(part)) label = `#${part}`;
    else if (FIXED[part]) {
      label = FIXED[part];
      linkable = part !== "aditivos";
    } else label = decodeURIComponent(part).replace(/[_-]+/g, " ");
    crumbs.push({ label, href: linkable ? href : undefined });
  });
  return crumbs;
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  const override = useSyncExternalStore(subscribe, () => currentOverride, () => null);
  const crumbs = crumbsFor(pathname, override);
  if (crumbs.length === 0) {
    return (
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">Início</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }
  const last = crumbs.length - 1;
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => (
          <Fragment key={`${index}-${crumb.label}`}>
            {/* No celular só os dois últimos níveis aparecem. */}
            {index > 0 && <BreadcrumbSeparator className={index < last ? "hidden sm:inline-flex" : undefined} />}
            <BreadcrumbItem
              className={cn(
                index < last - 1 && "hidden sm:inline-flex",
                index < last ? "shrink-0" : "min-w-0",
              )}
            >
              {index === last ? (
                <BreadcrumbPage className="truncate font-medium tabular-nums">{crumb.label}</BreadcrumbPage>
              ) : !crumb.href ? (
                <span>{crumb.label}</span>
              ) : (
                <BreadcrumbLink className="tabular-nums" render={<Link href={crumb.href} />}>
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
